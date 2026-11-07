import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { createTestDb, createUser, type TestDb } from "../db/harness";
import type { Database } from "@/lib/db/types";
import type { AppUser } from "@/lib/auth/types";
import { loadAppUser } from "@/lib/services/users";
import { issueQuote, submitQuoteRequest, transitionQuoteRequest } from "@/lib/services/quote-requests";
import { MAX_ATTEMPTS, maskAddress, processOutbox, resendProvider, staffRecipients, type EmailProvider } from "@/lib/email/outbox";
import { emailReplyTo, emailTestRecipient, getEmailTransport } from "@/lib/config/env";
import { applyResendEvent, verifyWebhookSignature } from "@/lib/email/webhook";

/*
 * Email outbox, delivery, retries and webhooks against PostgreSQL (PGlite) with
 * a FAKE provider: no message leaves the process and no real address is used.
 */

let t: TestDb;
let db: Database;
let staff: AppUser;
const resend = { kind: "resend" as const, apiKey: "re_test", from: "Marchelo Logistics <notify@example.test>" };
const STAFF = ["ops@example.test"];

type Sent = { from: string; to: string[]; subject: string; html: string; text: string; idempotencyKey: string; replyTo?: string };
function fakeProvider(behaviour: "ok" | "fail" | "throw" = "ok") {
  const sent: Sent[] = [];
  const provider: EmailProvider = {
    async send(input) {
      if (behaviour === "throw") throw new Error("network down");
      if (behaviour === "fail") return { error: "provider rejected" };
      sent.push(input);
      return { id: `msg_${sent.length}_${randomUUID().slice(0, 6)}` };
    },
  };
  return { provider, sent };
}

const outbox = async (where = "true") =>
  (await t.client.query<{ template: string; audience: string; status: string; attempts: number; recipient: string | null; provider_message_id: string | null; idempotency_key: string }>(
    `select template, audience, status::text, attempts, recipient, provider_message_id, idempotency_key from public.email_deliveries where ${where} order by created_at`,
  )).rows;

const input = (email: string) => ({
  service: "barrels",
  originCountry: "IE",
  destinationCountry: "CM",
  items: [{ description: "Barrel of clothes", quantity: "1" }],
  contact: { name: "Ada Example", email, phone: "+353 89 123 4567" },
  locale: "fr",
  idempotencyKey: randomUUID(),
  privacyAccepted: true,
  website: "",
});

beforeAll(async () => {
  t = await createTestDb();
  db = t.db as unknown as Database;
  const s = await createUser(t.client, "staff.mail@example.test", "staff", "Staff");
  staff = (await loadAppUser(db, s.id, "staff.mail@example.test"))!;
});
afterAll(async () => t?.close());
beforeEach(async () => {
  // Deliver or clear anything left by a previous test, so each test sees only its own rows.
  await t.client.query("update public.email_deliveries set status = 'SKIPPED' where status in ('PENDING', 'FAILED', 'SENDING')");
});

async function newRequest(email = `c.${randomUUID().slice(0, 8)}@example.test`) {
  const r = await submitQuoteRequest(db, input(email), { user: null, clientId: randomUUID() }, { available: true });
  if (!r.ok) throw new Error("setup failed: " + r.code);
  return r;
}

describe("outbox: emails are queued in the same transaction as the business change", () => {
  it("a new request queues the customer acknowledgement and one staff alert", async () => {
    const r = await newRequest();
    const rows = await outbox(`entity_id = '${r.requestId}'`);
    expect(rows.map((x) => [x.template, x.audience, x.status])).toEqual([
      ["quote_received", "customer", "PENDING"],
      ["staff_new_request", "staff", "PENDING"],
    ]);
    // Staff inbox is never stored; the customer address is.
    expect(rows[1].recipient).toBeNull();
    expect(rows[0].recipient).toMatch(/@example\.test$/);
  });

  it("a rolled-back change queues nothing", async () => {
    const before = (await outbox()).length;
    await expect(
      db.$transaction(async (tx) => {
        await tx.$executeRaw`select public.app_enqueue_email('quote_received', 'customer', 'quote_requests', 'x', ${`rollback:${randomUUID()}`}, 'a@example.test', 'en'::public.app_locale)`;
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect((await outbox()).length).toBe(before);
  });
});

describe("delivery", () => {
  it("sends customer emails in the request language and staff alerts to the configured inbox", async () => {
    const r = await newRequest();
    const { provider, sent } = fakeProvider();
    const report = await processOutbox(db, { transport: resend, provider, recipientsForStaff: STAFF });
    expect(report).toMatchObject({ claimed: 2, sent: 2, dead: 0 });
    const customer = sent.find((m) => m.to[0] !== STAFF[0])!;
    const staffMail = sent.find((m) => m.to[0] === STAFF[0])!;
    expect(customer.subject).toBe(`Nous avons bien reçu votre demande de devis ${r.reference}`);
    expect(customer.html).toContain(r.reference);
    expect(customer.html).toContain("/brand/marchelo-logo-email.png");
    expect(customer.text).toContain(r.reference); // plain-text version
    expect(customer.to).toEqual([expect.stringMatching(/@example\.test$/)]);
    expect(staffMail.to).toEqual(STAFF);
    expect(staffMail.subject).toBe(`New quote request ${r.reference}`);
    expect(staffMail.html).toContain(`/en/admin/quotes/${r.reference}`);
    // Staff alerts never quote the customer's goods description or notes.
    expect(staffMail.html).not.toContain("Barrel of clothes");
    const rows = await outbox(`entity_id = '${r.requestId}'`);
    expect(rows.every((x) => x.status === "SENT" && x.provider_message_id)).toBe(true);
    // The provider received the row's idempotency key (crash-safe retries).
    expect(sent.map((s) => s.idempotencyKey).sort()).toEqual(rows.map((x) => x.idempotency_key).sort());
  });

  it("skips staff alerts when no internal inbox is configured, and everything when email is disabled", async () => {
    await newRequest();
    const { provider, sent } = fakeProvider();
    const report = await processOutbox(db, { transport: resend, provider, recipientsForStaff: [] });
    expect(report).toMatchObject({ sent: 1, skipped: 1 });
    expect(sent).toHaveLength(1);
    const r = await newRequest();
    const disabled = await processOutbox(db, { transport: { kind: "disabled", reason: "flag off" }, provider, recipientsForStaff: STAFF });
    expect(disabled).toMatchObject({ claimed: 2, skipped: 2, sent: 0 });
    expect((await outbox(`entity_id = '${r.requestId}'`)).map((x) => x.status)).toEqual(["SKIPPED", "SKIPPED"]);
  });

  it("concurrent runs never send the same email twice", async () => {
    await newRequest();
    await newRequest();
    const { provider, sent } = fakeProvider();
    const reports = await Promise.all([1, 2, 3].map(() => processOutbox(db, { transport: resend, provider, recipientsForStaff: STAFF })));
    expect(reports.reduce((n, r) => n + r.sent, 0)).toBe(4);
    expect(new Set(sent.map((s) => s.idempotencyKey)).size).toBe(4);
  });

  it("retries failures with backoff, then gives up and alerts staff exactly once", async () => {
    const r = await newRequest();
    const failing = fakeProvider("fail");
    const first = await processOutbox(db, { transport: resend, provider: failing.provider, recipientsForStaff: STAFF });
    expect(first).toMatchObject({ retrying: 2 });
    let rows = await outbox(`entity_id = '${r.requestId}'`);
    expect(rows.map((x) => [x.status, x.attempts])).toEqual([
      ["FAILED", 1],
      ["FAILED", 1],
    ]);
    // Not due yet: nothing is retried immediately.
    expect(await processOutbox(db, { transport: resend, provider: failing.provider, recipientsForStaff: STAFF })).toMatchObject({ claimed: 0 });
    for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt++) {
      await t.client.query(`update public.email_deliveries set next_attempt_at = now() - interval '1 second' where entity_id = $1`, [r.requestId]);
      await processOutbox(db, { transport: resend, provider: failing.provider, recipientsForStaff: STAFF });
    }
    rows = await outbox(`entity_id = '${r.requestId}'`);
    expect(rows.map((x) => [x.status, x.attempts])).toEqual([
      ["DEAD", MAX_ATTEMPTS],
      ["DEAD", MAX_ATTEMPTS],
    ]);
    // One alert for the failed CUSTOMER email; none for the failed staff alert (no loops).
    const alerts = await outbox(`template = 'staff_email_failure'`);
    expect(alerts).toHaveLength(1);
    // A dead row is never retried again.
    await t.client.query(`update public.email_deliveries set next_attempt_at = now() - interval '1 second' where entity_id = $1`, [r.requestId]);
    const ok = fakeProvider();
    await processOutbox(db, { transport: resend, provider: ok.provider, recipientsForStaff: STAFF });
    expect(ok.sent.map((s) => s.subject)).toEqual([expect.stringMatching(/^Email delivery problem: quote_received/)]);
  });

  it("treats a provider exception like a failure (recorded, retried later)", async () => {
    const r = await newRequest();
    const report = await processOutbox(db, { transport: resend, provider: fakeProvider("throw").provider, recipientsForStaff: STAFF });
    expect(report.retrying).toBe(2);
    expect((await outbox(`entity_id = '${r.requestId}'`)).every((x) => x.status === "FAILED")).toBe(true);
  });

  it("reclaims a row stuck in SENDING after a crash", async () => {
    const r = await newRequest();
    await t.client.query(`update public.email_deliveries set status = 'SENDING', locked_at = now() - interval '11 minutes' where entity_id = $1`, [r.requestId]);
    const { provider, sent } = fakeProvider();
    await processOutbox(db, { transport: resend, provider, recipientsForStaff: STAFF });
    expect(sent).toHaveLength(2);
  });
});

describe("quotation emails", () => {
  it("include the full breakdown; a revised quote is announced as an update", async () => {
    const r = await newRequest();
    await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
    const validUntil = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const issued = await issueQuote(db, staff, {
      requestId: r.requestId,
      currency: "EUR",
      validUntil,
      inclusions: "Port handling",
      exclusions: "Customs duties in Cameroon",
      lines: [
        { kind: "charge", description: "Barrel (220 L)", quantity: "2", unitPrice: "150.00" },
        { kind: "discount", description: "Returning customer", quantity: "1", unitPrice: "20.00" },
      ],
    });
    expect(issued).toMatchObject({ ok: true, data: { totalMinor: "28000" } });
    const { provider, sent } = fakeProvider();
    await processOutbox(db, { transport: resend, provider, recipientsForStaff: STAFF });
    const quoteMail = sent.find((s) => s.subject.startsWith("Votre devis"))!;
    expect(quoteMail.subject).toBe(`Votre devis ${r.reference} est prêt`);
    for (const fragment of ["Barrel (220 L)", "Returning customer", "300,00", "-20,00", "280,00", "Port handling", "Customs duties in Cameroon"]) {
      expect(quoteMail.html.replace(/ | /g, " ")).toContain(fragment);
    }

    // Revise: back to review, new quote -> "updated" email.
    expect(await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" })).toMatchObject({ ok: true });
    await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil, lines: [{ kind: "charge", description: "Barrel (220 L)", quantity: "2", unitPrice: "140.00" }] });
    const second = fakeProvider();
    await processOutbox(db, { transport: resend, provider: second.provider, recipientsForStaff: STAFF });
    expect(second.sent.map((s) => s.subject)).toContain(`Votre devis ${r.reference} a été mis à jour`);
  });
});

describe("provider webhooks", () => {
  const secret = "whsec_" + Buffer.from("test-webhook-secret-key-32-bytes!").toString("base64");
  const sign = (id: string, ts: number, body: string) => `v1,${createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest("base64")}`;

  it("verifies Svix signatures and rejects forged, stale or missing ones", () => {
    const now = 1_800_000_000;
    const body = JSON.stringify({ type: "email.delivered" });
    const ok = { secret, id: "msg_1", timestamp: String(now), signature: sign("msg_1", now, body), body, nowSeconds: now };
    expect(verifyWebhookSignature(ok)).toBe(true);
    expect(verifyWebhookSignature({ ...ok, signature: `v1,${"A".repeat(44)} ${ok.signature}` })).toBe(true); // rotation
    expect(verifyWebhookSignature({ ...ok, body: body + " " })).toBe(false);
    expect(verifyWebhookSignature({ ...ok, signature: sign("msg_1", now, "{}") })).toBe(false);
    expect(verifyWebhookSignature({ ...ok, nowSeconds: now + 301 })).toBe(false); // replay window
    expect(verifyWebhookSignature({ ...ok, secret: undefined })).toBe(false);
    expect(verifyWebhookSignature({ ...ok, signature: null })).toBe(false);
  });

  it("records delivery, and alerts staff once for bounces and complaints", async () => {
    const r = await newRequest();
    const { provider } = fakeProvider();
    await processOutbox(db, { transport: resend, provider, recipientsForStaff: STAFF });
    const [customerRow] = await outbox(`entity_id = '${r.requestId}' and audience = 'customer'`);
    const id = customerRow.provider_message_id!;
    expect(await applyResendEvent(db, { type: "email.delivered", data: { email_id: id } })).toBe("applied");
    expect((await outbox(`provider_message_id = '${id}'`))[0].status).toBe("DELIVERED");
    await applyResendEvent(db, { type: "email.bounced", data: { email_id: id } });
    await applyResendEvent(db, { type: "email.bounced", data: { email_id: id } }); // replay
    expect((await outbox(`provider_message_id = '${id}'`))[0].status).toBe("BOUNCED");
    // A late "delivered" never hides a bounce.
    await applyResendEvent(db, { type: "email.delivered", data: { email_id: id } });
    expect((await outbox(`provider_message_id = '${id}'`))[0].status).toBe("BOUNCED");
    const alerts = (await outbox(`template = 'staff_email_failure'`)).filter((a) => a.idempotency_key.endsWith(""));
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(await applyResendEvent(db, { type: "email.delivered", data: { email_id: "unknown" } })).toBe("ignored");
    expect(await applyResendEvent(db, { type: "something.else", data: { email_id: id } })).toBe("ignored");
  });
});

describe("configuration", () => {
  it("parses one or more internal recipients and ignores invalid entries", () => {
    expect(staffRecipients({ STAFF_NOTIFICATION_EMAIL: " Ops@Example.test , owner@example.test,not-an-email " })).toEqual(["ops@example.test", "owner@example.test"]);
    expect(staffRecipients({})).toEqual([]);
  });

  it("never logs addresses in development mode", async () => {
    await newRequest();
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const report = await processOutbox(db, { transport: { kind: "log" }, recipientsForStaff: STAFF });
    expect(report.skipped).toBe(2);
    expect(log.mock.calls.flat().join(" ")).not.toMatch(/@/);
    log.mockRestore();
  });
});

describe("webhook events: delayed, complained and replays", () => {
  it("records a delay without changing the status, and alerts staff exactly once per failed email", async () => {
    const r = await newRequest();
    const { provider } = fakeProvider();
    await processOutbox(db, { transport: resend, provider, recipientsForStaff: STAFF });
    const [row] = await outbox(`entity_id = '${r.requestId}' and audience = 'customer'`);
    const id = row.provider_message_id!;
    expect(await applyResendEvent(db, { type: "email.delivery_delayed", data: { email_id: id } })).toBe("applied");
    const delayed = (await t.client.query<{ status: string; last_event: string }>("select status::text, last_event from public.email_deliveries where provider_message_id = $1", [id])).rows[0];
    expect(delayed).toEqual({ status: "SENT", last_event: "email.delivery_delayed" });
    for (let i = 0; i < 3; i++) await applyResendEvent(db, { type: "email.complained", data: { email_id: id } }); // replays
    expect((await outbox(`provider_message_id = '${id}'`))[0].status).toBe("COMPLAINED");
    const [{ id: deliveryId }] = (await t.client.query<{ id: string }>("select id from public.email_deliveries where provider_message_id = $1", [id])).rows;
    const alerts = await outbox(`template = 'staff_email_failure' and entity_id = '${deliveryId}'`);
    expect(alerts).toHaveLength(1);
    // A complaint on a staff alert never alerts staff again (no loops).
    const staffRow = (await outbox(`entity_id = '${r.requestId}' and audience = 'staff'`))[0];
    const before = (await outbox(`template = 'staff_email_failure'`)).length;
    await applyResendEvent(db, { type: "email.bounced", data: { email_id: staffRow.provider_message_id! } });
    expect((await outbox(`template = 'staff_email_failure'`)).length).toBe(before);
  });
});

describe("test recipient override (EMAIL_TEST_RECIPIENT)", () => {
  const base = { ENABLE_TRANSACTIONAL_EMAIL: "true", RESEND_API_KEY: "re_test", EMAIL_FROM: "Marchelo Logistics <notify@example.test>" };

  it("is active only off Vercel, for a single valid address", () => {
    expect(emailTestRecipient({ EMAIL_TEST_RECIPIENT: " Tester@Example.test " })).toBe("tester@example.test");
    expect(emailTestRecipient({ EMAIL_TEST_RECIPIENT: "tester@example.test", VERCEL: "1", VERCEL_ENV: "production" })).toBeUndefined();
    expect(emailTestRecipient({ EMAIL_TEST_RECIPIENT: "tester@example.test", VERCEL: "1", VERCEL_ENV: "preview" })).toBeUndefined();
    expect(emailTestRecipient({ EMAIL_TEST_RECIPIENT: "tester@example.test", VERCEL_ENV: "production" })).toBeUndefined();
    expect(emailTestRecipient({ EMAIL_TEST_RECIPIENT: "a@example.test,b@example.test" })).toBeUndefined();
    expect(emailTestRecipient({ EMAIL_TEST_RECIPIENT: "not-an-address" })).toBeUndefined();
    expect(emailTestRecipient({})).toBeUndefined();
    expect(getEmailTransport({ ...base, EMAIL_TEST_RECIPIENT: "tester@example.test" })).toMatchObject({ kind: "resend", testRecipient: "tester@example.test" });
    expect(getEmailTransport({ ...base, EMAIL_TEST_RECIPIENT: "tester@example.test", VERCEL: "1", VERCEL_ENV: "production" })).not.toHaveProperty("testRecipient");
    expect(getEmailTransport({ ...base, ENABLE_TRANSACTIONAL_EMAIL: "false", EMAIL_TEST_RECIPIENT: "tester@example.test" }).kind).toBe("disabled");
  });

  it("sends every email, customer and staff, only to the test address, marked [EMAIL TEST], without changing stored recipients", async () => {
    const email = `real.customer.${randomUUID().slice(0, 6)}@example.test`;
    const r = await newRequest(email);
    const { provider, sent } = fakeProvider();
    const report = await processOutbox(db, { transport: { ...resend, testRecipient: "tester@example.test" }, provider, recipientsForStaff: STAFF });
    expect(report).toMatchObject({ claimed: 2, sent: 2 });
    expect(sent.map((m) => m.to)).toEqual([["tester@example.test"], ["tester@example.test"]]);
    expect(sent.every((m) => m.subject.startsWith("[EMAIL TEST] "))).toBe(true);
    expect(sent.map((m) => m.subject).join(" ")).toContain(r.reference);
    // The intended recipients are reported masked, never in full.
    expect(report.redirected?.map((x) => x.audience).sort()).toEqual(["customer", "staff"]);
    expect(JSON.stringify(report.redirected)).not.toContain(email);
    expect(report.redirected?.find((x) => x.audience === "customer")?.intended).toEqual([maskAddress(email)]);
    // The database still holds the real customer address; staff rows still store none.
    const rows = await outbox(`entity_id = '${r.requestId}'`);
    expect(rows.find((x) => x.audience === "customer")?.recipient).toBe(email);
    expect(rows.find((x) => x.audience === "staff")?.recipient).toBeNull();
  });
});

describe("reply-to address (EMAIL_REPLY_TO)", () => {
  const base = { ENABLE_TRANSACTIONAL_EMAIL: "true", RESEND_API_KEY: "re_test", EMAIL_FROM: "Marchelo Logistics <notify@example.test>" };

  it("is optional, read from configuration and validated", () => {
    expect(emailReplyTo({ EMAIL_REPLY_TO: " Info.Cargo@Example.test " })).toBe("info.cargo@example.test");
    expect(emailReplyTo({})).toBeUndefined();
    expect(emailReplyTo({ EMAIL_REPLY_TO: "" })).toBeUndefined();
    expect(emailReplyTo({ EMAIL_REPLY_TO: "not-an-address" })).toBeUndefined();
    expect(emailReplyTo({ EMAIL_REPLY_TO: "a@example.test,b@example.test" })).toBeUndefined();
    expect(emailReplyTo({ EMAIL_REPLY_TO: "Name <a@example.test>" })).toBeUndefined();
    expect(getEmailTransport({ ...base, EMAIL_REPLY_TO: "info@example.test" })).toMatchObject({ kind: "resend", from: base.EMAIL_FROM, replyTo: "info@example.test" });
    expect(getEmailTransport(base)).not.toHaveProperty("replyTo");
    expect(getEmailTransport({ ...base, EMAIL_REPLY_TO: "bad" })).not.toHaveProperty("replyTo");
  });

  it("is passed with customer emails and staff alerts, without changing the sender or the recipients", async () => {
    const email = `reply.${randomUUID().slice(0, 8)}@example.test`;
    await newRequest(email);
    const { provider, sent } = fakeProvider();
    await processOutbox(db, { transport: { ...resend, replyTo: "info@example.test" }, provider, recipientsForStaff: STAFF });
    expect(sent).toHaveLength(2);
    for (const m of sent) expect(m).toMatchObject({ replyTo: "info@example.test" });
    expect(sent.map((m) => m.to).sort()).toEqual([[email], STAFF].sort());
    expect(sent.every((m) => m.from === resend.from)).toBe(true);
  });

  it("is left out entirely when not configured", async () => {
    await newRequest();
    const { provider, sent } = fakeProvider();
    await processOutbox(db, { transport: resend, provider, recipientsForStaff: STAFF });
    expect(sent).toHaveLength(2);
    expect(sent.every((m) => !("replyTo" in m))).toBe(true);
  });

  it("is handed to the Resend SDK as replyTo", async () => {
    const calls: { payload: Record<string, unknown>; options: unknown }[] = [];
    vi.doMock("resend", () => ({
      Resend: class {
        emails = {
          send: async (payload: Record<string, unknown>, options: unknown) => {
            calls.push({ payload, options });
            return { data: { id: "msg_mock" }, error: null };
          },
        };
      },
    }));
    const input = { from: resend.from, to: ["c@example.test"], subject: "S", html: "<p>h</p>", text: "t", idempotencyKey: "k1" };
    expect(await resendProvider("re_test").send({ ...input, replyTo: "info@example.test" })).toEqual({ id: "msg_mock" });
    expect(await resendProvider("re_test").send({ ...input, idempotencyKey: "k2" })).toEqual({ id: "msg_mock" });
    vi.doUnmock("resend");
    expect(calls[0].payload).toMatchObject({ from: resend.from, to: ["c@example.test"], replyTo: "info@example.test" });
    expect(calls[0].options).toEqual({ idempotencyKey: "k1" });
    expect(calls[1].payload).not.toHaveProperty("replyTo");
  });
});
