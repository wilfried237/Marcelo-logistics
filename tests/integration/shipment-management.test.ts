import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { asUser, createTestDb, createUser, expectDbError, type TestDb } from "../db/harness";
import type { Database } from "@/lib/db/types";
import { AuthorizationError, type AppUser } from "@/lib/auth/types";
import { loadAppUser } from "@/lib/services/users";
import { issueQuote, listQuoteRequestsForStaff, respondToQuote, submitQuoteRequest, transitionQuoteRequest } from "@/lib/services/quote-requests";
import {
  addShipmentEvent,
  createShipmentForRequest,
  getCustomerShipment,
  getShipmentForStaff,
  listCustomerShipments,
  listShipmentsForStaff,
  setShipmentEventVisibility,
  updateShipment,
} from "@/lib/services/shipments";

/**
 * Stage 5: shipment management through the application services, on an
 * isolated PGlite database with every production migration applied.
 */
let t: TestDb;
let db: Database;
let staff: AppUser;
let admin: AppUser;
let customerA: AppUser;
let customerB: AppUser;
const AVAILABLE = { available: true } as const;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const user = async (email: string, role: "customer" | "staff" | "admin", name: string) => {
  const created = await createUser(t.client, email, role, name);
  return (await loadAppUser(db, created.id, email))!;
};

/** A request submitted by `owner` and quoted by staff; accepted unless told otherwise. */
async function request(owner: AppUser, { accept = true } = {}) {
  // Many submissions per customer: clear the (separately tested) submission limiter in this test database.
  await t.client.query("delete from public.rate_limits");
  const r = await submitQuoteRequest(
    db,
    {
      service: "barrels",
      originCountry: "IE",
      destinationCountry: "CM",
      items: [{ description: "Barrel of clothes", quantity: "1" }],
      contact: { name: "Stage Five", email: owner.email!, phone: "+353 89 123 4567" },
      locale: "en",
      idempotencyKey: randomUUID(),
      privacyAccepted: true,
      website: "",
    },
    { user: owner, clientId: randomUUID() },
    AVAILABLE,
  );
  if (!r.ok) throw new Error(r.code);
  await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
  const q = await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(10), lines: [{ kind: "charge", description: "Barrel", quantity: "1", unitPrice: "200.00" }] });
  if (!q.ok) throw new Error(q.code);
  if (accept) expect(await respondToQuote(db, owner, r.reference, true)).toMatchObject({ ok: true });
  return r;
}

async function shipmentFor(owner: AppUser) {
  const r = await request(owner);
  const created = await createShipmentForRequest(db, staff, r.requestId);
  if (!created.ok) throw new Error(created.code);
  const reference = created.data!.reference;
  const id = (await t.client.query<{ id: string }>("select id from public.shipments where reference = $1", [reference])).rows[0].id;
  return { request: r, reference, id };
}

beforeAll(async () => {
  t = await createTestDb();
  db = t.db as unknown as Database;
  staff = await user("staff.s5@example.test", "staff", "Siobhan Staff");
  admin = await user("admin.s5@example.test", "admin", "Ada Admin");
  customerA = await user("a.s5@example.test", "customer", "Customer Alpha");
  customerB = await user("b.s5@example.test", "customer", "Customer Beta");
});
afterAll(async () => {
  await t?.close();
});

describe("creating a shipment from a quote", () => {
  it("creates one shipment from an accepted quotation, owned by the request's customer and linked to it", async () => {
    const { request: r, reference } = await shipmentFor(customerA);
    expect(reference).toMatch(/^ML[A-Z2-7]{10}$/);
    const [row] = (
      await t.client.query<{ customer_id: string; service_code: string; status: string; created_by: string; request_ref: string }>(
        `select s.customer_id, s.service_code, s.status::text, s.created_by, qr.reference as request_ref
           from public.shipments s join public.quotes q on q.id = s.quote_id join public.quote_requests qr on qr.id = q.quote_request_id
          where s.reference = $1`,
        [reference],
      )
    ).rows;
    expect(row).toEqual({ customer_id: customerA.customerId, service_code: "barrels", status: "BOOKED", created_by: staff.id, request_ref: r.reference });
  });

  it("refuses a request whose quotation has not been accepted, and an unknown or malformed request id", async () => {
    const pending = await request(customerA, { accept: false });
    expect(await createShipmentForRequest(db, staff, pending.requestId)).toMatchObject({ ok: false, code: "quote_not_accepted" });
    expect(await createShipmentForRequest(db, staff, randomUUID())).toMatchObject({ ok: false, code: "quote_not_accepted" });
    expect(await createShipmentForRequest(db, staff, "not-a-uuid")).toEqual({ ok: false, code: "not_found" });
    expect(await createShipmentForRequest(db, staff, "' or 1=1 --")).toEqual({ ok: false, code: "not_found" });
  });

  it("never creates a second shipment for the same request, even when two attempts race", async () => {
    const r = await request(customerA);
    const [first, second] = await Promise.all([createShipmentForRequest(db, staff, r.requestId), createShipmentForRequest(db, staff, r.requestId)]);
    const results = [first, second];
    expect(results.filter((x) => x.ok)).toHaveLength(1);
    expect(results.find((x) => !x.ok)).toMatchObject({ ok: false, code: "shipment_exists" });
    expect(await createShipmentForRequest(db, staff, r.requestId)).toEqual({ ok: false, code: "shipment_exists" });
    const { rows } = await t.client.query<{ n: number }>(
      "select count(*)::int n from public.shipments s join public.quotes q on q.id = s.quote_id where q.quote_request_id = $1",
      [r.requestId],
    );
    expect(rows[0].n).toBe(1);
  });

  it("the database refuses a second shipment for the same quote even without the service check", async () => {
    const { request: r } = await shipmentFor(customerA);
    const [quote] = (await t.client.query<{ id: string }>("select id from public.quotes where quote_request_id = $1", [r.requestId])).rows;
    await expectDbError(
      asUser(t.client, staff.id, "insert into public.shipments (reference, quote_id, created_by) values ('MLZZZZZZZZZ2', $1, $2)", [quote.id, staff.id]),
      /shipments_quote_key|duplicate key/,
    );
  });
});

describe("status transitions and history", () => {
  it("applies only permitted transitions and records each change with the acting staff member", async () => {
    const { reference, id } = await shipmentFor(customerA);
    expect(await updateShipment(db, staff, { shipmentId: id, status: "DELIVERED", etaVisible: false })).toMatchObject({ ok: false, code: "invalid_shipment_transition" });
    expect(await updateShipment(db, staff, { shipmentId: id, status: "IN_TRANSIT", etaFrom: inDays(20), etaTo: inDays(30), etaVisible: true })).toEqual({ ok: true });
    expect(await updateShipment(db, admin, { shipmentId: id, status: "BOOKED", etaFrom: inDays(20), etaTo: inDays(30), etaVisible: true })).toMatchObject({
      ok: false,
      code: "invalid_shipment_transition",
    });
    expect(await updateShipment(db, admin, { shipmentId: id, status: "ON_HOLD", etaFrom: inDays(20), etaTo: inDays(30), etaVisible: true })).toEqual({ ok: true });
    expect(await addShipmentEvent(db, staff, { shipmentId: id, milestone: "DELAYED", occurredAt: new Date().toISOString(), public: false, noteEn: "INTERNAL: paperwork" })).toEqual({ ok: true });

    const view = (await getShipmentForStaff(db, staff, reference))!;
    expect(view.status).toBe("ON_HOLD");
    expect(view.history.map((h) => h.kind)).toEqual(["created", "status", "status", "milestone"]);
    expect(view.history[0]).toMatchObject({ kind: "created", status: "BOOKED", actor: staff.id });
    expect(view.history[1]).toMatchObject({ kind: "status", from: "BOOKED", to: "IN_TRANSIT", etaChanged: true, actor: staff.id });
    expect(view.history[2]).toMatchObject({ kind: "status", from: "IN_TRANSIT", to: "ON_HOLD", etaChanged: false, actor: admin.id });
    expect(view.history[3]).toMatchObject({ kind: "milestone", milestone: "DELAYED", public: false, actor: staff.id });
    // Staff names come from their account's customer record.
    expect(view.actorNames[staff.id]).toBe("Siobhan Staff");
    expect(view.actorNames[admin.id]).toBe("Ada Admin");
    // Refused changes leave no trace.
    expect(view.history.some((h) => h.kind === "status" && h.to === "DELIVERED")).toBe(false);
  });

  it("records visibility changes and ETA-only edits", async () => {
    const { reference, id } = await shipmentFor(customerA);
    await addShipmentEvent(db, staff, { shipmentId: id, milestone: "RECEIVED_AT_DEPOT", occurredAt: new Date().toISOString(), public: false });
    const eventId = (await t.client.query<{ id: string }>("select id from public.shipment_events where shipment_id = $1", [id])).rows[0].id;
    expect(await setShipmentEventVisibility(db, staff, eventId, true)).toEqual({ ok: true });
    expect(await updateShipment(db, staff, { shipmentId: id, status: "BOOKED", etaFrom: inDays(5), etaTo: inDays(9), etaVisible: false })).toEqual({ ok: true });
    const kinds = (await getShipmentForStaff(db, staff, reference))!.history.map((h) => (h.kind === "visibility" ? `visibility:${h.public}` : h.kind));
    expect(kinds).toEqual(["created", "milestone", "visibility:true", "eta"]);
  });

  it("DELIVERED and CANCELLED are final", async () => {
    const delivered = await shipmentFor(customerA);
    await updateShipment(db, staff, { shipmentId: delivered.id, status: "IN_TRANSIT", etaVisible: false });
    expect(await updateShipment(db, staff, { shipmentId: delivered.id, status: "DELIVERED", etaVisible: false })).toEqual({ ok: true });
    for (const to of ["BOOKED", "IN_TRANSIT", "AT_DESTINATION", "ON_HOLD", "CANCELLED"] as const) {
      expect(await updateShipment(db, staff, { shipmentId: delivered.id, status: to, etaVisible: false }), to).toMatchObject({ ok: false, code: "invalid_shipment_transition" });
    }
    const cancelled = await shipmentFor(customerA);
    expect(await updateShipment(db, staff, { shipmentId: cancelled.id, status: "CANCELLED", etaVisible: false })).toEqual({ ok: true });
    expect(await updateShipment(db, staff, { shipmentId: cancelled.id, status: "BOOKED", etaVisible: false })).toMatchObject({ ok: false, code: "invalid_shipment_transition" });
  });

  it("rejects invalid input before it reaches the database", async () => {
    const { id } = await shipmentFor(customerA);
    expect(await updateShipment(db, staff, { shipmentId: id, status: "LOST", etaVisible: false })).toMatchObject({ ok: false, code: "invalid" });
    expect(await updateShipment(db, staff, { shipmentId: "x", status: "IN_TRANSIT", etaVisible: false })).toMatchObject({ ok: false, code: "invalid" });
    expect(await updateShipment(db, staff, { shipmentId: id, status: "BOOKED", etaFrom: inDays(9), etaTo: inDays(5), etaVisible: true })).toMatchObject({
      ok: false,
      code: "invalid",
      fieldErrors: { etaTo: "invalid_range" },
    });
    expect(await updateShipment(db, staff, { shipmentId: randomUUID(), status: "IN_TRANSIT", etaVisible: false })).toEqual({ ok: false, code: "not_found" });
    expect(await addShipmentEvent(db, staff, { shipmentId: id, milestone: "TELEPORTED", occurredAt: new Date().toISOString(), public: true })).toMatchObject({ ok: false, code: "invalid" });
  });
});

describe("staff list, search and filters", () => {
  it("finds shipments by shipment reference, quote reference, customer name or email, and filters by status", async () => {
    const a = await shipmentFor(customerA);
    const b = await shipmentFor(customerB);
    await updateShipment(db, staff, { shipmentId: b.id, status: "IN_TRANSIT", etaVisible: false });
    const refs = async (filter: Parameters<typeof listShipmentsForStaff>[2]) => (await listShipmentsForStaff(db, staff, filter)).map((s) => s.reference);
    expect(await refs({ q: a.reference.toLowerCase() })).toEqual([a.reference]);
    expect(await refs({ q: b.request.reference })).toEqual([b.reference]);
    expect(await refs({ q: "customer beta" })).toContain(b.reference);
    expect(await refs({ q: "customer beta" })).not.toContain(a.reference);
    expect(await refs({ q: "b.s5@example" })).toContain(b.reference);
    expect(await refs({ status: "IN_TRANSIT" })).toContain(b.reference);
    expect(await refs({ status: "IN_TRANSIT" })).not.toContain(a.reference);
    // LIKE wildcards are matched literally, in shipment and quote searches alike.
    for (const wildcard of ["%", "_", "\\"]) {
      expect(await refs({ q: wildcard }), wildcard).toEqual([]);
      expect(await listQuoteRequestsForStaff(db, staff, { q: wildcard }), wildcard).toEqual([]);
    }
    expect(await refs({ q: a.reference.slice(0, 6) })).toContain(a.reference); // partial references still match
    const all = await listShipmentsForStaff(db, staff);
    expect(all.find((s) => s.reference === b.reference)?.customerName).toBe("Customer Beta");
  });
});

describe("customer access", () => {
  it("customers see only their own shipments, with public milestones and the ETA only when shared", async () => {
    const mine = await shipmentFor(customerB);
    await addShipmentEvent(db, staff, { shipmentId: mine.id, milestone: "RECEIVED_AT_DEPOT", occurredAt: new Date().toISOString(), public: true, location: "Lucan" });
    await addShipmentEvent(db, staff, { shipmentId: mine.id, milestone: "DELAYED", occurredAt: new Date().toISOString(), public: false, noteEn: "INTERNAL: do not show" });
    await updateShipment(db, staff, { shipmentId: mine.id, status: "BOOKED", etaFrom: inDays(30), etaTo: inDays(40), etaVisible: false });

    const listB = (await listCustomerShipments(db, customerB)).map((s) => s.reference);
    expect(listB).toContain(mine.reference);
    expect((await listCustomerShipments(db, customerA)).map((s) => s.reference)).not.toContain(mine.reference);

    const view = (await getCustomerShipment(db, customerB, mine.reference))!;
    expect(view.status).toBe("BOOKED");
    expect(view.quoteReference).toBe(mine.request.reference);
    expect(view.events.map((e) => e.milestone)).toEqual(["RECEIVED_AT_DEPOT"]);
    expect(JSON.stringify(view)).not.toMatch(/INTERNAL|customerEmail|history|actor/);
    expect([view.etaFrom, view.etaTo]).toEqual([null, null]); // recorded but not shared
    await updateShipment(db, staff, { shipmentId: mine.id, status: "BOOKED", etaFrom: inDays(30), etaTo: inDays(40), etaVisible: true });
    expect((await getCustomerShipment(db, customerB, mine.reference))!.etaFrom).toBe(inDays(30));
  });

  it("another customer's reference, a malformed reference and an unknown reference all look the same: not found", async () => {
    const theirs = await shipmentFor(customerB);
    expect(await getCustomerShipment(db, customerA, theirs.reference)).toBeNull();
    expect(await getCustomerShipment(db, customerA, "not-a-reference")).toBeNull();
    expect(await getCustomerShipment(db, customerA, "MLZZZZZZZZZZ")).toBeNull();
    expect(await getCustomerShipment(db, customerA, "' or 1=1 --")).toBeNull();
    expect(await getShipmentForStaff(db, staff, "not-a-reference")).toBeNull();
    // A user without a customer record (e.g. staff in the portal) sees nothing.
    expect(await listCustomerShipments(db, { ...customerA, customerId: null })).toEqual([]);
  });

  it("customers cannot use any staff operation, even by calling the services directly", async () => {
    const { request: r, reference, id } = await shipmentFor(customerA);
    const calls: [string, () => Promise<unknown>][] = [
      ["list", () => listShipmentsForStaff(db, customerA)],
      ["get", () => getShipmentForStaff(db, customerA, reference)],
      ["create", () => createShipmentForRequest(db, customerA, r.requestId)],
      ["update", () => updateShipment(db, customerA, { shipmentId: id, status: "DELIVERED", etaVisible: false })],
      ["event", () => addShipmentEvent(db, customerA, { shipmentId: id, milestone: "DELIVERED", occurredAt: new Date().toISOString(), public: true })],
      ["visibility", () => setShipmentEventVisibility(db, customerA, randomUUID(), true)],
    ];
    for (const [name, call] of calls) await expect(call(), name).rejects.toBeInstanceOf(AuthorizationError);
    expect((await t.client.query<{ status: string }>("select status::text from public.shipments where id = $1", [id])).rows[0].status).toBe("BOOKED");
  });
});

describe("database isolation (RLS and column privileges)", () => {
  it("a customer cannot create, update or re-own a shipment directly, nor read its audit history", async () => {
    const own = await shipmentFor(customerA);
    const other = await request(customerA);
    const [quote] = (await t.client.query<{ id: string }>("select id from public.quotes where quote_request_id = $1", [other.requestId])).rows;
    await expectDbError(
      asUser(t.client, customerA.id, "insert into public.shipments (reference, quote_id, created_by) values ('MLAAAAAAAAA2', $1, $2)", [quote.id, customerA.id]),
      /row-level security|permission denied/,
    );
    expect(await asUser(t.client, customerA.id, "update public.shipments set status = 'DELIVERED' where id = $1 returning id", [own.id])).toHaveLength(0);
    await expectDbError(asUser(t.client, customerA.id, "update public.shipments set customer_id = $2 where id = $1", [own.id, customerB.customerId]), /permission denied/);
    expect(await asUser(t.client, customerA.id, "select id from public.audit_log where entity = 'shipments'")).toHaveLength(0);
  });

  it("staff cannot move a shipment to another customer or quote, or bypass the transition rules in SQL", async () => {
    const own = await shipmentFor(customerA);
    await expectDbError(asUser(t.client, staff.id, "update public.shipments set customer_id = $2 where id = $1", [own.id, customerB.customerId]), /permission denied/);
    await expectDbError(asUser(t.client, staff.id, "update public.shipments set status = 'DELIVERED' where id = $1", [own.id]), /invalid_shipment_transition/);
    await expectDbError(asUser(t.client, staff.id, "delete from public.shipments where id = $1", [own.id]), /permission denied/);
  });
});
