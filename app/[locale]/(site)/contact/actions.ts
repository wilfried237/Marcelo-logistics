"use server";

import { headers } from "next/headers";
import { getEmailTransport, isDatabaseConfigured } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { deliverQueuedEmailsSoon } from "@/lib/email/dispatch";
import { submitContactEnquiry, type ContactResult } from "@/lib/services/cases";

export type ContactActionResult = ContactResult extends infer R ? (R extends { ok: true } ? R & { emailSent: boolean } : R) | { ok: false; code: "unavailable" } : never;

async function clientIdentifier(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown-client";
}

/**
 * Contact form. Success is reported only after the enquiry is committed; the
 * customer confirmation and the staff alert are queued in the same transaction.
 */
export async function submitContactAction(input: unknown): Promise<ContactActionResult> {
  if (!isDatabaseConfigured()) return { ok: false, code: "unavailable" };
  const result = await submitContactEnquiry(getDb(), input, await clientIdentifier());
  if (!result.ok) return result;
  deliverQueuedEmailsSoon();
  return { ...result, emailSent: getEmailTransport().kind === "resend" };
}
