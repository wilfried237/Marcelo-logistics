import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, createUser, type TestDb } from "../db/harness";
import type { Database } from "@/lib/db/types";
import type { AppUser } from "@/lib/auth/types";
import { loadAppUser } from "@/lib/services/users";
import { issueQuote, respondToQuote, submitQuoteRequest, transitionQuoteRequest } from "@/lib/services/quote-requests";
import { addShipmentEvent, createShipmentForRequest, getCustomerShipment, setShipmentEventVisibility, updateShipment } from "@/lib/services/shipments";
import { processOutbox, type EmailProvider } from "@/lib/email/outbox";

/*
 * Stage 5 release review, task A: the delivery email for a Delivered milestone.
 * PGlite with every migration, and a FAKE provider: nothing leaves the process.
 *
 * Terms: an "outbox row" is the queued email (email_deliveries); an "attempt"
 * is one provider call; "SENT" means the provider accepted it. Actual arrival
 * in the mailbox is reported later by the provider webhook and is not tested here.
 */
let t: TestDb;
let db: Database;
let staff: AppUser;
let customer: AppUser;
const resend = { kind: "resend" as const, apiKey: "re_test", from: "Marchelo Logistics <notify@example.test>" };
const STAFF_INBOX = ["ops@example.test"];
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function fakeProvider(behaviour: "ok" | "fail" = "ok") {
  const calls: { to: string[]; subject: string; idempotencyKey: string }[] = [];
  const provider: EmailProvider = {
    async send(input) {
      calls.push({ to: input.to, subject: input.subject, idempotencyKey: input.idempotencyKey });
      return behaviour === "fail" ? { error: "provider rejected" } : { id: `msg_${randomUUID().slice(0, 8)}` };
    },
  };
  return { provider, calls };
}

async function bookedShipment() {
  await t.client.query("delete from public.rate_limits");
  const r = await submitQuoteRequest(
    db,
    {
      service: "parcels",
      originCountry: "IE",
      destinationCountry: "CM",
      items: [{ description: "Parcel", quantity: "1" }],
      contact: { name: "Delivery Test", email: customer.email!, phone: "+353 89 123 4567" },
      locale: "en",
      idempotencyKey: randomUUID(),
      privacyAccepted: true,
      website: "",
    },
    { user: customer, clientId: randomUUID() },
    { available: true },
  );
  if (!r.ok) throw new Error(r.code);
  await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
  await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(10), lines: [{ kind: "charge", description: "Parcel", quantity: "1", unitPrice: "50.00" }] });
  await respondToQuote(db, customer, r.reference, true);
  const created = await createShipmentForRequest(db, staff, r.requestId);
  if (!created.ok) throw new Error(created.code);
  const id = (await t.client.query<{ id: string }>("select id from public.shipments where reference = $1", [created.data!.reference])).rows[0].id;
  // Deliver everything queued so far (confirmation emails), so each test only sees its own rows.
  await processOutbox(db, { transport: resend, provider: fakeProvider().provider, recipientsForStaff: STAFF_INBOX });
  return { id, reference: created.data!.reference };
}

/** Outbox rows for the shipment and its milestones, oldest first. */
const rows = async (shipmentId: string) =>
  (
    await t.client.query<{ template: string; audience: string; status: string; attempts: number; idempotency_key: string }>(
      `select template, audience, status::text, attempts, idempotency_key from public.email_deliveries
        where entity_id = $1 or entity_id in (select id::text from public.shipment_events where shipment_id = $1::uuid)
        order by created_at, id`,
      [shipmentId],
    )
  ).rows;
const delivered = async (shipmentId: string) => (await rows(shipmentId)).filter((r) => r.template === "shipment_delivered");
const deliveredEvents = async (shipmentId: string) =>
  (await t.client.query<{ id: string; public: boolean }>("select id, public from public.shipment_events where shipment_id = $1 and milestone_code = 'DELIVERED' order by created_at", [shipmentId])).rows;
const toDelivered = (shipmentId: string, extra: Record<string, unknown> = { recordMilestone: true, milestonePublic: true }) =>
  updateShipment(db, staff, { shipmentId, status: "DELIVERED", etaVisible: false, ...extra });
const manualDelivered = (shipmentId: string, isPublic = true) =>
  addShipmentEvent(db, staff, { shipmentId, milestone: "DELIVERED", occurredAt: new Date().toISOString(), public: isPublic });

beforeAll(async () => {
  t = await createTestDb();
  db = t.db as unknown as Database;
  const s = await createUser(t.client, "staff.delivery@example.test", "staff", "Staff Delivery");
  staff = (await loadAppUser(db, s.id, "staff.delivery@example.test"))!;
  const c = await createUser(t.client, "customer.delivery@example.test", "customer", "Customer Delivery");
  customer = (await loadAppUser(db, c.id, "customer.delivery@example.test"))!;
});
afterAll(async () => t?.close());

describe("delivery email for a Delivered milestone", () => {
  it("1. a public Delivered milestone queues exactly one delivery email, which the provider accepts once", async () => {
    const s = await bookedShipment();
    await updateShipment(db, staff, { shipmentId: s.id, status: "IN_TRANSIT", etaVisible: false });
    expect(await toDelivered(s.id)).toEqual({ ok: true, data: { milestone: "recorded" } });
    const queued = await delivered(s.id);
    expect(queued).toMatchObject([{ audience: "customer", status: "PENDING", attempts: 0 }]);
    const { provider, calls } = fakeProvider();
    await processOutbox(db, { transport: resend, provider, recipientsForStaff: STAFF_INBOX });
    expect(calls.filter((c) => /delivered/i.test(c.subject))).toHaveLength(1);
    expect(calls[0].to).toEqual([customer.email]);
    expect(await delivered(s.id)).toMatchObject([{ status: "SENT", attempts: 1 }]);
  });

  it("2. repeating the operation queues nothing more", async () => {
    const s = await bookedShipment();
    await updateShipment(db, staff, { shipmentId: s.id, status: "IN_TRANSIT", etaVisible: false });
    await toDelivered(s.id);
    // The same request again (status already Delivered): nothing recorded.
    expect(await toDelivered(s.id)).toEqual({ ok: true, data: { milestone: "none" } });
    // The trigger's idempotency key is per milestone: re-queueing it is ignored by the unique index.
    const [event] = await deliveredEvents(s.id);
    await t.client.query("select public.app_enqueue_email('shipment_delivered', 'customer', 'shipment_events', $1, $2, 'x@example.test', 'en')", [event.id, `shipment_event:${event.id}`]);
    // Hiding and showing the milestone again re-fires the trigger with the same key.
    await setShipmentEventVisibility(db, staff, event.id, false);
    await setShipmentEventVisibility(db, staff, event.id, true);
    expect(await delivered(s.id)).toHaveLength(1);
    expect(await deliveredEvents(s.id)).toHaveLength(1);
  });

  it("3. concurrent attempts (status form twice, or form and manual milestone) create one Delivered milestone and one email", async () => {
    const a = await bookedShipment();
    await updateShipment(db, staff, { shipmentId: a.id, status: "IN_TRANSIT", etaVisible: false });
    const results = await Promise.all([toDelivered(a.id), toDelivered(a.id)]);
    expect(results.filter((r) => r.ok && r.data?.milestone === "recorded")).toHaveLength(1);
    expect(await deliveredEvents(a.id)).toHaveLength(1);
    expect(await delivered(a.id)).toHaveLength(1);

    const b = await bookedShipment();
    await updateShipment(db, staff, { shipmentId: b.id, status: "IN_TRANSIT", etaVisible: false });
    const mixed = await Promise.all([toDelivered(b.id), manualDelivered(b.id)]);
    expect(mixed.filter((r) => r.ok)).not.toHaveLength(0);
    expect(await deliveredEvents(b.id)).toHaveLength(1);
    expect(await delivered(b.id)).toHaveLength(1);
  });

  it("4 and 5. a provider failure keeps the email queued; the retry reuses the same row and idempotency key", async () => {
    const s = await bookedShipment();
    await updateShipment(db, staff, { shipmentId: s.id, status: "IN_TRANSIT", etaVisible: false });
    await toDelivered(s.id);
    const failing = fakeProvider("fail");
    await processOutbox(db, { transport: resend, provider: failing.provider, recipientsForStaff: STAFF_INBOX });
    expect(await delivered(s.id)).toMatchObject([{ status: "FAILED", attempts: 1 }]);
    // Due again (the backoff would normally wait): the retry succeeds without a new row.
    await t.client.query("update public.email_deliveries set next_attempt_at = now() - interval '1 second' where status = 'FAILED'");
    const ok = fakeProvider();
    await processOutbox(db, { transport: resend, provider: ok.provider, recipientsForStaff: STAFF_INBOX });
    const after = await delivered(s.id);
    expect(after).toMatchObject([{ status: "SENT", attempts: 2 }]);
    // The provider saw the same idempotency key both times (it can drop a duplicate of an ambiguous first attempt).
    const keys = [...failing.calls, ...ok.calls].filter((c) => /delivered/i.test(c.subject)).map((c) => c.idempotencyKey);
    expect(keys).toEqual([after[0].idempotency_key, after[0].idempotency_key]);
  });

  it("6. a private Delivered milestone sends no customer email; showing it later sends one", async () => {
    const s = await bookedShipment();
    await updateShipment(db, staff, { shipmentId: s.id, status: "IN_TRANSIT", etaVisible: false });
    expect(await toDelivered(s.id, { recordMilestone: true, milestonePublic: false })).toEqual({ ok: true, data: { milestone: "recorded" } });
    expect(await delivered(s.id)).toEqual([]);
    expect((await getCustomerShipment(db, customer, s.reference))!.events).toEqual([]);
    const [event] = await deliveredEvents(s.id);
    await setShipmentEventVisibility(db, staff, event.id, true);
    expect(await delivered(s.id)).toHaveLength(1);
  });

  it("7. a milestone recorded by hand first is not duplicated by the status change", async () => {
    const pub = await bookedShipment();
    await updateShipment(db, staff, { shipmentId: pub.id, status: "IN_TRANSIT", etaVisible: false });
    expect(await manualDelivered(pub.id, true)).toEqual({ ok: true });
    expect(await toDelivered(pub.id)).toEqual({ ok: true, data: { milestone: "skipped" } });
    expect(await deliveredEvents(pub.id)).toHaveLength(1);
    expect(await delivered(pub.id)).toHaveLength(1);

    // Recorded by hand as internal, then the status form asks for a visible one: the existing milestone is made
    // visible (one email) instead of being silently skipped, which would leave the customer uninformed.
    const priv = await bookedShipment();
    await updateShipment(db, staff, { shipmentId: priv.id, status: "IN_TRANSIT", etaVisible: false });
    await manualDelivered(priv.id, false);
    expect(await toDelivered(priv.id)).toEqual({ ok: true, data: { milestone: "published" } });
    expect(await deliveredEvents(priv.id)).toMatchObject([{ public: true }]);
    expect(await delivered(priv.id)).toHaveLength(1);
    expect((await getCustomerShipment(db, customer, priv.reference))!.events.map((e) => e.milestone)).toEqual(["DELIVERED"]);

    // A second Delivered milestone by hand is refused, so it can never produce a second delivery email.
    expect(await manualDelivered(priv.id, true)).toEqual({ ok: false, code: "delivered_milestone_exists" });
    expect(await deliveredEvents(priv.id)).toHaveLength(1);
    expect(await delivered(priv.id)).toHaveLength(1);
  });

  it("8. other status changes keep their existing behaviour", async () => {
    const s = await bookedShipment();
    const before = (await rows(s.id)).length;
    for (const to of ["IN_TRANSIT", "AT_DESTINATION"]) await updateShipment(db, staff, { shipmentId: s.id, status: to, etaVisible: false });
    expect((await rows(s.id)).length).toBe(before); // no email for ordinary status changes
    await updateShipment(db, staff, { shipmentId: s.id, status: "ON_HOLD", etaVisible: false });
    expect((await rows(s.id)).slice(before).map((r) => `${r.template}/${r.audience}`)).toEqual(["staff_shipment_exception/staff"]);
    await updateShipment(db, staff, { shipmentId: s.id, status: "CANCELLED", etaVisible: false, recordMilestone: true, milestonePublic: true });
    expect((await rows(s.id)).slice(before).map((r) => r.template)).toEqual(["staff_shipment_exception"]); // no cancellation email (SH-03)
    // A visible ordinary milestone still sends its update email; a repeated non-Delivered milestone by hand is still allowed.
    const other = await bookedShipment();
    await addShipmentEvent(db, staff, { shipmentId: other.id, milestone: "RECEIVED_AT_DEPOT", occurredAt: new Date().toISOString(), public: true });
    await addShipmentEvent(db, staff, { shipmentId: other.id, milestone: "DELAYED", occurredAt: new Date().toISOString(), public: false });
    expect(await addShipmentEvent(db, staff, { shipmentId: other.id, milestone: "DELAYED", occurredAt: new Date().toISOString(), public: false })).toEqual({ ok: true });
    expect((await rows(other.id)).map((r) => `${r.template}/${r.audience}`)).toEqual([
      "shipment_confirmed/customer",
      "shipment_update/customer",
      "staff_shipment_exception/staff",
      "staff_shipment_exception/staff",
    ]);
  });
});
