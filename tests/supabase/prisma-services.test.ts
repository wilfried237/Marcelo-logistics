import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "@/lib/db/client";
import type { Database, Tx } from "@/lib/db/types";
import { withUser } from "@/lib/db/context";
import type { AppUser } from "@/lib/auth/types";
import { loadAppUser } from "@/lib/services/users";
import { getCustomerQuoteRequest, respondToQuote, sendQuote, submitQuoteRequest, transitionQuoteRequest } from "@/lib/services/quote-requests";
import { addShipmentEvent, createShipmentForRequest, getCustomerShipment } from "@/lib/services/shipments";
import { trackShipment } from "@/lib/services/tracking";
import { expireQuotes } from "@/lib/services/jobs";
import { DATABASE_URL, createUser, sql } from "./env";

/* Application services (Prisma + @prisma/adapter-pg) against the REAL local Supabase Postgres. */

let db: Database;
let staff: AppUser;
let a: AppUser;
let b: AppUser;

beforeAll(async () => {
  db = createPrismaClient(DATABASE_URL, 3);
  const s = await createUser("staff", "prisma.staff");
  const ca = await createUser("customer", "prisma.a");
  const cb = await createUser("customer", "prisma.b");
  staff = (await loadAppUser(db, s.id, s.email))!;
  a = (await loadAppUser(db, ca.id, ca.email))!;
  b = (await loadAppUser(db, cb.id, cb.email))!;
});
afterAll(async () => db?.$disconnect());

const input = () => ({
  service: "barrels",
  originCountry: "IE",
  destinationCountry: "CM",
  items: [{ description: "Barrel of clothes", quantity: "1" }],
  contact: { name: "Real Stack", email: `real.${randomUUID().slice(0, 6)}@example.test`, phone: "+353 89 123 4567" },
  locale: "fr",
  idempotencyKey: randomUUID(),
  privacyAccepted: true,
  website: "",
});

describe("Prisma services on real Supabase Postgres", () => {
  it("runs the full quote -> shipment -> public tracking workflow under RLS", async () => {
    expect(staff.role).toBe("staff");
    const submitted = await submitQuoteRequest(db, input(), { user: a, clientId: `real-${randomUUID()}` }, { available: true });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(await getCustomerQuoteRequest(db, b, submitted.reference)).toBeNull();

    expect(await transitionQuoteRequest(db, staff, { requestId: submitted.requestId, to: "UNDER_REVIEW" })).toEqual({ ok: true, data: { status: "UNDER_REVIEW" } });
    const validUntil = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    expect(await sendQuote(db, staff, { requestId: submitted.requestId, amount: "125000", currency: "XAF", validUntil })).toMatchObject({ ok: true });
    expect(await respondToQuote(db, b, submitted.reference, true)).toEqual({ ok: false, code: "not_found" });
    expect(await respondToQuote(db, a, submitted.reference, true)).toEqual({ ok: true, status: "ACCEPTED" });

    const shipment = await createShipmentForRequest(db, staff, submitted.requestId);
    expect(shipment.ok).toBe(true);
    if (!shipment.ok) return;
    const [{ id: shipmentId }] = await sql<{ id: string }>("select id from public.shipments where reference = $1", [shipment.data!.reference]);
    await addShipmentEvent(db, staff, { shipmentId, milestone: "BOOKED", occurredAt: new Date().toISOString(), noteEn: "Booked", noteFr: "Réservé", public: true });
    await addShipmentEvent(db, staff, { shipmentId, milestone: "BOOKED", occurredAt: new Date().toISOString(), noteEn: "internal", public: false });

    const customerView = await getCustomerShipment(db, a, shipment.data!.reference);
    expect(customerView?.events).toHaveLength(1);
    expect(await getCustomerShipment(db, b, shipment.data!.reference)).toBeNull();

    const tracked = await trackShipment(db, shipment.data!.reference, `real-${randomUUID()}`);
    expect(tracked.ok).toBe(true);
    if (tracked.ok) {
      expect(tracked.shipment.events).toHaveLength(1);
      expect(JSON.stringify(tracked.shipment)).not.toMatch(/internal|example\.test/);
    }
  });

  it("expires quotes exactly once when two job runs overlap", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await submitQuoteRequest(db, input(), { user: a, clientId: `exp-${randomUUID()}` }, { available: true });
      if (!r.ok) throw new Error("setup failed");
      await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
      await sendQuote(db, staff, { requestId: r.requestId, amount: "10.00", currency: "EUR", validUntil: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) });
      ids.push(r.requestId);
    }
    // Test-only time travel on the disposable local database.
    await sql(
      `begin; alter table public.quotes disable trigger quotes_rules;
       update public.quotes set created_at = now() - interval '3 days', valid_until = now() - interval '1 hour' where quote_request_id = any($1::uuid[]);
       alter table public.quotes enable trigger quotes_rules; commit;`.replace("$1::uuid[]", `array[${ids.map((id) => `'${id}'`).join(",")}]::uuid[]`),
    );
    const second = createPrismaClient(DATABASE_URL, 1);
    try {
      const [r1, r2] = await Promise.all([expireQuotes(db), expireQuotes(second)]);
      const statuses = await sql<{ status: string }>("select status from public.quote_requests where id = any($1::uuid[])", [ids]);
      expect(statuses.every((s) => s.status === "EXPIRED")).toBe(true);
      // Other expired data in the shared local database may also be swept; ours exactly once.
      expect(r1.expired + r2.expired).toBeGreaterThanOrEqual(3);
      const auditCount = await sql<{ n: number }>(
        "select count(*)::int as n from public.audit_log where entity = 'quote_requests' and entity_id = any($1::text[]) and after->>'status' = 'EXPIRED'",
        [ids],
      );
      expect(auditCount[0].n).toBe(3);
      expect(await expireQuotes(db)).toEqual({ expired: 0 });
    } finally {
      await second.$disconnect();
    }
  });

  it("does not leak the RLS role or JWT claims to the next query on a pooled connection", async () => {
    // One connection, so the follow-up queries are guaranteed to reuse it.
    const single = createPrismaClient(DATABASE_URL, 1);
    const state = (client: Database | Tx) =>
      client.$queryRaw<{ role: string; claims: string | null }[]>`select current_user::text as role, nullif(current_setting('request.jwt.claims', true), '') as claims`;
    try {
      const before = await state(single);
      const inside = await withUser(single, a.id, (tx) => state(tx));
      expect(inside[0].role).toBe("authenticated");
      expect(JSON.parse(inside[0].claims!).sub).toBe(a.id);
      await expect(withUser(single, a.id, async () => Promise.reject(new Error("rollback")))).rejects.toThrow("rollback");
      const after = await state(single);
      expect(after[0].role).toBe(before[0].role);
      expect(after[0].role).not.toBe("authenticated");
      expect(after[0].claims).toBeNull();
    } finally {
      await single.$disconnect();
    }
  });
});
