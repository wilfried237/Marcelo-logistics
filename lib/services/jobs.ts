import { timingSafeEqual } from "node:crypto";
import { withSystem } from "@/lib/db/context";
import type { Database } from "@/lib/db/types";

/**
 * Expires QUOTED requests whose sent quotes are all past `valid_until`.
 *
 * Safety comes from app_expire_quotes() in the database:
 * - the UPDATE re-checks `status = 'QUOTED'` and validity under row locks, so a
 *   concurrent acceptance or cancellation is never overwritten and two
 *   concurrent runs never expire the same request twice;
 * - the lifecycle trigger validates QUOTED -> EXPIRED and the audit trigger
 *   records each change in the same transaction (actor = NULL, "system").
 * Idempotent: a second run finds nothing to do.
 */
export async function expireQuotes(db: Database): Promise<{ expired: number }> {
  const rows = await withSystem(db, null, (tx) => tx.$queryRaw<{ expired: number }[]>`select public.app_expire_quotes() as expired`);
  return { expired: Number(rows[0]?.expired ?? 0) };
}

/**
 * Validates `Authorization: Bearer <CRON_SECRET>` in constant time. Returns
 * "disabled" when no secret is configured, so jobs never run unauthenticated.
 */
export function checkCronAuth(authorization: string | null, secret: string | undefined): "ok" | "unauthorised" | "disabled" {
  if (!secret || secret.length < 32) return "disabled";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization ?? "");
  if (given.length !== expected.length) return "unauthorised";
  return timingSafeEqual(given, expected) ? "ok" : "unauthorised";
}
