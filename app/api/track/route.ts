import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/config/env";
import { isDemoDataEnabled } from "@/lib/config/flags";
import { getDb } from "@/lib/db/client";
import { DEMO_SHIPMENTS } from "@/lib/demo/tracking";
import { trackShipment } from "@/lib/services/tracking";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Public, read-only tracking lookup for API clients. Returns exactly the
 * allowlisted fields of public_track_shipment(). There is no write handler:
 * shipment updates are staff-only server actions, so POST/PUT/PATCH/DELETE
 * return 405. Unknown references get a uniform 404.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trackingNumber") ?? "";
  if (!/^[A-Za-z0-9 -]{6,24}$/.test(raw.trim())) return NextResponse.json({ code: "INVALID_REFERENCE" }, { status: 400, headers: NO_STORE });

  if (isDatabaseConfigured()) {
    const clientId = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-client";
    const result = await trackShipment(getDb(), raw, clientId);
    if (result.ok) return NextResponse.json({ data: result.shipment }, { headers: NO_STORE });
    const status = result.code === "rate_limited" ? 429 : result.code === "invalid_reference" ? 400 : 404;
    return NextResponse.json({ code: result.code.toUpperCase() }, { status, headers: NO_STORE });
  }

  const demo = isDemoDataEnabled() ? DEMO_SHIPMENTS[raw.trim().toUpperCase()] : undefined;
  if (!demo) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ data: demo, demo: true }, { headers: NO_STORE });
}
