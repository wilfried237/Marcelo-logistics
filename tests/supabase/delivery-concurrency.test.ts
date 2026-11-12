import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";
import type { AppUser } from "@/lib/auth/types";
import { loadAppUser } from "@/lib/services/users";
import { respondToQuote, sendQuote, submitQuoteRequest, transitionQuoteRequest } from "@/lib/services/quote-requests";
import { addShipmentEvent, createShipmentForRequest, updateShipment } from "@/lib/services/shipments";
import { DATABASE_URL, createUser, sql } from "./env";

/*
 * Stage 5 release review: truly concurrent transactions on the REAL local
 * Supabase Postgres (PGlite runs one transaction at a time, so it cannot show
 * this). Several staff requests that each try to mark the same shipment
 * Delivered, through the status form and the manual milestone form, must leave
 * one Delivered milestone and one queued delivery email.
 */
let db: Database;
let staff: AppUser;
let customer: AppUser;

beforeAll(async () => {
  db = createPrismaClient(DATABASE_URL, 8);
  const s = await createUser("staff", "concurrency.staff");
  const c = await createUser("customer", "concurrency.customer");
  staff = (await loadAppUser(db, s.id, s.email))!;
  customer = (await loadAppUser(db, c.id, c.email))!;
});
afterAll(async () => db?.$disconnect());

async function inTransitShipment(): Promise<string> {
  const r = await submitQuoteRequest(
    db,
    {
      service: "parcels",
      originCountry: "IE",
      destinationCountry: "CM",
      items: [{ description: "Parcel", quantity: "1" }],
      contact: { name: "Concurrency Test", email: customer.email!, phone: "+353 89 123 4567" },
      locale: "en",
      idempotencyKey: randomUUID(),
      privacyAccepted: true,
      website: "",
    },
    { user: customer, clientId: `concurrency-${randomUUID()}` },
    { available: true },
  );
  if (!r.ok) throw new Error(r.code);
  await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
  const validUntil = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  await sendQuote(db, staff, { requestId: r.requestId, amount: "5000", currency: "EUR", validUntil });
  await respondToQuote(db, customer, r.reference, true);
  const created = await createShipmentForRequest(db, staff, r.requestId);
  if (!created.ok) throw new Error(created.code);
  const [{ id }] = await sql<{ id: string }>("select id from public.shipments where reference = $1", [created.data!.reference]);
  await updateShipment(db, staff, { shipmentId: id, status: "IN_TRANSIT", etaVisible: false });
  return id;
}

const counts = async (shipmentId: string) => {
  const [events] = await sql<{ n: number }>("select count(*)::int n from public.shipment_events where shipment_id = $1 and milestone_code = 'DELIVERED'", [shipmentId]);
  const [emails] = await sql<{ n: number }>(
    `select count(*)::int n from public.email_deliveries where template = 'shipment_delivered'
       and entity_id in (select id::text from public.shipment_events where shipment_id = $1)`,
    [shipmentId],
  );
  return { events: events.n, emails: emails.n };
};

describe("concurrent Delivered requests on real Postgres", () => {
  it("five parallel requests (status form and manual form mixed) leave one Delivered milestone and one delivery email", async () => {
    for (let round = 0; round < 3; round++) {
      const id = await inTransitShipment();
      const attempts = [0, 1, 2, 3, 4].map((i) =>
        i % 2 === 0
          ? updateShipment(db, staff, { shipmentId: id, status: "DELIVERED", etaVisible: false, recordMilestone: true, milestonePublic: true })
          : addShipmentEvent(db, staff, { shipmentId: id, milestone: "DELIVERED", occurredAt: new Date().toISOString(), public: true }),
      );
      const results = await Promise.all(attempts);
      // Every attempt ends cleanly: saved, skipped, or refused as a duplicate. Never two milestones.
      for (const r of results) expect(r.ok || (!r.ok && r.code === "delivered_milestone_exists")).toBe(true);
      expect(await counts(id), `round ${round}`).toEqual({ events: 1, emails: 1 });
      const [{ status }] = await sql<{ status: string }>("select status::text from public.shipments where id = $1", [id]);
      expect(status).toBe("DELIVERED");
    }
  });
});
