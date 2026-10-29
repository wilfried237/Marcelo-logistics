import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFileSync } from "node:fs";
import { createTestDb, type TestDb } from "./harness";
import { QUOTE_STATUSES, MILESTONE_CODES, USER_ROLES, SHIPMENT_STATUSES } from "@/lib/domain/enums";
import { SERVICE_CODES } from "@/lib/domain/services";
import { canTransition } from "@/lib/domain/quote-lifecycle";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t?.client.close());

const APP_TABLES = ["profiles", "customers", "quote_requests", "quotes", "shipments", "shipment_events", "documents", "audit_log", "rate_limits", "email_deliveries"];

describe("migrations", () => {
  it("apply cleanly to an empty database and create every table", async () => {
    const { rows } = await t.client.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public' order by 1");
    expect(rows.map((r) => r.tablename).sort()).toEqual([...APP_TABLES].sort());
  });

  it("are safe to re-run through the migrator (no-op)", async () => {
    await migrate(t.db, { migrationsFolder: "drizzle" });
    const { rows } = await t.client.query<{ n: number }>("select count(*)::int n from drizzle.__drizzle_migrations");
    expect(rows[0].n).toBe(2);
  });

  it("the security migration is itself idempotent when executed twice", async () => {
    const sqlText = readFileSync("drizzle/0001_security_model.sql", "utf8").split("--> statement-breakpoint");
    for (const statement of sqlText) if (statement.trim()) await t.client.exec(statement);
  });

  it("contain no destructive statements", () => {
    for (const file of ["drizzle/0000_initial_schema.sql", "drizzle/0001_security_model.sql"]) {
      const text = readFileSync(file, "utf8").replace(/--.*$/gm, "");
      expect(text).not.toMatch(/\bdrop\s+(table|schema|column|type)\b/i);
      // A statement starting with TRUNCATE (the audit trigger "before truncate" is allowed).
      expect(text).not.toMatch(/(^|;)\s*truncate\b/im);
      expect(text).not.toMatch(/\bdelete\s+from\s+public\.(?!rate_limits)/i);
    }
  });

  it("enable RLS on every application table", async () => {
    const { rows } = await t.client.query<{ relname: string; relrowsecurity: boolean }>(
      "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'",
    );
    for (const row of rows) expect(row.relrowsecurity, row.relname).toBe(true);
  });

  it("revoke Supabase's default table privileges from anon", async () => {
    const { rows } = await t.client.query<{ n: number }>(
      "select count(*)::int n from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'",
    );
    expect(rows[0].n).toBe(0);
  });

  it("create the expected unique constraints and indexes", async () => {
    const { rows } = await t.client.query<{ indexname: string }>("select indexname from pg_indexes where schemaname = 'public'");
    const names = rows.map((r) => r.indexname);
    for (const name of [
      "quote_requests_reference_key",
      "quote_requests_idempotency_key_key",
      "shipments_reference_key",
      "shipments_quote_key",
      "customers_user_id_key",
      "documents_storage_key_key",
      "email_deliveries_idempotency_key",
      "quote_requests_status_created_idx",
      "audit_log_entity_idx",
    ]) {
      expect(names).toContain(name);
    }
  });

  it("define enums that match the TypeScript domain values", async () => {
    const values = async (type: string) =>
      (await t.client.query<{ v: string }>(`select unnest(enum_range(null::public.${type}))::text v`)).rows.map((r) => r.v);
    expect(await values("quote_status")).toEqual([...QUOTE_STATUSES]);
    expect(await values("milestone_code")).toEqual([...MILESTONE_CODES]);
    expect(await values("user_role")).toEqual([...USER_ROLES]);
    expect(await values("shipment_status")).toEqual([...SHIPMENT_STATUSES]);
    expect(await values("service_code")).toEqual([...SERVICE_CODES]);
  });

  it("keep the SQL transition table identical to the TypeScript lifecycle", async () => {
    for (const from of QUOTE_STATUSES) {
      for (const to of QUOTE_STATUSES) {
        const { rows } = await t.client.query<{ ok: boolean }>("select public.app_quote_transition_allowed($1, $2) ok", [from, to]);
        expect(rows[0].ok, `${from} -> ${to}`).toBe(canTransition(from, to));
      }
    }
  });
});
