import { NextResponse, type NextRequest } from "next/server";
import { isDatabaseConfigured } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { checkCronAuth, expireQuotes, runJob } from "@/lib/services/jobs";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Scheduled quote expiry (Vercel Cron sends GET with `Authorization: Bearer
 * $CRON_SECRET`). Logs and returns only a count, never customer data.
 */
export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "disabled") return NextResponse.json({ code: "CRON_DISABLED" }, { status: 503, headers: NO_STORE });
  if (auth !== "ok") return NextResponse.json({ code: "UNAUTHORISED" }, { status: 401, headers: NO_STORE });
  if (!isDatabaseConfigured()) return NextResponse.json({ code: "DATABASE_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE });
  try {
    const db = getDb();
    const result = await runJob(db, "expire-quotes", () => expireQuotes(db));
    console.info(`[cron] expire-quotes: ${result.expired} request(s) expired`);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    console.error("[cron] expire-quotes failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ code: "FAILED" }, { status: 500, headers: NO_STORE });
  }
}
