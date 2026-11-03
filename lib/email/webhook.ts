import { createHmac, timingSafeEqual } from "node:crypto";
import type { Database } from "@/lib/db/types";
import { alertDeliveryProblem } from "./outbox";

/*
 * Resend delivery webhooks (Svix signing scheme). The signature is an
 * HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${raw body}` keyed with the
 * base64 part of RESEND_WEBHOOK_SECRET ("whsec_..."). Requests older or newer
 * than 5 minutes are rejected (replay protection). Unsigned or badly signed
 * requests change nothing.
 */

const TOLERANCE_SECONDS = 5 * 60;

export function verifyWebhookSignature(input: {
  secret: string | undefined;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowSeconds?: number;
}): boolean {
  const { secret, id, timestamp, signature, body } = input;
  if (!secret || !secret.startsWith("whsec_") || !id || !timestamp || !signature) return false;
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  let key: Buffer;
  try {
    key = Buffer.from(secret.slice("whsec_".length), "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  // The header may hold several space-separated "v1,<base64>" signatures (key rotation).
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type ResendEvent = { type?: string; created_at?: string; data?: { email_id?: string } };

const STATUS_FOR_EVENT: Record<string, "DELIVERED" | "BOUNCED" | "COMPLAINED" | null> = {
  "email.delivered": "DELIVERED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
  "email.sent": null,
  "email.delivery_delayed": null,
  "email.opened": null,
  "email.clicked": null,
};

/**
 * Applies a verified provider event to the outbox row with that provider id.
 * Idempotent: replaying an event changes nothing further. Bounces and
 * complaints alert staff once (deduplicated by the outbox key).
 */
export async function applyResendEvent(db: Database, event: ResendEvent): Promise<"applied" | "ignored"> {
  const type = event.type ?? "";
  const providerId = event.data?.email_id;
  if (!(type in STATUS_FOR_EVENT) || !providerId || providerId.length > 100) return "ignored";
  const row = await db.emailDelivery.findFirst({
    where: { providerMessageId: providerId },
    select: { id: true, template: true, audience: true, entity: true, entityId: true, status: true },
  });
  if (!row) return "ignored";
  const at = event.created_at && !Number.isNaN(Date.parse(event.created_at)) ? new Date(event.created_at) : new Date();
  const status = STATUS_FOR_EVENT[type];
  // Bounces and complaints are final; a late "delivered" never overwrites them.
  const final = row.status === "BOUNCED" || row.status === "COMPLAINED";
  await db.emailDelivery.update({
    where: { id: row.id },
    data: {
      lastEvent: type,
      lastEventAt: at,
      ...(status && !final ? { status, ...(status === "DELIVERED" ? { deliveredAt: at } : {}) } : {}),
    },
    select: { id: true },
  });
  if ((status === "BOUNCED" || status === "COMPLAINED") && !final) {
    await alertDeliveryProblem(db, { ...row, audience: row.audience === "staff" ? "staff" : "customer" }, status);
  }
  return "applied";
}
