#!/usr/bin/env node
// Applies the reviewed SQL migrations in ./drizzle using DIRECT_URL.
//
// Safety: refuses any non-local database unless ALLOW_MIGRATE_HOST equals the
// database host exactly. Set that only after the owner has approved applying the
// migration to that project (docs/DECISIONS-REQUIRED.md, R-02).
// Never use `drizzle-kit push`.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

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

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  console.log(`db:migrate: applying migrations to ${host} ...`);
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("db:migrate: done.");
} catch (error) {
  // Print the database message only; never the connection string.
  console.error(`db:migrate: failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
