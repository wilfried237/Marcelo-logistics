import { NextRequest, NextResponse } from "next/server";
import { isDemoDataEnabled } from "@/lib/config/flags";
import { DEMO_SHIPMENTS } from "@/lib/demo/tracking";

const NO_STORE = { "Cache-Control": "no-store" };
const REFERENCE = /^[A-Z0-9]{6,20}$/;

/**
 * Public, read-only tracking lookup.
 *
 * There is no write handler: shipment updates are staff-only server actions,
 * so POST/PUT/PATCH/DELETE return 405. Unknown and invalid references get the
 * same 404, so the response never reveals whether a private record exists.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trackingNumber") ?? "";
  const reference = raw.trim().toUpperCase();
  if (!REFERENCE.test(reference)) {
    return NextResponse.json({ code: "INVALID_REFERENCE" }, { status: 400, headers: NO_STORE });
  }

  const shipment = isDemoDataEnabled() ? DEMO_SHIPMENTS[reference] : undefined;
  if (!shipment) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ data: shipment, demo: true }, { headers: NO_STORE });
}
