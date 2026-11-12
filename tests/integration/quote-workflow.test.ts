import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, createUser, type TestDb } from "../db/harness";
import type { Database } from "@/lib/db/types";
import type { AppUser } from "@/lib/auth/types";
import { AuthorizationError } from "@/lib/auth/types";
import {
  getCustomerQuoteRequest,
  getQuoteRequestForStaff,
  listCustomerQuoteRequests,
  listQuoteRequestsForStaff,
  respondToQuote,
  sendQuote,
  submitQuoteRequest,
  transitionQuoteRequest,
} from "@/lib/services/quote-requests";
import { addShipmentEvent, createShipmentForRequest, getCustomerShipment, updateShipment } from "@/lib/services/shipments";
import { trackShipment } from "@/lib/services/tracking";
import { loadAppUser, setUserRole } from "@/lib/services/users";

let t: TestDb;
let db: Database;
let staff: AppUser;
let admin: AppUser;
let customerA: AppUser;
let customerB: AppUser;
const AVAILABLE = { available: true } as const;

const validInput = (overrides: Record<string, unknown> = {}) => ({
  service: "barrels",
  originCountry: "IE",
  destinationCountry: "CM",
  destinationCity: "Douala",
  items: [{ description: "Barrel of clothes", quantity: "2", weightKg: "80" }],
  notes: "Please call before collection",
  contact: { name: "Ada Example", email: "Ada@Example.test", phone: "+353 1 234 5678" },
  locale: "en",
  idempotencyKey: randomUUID(),
  privacyAccepted: true,
  website: "",
  ...overrides,
});

const user = async (email: string, role: "customer" | "staff" | "admin") => {
  const created = await createUser(t.client, email, role, email.split("@")[0]);
  return (await loadAppUser(db, created.id, email))!;
};

beforeAll(async () => {
  t = await createTestDb();
  db = t.db as unknown as Database;
  staff = await user("staff@example.test", "staff");
  admin = await user("admin@example.test", "admin");
  customerA = await user("a@example.test", "customer");
  customerB = await user("b@example.test", "customer");
});
afterAll(async () => t?.close());

const count = async (table: string) => (await t.client.query<{ n: number }>(`select count(*)::int n from public.${table}`)).rows[0].n;

describe("quote submission", () => {
  it("is refused while the feature is unavailable, storing nothing", async () => {
    const before = await count("quote_requests");
    const result = await submitQuoteRequest(db, validInput(), { user: null, clientId: "1.1.1.1" }, { available: false, reason: "flag_disabled" });
    expect(result).toEqual({ ok: false, code: "unavailable" });
    expect(await count("quote_requests")).toBe(before);
  });

  it("returns field-level validation errors", async () => {
    const result = await submitQuoteRequest(
      db,
      validInput({ items: [], contact: { name: "", email: "not-an-email" }, idempotencyKey: "x" }),
      { user: null, clientId: "1.1.1.2" },
      AVAILABLE,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid");
    expect(result.fieldErrors).toMatchObject({ items: "required", "contact.name": "required", "contact.email": "invalid_email", idempotencyKey: "invalid" });
  });

  it("validates items per service and rejects unknown fields and oversize text", async () => {
    const vehicleWithoutYear = await submitQuoteRequest(db, validInput({ service: "vehicle", items: [{ vehicleMake: "X", vehicleModel: "Y" }] }), { user: null, clientId: "1.1.1.3" }, AVAILABLE);
    expect(vehicleWithoutYear).toMatchObject({ ok: false, fieldErrors: { "items.0.vehicleYear": "invalid" } });
    const extraField = await submitQuoteRequest(db, validInput({ items: [{ description: "x", quantity: 1, price: 1 }] }), { user: null, clientId: "1.1.1.3" }, AVAILABLE);
    expect(extraField).toMatchObject({ ok: false, code: "invalid" });
    const longNotes = await submitQuoteRequest(db, validInput({ notes: "x".repeat(2001) }), { user: null, clientId: "1.1.1.3" }, AVAILABLE);
    expect(longNotes).toMatchObject({ ok: false, fieldErrors: { notes: "too_long" } });
    const badService = await submitQuoteRequest(db, validInput({ service: "teleport" }), { user: null, clientId: "1.1.1.3" }, AVAILABLE);
    expect(badService).toMatchObject({ ok: false, code: "invalid" });
  });

  it("rejects honeypot submissions without storing anything or reporting success", async () => {
    const before = await count("quote_requests");
    const result = await submitQuoteRequest(db, validInput({ website: "http://spam.example" }), { user: null, clientId: "1.1.1.4" }, AVAILABLE);
    expect(result).toEqual({ ok: false, code: "rejected" });
    expect(await count("quote_requests")).toBe(before);
  });

  it("rejects routes that are not offered", async () => {
    const result = await submitQuoteRequest(db, validInput({ destinationCountry: "FR" }), { user: null, clientId: "1.1.1.5" }, AVAILABLE);
    expect(result).toMatchObject({ ok: false, code: "route_not_offered" });
    const sameCountry = await submitQuoteRequest(db, validInput({ originCountry: "IE", destinationCountry: "IE", contact: { name: "Same", email: "same.country@example.test", phone: "+353 89 000 0000" } }), { user: null, clientId: "1.1.1.6" }, AVAILABLE);
    expect(sameCountry).toMatchObject({ ok: false, code: "route_not_offered" });
  });

  it("accepts both monthly routes: Ireland to Cameroon and Cameroon to Ireland", async () => {
    // Own addresses, so the per-email rate limit shared by the other tests is untouched.
    const contact = (name: string) => ({ name, email: `${name}@example.test`, phone: "+353 89 000 0000" });
    const outbound = await submitQuoteRequest(db, validInput({ originCountry: "IE", destinationCountry: "CM", contact: contact("outbound") }), { user: null, clientId: "1.1.1.7" }, AVAILABLE);
    const inbound = await submitQuoteRequest(db, validInput({ originCountry: "CM", destinationCountry: "IE", contact: contact("inbound") }), { user: null, clientId: "1.1.1.8" }, AVAILABLE);
    expect(outbound).toMatchObject({ ok: true });
    expect(inbound).toMatchObject({ ok: true });
  });

  it("persists an anonymous request with a secure reference and audit record", async () => {
    const result = await submitQuoteRequest(db, validInput(), { user: null, clientId: "1.1.1.6" }, AVAILABLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reference).toMatch(/^QR[A-Z2-7]{6}$/);
    const { rows } = await t.client.query<{ email: string; status: string; items: unknown }>(
      "select c.email, r.status, r.items from public.quote_requests r join public.customers c on c.id = r.customer_id where r.reference = $1",
      [result.reference],
    );
    expect(rows[0]).toMatchObject({ email: "ada@example.test", status: "SUBMITTED", items: [{ description: "Barrel of clothes", quantity: 2, weightKg: 80 }] });
    const audit = await t.client.query("select 1 from public.audit_log where entity = 'quote_requests' and entity_id = $1", [result.requestId]);
    expect(audit.rows).toHaveLength(1);
  });

  it("stores the customer's catalogue choice and vehicle method with the request, and rejects a mismatched choice", async () => {
    const contact = (name: string) => ({ name, email: `${name}@example.test`, phone: "+353 89 000 0000" });
    const barrel = await submitQuoteRequest(
      db,
      validInput({ items: [{ catalogueItem: "barrels.barrel_220_supplied", description: "220-litre barrel supplied", quantity: "1" }], contact: contact("catalogue") }),
      { user: null, clientId: "1.1.2.1" },
      AVAILABLE,
    );
    expect(barrel.ok).toBe(true);
    if (!barrel.ok) return;
    const stored = await t.client.query<{ items: unknown }>("select items from public.quote_requests where reference = $1", [barrel.reference]);
    expect(stored.rows[0].items).toEqual([{ catalogueItem: "barrels.barrel_220_supplied", description: "220-litre barrel supplied", quantity: 1 }]);

    const car = await submitQuoteRequest(
      db,
      validInput({ service: "vehicle", items: [{ vehicleMake: "Toyota", vehicleModel: "Yaris", vehicleYear: "2015", running: true, catalogueItem: "vehicles.small_city_car", shippingMethod: "container" }], contact: contact("vehicle-catalogue") }),
      { user: null, clientId: "1.1.2.2" },
      AVAILABLE,
    );
    expect(car.ok).toBe(true);

    const before = await count("quote_requests");
    const mismatched = await submitQuoteRequest(
      db,
      validInput({ items: [{ catalogueItem: "vehicles.small_city_car", description: "x", quantity: "1" }], contact: contact("mismatch") }),
      { user: null, clientId: "1.1.2.3" },
      AVAILABLE,
    );
    expect(mismatched).toMatchObject({ ok: false, code: "invalid", fieldErrors: { "items.0.catalogueItem": "invalid" } });
    expect(await count("quote_requests")).toBe(before);
  });

  it("treats a retried submission (same idempotency key) as one request", async () => {
    const input = validInput();
    const first = await submitQuoteRequest(db, input, { user: null, clientId: "1.1.1.7" }, AVAILABLE);
    const second = await submitQuoteRequest(db, input, { user: null, clientId: "1.1.1.7" }, AVAILABLE);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second).toMatchObject({ duplicate: true, reference: first.reference });
    const { rows } = await t.client.query<{ n: number }>("select count(*)::int n from public.quote_requests where idempotency_key = $1", [input.idempotencyKey]);
    expect(rows[0].n).toBe(1);
  });

  it("enforces persistent rate limits per client", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await submitQuoteRequest(db, validInput({ contact: { name: "R", email: `r${i}@example.test`, phone: "+353 89 000 0000" } }), { user: null, clientId: "9.9.9.9" }, AVAILABLE));
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5]).toEqual({ ok: false, code: "rate_limited" });
  });

  it("enforces rate limits per email address across clients", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await submitQuoteRequest(db, validInput({ contact: { name: "E", email: "same@example.test", phone: "+353 89 000 0000" } }), { user: null, clientId: `8.8.8.${i}` }, AVAILABLE));
    expect(results[5]).toEqual({ ok: false, code: "rate_limited" });
  });

  it("never reports success when the database fails", async () => {
    const broken = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "$transaction") return () => Promise.reject(new Error("connection terminated"));
        return Reflect.get(target, prop, receiver);
      },
    });
    const result = await submitQuoteRequest(broken, validInput(), { user: null, clientId: "1.1.1.8" }, AVAILABLE);
    expect(result).toEqual({ ok: false, code: "server_error" });
  });

  it("derives the customer from the session, ignoring any customer id in the input", async () => {
    const result = await submitQuoteRequest(db, { ...validInput(), customerId: customerB.customerId }, { user: customerA, clientId: "1.1.1.9" }, AVAILABLE);
    expect(result).toMatchObject({ ok: false, code: "invalid" }); // unknown field rejected outright
    const ok = await submitQuoteRequest(db, validInput(), { user: customerA, clientId: "1.1.1.9" }, AVAILABLE);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const { rows } = await t.client.query<{ customer_id: string }>("select customer_id from public.quote_requests where reference = $1", [ok.reference]);
    expect(rows[0].customer_id).toBe(customerA.customerId);
  });
});

describe("staff review, manual quote, acceptance, shipment and tracking", () => {
  let reference = "";
  let requestId = "";
  let shipmentReference = "";

  it("rejects staff operations for customers", async () => {
    await expect(listQuoteRequestsForStaff(db, customerA)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(transitionQuoteRequest(db, customerA, {})).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("lets the customer see their own request but not another customer's", async () => {
    const created = await submitQuoteRequest(db, validInput(), { user: customerA, clientId: "2.2.2.1" }, AVAILABLE);
    if (!created.ok) throw new Error("setup failed");
    reference = created.reference;
    requestId = created.requestId;
    expect((await listCustomerQuoteRequests(db, customerA)).map((r) => r.reference)).toContain(reference);
    expect(await getCustomerQuoteRequest(db, customerB, reference)).toBeNull();
    expect(await getCustomerQuoteRequest(db, customerA, reference)).toMatchObject({ reference, status: "SUBMITTED", quotes: [] });
  });

  it("validates transitions, including the cancellation reason", async () => {
    expect(await transitionQuoteRequest(db, staff, { requestId, to: "QUOTED" })).toMatchObject({ ok: false, code: "invalid_quote_transition" });
    expect(await transitionQuoteRequest(db, staff, { requestId, to: "CANCELLED" })).toMatchObject({ ok: false, code: "invalid", fieldErrors: { reason: "required" } });
    expect(await transitionQuoteRequest(db, staff, { requestId, to: "UNDER_REVIEW" })).toEqual({ ok: true, data: { status: "UNDER_REVIEW" } });
  });

  it("sends a manually entered quote in integer minor units", async () => {
    const validUntil = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
    expect(await sendQuote(db, staff, { requestId, amount: "450.505", currency: "EUR", validUntil })).toMatchObject({ ok: false, code: "invalid" });
    expect(await sendQuote(db, staff, { requestId, amount: "10.50", currency: "XAF", validUntil })).toMatchObject({ ok: false, fieldErrors: { amount: "invalid" } });
    const sent = await sendQuote(db, staff, { requestId, amount: "450.50", currency: "EUR", inclusions: "Sea freight", exclusions: "Duties", validUntil });
    expect(sent).toMatchObject({ ok: true, data: { reference, totalMinor: "45050" } });
    const view = await getCustomerQuoteRequest(db, customerA, reference);
    expect(view).toMatchObject({ status: "QUOTED", quotes: [{ amountMinor: 45050, currency: "EUR" }] });
    const staffView = await getQuoteRequestForStaff(db, staff, reference);
    expect(staffView?.history.map((h) => h.action)).toEqual(["quote_requests.insert", "quote_requests.status_changed", "quote_requests.status_changed"]);
  });

  it("lets only the owner accept", async () => {
    expect(await respondToQuote(db, customerB, reference, true)).toEqual({ ok: false, code: "not_found" });
    expect(await respondToQuote(db, customerA, reference, true)).toEqual({ ok: true, status: "ACCEPTED" });
  });

  it("creates the shipment, records events and keeps internal events private", async () => {
    const created = await createShipmentForRequest(db, staff, requestId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    shipmentReference = created.data!.reference;
    expect(shipmentReference).toMatch(/^ML[A-Z2-7]{10}$/);
    const [{ id: shipmentId }] = (await t.client.query<{ id: string }>("select id from public.shipments where reference = $1", [shipmentReference])).rows;
    expect(await addShipmentEvent(db, staff, { shipmentId, milestone: "RECEIVED_AT_DEPOT", location: "Dublin", occurredAt: new Date().toISOString(), noteEn: "Received", noteFr: "Reçu", public: true })).toEqual({ ok: true });
    expect(await addShipmentEvent(db, staff, { shipmentId, milestone: "RECEIVED_AT_DEPOT", occurredAt: new Date().toISOString(), noteEn: "Internal check", public: false })).toEqual({ ok: true });
    expect(await updateShipment(db, staff, { shipmentId, status: "IN_TRANSIT", etaFrom: "2030-01-10", etaTo: "2030-01-20", etaVisible: false })).toEqual({ ok: true, data: { milestone: "none" } });

    const customerView = await getCustomerShipment(db, customerA, shipmentReference);
    expect(customerView?.events).toHaveLength(1);
    expect(customerView?.etaFrom).toBeNull();
    expect(await getCustomerShipment(db, customerB, shipmentReference)).toBeNull();
  });

  it("public tracking exposes only the allowlisted public data", async () => {
    const result = await trackShipment(db, shipmentReference.toLowerCase(), "3.3.3.3");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shipment.events).toHaveLength(1);
    expect(JSON.stringify(result.shipment)).not.toMatch(/Internal check|a@example|customer/i);
    expect(await trackShipment(db, "MLAAAAAAAAAA", "3.3.3.3")).toEqual({ ok: false, code: "not_found" });
    expect(await trackShipment(db, "<script>", "3.3.3.3")).toEqual({ ok: false, code: "invalid_reference" });
  });

  it("rate-limits tracking lookups", async () => {
    let last;
    for (let i = 0; i < 31; i++) last = await trackShipment(db, "MLAAAAAAAAAA", "4.4.4.4");
    expect(last).toEqual({ ok: false, code: "rate_limited" });
  });
});

describe("roles", () => {
  it("only admins change roles, through the audited database function", async () => {
    await expect(setUserRole(db, staff, customerB.id, "staff")).rejects.toBeInstanceOf(AuthorizationError);
    expect(await setUserRole(db, admin, customerB.id, "staff")).toEqual({ ok: true });
    expect((await loadAppUser(db, customerB.id, null))?.role).toBe("staff");
    expect(await setUserRole(db, admin, customerB.id, "customer")).toEqual({ ok: true });
  });
});
