import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestDb, migrationFiles, type TestDb } from "./harness";
import { QUOTE_STATUSES, MILESTONE_CODES, USER_ROLES, SHIPMENT_STATUSES } from "@/lib/domain/enums";
import { SERVICE_CODES } from "@/lib/domain/services";
import { canTransition } from "@/lib/domain/quote-lifecycle";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t?.close());

const APP_TABLES = ["profiles", "customers", "quote_requests", "quotes", "shipments", "shipment_events", "documents", "audit_log", "rate_limits", "email_deliveries"];

describe("migrations (PGlite)", () => {
  it("apply cleanly to an empty database and create every table", async () => {
    const { rows } = await t.client.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public' order by 1");
    expect(rows.map((r) => r.tablename).sort()).toEqual([...APP_TABLES].sort());
  });

  it("are stored in Prisma Migrate order and layout", () => {
    const names = migrationFiles().map((m) => m.name);
    expect(names[0]).toBe("20261029000000_initial_schema");
    expect(names).toEqual([...names].sort());
    for (const name of names) expect(name).toMatch(/^\d{14}_[a-z0-9_]+$/);
    expect(readFileSync("prisma/migrations/migration_lock.toml", "utf8")).toContain('provider = "postgresql"');
  });

  it("all migrations after the initial schema are safe to execute twice", async () => {
    // Prisma's history table normally prevents re-runs; the SQL itself is still
    // idempotent so a partially applied migration can be completed safely.
    for (const migration of migrationFiles().slice(1)) await t.client.exec(migration.sql);
  });

  it("contain no destructive statements", () => {
    for (const { name, sql } of migrationFiles()) {
      const text = sql.replace(/--.*$/gm, "");
      expect(text, name).not.toMatch(/\bdrop\s+(table|schema|column|type)\b/i);
      // A statement starting with TRUNCATE (the audit trigger "before truncate" is allowed).
      expect(text, name).not.toMatch(/(^|;)\s*truncate\b/im);
      expect(text, name).not.toMatch(/\bdelete\s+from\s+public\.(?!rate_limits)/i);
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

  it("store customer emails in lower case only", async () => {
    await expect(t.client.query("insert into public.customers (name, email) values ('X', 'Mixed@Example.test')")).rejects.toThrow(/customers_email_lowercase/);
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
      "customers_email_idx",
      "documents_storage_key_key",
      "email_deliveries_idempotency_key",
      "quote_requests_status_created_idx",
      "audit_log_entity_idx",
    ]) {
      expect(names).toContain(name);
    }
    expect(names).not.toContain("customers_email_lower_idx");
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
