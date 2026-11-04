import { createHash } from "node:crypto";
import type { Database, Tx } from "@/lib/db/types";

/** Hashes identifiers (IP, email) before they are stored as rate-limit keys. */
export function hashKey(scope: string, value: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "ml-rate-limit";
  return `${scope}:${createHash("sha256").update(`${salt}:${value.toLowerCase()}`).digest("base64url").slice(0, 32)}`;
}

/**
 * Persistent fixed-window limiter backed by Postgres (app_rate_limit_hit), so it
 * holds across serverless instances. Returns true when the request is allowed.
 * If the database is unavailable the call throws, and callers treat that as a
 * refusal: rate limits fail closed.
 */
export async function rateLimitHit(db: Database | Tx, key: string, windowSeconds: number, max: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ allowed: boolean }[]>`select public.app_rate_limit_hit(${key}, ${windowSeconds}::int, ${max}::int) as allowed`;
  return rows[0]?.allowed === true;
}

export const QUOTE_LIMITS = { perClientPerHour: 5, perEmailPerDay: 5 } as const;
export const TRACKING_LIMITS = { perClientPerMinute: 30 } as const;
/** Sign-in, password-reset and registration attempts (in addition to Supabase's own limits). */
export const AUTH_LIMITS = { perClientPerTenMinutes: 20, perEmailPerTenMinutes: 10, resetPerEmailPerHour: 3, registerPerEmailPerHour: 3 } as const;
/** Contact form submissions. */
export const CONTACT_LIMITS = { perClientPerHour: 5, perEmailPerDay: 5 } as const;
/** Actions through signed quote links (accept, decline, reply). */
export const LINK_LIMITS = { perClientPerTenMinutes: 20 } as const;
