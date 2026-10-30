#!/usr/bin/env node
// Applies the committed Prisma migrations (prisma/migrations) with
// `prisma migrate deploy`, using DIRECT_URL.
//
// Safety: refuses any non-local database unless ALLOW_MIGRATE_HOST equals the
// database host exactly. Set it only after the owner has approved the migration
// SQL for that project (docs/DECISIONS-REQUIRED.md, R-02; docs/DATABASE.md).
// Never use `prisma db push` or `prisma migrate dev` against shared databases.
import { spawnSync } from "node:child_process";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("db:migrate: DIRECT_URL is not set (see .env.example).");
  process.exit(1);
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error("db:migrate: DIRECT_URL is not a valid URL.");
  process.exit(1);
}

const isLocal = ["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(host);
if (!isLocal && process.env.ALLOW_MIGRATE_HOST !== host) {
  console.error(
    `db:migrate: refusing to migrate non-local host "${host}".\n` +
      "Applying migrations to a shared or production database requires owner approval (R-02).\n" +
      `After approval, run with ALLOW_MIGRATE_HOST=${host}.`,
  );
  process.exit(1);
}

// Supabase databases are never "empty" for Prisma because the auth/storage
// schemas always contain tables, so `migrate deploy` stops with P3005 before the
// first migration. Only when the application schema (public) has NO tables at
// all do we create Prisma's standard history table, letting deploy apply every
// migration from the beginning. A non-empty public schema is left untouched and
// Prisma's own baseline protection still applies.
const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query(
    "select count(*)::int as tables, bool_or(table_name = '_prisma_migrations') as has_history from information_schema.tables where table_schema = 'public'",
  );
  if (rows[0].tables === 0) {
    await client.query(`create table if not exists public."_prisma_migrations" (
      "id" varchar(36) primary key not null,
      "checksum" varchar(64) not null,
      "finished_at" timestamptz,
      "migration_name" varchar(255) not null,
      "logs" text,
      "rolled_back_at" timestamptz,
      "started_at" timestamptz not null default now(),
      "applied_steps_count" integer not null default 0
    )`);
    console.log("db:migrate: empty application schema; initialised Prisma migration history");
  }
} finally {
  await client.end();
}

console.log(`db:migrate: prisma migrate deploy -> ${host}`);
// Prisma reads DIRECT_URL through prisma.config.ts; credentials are never printed.
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
