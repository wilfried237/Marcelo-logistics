import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { asRole, asSystem, createTestDb, createUser, expectDbError, type TestDb } from "../db/harness";
import type { Database } from "@/lib/db/types";
import type { AppUser } from "@/lib/auth/types";
import { AuthorizationError } from "@/lib/auth/types";
import { loadAppUser } from "@/lib/services/users";
import { getCustomerQuoteRequest, getQuoteRequestForStaff, issueQuote, listQuoteRequestsForStaff, submitQuoteRequest, transitionQuoteRequest } from "@/lib/services/quote-requests";
import {
  addCustomerReply,
  addInternalNote,
  assignRequest,
  getQuoteForLink,
  listContactEnquiries,
  replyViaLink,
  reportShipmentIssue,
  requestInformation,
  respondViaLink,
  submitContactEnquiry,
} from "@/lib/services/cases";
import { createQuoteToken, verifyQuoteToken } from "@/lib/services/quote-links";
import { addShipmentEvent, createShipmentForRequest, updateShipment } from "@/lib/services/shipments";
import { trackShipment } from "@/lib/services/tracking";
import { queueExpiryReminders, runJob } from "@/lib/services/jobs";
import { renderOutboxEmail } from "@/lib/email/render";
import { SHIPMENT_TRANSITIONS } from "@/lib/domain/shipment-lifecycle";
import { SHIPMENT_STATUSES } from "@/lib/domain/enums";

let t: TestDb;
let db: Database;
let staff: AppUser;
let customerA: AppUser;
let customerB: AppUser;
const SECRET = "test-quote-link-secret-with-more-than-32-chars";
const AVAILABLE = { available: true } as const;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const user = async (email: string, role: "customer" | "staff" | "admin") => {
  const created = await createUser(t.client, email, role, email.split("@")[0]);
  return (await loadAppUser(db, created.id, email))!;
};
const input = (overrides: Record<string, unknown> = {}) => ({
  service: "parcels",
  originCountry: "CM",
  destinationCountry: "IE",
  items: [{ description: "Documents", quantity: "1" }],
  contact: { name: "Ngozi Example", email: `n.${randomUUID().slice(0, 8)}@example.test`, phone: "+237 6 95 73 90 33" },
  locale: "en",
  idempotencyKey: randomUUID(),
  privacyAccepted: true,
  website: "",
  ...overrides,
});
const emails = async (where: string) => (await t.client.query<{ template: string; audience: string }>(`select template, audience from public.email_deliveries where ${where} order by created_at`)).rows;

async function quotedRequest(asUser: AppUser | null = null) {
  const r = await submitQuoteRequest(db, input(), { user: asUser, clientId: randomUUID() }, AVAILABLE);
  if (!r.ok) throw new Error(r.code);
  await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
  const q = await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(10), lines: [{ kind: "charge", description: "Air parcel", quantity: "1", unitPrice: "85.00" }] });
  if (!q.ok) throw new Error(q.code);
  return r;
}

beforeAll(async () => {
  process.env.QUOTE_LINK_SECRET = SECRET;
  t = await createTestDb();
  db = t.db as unknown as Database;
  staff = await user("staff.mvp@example.test", "staff");
  customerA = await user("a.mvp@example.test", "customer");
  customerB = await user("b.mvp@example.test", "customer");
});
afterAll(async () => {
  delete process.env.QUOTE_LINK_SECRET;
  await t?.close();
});

describe("quote request submission (Phase 1)", () => {
  it("requires an international phone number and the privacy acknowledgement, and records it", async () => {
    const noConsent = await submitQuoteRequest(db, input({ privacyAccepted: false }), { user: null, clientId: randomUUID() }, AVAILABLE);
    expect(noConsent).toMatchObject({ ok: false, code: "invalid", fieldErrors: { privacyAccepted: "consent_required" } });
    for (const phone of ["0891234567", "+1", "", "+353 abc"]) {
      const bad = await submitQuoteRequest(db, input({ contact: { name: "X", email: "x@example.test", phone } }), { user: null, clientId: randomUUID() }, AVAILABLE);
      expect(bad, phone).toMatchObject({ ok: false, code: "invalid" });
    }
    const ok = await submitQuoteRequest(db, input(), { user: null, clientId: randomUUID() }, AVAILABLE);
    expect(ok.ok).toBe(true);
    const row = (await t.client.query<{ privacy_accepted_at: Date | null }>("select privacy_accepted_at from public.quote_requests where reference = $1", [ok.ok ? ok.reference : ""])).rows[0];
    expect(row.privacy_accepted_at).toBeInstanceOf(Date);
  });

  it("rejects negative weights, zero quantities, invalid dimensions and oversized payloads", async () => {
    const items = [
      [{ description: "Box", quantity: "0" }],
      [{ description: "Box", quantity: "1", weightKg: "-5" }],
      [{ description: "Box", quantity: "1", lengthCm: "abc" }],
      Array.from({ length: 21 }, () => ({ description: "Box", quantity: "1" })),
      [{ description: "x".repeat(201), quantity: "1" }],
      [{ description: "<script>alert(1)</script>", quantity: "1", extra: "field" }],
    ];
    for (const set of items) {
      const r = await submitQuoteRequest(db, input({ items: set }), { user: null, clientId: randomUUID() }, AVAILABLE);
      expect(r).toMatchObject({ ok: false, code: "invalid" });
    }
  });
});

describe("staff case management (Phase 1)", () => {
  it("searches by reference, customer name or email; filters by assignment; sorts by date", async () => {
    const r = await submitQuoteRequest(db, input({ contact: { name: "Searchable Person", email: "find.me@example.test", phone: "+353 89 111 2222" } }), { user: null, clientId: randomUUID() }, AVAILABLE);
    if (!r.ok) throw new Error("setup");
    for (const q of [r.reference, r.reference.slice(2, 6).toLowerCase(), "searchable", "FIND.ME"]) {
      const found = await listQuoteRequestsForStaff(db, staff, { q });
      expect(found.map((x) => x.reference), q).toContain(r.reference);
    }
    expect(await assignRequest(db, staff, { requestId: r.requestId, assigneeId: staff.id })).toEqual({ ok: true });
    expect((await listQuoteRequestsForStaff(db, staff, { assigned: "me" })).map((x) => x.reference)).toContain(r.reference);
    expect((await listQuoteRequestsForStaff(db, staff, { assigned: "unassigned" })).map((x) => x.reference)).not.toContain(r.reference);
    const newest = await listQuoteRequestsForStaff(db, staff, { sort: "newest" });
    const oldest = await listQuoteRequestsForStaff(db, staff, { sort: "oldest" });
    expect(newest[0].createdAt.getTime()).toBeGreaterThanOrEqual(oldest[0].createdAt.getTime());
  });

  it("only staff can be assigned, and only staff can assign", async () => {
    const r = await submitQuoteRequest(db, input(), { user: null, clientId: randomUUID() }, AVAILABLE);
    if (!r.ok) throw new Error("setup");
    expect(await assignRequest(db, staff, { requestId: r.requestId, assigneeId: customerA.id })).toMatchObject({ ok: false, code: "assignee_not_staff" });
    await expect(assignRequest(db, customerA, { requestId: r.requestId, assigneeId: staff.id })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("internal notes stay internal; information requests reach the customer and move the request", async () => {
    const r = await submitQuoteRequest(db, input(), { user: customerA, clientId: randomUUID() }, AVAILABLE);
    if (!r.ok) throw new Error("setup");
    await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
    expect(await addInternalNote(db, staff, { requestId: r.requestId, body: "INTERNAL: customer is a reseller" })).toEqual({ ok: true });
    expect(await requestInformation(db, staff, { requestId: r.requestId, body: "Please confirm the weight of the parcel." })).toEqual({ ok: true });

    const staffView = await getQuoteRequestForStaff(db, staff, r.reference);
    expect(staffView?.status).toBe("AWAITING_CUSTOMER");
    expect(staffView?.messages.map((m) => m.kind)).toEqual(["note", "info_request"]);

    const customerView = await getCustomerQuoteRequest(db, customerA, r.reference);
    expect(customerView?.messages.map((m) => m.kind)).toEqual(["info_request"]);
    expect(JSON.stringify(customerView)).not.toContain("INTERNAL");
    // Directly through RLS as the customer: the note is invisible.
    const rows = await asRole<{ body: string }>(t.client, "authenticated", customerA.id, "select body from public.case_messages");
    expect(rows.map((x) => x.body)).toEqual(["Please confirm the weight of the parcel."]);
    // A customer cannot write an internal note or a staff message.
    await expectDbError(
      asRole(t.client, "authenticated", customerA.id, `insert into public.case_messages (quote_request_id, author_kind, author_id, internal, kind, body) values ('${r.requestId}', 'staff', '${customerA.id}', true, 'note', 'x')`),
      /row-level security|forbidden/,
    );

    // The information-request email quotes the question.
    const row = (await t.client.query<{ id: string; template: string; audience: string; recipient: string; locale: "en"; entity: string; entity_id: string; payload: Record<string, unknown> }>(
      "select id, template, audience, recipient, locale::text as locale, entity, entity_id, payload from public.email_deliveries where template = 'info_requested' and entity_id = $1",
      [r.requestId],
    )).rows[0];
    const rendered = await renderOutboxEmail(db, { ...row, audience: "customer", entityId: row.entity_id });
    expect("props" in rendered && rendered.props.callout).toBe("Please confirm the weight of the parcel.");

    // Customer reply alerts staff; another customer cannot reply.
    expect(await addCustomerReply(db, customerA, r.reference, "It weighs 2 kg.")).toEqual({ ok: true });
    expect(await addCustomerReply(db, customerB, r.reference, "Not mine")).toMatchObject({ ok: false, code: "not_found" });
    expect((await emails(`template = 'staff_customer_message'`)).length).toBeGreaterThanOrEqual(1);
  });
});

describe("pricing persistence and database verification (Phase 2)", () => {
  it("stores every line and its total; the database re-verifies totals when sending", async () => {
    const r = await submitQuoteRequest(db, input(), { user: null, clientId: randomUUID() }, AVAILABLE);
    if (!r.ok) throw new Error("setup");
    await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
    const result = await issueQuote(db, staff, {
      requestId: r.requestId,
      currency: "XAF",
      validUntil: inDays(5),
      lines: [
        { kind: "charge", description: "Carton", quantity: "3", unitPrice: "15000" },
        { kind: "charge", description: "Pick-up", quantity: "1.5", unitPrice: "2001" },
        { kind: "discount", description: "Promotion", quantity: "1", unitPrice: "1000" },
      ],
    });
    expect(result).toMatchObject({ ok: true, data: { totalMinor: "47002" } }); // 45000 + 3001.5->3002 - 1000
    const lines = (await t.client.query<{ position: number; kind: string; quantity: string; unit_amount_minor: string; line_total_minor: string }>(
      "select l.position, l.kind::text, l.quantity::text, l.unit_amount_minor::text, l.line_total_minor::text from public.quote_line_items l join public.quotes q on q.id = l.quote_id where q.quote_request_id = $1 order by position",
      [r.requestId],
    )).rows;
    expect(lines).toEqual([
      { position: 1, kind: "charge", quantity: "3.000", unit_amount_minor: "15000", line_total_minor: "45000" },
      { position: 2, kind: "charge", quantity: "1.500", unit_amount_minor: "2001", line_total_minor: "3002" },
      { position: 3, kind: "discount", quantity: "1.000", unit_amount_minor: "1000", line_total_minor: "-1000" },
    ]);
    // Lines of a sent quote can never change.
    const quoteId = (await t.client.query<{ id: string }>("select id from public.quotes where quote_request_id = $1", [r.requestId])).rows[0].id;
    await expectDbError(asSystem(t.client, `insert into public.quote_line_items (quote_id, position, kind, description, quantity, unit_amount_minor, line_total_minor) values ('${quoteId}', 9, 'charge', 'x', 1, 1, 1)`), /quote_already_sent/);
    await expectDbError(asSystem(t.client, `update public.quotes set amount_minor = 1 where id = '${quoteId}'`), /quote_already_sent/);
  });

  it("refuses to send a quote whose stored amounts do not add up (tampering)", async () => {
    const r = await submitQuoteRequest(db, input(), { user: null, clientId: randomUUID() }, AVAILABLE);
    if (!r.ok) throw new Error("setup");
    await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
    const [{ id }] = await asSystem<{ id: string }>(
      t.client,
      `insert into public.quotes (quote_request_id, amount_minor, currency, valid_until, created_by) values ('${r.requestId}', 9999, 'EUR', now() + interval '5 days', '${staff.id}') returning id`,
      [],
      staff.id,
    );
    await asSystem(t.client, `insert into public.quote_line_items (quote_id, position, kind, description, quantity, unit_amount_minor, line_total_minor) values ('${id}', 1, 'charge', 'Box', 2, 1000, 2000)`);
    await expectDbError(asSystem(t.client, `update public.quotes set sent_at = now() where id = '${id}'`), /quote_total_mismatch/);
    // A line whose own total is wrong is refused too.
    await asSystem(t.client, `update public.quotes set amount_minor = 2500 where id = '${id}'`);
    await asSystem(t.client, `insert into public.quote_line_items (quote_id, position, kind, description, quantity, unit_amount_minor, line_total_minor) values ('${id}', 2, 'charge', 'Fee', 1, 400, 500)`);
    await expectDbError(asSystem(t.client, `update public.quotes set sent_at = now() where id = '${id}'`), /quote_total_mismatch/);
  });

  it("rejects tax lines until a rate is approved, and invalid prices from the browser", async () => {
    const r = await submitQuoteRequest(db, input(), { user: null, clientId: randomUUID() }, AVAILABLE);
    if (!r.ok) throw new Error("setup");
    await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
    const base = { requestId: r.requestId, currency: "EUR", validUntil: inDays(5) };
    expect(await issueQuote(db, staff, { ...base, lines: [{ kind: "charge", description: "Box", quantity: "1", unitPrice: "100" }, { kind: "tax", description: "VAT", rateBp: 2300 }] })).toMatchObject({
      ok: false,
      fieldErrors: { "lines.1": "tax_not_allowed" },
    });
    expect(await issueQuote(db, staff, { ...base, lines: [{ kind: "charge", description: "Box", quantity: "1", unitPrice: "-100" }] })).toMatchObject({ ok: false, code: "invalid" });
    // Client-computed totals are ignored: there is no field to send one.
    expect(await issueQuote(db, staff, { ...base, totalMinor: "1", lines: [{ kind: "charge", description: "Box", quantity: "1", unitPrice: "100" }] })).toMatchObject({ ok: false, code: "invalid" });
  });

  it("customers cannot change quotation totals", async () => {
    const r = await quotedRequest(customerA);
    const [{ id }] = (await t.client.query<{ id: string }>("select id from public.quotes where quote_request_id = $1", [r.requestId])).rows;
    // RLS filters the rows out: the statements run but change nothing (committed to prove it).
    await asRole(t.client, "authenticated", customerA.id, `update public.quotes set amount_minor = 1 where id = '${id}'`, [], { commit: true });
    await asRole(t.client, "authenticated", customerA.id, `delete from public.quote_line_items where quote_id = '${id}'`, [], { commit: true });
    const after = (await t.client.query<{ amount: string; lines: number }>(
      `select q.amount_minor::text as amount, (select count(*)::int from public.quote_line_items l where l.quote_id = q.id) as lines from public.quotes q where q.id = $1`,
      [id],
    )).rows[0];
    expect(after).toEqual({ amount: "8500", lines: 1 });
  });
});

describe("signed quote links (customers without an account)", () => {
  it("only genuine tokens are accepted", () => {
    const token = createQuoteToken("QRABCDEF")!;
    expect(verifyQuoteToken(token)).toBe("QRABCDEF");
    expect(verifyQuoteToken(token.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBeNull();
    expect(verifyQuoteToken("QRABCDEG." + token.split(".")[1])).toBeNull();
    expect(verifyQuoteToken("QRABCDEF")).toBeNull();
    expect(createQuoteToken("QRABCDEF", { QUOTE_LINK_SECRET: "short" })).toBeNull(); // disabled without a strong secret
  });

  it("shows only customer-visible data and lets the holder accept once", async () => {
    const r = await quotedRequest();
    await addInternalNote(db, staff, { requestId: r.requestId, body: "INTERNAL margin note" });
    const token = createQuoteToken(r.reference)!;
    const view = await getQuoteForLink(db, token);
    expect(view).toMatchObject({ reference: r.reference, status: "QUOTED", quote: { amountMinor: 8500, currency: "EUR" } });
    expect(JSON.stringify(view)).not.toContain("INTERNAL");
    expect(await getQuoteForLink(db, token.slice(0, -1) + "x")).toBeNull();

    expect(await respondViaLink(db, token, true, randomUUID())).toEqual({ ok: true, data: { status: "ACCEPTED" } });
    expect(await respondViaLink(db, token, false, randomUUID())).toMatchObject({ ok: false, code: "invalid_quote_transition" });
    expect((await emails(`entity_id = '${r.requestId}' and template in ('quote_accepted', 'staff_quote_accepted')`)).map((e) => e.template)).toEqual(["quote_accepted", "staff_quote_accepted"]);
    expect(await replyViaLink(db, token, "When can I drop off the parcel?", randomUUID())).toEqual({ ok: true });
  });

  it("rate-limits link actions per client", async () => {
    const r = await quotedRequest();
    const token = createQuoteToken(r.reference)!;
    const client = randomUUID();
    let last;
    for (let i = 0; i < 21; i++) last = await replyViaLink(db, token, `message ${i}`, client);
    expect(last).toMatchObject({ ok: false, code: "rate_limited" });
  });
});

describe("shipments: transitions, issue reports, tracking (Phases 4-5)", () => {
  it("the TypeScript and database transition tables are identical", async () => {
    for (const from of SHIPMENT_STATUSES) {
      for (const to of SHIPMENT_STATUSES) {
        if (from === to) continue;
        const { rows } = await t.client.query<{ ok: boolean }>("select public.app_shipment_transition_allowed($1, $2) ok", [from, to]);
        expect(rows[0].ok, `${from} -> ${to}`).toBe(SHIPMENT_TRANSITIONS[from].includes(to));
      }
    }
  });

  it("enforces transitions, accepts issue reports and keeps internal data out of public tracking", async () => {
    const r = await quotedRequest(customerA);
    expect(await respondViaLink(db, createQuoteToken(r.reference)!, true, randomUUID())).toMatchObject({ ok: true });
    const created = await createShipmentForRequest(db, staff, r.requestId);
    if (!created.ok) throw new Error(created.code);
    const ref = created.data!.reference;
    const shipmentId = (await t.client.query<{ id: string }>("select id from public.shipments where reference = $1", [ref])).rows[0].id;
    expect(await emails(`entity_id = '${shipmentId}'`)).toEqual([{ template: "shipment_confirmed", audience: "customer" }]);

    expect(await updateShipment(db, staff, { shipmentId, status: "DELIVERED", etaVisible: false })).toMatchObject({ ok: false, code: "invalid_shipment_transition" });
    expect(await updateShipment(db, staff, { shipmentId, status: "IN_TRANSIT", etaVisible: false })).toEqual({ ok: true });
    await addShipmentEvent(db, staff, { shipmentId, milestone: "DELAYED", occurredAt: new Date().toISOString(), public: false, noteEn: "INTERNAL: carrier strike" });
    expect((await emails(`template = 'staff_shipment_exception'`)).length).toBeGreaterThanOrEqual(1);
    await addShipmentEvent(db, staff, { shipmentId, milestone: "DELIVERED", occurredAt: new Date().toISOString(), public: true, location: "Douala" });
    expect(await updateShipment(db, staff, { shipmentId, status: "DELIVERED", etaVisible: false })).toEqual({ ok: true });
    expect(await updateShipment(db, staff, { shipmentId, status: "IN_TRANSIT", etaVisible: false })).toMatchObject({ ok: false, code: "invalid_shipment_transition" });

    expect(await reportShipmentIssue(db, customerA, ref, "One box arrived damaged.")).toEqual({ ok: true });
    expect(await reportShipmentIssue(db, customerB, ref, "Not mine")).toMatchObject({ ok: false, code: "not_found" });
    await addInternalNote(db, staff, { requestId: r.requestId, shipmentId, body: "INTERNAL: claim opened" });

    const tracking = await trackShipment(db, ref, randomUUID());
    expect(tracking.ok && tracking.shipment).toMatchObject({ reference: ref, status: "DELIVERED", origin: "CM", destination: "IE" });
    expect(tracking.ok && tracking.shipment.deliveredAt).toBeTruthy();
    expect(tracking.ok && tracking.shipment.events.map((e) => e.milestone)).toEqual(["DELIVERED"]);
    expect(JSON.stringify(tracking)).not.toMatch(/INTERNAL|damaged|claim/);
    expect((await emails(`template = 'shipment_delivered'`)).length).toBeGreaterThanOrEqual(1);
  });
});

describe("contact enquiries (Phase 10)", () => {
  const contact = (overrides: Record<string, unknown> = {}) => ({
    name: "Ama Example",
    email: "Ama@Example.test",
    phone: "",
    topic: "shipment",
    relatedReference: "",
    message: "Hello, I would like to know when the next shipment leaves.",
    locale: "fr",
    idempotencyKey: randomUUID(),
    privacyAccepted: true,
    website: "",
    ...overrides,
  });

  it("persists before confirming, queues both emails, and is idempotent", async () => {
    const payload = contact();
    const first = await submitContactEnquiry(db, payload, randomUUID());
    expect(first).toMatchObject({ ok: true, reference: expect.stringMatching(/^CE[A-Z2-7]{6}$/) });
    expect(await submitContactEnquiry(db, payload, randomUUID())).toEqual(first);
    const stored = await listContactEnquiries(db, staff);
    expect(stored.filter((e) => first.ok && e.reference === first.reference)).toHaveLength(1);
    expect(stored[0].email).toBe("ama@example.test");
    const id = (await t.client.query<{ id: string }>("select id from public.contact_enquiries where reference = $1", [first.ok ? first.reference : ""])).rows[0].id;
    expect((await emails(`entity_id = '${id}'`)).map((e) => e.template)).toEqual(["contact_received", "staff_contact"]);
  });

  it("rejects bots, invalid input and floods; only staff can read enquiries", async () => {
    expect(await submitContactEnquiry(db, contact({ website: "http://spam" }), randomUUID())).toEqual({ ok: false, code: "rejected" });
    expect(await submitContactEnquiry(db, contact({ message: "short" }), randomUUID())).toMatchObject({ ok: false, code: "invalid" });
    expect(await submitContactEnquiry(db, contact({ privacyAccepted: false }), randomUUID())).toMatchObject({ ok: false, code: "invalid" });
    expect(await submitContactEnquiry(db, contact({ relatedReference: "NOTAREF" }), randomUUID())).toMatchObject({ ok: false, code: "invalid" });
    const client = randomUUID();
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await submitContactEnquiry(db, contact({ email: `flood${i}@example.test` }), client));
    expect(results.at(-1)).toMatchObject({ ok: false, code: "rate_limited" });
    await expect(listContactEnquiries(db, customerA)).rejects.toBeInstanceOf(AuthorizationError);
    expect(await asRole(t.client, "anon", null, "select count(*) from public.contact_enquiries").catch((e: Error) => e.message)).toMatch(/permission denied/);
  });
});

describe("background jobs (Phase 8)", () => {
  it("records each run and alerts staff once per job per day on failure", async () => {
    await runJob(db, "test-ok", async () => ({ done: 1 }));
    await expect(runJob(db, "test-fail", async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(runJob(db, "test-fail", async () => Promise.reject(new Error("boom again")))).rejects.toThrow();
    const runs = (await t.client.query<{ job: string; ok: boolean; error: string | null }>("select job, ok, error from public.job_runs where job like 'test-%' order by id")).rows;
    expect(runs.map((r) => [r.job, r.ok])).toEqual([
      ["test-ok", true],
      ["test-fail", false],
      ["test-fail", false],
    ]);
    expect(await emails(`template = 'staff_job_failure'`)).toHaveLength(1);
  });

  it("queues expiry reminders only when configured, once per quote", async () => {
    const r = await submitQuoteRequest(db, input(), { user: null, clientId: randomUUID() }, AVAILABLE);
    if (!r.ok) throw new Error("setup");
    await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
    await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(1), lines: [{ kind: "charge", description: "Box", quantity: "1", unitPrice: "50" }] });
    expect(await queueExpiryReminders(db, null)).toEqual({ reminders: 0 });
    const first = await queueExpiryReminders(db, 72);
    expect(first.reminders).toBeGreaterThanOrEqual(1);
    const before = (await emails(`template = 'quote_expiring'`)).length;
    await queueExpiryReminders(db, 72);
    expect((await emails(`template = 'quote_expiring'`)).length).toBe(before);
  });
});
