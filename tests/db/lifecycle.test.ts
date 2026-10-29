import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asSystem, asUser, createTestDb, createUser, expectDbError, type TestDb } from "./harness";
import { ITEMS, insertRequest, quoteRequest } from "./fixtures";

let t: TestDb;
let staff: { id: string };
let customer: { id: string; customerId: string };
let counter = 0;
const nextRef = () => `QRT${"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[counter++ % 32]}${"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(counter / 32) % 32]}AAA`;

beforeAll(async () => {
  t = await createTestDb();
  staff = await createUser(t.client, "ops@example.test", "staff");
  customer = await createUser(t.client, "lifecycle@example.test");
});
afterAll(async () => t?.client.close());

const status = async (id: string) => (await t.client.query<{ status: string }>("select status from public.quote_requests where id = $1", [id])).rows[0].status;
const setStatus = (id: string, to: string, reason?: string) =>
  asUser(t.client, staff.id, "update public.quote_requests set status = $2, cancellation_reason = $3 where id = $1 returning id", [id, to, reason ?? null], { commit: true });
const auditFor = async (id: string) =>
  (await t.client.query<{ action: string; actor: string | null; before: Record<string, unknown>; after: Record<string, unknown> }>(
    "select action, actor, before, after from public.audit_log where entity = 'quote_requests' and entity_id = $1 order by id",
    [id],
  )).rows;

describe("quote lifecycle (database-enforced)", () => {
  it("rejects transitions that are not in the documented table", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef());
    await expectDbError(setStatus(id, "QUOTED"), /invalid_quote_transition/);
    await expectDbError(setStatus(id, "ACCEPTED"), /invalid_quote_transition/);
    expect(await status(id)).toBe("SUBMITTED");
  });

  it("requires a sent quote before QUOTED and a still-valid quote before ACCEPTED", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef());
    await setStatus(id, "UNDER_REVIEW");
    await expectDbError(setStatus(id, "QUOTED"), /sent_quote_required/);
    // Draft (unsent) quote is not enough.
    await asUser(t.client, staff.id, "insert into public.quotes (quote_request_id, amount_minor, currency, valid_until, created_by) values ($1, 100, 'EUR', now() + interval '1 day', $2)", [id, staff.id], { commit: true });
    await expectDbError(setStatus(id, "QUOTED"), /sent_quote_required/);
  });

  it("rejects acceptance of an expired quote and expires it via the scheduled function", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef());
    await setStatus(id, "UNDER_REVIEW");
    await asUser(t.client, staff.id, "insert into public.quotes (quote_request_id, amount_minor, currency, valid_until, created_by, sent_at) values ($1, 100, 'EUR', now() + interval '1 second', $2, now())", [id, staff.id], { commit: true });
    await setStatus(id, "QUOTED");
    await new Promise((r) => setTimeout(r, 1200));
    await expectDbError(asUser(t.client, customer.id, "select public.customer_respond_to_quote($1, true)", [id]), /quote_not_valid/);
    const [{ expired }] = (await t.client.query<{ expired: number }>("select public.app_expire_quotes() as expired")).rows;
    expect(expired).toBeGreaterThanOrEqual(1);
    expect(await status(id)).toBe("EXPIRED");
  });

  it("allows cancellation from any non-cancelled stage, only with a reason", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef());
    await expectDbError(setStatus(id, "CANCELLED"), /quote_requests_cancellation_reason/);
    await expectDbError(setStatus(id, "CANCELLED", "   "), /quote_requests_cancellation_reason/);
    await setStatus(id, "CANCELLED", "Customer withdrew the request");
    await expectDbError(setStatus(id, "UNDER_REVIEW"), /invalid_quote_transition/);
    await expectDbError(setStatus(id, "CANCELLED", "again"), /invalid_quote_transition|immutable_field/);
  });

  it("writes one audit record per transition, atomically, with the acting user", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef(), customer.id);
    await setStatus(id, "UNDER_REVIEW");
    await expectDbError(setStatus(id, "ACCEPTED"), /invalid_quote_transition/); // must not leave an audit row
    const rows = await auditFor(id);
    expect(rows.map((r) => r.action)).toEqual(["quote_requests.insert", "quote_requests.status_changed"]);
    expect(rows[0].actor).toBe(customer.id);
    expect(rows[1]).toMatchObject({ actor: staff.id, before: { status: "SUBMITTED" }, after: { status: "UNDER_REVIEW" } });
  });

  it("redacts personal data in audit records", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef());
    const [insert] = await auditFor(id);
    expect(insert.after.items).toBe("[redacted]");
    expect(insert.after.notes).toBe("[redacted]");
    expect(JSON.stringify(insert.after)).not.toContain("household");
    const { rows } = await t.client.query<{ after: Record<string, unknown> }>("select after from public.audit_log where entity = 'customers' and entity_id = $1", [customer.customerId]);
    expect(rows[0].after.email).toBe("[redacted]");
  });

  it("keeps the audit log append-only, even for the privileged role", async () => {
    await expectDbError(t.client.query("update public.audit_log set action = 'x'"), /append-only/);
    await expectDbError(t.client.query("delete from public.audit_log"), /append-only/);
    await expectDbError(t.client.query("truncate public.audit_log"), /append-only/);
  });

  it("protects immutable request fields", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef());
    await expectDbError(t.client.query("update public.quote_requests set reference = 'QRZZZZZZ' where id = $1", [id]), /immutable_field/);
    const other = await createUser(t.client, "other@example.test");
    await expectDbError(t.client.query("update public.quote_requests set customer_id = $2 where id = $1", [id, other.customerId]), /immutable_field/);
  });

  it("freezes a quote once it has been sent", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef());
    const quoteId = await quoteRequest(t.client, id, staff.id);
    await expectDbError(asUser(t.client, staff.id, "update public.quotes set amount_minor = 1 where id = $1", [quoteId]), /quote_already_sent/);
  });

  it("only creates shipments from accepted quotes and derives the owner server-side", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef());
    const quoteId = await quoteRequest(t.client, id, staff.id);
    await expectDbError(
      asUser(t.client, staff.id, "insert into public.shipments (reference, quote_id, created_by) values ('MLCCCCCCCCCC', $1, $2)", [quoteId, staff.id]),
      /quote_not_accepted/,
    );
    await asUser(t.client, customer.id, "select public.customer_respond_to_quote($1, true)", [id], { commit: true });
    const intruder = await createUser(t.client, "intruder@example.test");
    const [shipment] = await asUser<{ customer_id: string }>(
      t.client,
      staff.id,
      "insert into public.shipments (reference, quote_id, customer_id, service_code, created_by) values ('MLCCCCCCCCCC', $1, $2, 'vehicle', $3) returning customer_id",
      [quoteId, intruder.customerId, staff.id],
      { commit: true },
    );
    expect(shipment.customer_id).toBe(customer.customerId);
  });

  it("rejects a created_by that does not match the session user", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef());
    await setStatus(id, "UNDER_REVIEW");
    const other = await createUser(t.client, "other.staff@example.test", "staff");
    await expectDbError(
      asUser(t.client, staff.id, "insert into public.quotes (quote_request_id, amount_minor, currency, valid_until, created_by) values ($1, 100, 'EUR', now() + interval '1 day', $2)", [id, other.id]),
      /created_by_mismatch/,
    );
  });
});

describe("constraints and references", () => {
  it("rejects malformed and duplicate references", async () => {
    await expectDbError(insertRequest(t.client, customer.customerId, "QR12345!"), /quote_requests_reference_format/);
    await expectDbError(insertRequest(t.client, customer.customerId, "qrabcdef"), /quote_requests_reference_format/);
    const ref = nextRef();
    await insertRequest(t.client, customer.customerId, ref);
    await expectDbError(insertRequest(t.client, customer.customerId, ref), /quote_requests_reference_key/);
  });

  it("rejects invalid item payloads, countries, amounts and currencies", async () => {
    const insert = (items: string, origin = "IE") =>
      asSystem(t.client, "insert into public.quote_requests (reference, customer_id, service_code, origin_country, destination_country, items, locale) values ($1, $2, 'parcels', $4, 'CM', $3::jsonb, 'en')", [
        nextRef(),
        customer.customerId,
        items,
        origin,
      ]);
    await expectDbError(insert("{}"), /quote_requests_items_shape/);
    await expectDbError(insert("[]"), /quote_requests_items_shape/);
    await expectDbError(insert(JSON.stringify(Array.from({ length: 51 }, () => ({ d: 1 })))), /quote_requests_items_shape/);
    await expectDbError(insert(JSON.stringify([{ description: "x".repeat(40000) }])), /quote_requests_items_shape/);
    await expectDbError(insert(ITEMS, "ie"), /quote_requests_origin_format/);
    await expectDbError(insert(ITEMS, "IRL"), /value too long|origin_format/);

    const id = await insertRequest(t.client, customer.customerId, nextRef());
    await setStatus(id, "UNDER_REVIEW");
    const quote = (amount: number, currency: string) =>
      asUser(t.client, staff.id, "insert into public.quotes (quote_request_id, amount_minor, currency, valid_until, created_by) values ($1, $2, $3, now() + interval '1 day', $4)", [id, amount, currency, staff.id]);
    await expectDbError(quote(0, "EUR"), /quotes_amount_positive/);
    await expectDbError(quote(-5, "EUR"), /quotes_amount_positive/);
    await expectDbError(quote(100, "USD"), /quotes_currency_allowed/);
  });

  it("rejects disallowed document types and sizes", async () => {
    const id = await insertRequest(t.client, customer.customerId, nextRef());
    const doc = (mime: string, size: number) =>
      asUser(t.client, customer.id, "insert into public.documents (owner_type, owner_id, storage_key, original_name, mime, size_bytes, uploaded_by) values ('quote_request', $1, $2, 'f', $3, $4, $5)", [
        id,
        `k/${Math.random()}`,
        mime,
        size,
        customer.id,
      ]);
    await expectDbError(doc("application/x-msdownload", 10), /documents_mime_allowed/);
    await expectDbError(doc("application/pdf", 10 * 1024 * 1024 + 1), /documents_size/);
  });

  it("creates a customer profile and record for every new auth user", async () => {
    const user = await createUser(t.client, "New.Person@Example.test", "customer", "New Person");
    const { rows } = await t.client.query<{ role: string; email: string; name: string }>(
      "select p.role, c.email, c.name from public.profiles p join public.customers c on c.user_id = p.id where p.id = $1",
      [user.id],
    );
    expect(rows).toEqual([{ role: "customer", email: "new.person@example.test", name: "New Person" }]);
  });

  it("rate-limits per key within a window", async () => {
    const hit = async () => (await t.client.query<{ ok: boolean }>("select public.app_rate_limit_hit('test-key', 60, 3) ok")).rows[0].ok;
    expect([await hit(), await hit(), await hit(), await hit()]).toEqual([true, true, true, false]);
  });
});
