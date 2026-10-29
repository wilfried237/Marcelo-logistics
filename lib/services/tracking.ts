import { sql } from "drizzle-orm";
import { withSystem } from "@/lib/db/context";
import type { Database } from "@/lib/db/types";
import type { MilestoneCode, ShipmentStatus } from "@/lib/domain/enums";
import type { ServiceCode } from "@/lib/domain/services";
import { SHIPMENT_REFERENCE_PATTERN, normaliseReference } from "@/lib/domain/references";
import { TRACKING_LIMITS, hashKey, rateLimitHit } from "./rate-limit";

/** Exactly the fields returned by public_track_shipment(); nothing else is exposed. */
export interface PublicTracking {
  reference: string;
  serviceCode: ServiceCode;
  status: ShipmentStatus;
  etaFrom: string | null;
  etaTo: string | null;
  events: { milestone: MilestoneCode; location: string | null; occurredAt: string; noteEn: string | null; noteFr: string | null }[];
}

export type TrackResult = { ok: true; shipment: PublicTracking } | { ok: false; code: "invalid_reference" | "not_found" | "rate_limited" };

/**
 * Public lookup. Invalid and unknown references are indistinguishable to the
 * caller apart from a format hint, so private record existence never leaks.
 */
export async function trackShipment(db: Database, rawReference: string, clientId: string): Promise<TrackResult> {
  const reference = normaliseReference(rawReference);
  if (!SHIPMENT_REFERENCE_PATTERN.test(reference)) return { ok: false, code: "invalid_reference" };
  if (!(await rateLimitHit(db, hashKey("track:client", clientId), 60, TRACKING_LIMITS.perClientPerMinute))) return { ok: false, code: "rate_limited" };

  // Executed as the anon role so the function's grant model is exercised.
  const result = await withSystem(db, null, async (tx) => {
    await tx.execute(sql`set local role anon`);
    const rows = await tx.execute<{ result: PublicTracking | null }>(sql`select public.public_track_shipment(${reference}) as result`);
    const list = (Array.isArray(rows) ? rows : (rows as { rows: { result: PublicTracking | null }[] }).rows) as { result: PublicTracking | null }[];
    return list[0]?.result ?? null;
  });
  return result ? { ok: true, shipment: result } : { ok: false, code: "not_found" };
}
