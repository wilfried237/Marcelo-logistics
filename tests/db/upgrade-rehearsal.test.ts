import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { asSystem, asUser, expectDbError, migrationFiles } from "./harness";
import { createScenario, insertRequest, quoteRequest } from "./fixtures";

/*
 * Upgrade rehearsal: a database in the state of production today (the first
 * four migrations, data written by the previous application version, including
 * its email rows), then the backend MVP migrations applied on top. Checks that
 * existing data survives unchanged and that nothing old is sent late.
 */
const PRODUCTION_TODAY = [
  "20261029000000_initial_schema",
  "20261029000001_security_model",
  "20261031000000_customers_email_index",
  "20261031000100_admin_role_serialisation",
];

let client: PGlite;
let s: Awaited<ReturnType<typeof createScenario>>;
let pendingDecision: string;
let before: Record<string, unknown[]>;

const TABLES = ["profiles", "customers", "quote_requests", "quotes", "shipments", "shipment_events", "documents", "audit_log", "email_deliveries"];

async function snapshot() {
  const out: Record<string, unknown[]> = {};
  // Columns that existed before the upgrade, so the comparison ignores new columns.
  for (const table of TABLES) {
    const cols = (
      await client.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = any($2) order by column_name",
        [table, oldColumns[table]],
      )
    ).rows.map((r) => `"${r.column_name}"`);
    out[table] = (await client.query(`select ${cols.join(", ")} from public.${table} order by 1`)).rows;
  }
  return out;
}
const oldColumns: Record<string, string[]> = {};
let pristineSchema: Record<string, unknown[]>;

/** Everything that defines the public schema, in a comparable form. */
async function schemaFingerprint() {
  const queries: Record<string, string> = {
    columns: "select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' order by 1, 2",
    constraints: "select conrelid::regclass::text t, conname, pg_get_constraintdef(c.oid) d from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' order by 1, 2",
    indexes: "select indexname, indexdef from pg_indexes where schemaname = 'public' order by 1",
    triggers: "select tgrelid::regclass::text t, tgname, pg_get_triggerdef(oid) d from pg_trigger where not tgisinternal and tgrelid::regclass::text like 'public.%' order by 1, 2",
    functions: "select p.oid::regprocedure::text f, md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1",
    policies: "select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2",
    tableGrants: "select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema = 'public' order by 1, 2, 3",
    columnGrants: "select grantee, table_name, column_name, privilege_type from information_schema.column_privileges where table_schema = 'public' order by 1, 2, 3, 4",
    functionGrants: "select grantee, routine_name, privilege_type from information_schema.routine_privileges where routine_schema = 'public' order by 1, 2, 3",
    // email_status keeps its extra values after a rollback (PostgreSQL cannot drop enum values).
    enums: "select t.typname, array_agg(e.enumlabel::text order by e.enumsortorder) labels from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname <> 'email_status' group by 1 order by 1",
    rls: "select relname, relrowsecurity, relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r' order by 1",
  };
  const out: Record<string, unknown[]> = {};
  for (const [name, sql] of Object.entries(queries)) out[name] = (await client.query(sql)).rows;
  return out;
}

beforeAll(async () => {
  const all = migrationFiles();
  expect(all.slice(0, 4).map((m) => m.name)).toEqual(PRODUCTION_TODAY);
  client = await PGlite.create();
  await client.exec(readFileSync("tests/db/supabase-stub.sql", "utf8"));
  for (const m of all.slice(0, 4)) await client.exec(m.sql);
  pristineSchema = await schemaFingerprint();

  // Data as the previous application version wrote it.
  s = await createScenario(client);
  pendingDecision = await insertRequest(client, s.a.customerId, "QRCCCCCC", s.a.id);
  await quoteRequest(client, pendingDecision, s.staff.id); // QUOTED, awaiting the customer
  await asSystem(
    client,
    `insert into public.email_deliveries (template, recipient, locale, entity, entity_id, idempotency_key, status, error, sent_at) values
       ('quote_acknowledgement', 'customer.a@example.test', 'en', 'quote_requests', $1, 'ack:' || $1, 'PENDING', null, null),
       ('staff_new_request', 'owner.inbox@example.test', 'en', 'quote_requests', $1, 'staff-new:' || $1, 'FAILED', 'provider timeout', null),
       ('staff_new_request', 'owner.inbox@example.test', 'en', 'quote_requests', $2, 'staff-new:' || $2, 'SENT', null, now()),
       ('quote_issued', 'customer.b@example.test', 'en', 'quotes', $3, 'quote-issued:' || $3, 'SENT', null, now()),
       ('shipment_update', 'customer.b@example.test', 'en', 'shipments', 'MLBBBBBBBBBB', 'shipment-update:evt1', 'FAILED', 'provider timeout', null),
       ('quote_issued', 'customer.a@example.test', 'en', 'quotes', $3, 'quote-issued:x', 'SKIPPED', 'transactional email disabled', null)`,
    [s.requestA, s.requestB, s.quoteB],
  );
  for (const table of TABLES) {
    oldColumns[table] = (
      await client.query<{ column_name: string }>("select column_name from information_schema.columns where table_schema = 'public' and table_name = $1", [table])
    ).rows.map((r) => r.column_name);
  }
  before = await snapshot();

  for (const m of all.slice(4)) await client.exec(m.sql);
});
afterAll(async () => client?.close());

describe("upgrade rehearsal: production schema + data → backend MVP", () => {
  it("applies only the new migrations on top of production's four", () => {
    expect(migrationFiles().slice(4).map((m) => m.name)).toEqual(["20261104000000_backend_mvp", "20261104000100_outbox_legacy_rows"]);
  });

  it("keeps every existing customer, staff, request, quote, shipment, event, document and audit row unchanged", async () => {
    const after = await snapshot();
    for (const table of TABLES.filter((t) => t !== "email_deliveries")) expect(after[table], table).toEqual(before[table]);
    const roles = (await client.query<{ role: string }>("select role::text from public.profiles order by role")).rows.map((r) => r.role);
    expect(roles).toEqual(["admin", "customer", "customer", "staff"]);
  });

  it("closes unsent legacy emails and removes the stored staff inbox, keeping sent history", async () => {
    const rows = (
      await client.query<{ key: string; status: string; audience: string; recipient: string | null }>(
        "select idempotency_key as key, status::text, audience, recipient from public.email_deliveries order by idempotency_key",
      )
    ).rows;
    const byKey = Object.fromEntries(rows.map((r) => [r.key.replace(/[0-9a-f-]{36}$/, "<id>"), r]));
    expect(byKey["ack:<id>"]).toMatchObject({ status: "SKIPPED", audience: "customer", recipient: "customer.a@example.test" });
    expect(byKey["shipment-update:evt1"]).toMatchObject({ status: "SKIPPED" });
    expect(rows.filter((r) => r.key.startsWith("staff-new:")).map((r) => [r.status, r.audience, r.recipient]).sort()).toEqual([
      ["SENT", "staff", null],
      ["SKIPPED", "staff", null],
    ]);
    expect(rows.filter((r) => r.key.startsWith("quote-issued:")).map((r) => r.status).sort()).toEqual(["SENT", "SKIPPED"]);
    // Nothing old is due for delivery.
    expect((await client.query("select 1 from public.email_deliveries where status in ('PENDING', 'FAILED', 'SENDING')")).rows).toHaveLength(0);
  });

  it("lets in-flight cases continue: the customer accepts a quote sent before the upgrade", async () => {
    await asUser(client, s.a.id, "select public.customer_respond_to_quote($1, true)", [pendingDecision], { commit: true });
    const queued = (
      await client.query<{ template: string; audience: string }>("select template, audience from public.email_deliveries where entity_id = $1 and status = 'PENDING' order by template", [pendingDecision])
    ).rows;
    expect(queued).toEqual([
      { template: "quote_accepted", audience: "customer" },
      { template: "staff_quote_accepted", audience: "staff" },
    ]);
  });

  it("tracks pre-existing shipments with the new fields and still hides internal events", async () => {
    const [{ t }] = (await client.query<{ t: { origin: string; destination: string; events: { milestone: string }[] } }>("select public.public_track_shipment('MLBBBBBBBBBB') as t")).rows;
    expect(t).toMatchObject({ origin: "IE", destination: "CM" });
    expect(t.events.map((e) => e.milestone)).toEqual(["RECEIVED_AT_DEPOT"]);
  });

  it("applies the new shipment rules to existing shipments", async () => {
    await asUser(client, s.staff.id, "update public.shipments set status = 'IN_TRANSIT' where id = $1", [s.shipmentB], { commit: true });
    await asUser(client, s.staff.id, "update public.shipments set status = 'DELIVERED' where id = $1", [s.shipmentB], { commit: true });
    await expectDbError(asUser(client, s.staff.id, "update public.shipments set status = 'IN_TRANSIT' where id = $1", [s.shipmentB], { commit: true }), /invalid_shipment_transition/);
  });

  it("is safe to apply again (a partially applied deployment can be completed)", async () => {
    const before2 = (await client.query("select count(*)::int n from public.email_deliveries")).rows;
    for (const m of migrationFiles().slice(4)) await client.exec(m.sql);
    expect((await client.query("select count(*)::int n from public.email_deliveries")).rows).toEqual(before2);
  });

  // Runs last: it removes the upgrade.
  it("rollback script restores the pre-upgrade schema and keeps the core data", async () => {
    await client.exec(readFileSync("docs/runbooks/backend-mvp-rollback.sql", "utf8"));
    const restored = await schemaFingerprint();
    for (const key of Object.keys(pristineSchema)) expect(restored[key], key).toEqual(pristineSchema[key]);
    const after = await snapshot();
    for (const table of ["customers", "documents"]) expect(after[table], table).toEqual(before[table]);
    expect((await client.query("select count(*)::int n from public.quote_requests")).rows[0]).toEqual({ n: 3 });
    expect((await client.query("select 1 from public.email_deliveries where status::text in ('PENDING', 'SENDING')")).rows).toHaveLength(0);
    // The previous application version's tracking output is back.
    const [{ t }] = (await client.query<{ t: Record<string, unknown> }>("select public.public_track_shipment('MLBBBBBBBBBB') as t")).rows;
    expect(Object.keys(t).sort()).toEqual(["etaFrom", "etaTo", "events", "reference", "serviceCode", "status"]);
  });
});
