import type { Database, Tx } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/**
 * Runs `fn` in a Prisma interactive transaction as the Supabase `authenticated`
 * role with the user's JWT subject, so Row Level Security, column grants and
 * triggers apply to these Prisma queries exactly as to a direct API call.
 *
 * Security properties:
 * - The identity comes only from a verified server-side session (never from
 *   the browser) and must be a UUID.
 * - `set_config(..., true)` and `SET LOCAL ROLE` are transaction-scoped: they
 *   end with the transaction, so a pooled connection never carries one user's
 *   identity into another request.
 * - Queries under this role may only read granted columns, so callers must use
 *   explicit `select` clauses.
 */
export async function withUser<T>(db: Database, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(userId)) throw new Error("withUser: invalid user id");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    await tx.$executeRawUnsafe("set local role authenticated");
    return fn(tx);
  }, TX_OPTIONS);
}

/**
 * Privileged transaction (the server's database role bypasses RLS). Only for
 * operations without a signed-in user (anonymous quote submission, rate
 * limiting, email logging, scheduled jobs) or after explicit application-level
 * authorisation. `actor` is recorded by the audit triggers when present.
 */
export async function withSystem<T>(db: Database, actor: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (actor !== null && !UUID.test(actor)) throw new Error("withSystem: invalid actor id");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('request.jwt.claims', ${actor ? JSON.stringify({ sub: actor }) : ""}, true)`;
    return fn(tx);
  }, TX_OPTIONS);
}

/** Runs a statement as the public `anon` role (used for public tracking). */
export async function withAnon<T>(db: Database, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('request.jwt.claims', ${JSON.stringify({ role: "anon" })}, true)`;
    await tx.$executeRawUnsafe("set local role anon");
    return fn(tx);
  }, TX_OPTIONS);
}
