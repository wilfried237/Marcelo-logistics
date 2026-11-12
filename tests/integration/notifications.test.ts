import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createTestDb, createUser, type TestDb } from "../db/harness";
import type { Database } from "@/lib/db/types";
import { AuthorizationError, type AppUser } from "@/lib/auth/types";
import { loadAppUser } from "@/lib/services/users";
import { issueQuote, respondToQuote, submitQuoteRequest, transitionQuoteRequest } from "@/lib/services/quote-requests";
import { addShipmentEvent, createShipmentForRequest } from "@/lib/services/shipments";
import { listEmailsForShipment, listNotifications } from "@/lib/services/notifications";

/* Stage 6: read-only staff views of the email outbox (PGlite, every migration; nothing is sent). */
let t: TestDb;
let db: Database;
let staff: AppUser;
let customer: AppUser;
let requestRef = "";
let shipmentRef = "";
let shipmentId = "";
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  t = await createTestDb();
  db = t.db as unknown as Database;
  const s = await createUser(t.client, "notif.staff@example.test", "staff", "Niamh Staff");
  const c = await createUser(t.client, "notif.customer@example.test", "customer", "Nell Customer");
  staff = (await loadAppUser(db, s.id, "notif.staff@example.test"))!;
  customer = (await loadAppUser(db, c.id, "notif.customer@example.test"))!;
  const r = await submitQuoteRequest(
    db,
    {
      service: "parcels",
      originCountry: "IE",
      destinationCountry: "CM",
      items: [{ description: "Parcel", quantity: "1" }],
      contact: { name: "Nell Customer", email: "notif.customer@example.test", phone: "+353 89 123 4567" },
      locale: "fr",
      idempotencyKey: randomUUID(),
      privacyAccepted: true,
      website: "",
    },
    { user: customer, clientId: randomUUID() },
    { available: true },
  );
  if (!r.ok) throw new Error(r.code);
  requestRef = r.reference;
  await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
  await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(10), lines: [{ kind: "charge", description: "Parcel", quantity: "1", unitPrice: "50.00" }] });
  await respondToQuote(db, customer, r.reference, true);
  const created = await createShipmentForRequest(db, staff, r.requestId);
  if (!created.ok) throw new Error(created.code);
  shipmentRef = created.data!.reference;
  shipmentId = (await t.client.query<{ id: string }>("select id from public.shipments where reference = $1", [shipmentRef])).rows[0].id;
  await addShipmentEvent(db, staff, { shipmentId, milestone: "DEPARTED_ORIGIN", occurredAt: new Date().toISOString(), public: true });
  // One failed delivery, as the outbox records it after provider errors.
  await t.client.query("update public.email_deliveries set status = 'DEAD', attempts = 5 where template = 'quote_issued'");
});
afterAll(async () => t?.close());

describe("staff notification history", () => {
  it("is staff-only", async () => {
    await expect(listNotifications(db, customer)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(listEmailsForShipment(db, customer, shipmentId)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("filters by status, template and audience, and ignores unknown filter values", async () => {
    const all = await listNotifications(db, staff);
    expect(all.total).toBeGreaterThan(4);
    expect(all.problems).toBe(1);
    expect((await listNotifications(db, staff, { status: "DEAD" })).emails.map((e) => e.template)).toEqual(["quote_issued"]);
    const shipmentUpdates = await listNotifications(db, staff, { template: "shipment_update" });
    expect(shipmentUpdates.emails).toHaveLength(1);
    expect((await listNotifications(db, staff, { audience: "staff" })).emails.every((e) => e.audience === "staff")).toBe(true);
    expect((await listNotifications(db, staff, { audience: "customer", template: "staff_new_request" })).total).toBe(0);
    expect(all.templates).toEqual(expect.arrayContaining(["quote_received", "staff_new_request", "shipment_confirmed", "shipment_update"]));
    expect((await listNotifications(db, staff, { status: "NOPE", template: "x; drop table", audience: "everyone" })).total).toBe(all.total);
  });

  it("links each email to its quote request or shipment and never returns addresses or content", async () => {
    const { emails } = await listNotifications(db, staff);
    expect(emails.find((e) => e.template === "quote_received")?.link).toEqual({ href: `/admin/quotes/${requestRef}`, label: requestRef });
    expect(emails.find((e) => e.template === "quote_issued")?.link).toEqual({ href: `/admin/quotes/${requestRef}`, label: requestRef });
    expect(emails.find((e) => e.template === "shipment_update")?.link).toEqual({ href: `/admin/shipments/${shipmentRef}`, label: shipmentRef });
    const json = JSON.stringify(emails);
    expect(json).not.toContain("notif.customer@example.test");
    expect(json).not.toMatch(/"recipient"|"payload"|"idempotencyKey"/);
  });

  it("lists a shipment's own emails on the shipment page", async () => {
    const emails = await listEmailsForShipment(db, staff, shipmentId);
    expect(emails.map((e) => e.template).sort()).toEqual(["shipment_confirmed", "shipment_update"]);
    expect(await listEmailsForShipment(db, staff, "not-a-uuid")).toEqual([]);
  });

  it("pages through the history", async () => {
    const values = Array.from({ length: 60 }, (_, i) => `('staff_job_failure', 'staff', 'job_runs', '${i}', 'test:${randomUUID()}', null, 'en', 'SENT', now() - interval '${i} minutes')`).join(",");
    await t.client.query(`insert into public.email_deliveries (template, audience, entity, entity_id, idempotency_key, recipient, locale, status, created_at) values ${values}`);
    const first = await listNotifications(db, staff, { template: "staff_job_failure" });
    expect(first).toMatchObject({ total: 60, page: 1, pages: 2 });
    expect(first.emails).toHaveLength(50);
    expect((await listNotifications(db, staff, { template: "staff_job_failure", page: 2 })).emails).toHaveLength(10);
  });

  it("is read-only: viewing changes nothing, and there is no way to re-send a DEAD email (D4)", async () => {
    const before = (await t.client.query("select id, status::text, attempts, next_attempt_at from public.email_deliveries order by id")).rows;
    await listNotifications(db, staff, { status: "DEAD" });
    await listEmailsForShipment(db, staff, shipmentId);
    expect((await t.client.query("select id, status::text, attempts, next_attempt_at from public.email_deliveries order by id")).rows).toEqual(before);
    for (const file of ["lib/services/notifications.ts", "app/[locale]/admin/(staff)/notifications/page.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\.update(Many)?\(|\.create(Many)?\(|\.upsert\(|\.delete(Many)?\(|app_enqueue_email|processOutbox|"use server"/);
    }
  });
});
