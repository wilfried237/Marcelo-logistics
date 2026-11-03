import { NextResponse, type NextRequest } from "next/server";
import { isDatabaseConfigured } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { applyResendEvent, verifyWebhookSignature } from "@/lib/email/webhook";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Resend delivery events (delivered, bounced, complained, ...). Every request
 * must carry a valid Svix signature made with RESEND_WEBHOOK_SECRET; anything
 * else is rejected without touching the database. Responses never echo input.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !isDatabaseConfigured()) return NextResponse.json({ code: "WEBHOOK_DISABLED" }, { status: 503, headers: NO_STORE });
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return NextResponse.json({ code: "TOO_LARGE" }, { status: 413, headers: NO_STORE });
  const valid = verifyWebhookSignature({
    secret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  });
  if (!valid) return NextResponse.json({ code: "INVALID_SIGNATURE" }, { status: 401, headers: NO_STORE });
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ code: "INVALID_BODY" }, { status: 400, headers: NO_STORE });
  }
  try {
    const outcome = await applyResendEvent(getDb(), event as Parameters<typeof applyResendEvent>[1]);
    return NextResponse.json({ outcome }, { headers: NO_STORE });
  } catch (error) {
    console.error("[webhook] resend event failed", error instanceof Error ? error.name : "unknown");
    // 500 lets the provider retry later.
    return NextResponse.json({ code: "FAILED" }, { status: 500, headers: NO_STORE });
  }
}
