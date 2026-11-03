import "server-only";
import { after } from "next/server";
import { getDb } from "@/lib/db/client";
import { processOutbox } from "./outbox";

/**
 * Delivers queued emails right after the response has been sent (Next.js
 * `after`), so customers and staff are notified within seconds instead of at
 * the next scheduled run. Failures stay in the outbox for the retry job.
 */
export function deliverQueuedEmailsSoon(): void {
  after(async () => {
    try {
      await processOutbox(getDb(), { limit: 10 });
    } catch (error) {
      console.error("[email] immediate delivery failed; the scheduled job will retry", error instanceof Error ? error.name : "unknown");
    }
  });
}
