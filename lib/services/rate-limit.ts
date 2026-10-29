import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database, Tx } from "@/lib/db/types";

/** Hashes identifiers (IP, email) before they are stored as rate-limit keys. */
export function hashKey(scope: string, value: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "ml-rate-limit";
  return `${scope}:${createHash("sha256").update(`${salt}:${value.toLowerCase()}`).digest("base64url").slice(0, 32)}`;
}

/**
 * Persistent fixed-window limiter backed by Postgres (app_rate_limit_hit), so it
 * holds across serverless instances. Returns true when the request is allowed.
 */
export async function rateLimitHit(db: Database | Tx, key: string, windowSeconds: number, max: number): Promise<boolean> {
  const rows = await db.execute<{ allowed: boolean }>(sql`select public.app_rate_limit_hit(${key}, ${windowSeconds}::int, ${max}::int) as allowed`);
  const list = (Array.isArray(rows) ? rows : (rows as { rows: { allowed: boolean }[] }).rows) as { allowed: boolean }[];
  return list[0]?.allowed === true;
}

export const QUOTE_LIMITS = {
  perClientPerHour: 5,
  perEmailPerDay: 5,
} as const;

export const TRACKING_LIMITS = {
  perClientPerMinute: 30,
} as const;
