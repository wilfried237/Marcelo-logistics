import { eq } from "drizzle-orm";
import { render } from "@react-email/components";
import { getEmailTransport, type EmailTransport } from "@/lib/config/env";
import { emailDeliveries } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";

export interface EmailMessage {
  template: string;
  to: string;
  locale: "en" | "fr";
  subject: string;
  react: React.ReactElement;
  /** Business record the email is about (for the delivery log). */
  entity: string;
  entityId: string;
  /** Same key = same email; retries never send twice. */
  idempotencyKey: string;
}

export interface EmailProvider {
  send(input: { from: string; to: string; subject: string; html: string; text: string; idempotencyKey: string }): Promise<{ id: string } | { error: string }>;
}

/** Resend over its HTTP API. The API key never leaves the server. */
export function resendProvider(apiKey: string): EmailProvider {
  return {
    async send({ from, to, subject, html, text, idempotencyKey }) {
      const { Resend } = await import("resend");
      const client = new Resend(apiKey);
      const { data, error } = await client.emails.send({ from, to, subject, html, text }, { idempotencyKey });
      if (error || !data) return { error: error?.message ?? "unknown provider error" };
      return { id: data.id };
    },
  };
}

export type EmailOutcome = "sent" | "already_sent" | "skipped" | "failed";

/**
 * Records and sends a transactional email. Returns "sent" ONLY when the provider
 * accepted the message, so callers never claim an email was sent otherwise.
 */
export async function sendEmail(
  db: Database,
  message: EmailMessage,
  options: { transport?: EmailTransport; provider?: EmailProvider } = {},
): Promise<EmailOutcome> {
  const transport = options.transport ?? getEmailTransport();
  const inserted = await db
    .insert(emailDeliveries)
    .values({
      template: message.template,
      recipient: message.to,
      locale: message.locale,
      entity: message.entity,
      entityId: message.entityId,
      idempotencyKey: message.idempotencyKey,
      status: "PENDING",
    })
    .onConflictDoNothing({ target: emailDeliveries.idempotencyKey })
    .returning({ id: emailDeliveries.id });

  if (inserted.length === 0) {
    const [existing] = await db.select({ status: emailDeliveries.status }).from(emailDeliveries).where(eq(emailDeliveries.idempotencyKey, message.idempotencyKey));
    if (existing?.status === "SENT") return "already_sent";
    if (existing?.status === "PENDING") return "skipped"; // another attempt is in flight
  }
  const finish = (status: "SENT" | "FAILED" | "SKIPPED", fields: { providerMessageId?: string; error?: string } = {}) =>
    db
      .update(emailDeliveries)
      .set({ status, providerMessageId: fields.providerMessageId ?? null, error: fields.error?.slice(0, 1000) ?? null, sentAt: status === "SENT" ? new Date() : null })
      .where(eq(emailDeliveries.idempotencyKey, message.idempotencyKey));

  if (transport.kind === "disabled") {
    await finish("SKIPPED", { error: transport.reason });
    return "skipped";
  }
  if (transport.kind === "log") {
    // Development only: never prints the address or body.
    console.info(`[email:dev] ${message.template} (${message.locale}) for ${message.entity}/${message.entityId} not sent (EMAIL_DEV_LOG)`);
    await finish("SKIPPED", { error: "dev log transport" });
    return "skipped";
  }

  try {
    const html = await render(message.react);
    const text = await render(message.react, { plainText: true });
    const provider = options.provider ?? resendProvider(transport.apiKey);
    const result = await provider.send({ from: transport.from, to: message.to, subject: message.subject, html, text, idempotencyKey: message.idempotencyKey });
    if ("error" in result) {
      await finish("FAILED", { error: result.error });
      return "failed";
    }
    await finish("SENT", { providerMessageId: result.id });
    return "sent";
  } catch (error) {
    await finish("FAILED", { error: error instanceof Error ? error.message : "send failed" });
    return "failed";
  }
}
