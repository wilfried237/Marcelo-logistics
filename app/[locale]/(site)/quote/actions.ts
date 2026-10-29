"use server";

import { headers } from "next/headers";
import { quoteSubmissionStatus } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyQuoteRequestReceived } from "@/lib/email/notifications";
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

  // The request is committed at this point. Email is best effort and reported truthfully.
  let emailSent = false;
  try {
    const service = (input as { service?: string }).service ?? "";
    const outcome = await notifyQuoteRequestReceived(db, { requestId: result.requestId, reference: result.reference, service, ...result.notify });
    emailSent = outcome === "sent" || outcome === "already_sent";
  } catch (error) {
    console.error("acknowledgement email failed", error instanceof Error ? error.name : "unknown");
  }
  return { ok: true, reference: result.reference, emailSent };
}
