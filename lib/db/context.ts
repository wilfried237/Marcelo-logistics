import { sql } from "drizzle-orm";
import type { Database, Tx } from "./types";

/**
 * Runs `fn` in a transaction as the Supabase `authenticated` role with the
 * user's JWT subject, so Row Level Security, column grants and triggers apply
 * exactly as for a direct API call. Use for everything a signed-in user does.
 */
export async function withUser<T>(db: Database, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}

/**
 * Runs `fn` with the server's privileged connection (bypasses RLS). Only for
 * operations without a signed-in user (anonymous quote submission, rate
 * limiting, email logging) or after explicit application-level authorisation.
 * `actor` is recorded by the audit triggers when present.
 */
export async function withSystem<T>(db: Database, actor: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${actor ? JSON.stringify({ sub: actor }) : ""}, true)`);
    return fn(tx);
  });
}
