"use server";

import { headers } from "next/headers";
import { getEmailTransport, quoteSubmissionStatus } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { deliverQueuedEmailsSoon } from "@/lib/email/dispatch";
import { submitQuoteRequest, type SubmitFailure } from "@/lib/services/quote-requests";

export type QuoteActionResult =
  | { ok: true; reference: string; emailSent: boolean }
  | { ok: false; code: SubmitFailure; fieldErrors?: Record<string, string> };

/** First address in X-Forwarded-For (set by the hosting proxy), else a constant bucket. */
async function clientIdentifier(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown-client";
}

export async function submitQuoteAction(input: unknown): Promise<QuoteActionResult> {
  const availability = quoteSubmissionStatus();
  if (!availability.available) return { ok: false, code: "unavailable" };

  const db = getDb();
  const user = await getCurrentUser();
  const result = await submitQuoteRequest(db, input, { user, clientId: await clientIdentifier() }, availability);
  if (!result.ok) return { ok: false, code: result.code, fieldErrors: result.fieldErrors };

  // The request and its acknowledgement email were committed together (outbox).
  // Delivery happens right after this response; the scheduled job retries failures.
  deliverQueuedEmailsSoon();
  return { ok: true, reference: result.reference, emailSent: getEmailTransport().kind === "resend" };
}
