import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createPrismaClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

/*
 * PGlite test database: PostgreSQL 17 compiled to WebAssembly, in-process.
 * - Raw SQL tests talk to the PGlite instance directly (`client`).
 * - Application code talks to it through real Prisma Client + @prisma/adapter-pg
 *   over the PostgreSQL wire protocol (pglite-socket), exactly like production.
 * This is NOT a Supabase stack: tests/supabase covers that separately.
 */

export const MIGRATIONS_DIR = "prisma/migrations";

/** Migration directories in the order Prisma Migrate applies them. */
export function migrationFiles(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8") }));
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

let nextPort = 55_000 + Math.floor(Math.random() * 5_000);

/** Fresh database with the Supabase stub and all migrations, plus a Prisma client on top. */
export async function createTestDb() {
  const client = await PGlite.create();
  await client.exec(readFileSync("tests/db/supabase-stub.sql", "utf8"));
  for (const migration of migrationFiles()) await client.exec(migration.sql);

  let server: PGLiteSocketServer | undefined;
  let port = 0;
  for (let attempt = 0; attempt < 20 && !server; attempt++) {
    port = nextPort++;
    const candidate = new PGLiteSocketServer({ db: client, port, host: "127.0.0.1", maxConnections: 1 });
    try {
      await candidate.start();
      server = candidate;
    } catch {
      // port in use: try the next one
    }
  }
  if (!server) throw new Error("could not start pglite socket server");
  const db: Database = createPrismaClient(`postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`, 1);
  const close = async () => {
    await db.$disconnect();
    await server!.stop();
    await client.close();
  };
  return { client, db, close };
}

type Row = Record<string, unknown>;

/** SQL string literal for the simple-protocol control statements (test-only). */
function literal(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Runs SQL statements as an API role, exactly as PostgREST would:
 * `set local role` + JWT claims. Always rolled back unless `commit` is true.
 */
export async function asRole<T = Row>(
  client: PGlite,
  role: "anon" | "authenticated",
  userId: string | null,
  sqlText: string,
  params: unknown[] = [],
  { commit = false }: { commit?: boolean } = {},
): Promise<T[]> {
  // Control statements (no user input) go through the simple query protocol in one
  // round trip; only the statement under test uses bind parameters.
  await client.exec(`begin; select set_config('request.jwt.claims', ${literal(JSON.stringify(userId ? { sub: userId, role } : { role }))}, true); set local role ${role};`);
  try {
    const result = await client.query<T>(sqlText, params);
    await client.exec(commit ? "commit" : "rollback");
    return result.rows;
  } catch (error) {
    await client.exec("rollback");
    throw error;
  }
}

export const asUser = <T = Row>(client: PGlite, userId: string, sqlText: string, params: unknown[] = [], opts?: { commit?: boolean }) =>
  asRole<T>(client, "authenticated", userId, sqlText, params, opts);

export const asAnon = <T = Row>(client: PGlite, sqlText: string, params: unknown[] = []) => asRole<T>(client, "anon", null, sqlText, params);

/** Privileged statement executed with a JWT subject set, as the server does for trusted writes. */
export async function asSystem<T = Row>(client: PGlite, sqlText: string, params: unknown[] = [], actor: string | null = null): Promise<T[]> {
  await client.exec(`begin; select set_config('request.jwt.claims', ${literal(actor ? JSON.stringify({ sub: actor }) : "")}, true);`);
  try {
    const result = await client.query<T>(sqlText, params);
    await client.exec("commit");
    return result.rows;
  } catch (error) {
    await client.exec("rollback");
    throw error;
  }
}

/** Creates an auth user (the trigger creates the profile and customer). */
export async function createUser(client: PGlite, email: string, role: "customer" | "staff" | "admin" = "customer", fullName = "Test User") {
  const [{ id }] = (
    await client.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify({ full_name: fullName })])
  ).rows;
  if (role !== "customer") {
    // Trusted bootstrap path (documented in docs/DATABASE.md).
    await client.exec(`begin; select set_config('app.role_change', 'allowed', true); update public.profiles set role = ${literal(role)} where id = ${literal(id)}; commit;`);
  }
  const customer = (await client.query<{ id: string }>("select id from public.customers where user_id = $1", [id])).rows[0];
  return { id, customerId: customer?.id as string };
}

export async function expectDbError(promise: Promise<unknown>, pattern: RegExp) {
  let error: unknown;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  if (!error) throw new Error(`Expected database error matching ${pattern}, but the statement succeeded`);
  const message = error instanceof Error ? `${error.message} ${JSON.stringify((error as { meta?: unknown }).meta ?? "")}` : String(error);
  if (!pattern.test(message)) throw new Error(`Expected error matching ${pattern}, got: ${message}`);
}
