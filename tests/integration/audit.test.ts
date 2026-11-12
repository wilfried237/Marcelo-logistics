import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, createUser, type TestDb } from "../db/harness";
import type { Database } from "@/lib/db/types";
import { AuthorizationError, type AppUser } from "@/lib/auth/types";
import { loadAppUser, setUserRole, updateOwnCustomerProfile } from "@/lib/services/users";
import { issueQuote, respondToQuote, submitQuoteRequest, transitionQuoteRequest } from "@/lib/services/quote-requests";
import { createShipmentForRequest, updateShipment } from "@/lib/services/shipments";
import { AUDIT_PAGE_SIZE, changedFieldNames, listAuditActors, searchAudit } from "@/lib/services/audit";

/* Stage 6: staff audit search on PGlite with every migration (append-only audit_log written by triggers). */
let t: TestDb;
let db: Database;
let staff: AppUser;
let admin: AppUser;
let customer: AppUser;
let requestRef = "";
let shipmentRef = "";
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  t = await createTestDb();
  db = t.db as unknown as Database;
  const s = await createUser(t.client, "audit.staff@example.test", "staff", "Aoife Staff");
  const a = await createUser(t.client, "audit.admin@example.test", "admin", "Ade Admin");
  const c = await createUser(t.client, "audit.customer@example.test", "customer", "Cara Customer");
  staff = (await loadAppUser(db, s.id, "audit.staff@example.test"))!;
  admin = (await loadAppUser(db, a.id, "audit.admin@example.test"))!;
  customer = (await loadAppUser(db, c.id, "audit.customer@example.test"))!;

  const r = await submitQuoteRequest(
    db,
    {
      service: "barrels",
      originCountry: "IE",
      destinationCountry: "CM",
      items: [{ description: "Barrel", quantity: "1" }],
      contact: { name: "Cara Customer", email: "audit.customer@example.test", phone: "+353 89 123 4567" },
      locale: "en",
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
  await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(10), lines: [{ kind: "charge", description: "Barrel", quantity: "1", unitPrice: "200.00" }] });
  await respondToQuote(db, customer, r.reference, true);
  const shipment = await createShipmentForRequest(db, admin, r.requestId);
  if (!shipment.ok) throw new Error(shipment.code);
  shipmentRef = shipment.data!.reference;
  const [{ id }] = (await t.client.query<{ id: string }>("select id from public.shipments where reference = $1", [shipmentRef])).rows;
  await updateShipment(db, staff, { shipmentId: id, status: "IN_TRANSIT", etaVisible: false });
  // A customer edits their own phone number: a value that must never be shown.
  await updateOwnCustomerProfile(db, customer, { name: "Cara Customer", phone: "+353 SECRET 0000", preferredLocale: "en" });
});
afterAll(async () => t?.close());

describe("staff audit search", () => {
  it("is staff-only", async () => {
    await expect(searchAudit(db, customer)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(listAuditActors(db, customer)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("shows which fields changed, never their old or new values", async () => {
    const result = await searchAudit(db, staff, { entity: "customers", action: "update" });
    const phoneChange = result.entries.find((e) => e.fields.includes("phone"));
    expect(phoneChange).toBeDefined();
    expect(phoneChange!.actor).toEqual({ id: customer.id, name: "Cara Customer" });
    const everything = JSON.stringify(await searchAudit(db, staff, {}));
    expect(everything).not.toContain("SECRET");
    expect(everything).not.toMatch(/"before"|"after"|\+353/);
    expect(changedFieldNames("customers.update", { phone: "a" }, { phone: "b", name: "x" })).toEqual(["name", "phone"]);
    expect(changedFieldNames("customers.insert", null, { phone: "b" })).toEqual([]);
  });

  it("filters by record type, action, staff member and date range", async () => {
    const shipments = await searchAudit(db, staff, { entity: "shipments" });
    expect(shipments.entries.map((e) => e.action).sort()).toEqual(["insert", "status_changed"]);
    expect((await searchAudit(db, staff, { entity: "shipments", action: "status_changed" })).entries).toMatchObject([
      { entity: "shipments", action: "status_changed", fields: ["status"], actor: { id: staff.id, name: "Aoife Staff" } },
    ]);
    const byAdmin = await searchAudit(db, staff, { actor: admin.id });
    expect(byAdmin.total).toBeGreaterThan(0);
    expect(byAdmin.entries.every((e) => e.actor.id === admin.id)).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    expect((await searchAudit(db, staff, { from: today, to: today })).total).toBe((await searchAudit(db, staff, {})).total);
    expect((await searchAudit(db, staff, { to: "2020-01-01" })).total).toBe(0);
    // Unknown filter values are ignored rather than trusted.
    expect((await searchAudit(db, staff, { entity: "auth.users", action: "drop", actor: "' or 1=1" })).total).toBe((await searchAudit(db, staff, {})).total);
  });

  it("finds a record's history by reference, with links to the record", async () => {
    const byRequest = await searchAudit(db, staff, { q: requestRef.toLowerCase() });
    expect(new Set(byRequest.entries.map((e) => e.entity))).toEqual(new Set(["quote_requests", "quotes", "quote_line_items"]));
    expect(byRequest.entries.every((e) => e.link?.href === `/admin/quotes/${requestRef}`)).toBe(true);
    const byShipment = await searchAudit(db, staff, { q: shipmentRef });
    expect(byShipment.entries.length).toBe(2);
    expect(byShipment.entries.every((e) => e.link?.href === `/admin/shipments/${shipmentRef}`)).toBe(true);
    expect(await searchAudit(db, staff, { q: "QRZZZZZZ" })).toMatchObject({ total: 0, invalidReference: false });
    expect(await searchAudit(db, staff, { q: "hello" })).toMatchObject({ total: 0, invalidReference: true });
  });

  it("links role changes to user management for admins only", async () => {
    await setUserRole(db, admin, customer.id, "staff");
    await setUserRole(db, admin, customer.id, "customer");
    const forAdmin = await searchAudit(db, admin, { entity: "profiles", action: "role_changed" });
    // Two changes here, plus the staff and admin roles given when the test users were created.
    expect(forAdmin.entries.length).toBe(4);
    expect(forAdmin.entries.every((e) => e.link?.href === "/admin/users" && e.fields.includes("role"))).toBe(true);
    expect((await searchAudit(db, staff, { entity: "profiles", action: "role_changed" })).entries.every((e) => e.link === null)).toBe(true);
  });

  it("pages through long histories, newest first", async () => {
    // Synthetic entries (the trigger path is covered above); audit_log accepts inserts but never updates or deletes.
    const values = Array.from({ length: AUDIT_PAGE_SIZE + 7 }, (_, i) => `('${staff.id}', 'customers.update', 'customers', '${randomUUID()}', null, '{"name":"x${i}"}', now() - interval '${i} seconds')`).join(",");
    await t.client.query(`insert into public.audit_log (actor, action, entity, entity_id, before, after, at) values ${values}`);
    const first = await searchAudit(db, staff, { entity: "customers", actor: staff.id });
    expect(first).toMatchObject({ total: AUDIT_PAGE_SIZE + 7, page: 1, pages: 2 });
    expect(first.entries).toHaveLength(AUDIT_PAGE_SIZE);
    const second = await searchAudit(db, staff, { entity: "customers", actor: staff.id, page: 2 });
    expect(second.entries).toHaveLength(7);
    expect(new Set([...first.entries, ...second.entries].map((e) => e.id)).size).toBe(AUDIT_PAGE_SIZE + 7);
    expect(first.entries[0].at.getTime()).toBeGreaterThanOrEqual(second.entries[0].at.getTime());
    expect((await searchAudit(db, staff, { entity: "customers", actor: staff.id, page: 99 })).entries).toEqual([]);
  });

  it("lists staff and admins as possible actors, with names", async () => {
    const actors = await listAuditActors(db, staff);
    expect(actors).toEqual(expect.arrayContaining([{ id: staff.id, name: "Aoife Staff" }, { id: admin.id, name: "Ade Admin" }]));
    expect(actors.find((a) => a.id === customer.id)).toBeUndefined();
  });
});
