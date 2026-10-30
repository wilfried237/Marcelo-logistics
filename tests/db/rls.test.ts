import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDb, expectDbError, type TestDb } from "./harness";
import { createScenario } from "./fixtures";

let t: TestDb;
let s: Awaited<ReturnType<typeof createScenario>>;

beforeAll(async () => {
  t = await createTestDb();
  s = await createScenario(t.client);
});
afterAll(async () => t?.close());

describe("row level security and authorisation (executed against PostgreSQL)", () => {
  it("1. customer A cannot read customer B's quote requests", async () => {
    const byId = await asUser(t.client, s.a.id, "select id from public.quote_requests where id = $1", [s.requestB]);
    expect(byId).toHaveLength(0);
    const all = await asUser<{ id: string }>(t.client, s.a.id, "select id from public.quote_requests");
    expect(all.map((r) => r.id)).toEqual([s.requestA]);
    const byReference = await asUser(t.client, s.a.id, "select id from public.quote_requests where reference = 'QRBBBBBB'");
    expect(byReference).toHaveLength(0);
  });

  it("2. customer A cannot read customer B's quotes; B sees only sent quotes", async () => {
    expect(await asUser(t.client, s.a.id, "select id from public.quotes")).toHaveLength(0);
    expect(await asUser(t.client, s.b.id, "select id from public.quotes")).toHaveLength(1);
  });

  it("3. customer A cannot read customer B's shipments", async () => {
    expect(await asUser(t.client, s.a.id, "select id from public.shipments")).toHaveLength(0);
    expect(await asUser(t.client, s.a.id, "select id from public.shipment_events")).toHaveLength(0);
    expect(await asUser(t.client, s.b.id, "select id from public.shipments")).toHaveLength(1);
  });

  it("4. customer A cannot read or attach documents to customer B's records", async () => {
    expect(await asUser(t.client, s.a.id, "select id from public.documents")).toHaveLength(0);
    await expectDbError(
      asUser(
        t.client,
        s.a.id,
        `insert into public.documents (owner_type, owner_id, storage_key, original_name, mime, size_bytes, uploaded_by)
         values ('quote_request', $1, 'x/y.pdf', 'y.pdf', 'application/pdf', 10, $2)`,
        [s.requestB, s.a.id],
      ),
      /row-level security/,
    );
    expect(await asUser(t.client, s.b.id, "select id from public.documents")).toHaveLength(1);
  });

  it("5. unauthenticated users cannot read private records", async () => {
    for (const table of ["profiles", "customers", "quote_requests", "quotes", "shipments", "shipment_events", "documents", "audit_log", "rate_limits", "email_deliveries"]) {
      await expectDbError(asAnon(t.client, `select * from public.${table} limit 1`), /permission denied/);
    }
  });

  it("6. a customer cannot promote themselves to staff or admin", async () => {
    await expectDbError(asUser(t.client, s.a.id, "update public.profiles set role = 'admin' where id = $1", [s.a.id]), /permission denied/);
    await expectDbError(asUser(t.client, s.a.id, "insert into public.profiles (id, role) values (gen_random_uuid(), 'admin')"), /permission denied/);
    await expectDbError(asUser(t.client, s.a.id, "select public.admin_set_user_role($1, 'admin')", [s.a.id]), /forbidden/);
    // Even the server's privileged connection cannot change a role outside the trusted path.
    await expectDbError(t.client.query("update public.profiles set role = 'admin' where id = $1", [s.a.id]), /role_change_forbidden/);
    const [profile] = (await t.client.query<{ role: string }>("select role from public.profiles where id = $1", [s.a.id])).rows;
    expect(profile.role).toBe("customer");
  });

  it("7. an ordinary user cannot change shipment status or add events", async () => {
    const updated = await asUser(t.client, s.b.id, "update public.shipments set status = 'DELIVERED' where id = $1 returning id", [s.shipmentB]);
    expect(updated).toHaveLength(0);
    await expectDbError(
      asUser(t.client, s.b.id, "insert into public.shipment_events (shipment_id, milestone_code, occurred_at, public, created_by) values ($1, 'DELIVERED', now(), true, $2)", [
        s.shipmentB,
        s.b.id,
      ]),
      /row-level security/,
    );
    await expectDbError(asUser(t.client, s.a.id, "update public.quote_requests set status = 'UNDER_REVIEW' where id = $1", [s.requestA]).then((rows) => {
      if (rows.length === 0) throw new Error("no rows updated (row-level security)");
    }), /row-level security|no rows/);
  });

  it("8. staff can see and manage operational records; customers cannot", async () => {
    const rows = await asUser(t.client, s.staff.id, "select id from public.quote_requests");
    expect(rows).toHaveLength(2);
    const updated = await asUser(t.client, s.staff.id, "update public.quote_requests set status = 'UNDER_REVIEW' where id = $1 returning status", [s.requestA]);
    expect(updated).toEqual([{ status: "UNDER_REVIEW" }]);
    expect(await asUser(t.client, s.staff.id, "select id from public.audit_log limit 1")).toHaveLength(1);
    expect(await asUser(t.client, s.a.id, "select id from public.audit_log")).toHaveLength(0);
  });

  it("9. admin-only operations reject staff and protect the last admin", async () => {
    await expectDbError(asUser(t.client, s.staff.id, "select public.admin_set_user_role($1, 'admin')", [s.staff.id]), /forbidden/);
    await asUser(t.client, s.admin.id, "select public.admin_set_user_role($1, 'staff')", [s.a.id]);
    await expectDbError(asUser(t.client, s.admin.id, "select public.admin_set_user_role($1, 'customer')", [s.admin.id]), /last_admin/);
    await asUser(t.client, s.admin.id, "select public.admin_set_user_role($1, 'staff')", [s.b.id], { commit: true });
    const [audit] = await asUser<{ action: string; actor: string; after: { role: string } }>(
      t.client,
      s.admin.id,
      "select action, actor, after from public.audit_log where entity = 'profiles' and entity_id = $1::text order by id desc limit 1",
      [s.b.id],
    );
    expect(audit).toMatchObject({ action: "profiles.role_changed", actor: s.admin.id, after: { role: "staff" } });
    // Restore B as a customer for the remaining tests.
    await asUser(t.client, s.admin.id, "select public.admin_set_user_role($1, 'customer')", [s.b.id], { commit: true });
  });

  it("10. public tracking returns only allowlisted fields and public events", async () => {
    const [{ result }] = await asAnon<{ result: Record<string, unknown> }>(t.client, "select public.public_track_shipment('mlbbbbbbbbbb') as result");
    expect(Object.keys(result).sort()).toEqual(["etaFrom", "etaTo", "events", "reference", "serviceCode", "status"]);
    expect(result.etaFrom).toBeNull(); // ETA not approved for customers
    const events = result.events as Record<string, unknown>[];
    expect(events).toHaveLength(1);
    expect(Object.keys(events[0]).sort()).toEqual(["location", "milestone", "noteEn", "noteFr", "occurredAt"]);
    expect(JSON.stringify(result)).not.toMatch(/INTERNAL|customer|email|Customer B|created_by|staff/i);

    const [{ unknown }] = await asAnon<{ unknown: unknown }>(t.client, "select public.public_track_shipment('MLZZZZZZZZZZ') as unknown");
    expect(unknown).toBeNull();
    const [{ injected }] = await asAnon<{ injected: unknown }>(t.client, "select public.public_track_shipment($1) as injected", ["' or 1=1 --"]);
    expect(injected).toBeNull();
  });

  it("customers never see draft quotes, internal events or staff identifiers", async () => {
    await expectDbError(asUser(t.client, s.b.id, "select created_by from public.quotes"), /permission denied/);
    await expectDbError(asUser(t.client, s.b.id, "select created_by from public.shipment_events"), /permission denied/);
    await expectDbError(asUser(t.client, s.b.id, "select storage_key from public.documents"), /permission denied/);
    const events = await asUser<{ public: boolean }>(t.client, s.b.id, "select public from public.shipment_events");
    expect(events).toEqual([{ public: true }]);
  });

  it("customers may only respond to their own quotes", async () => {
    await expectDbError(asUser(t.client, s.a.id, "select public.customer_respond_to_quote($1, true)", [s.requestB]), /not_found/);
    await expectDbError(asUser(t.client, s.a.id, "select public.customer_respond_to_quote(gen_random_uuid(), true)"), /not_found/);
  });

  it("server-only functions are not callable by API roles", async () => {
    await expectDbError(asUser(t.client, s.a.id, "select public.app_rate_limit_hit('k', 60, 5)"), /permission denied/);
    await expectDbError(asUser(t.client, s.staff.id, "select public.app_expire_quotes()"), /permission denied/);
    await expectDbError(asAnon(t.client, "select public.customer_respond_to_quote(gen_random_uuid(), true)"), /permission denied/);
  });

  it("customers may edit only their own contact fields", async () => {
    const own = await asUser(t.client, s.a.id, "update public.customers set phone = '+353000000' where user_id = $1 returning id", [s.a.id]);
    expect(own).toHaveLength(1);
    const other = await asUser(t.client, s.a.id, "update public.customers set phone = '+353000000' where user_id = $1 returning id", [s.b.id]);
    expect(other).toHaveLength(0);
    await expectDbError(asUser(t.client, s.a.id, "update public.customers set user_id = $1 where user_id = $2", [s.b.id, s.a.id]), /permission denied/);
  });
});
