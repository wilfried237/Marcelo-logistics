import { NextResponse } from "next/server";

/**
 * Legacy quote endpoint.
 *
 * The previous implementation stored requests in process memory (lost on
 * restart, never seen by staff), returned every customer's personal data from
 * an unauthenticated GET, and calculated invented prices. It has been removed.
 *
 * Quote requests are submitted through the database-backed server action in
 * app/[locale]/(site)/quote/actions.ts. This endpoint only answers honestly
 * that it does not accept submissions. There is deliberately no GET handler,
 * so any GET returns 405 and never exposes data.
 */
export function POST() {
  return NextResponse.json(
    { code: "SUBMISSION_UNAVAILABLE", message: "This endpoint does not accept quote requests." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
