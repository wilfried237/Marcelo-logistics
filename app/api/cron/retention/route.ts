import { NextResponse, type NextRequest } from "next/server";
import { retentionPolicy } from "@/config/retention";
import { isDatabaseConfigured, isStorageConfigured } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { checkCronAuth } from "@/lib/services/jobs";
import { runRetention } from "@/lib/services/retention";
import { supabaseDocumentStorage } from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Retention job. Default is a dry run that returns counts only. Deletion needs
 * ALL of: `?mode=execute`, an approved policy (config/retention.ts) and
 * RETENTION_EXECUTION_ENABLED=true. Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "disabled") return NextResponse.json({ code: "CRON_DISABLED" }, { status: 503, headers: NO_STORE });
  if (auth !== "ok") return NextResponse.json({ code: "UNAUTHORISED" }, { status: 401, headers: NO_STORE });
  if (!isDatabaseConfigured() || !isStorageConfigured()) return NextResponse.json({ code: "NOT_CONFIGURED" }, { status: 503, headers: NO_STORE });

  const execute = request.nextUrl.searchParams.get("mode") === "execute";
  try {
    const result = await runRetention(getDb(), supabaseDocumentStorage(), {
      policy: retentionPolicy,
      execute,
      executionEnabled: process.env.RETENTION_EXECUTION_ENABLED === "true",
    });
    if ("refused" in result) return NextResponse.json({ code: result.reason.toUpperCase() }, { status: 409, headers: NO_STORE });
    console.info(`[cron] retention ${result.mode}: ${result.documentsEligible} eligible, ${result.documentsDeleted} deleted, ${result.documentsFailed} failed`);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    console.error("[cron] retention failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ code: "FAILED" }, { status: 500, headers: NO_STORE });
  }
}
