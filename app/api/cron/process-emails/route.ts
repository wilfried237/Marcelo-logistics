import { NextResponse, type NextRequest } from "next/server";
import { ownerConfig } from "@/config/owner";
import { isDatabaseConfigured } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { processOutbox } from "@/lib/email/outbox";
import { checkCronAuth, queueExpiryReminders, runJob } from "@/lib/services/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Email outbox job: queues configured expiry reminders, then delivers due
 * emails and retries failed ones (bounded attempts with backoff). Emails are
 * also delivered right after each user action; this job catches retries and
 * anything interrupted. Protected by CRON_SECRET; logs counts only.
 */
export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "disabled") return NextResponse.json({ code: "CRON_DISABLED" }, { status: 503, headers: NO_STORE });
  if (auth !== "ok") return NextResponse.json({ code: "UNAUTHORISED" }, { status: 401, headers: NO_STORE });
  if (!isDatabaseConfigured()) return NextResponse.json({ code: "DATABASE_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE });
  const db = getDb();
  try {
    const result = await runJob(db, "process-emails", async () => {
      const reminders = await queueExpiryReminders(db, ownerConfig.notifications.quoteExpiryReminderHours);
      let total = { claimed: 0, sent: 0, skipped: 0, retrying: 0, dead: 0 };
      // Up to 4 batches of 25 per run, well within the function time limit.
      for (let i = 0; i < 4; i++) {
        const batch = await processOutbox(db);
        total = { claimed: total.claimed + batch.claimed, sent: total.sent + batch.sent, skipped: total.skipped + batch.skipped, retrying: total.retrying + batch.retrying, dead: total.dead + batch.dead };
        if (batch.claimed < 25) break;
      }
      return { ...reminders, ...total };
    });
    console.info(`[cron] process-emails: ${JSON.stringify(result)}`);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    console.error("[cron] process-emails failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ code: "FAILED" }, { status: 500, headers: NO_STORE });
  }
}
