import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asSystem, asUser, createTestDb, createUser, type TestDb } from "../db/harness";
import { insertRequest, quoteRequest } from "../db/fixtures";
import { checkCronAuth, expireQuotes } from "@/lib/services/jobs";
import { runRetention } from "@/lib/services/retention";
import type { DocumentStorage } from "@/lib/services/documents";
import type { RetentionPolicy } from "@/config/retention";

let t: TestDb;
let staff: { id: string };
let customer: { id: string; customerId: string };
let refCounter = 0;
const ref = () => `QRJ${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[refCounter++ % 26]}${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(refCounter / 26) % 26]}AAA`;

beforeAll(async () => {
  t = await createTestDb();
  staff = await createUser(t.client, "jobs.staff@example.test", "staff");
  customer = await createUser(t.client, "jobs.customer@example.test");
});
afterAll(async () => t?.close());

const status = async (id: string) => (await t.client.query<{ status: string }>("select status from public.quote_requests where id = $1", [id])).rows[0].status;
/** Test-only time travel: sent quotes are immutable, so the guard trigger is paused for this superuser update. */
const expireNow = async (requestId: string) => {
  await t.client.exec("alter table public.quotes disable trigger quotes_rules");
  await t.client.query("update public.quotes set valid_until = now() - interval '1 minute', created_at = now() - interval '2 days' where quote_request_id = $1", [requestId]);
  await t.client.exec("alter table public.quotes enable trigger quotes_rules");
};

describe("cron authentication", () => {
  const secret = "s".repeat(40);
  it("is disabled without a sufficiently long secret", () => {
    expect(checkCronAuth(`Bearer ${secret}`, undefined)).toBe("disabled");
    expect(checkCronAuth("Bearer short", "short")).toBe("disabled");
  });
  it("accepts only the exact bearer token", () => {
    expect(checkCronAuth(`Bearer ${secret}`, secret)).toBe("ok");
    expect(checkCronAuth(`Bearer ${secret}x`, secret)).toBe("unauthorised");
    expect(checkCronAuth(secret, secret)).toBe("unauthorised");
    expect(checkCronAuth(null, secret)).toBe("unauthorised");
  });
});

describe("quote expiry", () => {
  it("expires only QUOTED requests whose quotes are past their validity, idempotently", async () => {
    const due = await insertRequest(t.client, customer.customerId, ref());
    await quoteRequest(t.client, due, staff.id);
    await expireNow(due);
    const stillValid = await insertRequest(t.client, customer.customerId, ref());
    await quoteRequest(t.client, stillValid, staff.id);
    const accepted = await insertRequest(t.client, customer.customerId, ref());
    await quoteRequest(t.client, accepted, staff.id);
    await asUser(t.client, customer.id, "select public.customer_respond_to_quote($1, true)", [accepted], { commit: true });
    await expireNow(accepted);
    const cancelled = await insertRequest(t.client, customer.customerId, ref());
    await quoteRequest(t.client, cancelled, staff.id);
    await asUser(t.client, staff.id, "update public.quote_requests set status = 'CANCELLED', cancellation_reason = 'test' where id = $1", [cancelled], { commit: true });
    await expireNow(cancelled);

    expect(await expireQuotes(t.db)).toEqual({ expired: 1 });
    expect(await status(due)).toBe("EXPIRED");
    expect(await status(stillValid)).toBe("QUOTED");
    expect(await status(accepted)).toBe("ACCEPTED");
    expect(await status(cancelled)).toBe("CANCELLED");
    expect(await expireQuotes(t.db)).toEqual({ expired: 0 });

    const audit = await t.client.query<{ actor: string | null; after: { status: string } }>(
      "select actor, after from public.audit_log where entity = 'quote_requests' and entity_id = $1 and action = 'quote_requests.status_changed' order by id desc limit 1",
      [due],
    );
    expect(audit.rows[0]).toEqual({ actor: null, after: { status: "EXPIRED" } });
  });
});

class FakeStorage implements DocumentStorage {
  removed: string[] = [];
  failing = new Set<string>();
  async upload() {}
  async signedUrl() {
    return "";
  }
  async remove(key: string) {
    if (this.failing.has(key)) throw new Error("storage unavailable");
    this.removed.push(key);
  }
}

describe("retention", () => {
  const unapproved: RetentionPolicy = { approved: false, documentsAfterDays: null, closedQuoteRequestsAfterDays: null };
  const approved: RetentionPolicy = { approved: true, documentsAfterDays: null, closedQuoteRequestsAfterDays: 30 };
  let expiredDoc = "";
  let futureDoc = "";
  let undatedDoc = "";

  beforeAll(async () => {
    const owner = await insertRequest(t.client, customer.customerId, ref());
    const add = async (key: string, retention: string | null) => {
      const [row] = await asSystem<{ id: string }>(
        t.client,
        "insert into public.documents (owner_type, owner_id, customer_id, storage_key, original_name, mime, size_bytes, uploaded_by) values ('quote_request', $1, $2, $3, 'f.pdf', 'application/pdf', 10, $4) returning id",
        [owner, customer.customerId, key, customer.id],
      );
      if (retention) await t.client.query(`update public.documents set retention_until = ${retention} where id = $1`, [row.id]);
      return row.id;
    };
    expiredDoc = await add("ret/expired.pdf", "now() - interval '1 day'");
    futureDoc = await add("ret/future.pdf", "now() + interval '30 days'");
    undatedDoc = await add("ret/undated.pdf", null);
  });

  const exists = async (id: string) => (await t.client.query("select 1 from public.documents where id = $1", [id])).rows.length === 1;

  it("dry-run reports eligible records and deletes nothing; missing dates are never eligible", async () => {
    const storage = new FakeStorage();
    const report = await runRetention(t.db, storage, { policy: unapproved, execute: false, executionEnabled: false });
    expect(report).toMatchObject({ mode: "dry-run", documentsEligible: 1, documentsDeleted: 0 });
    expect(storage.removed).toEqual([]);
    expect(await exists(expiredDoc)).toBe(true);
  });

  it("refuses to delete while the policy is unapproved or execution is disabled", async () => {
    const storage = new FakeStorage();
    expect(await runRetention(t.db, storage, { policy: unapproved, execute: true, executionEnabled: true })).toEqual({ refused: true, reason: "policy_not_approved" });
    expect(await runRetention(t.db, storage, { policy: approved, execute: true, executionEnabled: false })).toEqual({ refused: true, reason: "execution_disabled" });
    expect(storage.removed).toEqual([]);
  });

  it("keeps metadata when the file cannot be removed", async () => {
    const storage = new FakeStorage();
    storage.failing.add("ret/expired.pdf");
    const report = await runRetention(t.db, storage, { policy: approved, execute: true, executionEnabled: true });
    expect(report).toMatchObject({ documentsFailed: 1, documentsDeleted: 0 });
    expect(await exists(expiredDoc)).toBe(true);
  });

  it("deletes only eligible documents, audits the deletion and is idempotent", async () => {
    const storage = new FakeStorage();
    const report = await runRetention(t.db, storage, { policy: approved, execute: true, executionEnabled: true });
    expect(report).toMatchObject({ mode: "execute", documentsEligible: 1, documentsDeleted: 1, documentsFailed: 0 });
    expect(storage.removed).toEqual(["ret/expired.pdf"]);
    expect(await exists(expiredDoc)).toBe(false);
    expect(await exists(futureDoc)).toBe(true);
    expect(await exists(undatedDoc)).toBe(true);
    const audit = await t.client.query("select 1 from public.audit_log where entity = 'documents' and entity_id = $1 and action = 'documents.delete'", [expiredDoc]);
    expect(audit.rows).toHaveLength(1);
    const again = await runRetention(t.db, new FakeStorage(), { policy: approved, execute: true, executionEnabled: true });
    expect(again).toMatchObject({ documentsEligible: 0, documentsDeleted: 0 });
  });
});

describe("authentication attempt limits", () => {
  it("limit attempts per email, cap reset emails, and fail closed", async () => {
    const { authAttemptAllowed } = await import("@/lib/services/auth-limits");
    const results: boolean[] = [];
    for (let i = 0; i < 11; i++) results.push(await authAttemptAllowed(t.db, "login", `10.0.0.${i}`, "victim@example.test"));
    expect(results.slice(0, 10).every(Boolean)).toBe(true);
    expect(results[10]).toBe(false); // 10 attempts per email per 10 minutes
    const resets: boolean[] = [];
    for (let i = 0; i < 4; i++) resets.push(await authAttemptAllowed(t.db, "reset", `10.0.1.${i}`, "reset@example.test"));
    expect(resets).toEqual([true, true, true, false]); // 3 reset emails per address per hour
    const broken = new Proxy(t.db, { get: (target, prop, r) => (prop === "$queryRaw" ? () => Promise.reject(new Error("db down")) : Reflect.get(target, prop, r)) });
    expect(await authAttemptAllowed(broken, "login", "10.0.0.99", "x@example.test")).toBe(false);
  });
});
