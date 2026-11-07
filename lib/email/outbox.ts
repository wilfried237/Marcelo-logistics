import { render } from "@react-email/components";
import { getEmailTransport, type EmailTransport } from "@/lib/config/env";
import type { Database } from "@/lib/db/types";
import { emailElement, renderOutboxEmail, type OutboxRow } from "./render";
import { plainTextEmail } from "./templates";

/*
 * Delivers the email outbox. Rows are created by database triggers in the same
 * transaction as the business change (migration 20261104000000_backend_mvp).
 *
 * - Claims due rows with FOR UPDATE SKIP LOCKED, so concurrent runs never send
 *   the same row twice; a row stuck in SENDING for 10 minutes is reclaimed.
 * - The provider receives the row's idempotency key, so a crash between the
 *   provider call and the status update cannot produce a second email.
 * - Failures are retried with backoff (1 min, 5 min, 30 min, 2 h, 12 h); after
 *   MAX_ATTEMPTS the row is DEAD and staff get one alert. Never endless.
 * - "Sent" means the provider accepted the message; delivery, bounces and
 *   complaints arrive later through the signed webhook (webhook.ts).
 * - Staff alerts go to STAFF_NOTIFICATION_EMAIL (comma-separated), resolved at
 *   send time and never stored in the database.
 */

export const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
const STALE_LOCK_MINUTES = 10;

export interface EmailProvider {
  send(input: { from: string; to: string[]; subject: string; html: string; text: string; idempotencyKey: string; replyTo?: string }): Promise<{ id: string } | { error: string }>;
}

/** Resend over its HTTP API. The API key never leaves the server. */
export function resendProvider(apiKey: string): EmailProvider {
  return {
    async send({ from, to, subject, html, text, idempotencyKey, replyTo }) {
      const { Resend } = await import("resend");
      const client = new Resend(apiKey);
      const { data, error } = await client.emails.send({ from, to, subject, html, text, ...(replyTo ? { replyTo } : {}) }, { idempotencyKey });
      if (error || !data) return { error: error?.message ?? "unknown provider error" };
      return { id: data.id };
    },
  };
}

/** Parses STAFF_NOTIFICATION_EMAIL ("a@x.ie, b@y.ie"); invalid entries are ignored. */
export function staffRecipients(env: Record<string, string | undefined> = process.env): string[] {
  return (env.STAFF_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 254)
    .slice(0, 10);
}

export interface OutboxOptions {
  transport?: EmailTransport;
  provider?: EmailProvider;
  recipientsForStaff?: string[];
  limit?: number;
}

export interface OutboxReport {
  claimed: number;
  sent: number;
  skipped: number;
  retrying: number;
  dead: number;
  /** Only with EMAIL_TEST_RECIPIENT: who each redirected email was meant for (masked). */
  redirected?: { template: string; audience: "customer" | "staff"; intended: string[] }[];
}

/** "ngozi.example@domain.test" -> "n***@domain.test": enough to identify the case, no full address. */
export function maskAddress(address: string): string {
  const [local, domain] = address.split("@");
  return `${(local ?? "").slice(0, 1)}***@${domain ?? ""}`;
}

type ClaimedRow = OutboxRow & { idempotencyKey: string; attempts: number };

async function claim(db: Database, limit: number): Promise<ClaimedRow[]> {
  const rows = await db.$queryRaw<
    { id: string; template: string; audience: string; recipient: string | null; locale: string; entity: string; entity_id: string; payload: unknown; idempotency_key: string; attempts: number }[]
  >`
    update public.email_deliveries d
       set status = 'SENDING', locked_at = now(), attempts = d.attempts + 1
     where d.id in (
       select id from public.email_deliveries
        where (status in ('PENDING', 'FAILED') and next_attempt_at <= now())
           or (status = 'SENDING' and locked_at < now() - make_interval(mins => ${STALE_LOCK_MINUTES}))
        order by next_attempt_at
        limit ${limit}
        for update skip locked)
    returning d.id, d.template, d.audience, d.recipient, d.locale::text as locale, d.entity, d.entity_id, d.payload, d.idempotency_key, d.attempts`;
  return rows.map((r) => ({
    id: r.id,
    template: r.template,
    audience: r.audience === "staff" ? "staff" : "customer",
    recipient: r.recipient,
    locale: r.locale === "fr" ? "fr" : "en",
    entity: r.entity,
    entityId: r.entity_id,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    idempotencyKey: r.idempotency_key,
    attempts: r.attempts,
  }));
}

async function finish(db: Database, id: string, status: "SENT" | "SKIPPED", fields: { providerMessageId?: string; error?: string } = {}) {
  await db.emailDelivery.update({
    where: { id },
    data: { status, providerMessageId: fields.providerMessageId ?? null, error: fields.error?.slice(0, 1000) ?? null, sentAt: status === "SENT" ? new Date() : null, lockedAt: null },
    select: { id: true },
  });
}

/** Records a failed attempt; schedules a retry or marks the row DEAD and alerts staff once. */
export async function recordFailure(db: Database, row: ClaimedRow, error: string): Promise<"retrying" | "dead"> {
  const dead = row.attempts >= MAX_ATTEMPTS;
  const delay = BACKOFF_MINUTES[Math.min(row.attempts, BACKOFF_MINUTES.length) - 1] ?? 720;
  await db.emailDelivery.update({
    where: { id: row.id },
    data: { status: dead ? "DEAD" : "FAILED", error: error.slice(0, 1000), lockedAt: null, nextAttemptAt: new Date(Date.now() + delay * 60_000) },
    select: { id: true },
  });
  if (dead) await alertDeliveryProblem(db, row, "DEAD");
  return dead ? "dead" : "retrying";
}

/** One staff alert per failed customer email (never for staff alerts: no loops). */
export async function alertDeliveryProblem(db: Database, row: Pick<OutboxRow, "id" | "template" | "audience" | "entity" | "entityId">, status: string) {
  if (row.audience === "staff") return;
  const reference = await referenceFor(db, row.entity, row.entityId);
  await db.$executeRaw`select public.app_enqueue_email('staff_email_failure', 'staff', 'email_deliveries', ${row.id}, ${`staff_email_failure:${row.id}`}, null, 'en'::public.app_locale,
    ${JSON.stringify({ template: row.template, status, reference })}::jsonb)`;
}

async function referenceFor(db: Database, entity: string, id: string): Promise<string> {
  try {
    if (entity === "quote_requests") return (await db.quoteRequest.findUnique({ where: { id }, select: { reference: true } }))?.reference ?? id;
    if (entity === "quotes") return (await db.quote.findUnique({ where: { id }, select: { quoteRequest: { select: { reference: true } } } }))?.quoteRequest.reference ?? id;
    if (entity === "shipments") return (await db.shipment.findUnique({ where: { id }, select: { reference: true } }))?.reference ?? id;
    if (entity === "shipment_events") return (await db.shipmentEvent.findUnique({ where: { id }, select: { shipment: { select: { reference: true } } } }))?.shipment.reference ?? id;
    if (entity === "contact_enquiries") return (await db.contactEnquiry.findUnique({ where: { id }, select: { reference: true } }))?.reference ?? id;
  } catch {
    // fall through
  }
  return id;
}

export async function processOutbox(db: Database, options: OutboxOptions = {}): Promise<OutboxReport> {
  const transport = options.transport ?? getEmailTransport();
  const staff = options.recipientsForStaff ?? staffRecipients();
  const report: OutboxReport = { claimed: 0, sent: 0, skipped: 0, retrying: 0, dead: 0 };
  const rows = await claim(db, options.limit ?? 25);
  report.claimed = rows.length;

  for (const row of rows) {
    try {
      if (transport.kind === "disabled") {
        await finish(db, row.id, "SKIPPED", { error: transport.reason });
        report.skipped++;
        continue;
      }
      const to = row.audience === "staff" ? staff : row.recipient ? [row.recipient] : [];
      if (to.length === 0) {
        await finish(db, row.id, "SKIPPED", { error: row.audience === "staff" ? "no staff notification inbox configured" : "no recipient" });
        report.skipped++;
        continue;
      }
      const rendered = await renderOutboxEmail(db, row);
      if ("skip" in rendered) {
        await finish(db, row.id, "SKIPPED", { error: rendered.skip });
        report.skipped++;
        continue;
      }
      if (transport.kind === "log") {
        // Development only: never prints addresses or content.
        console.info(`[email:dev] ${row.template} (${row.locale}) ${row.entity}/${row.entityId} not sent (EMAIL_DEV_LOG)`);
        await finish(db, row.id, "SKIPPED", { error: "dev log transport" });
        report.skipped++;
        continue;
      }
      const element = emailElement(rendered.props);
      const html = await render(element);
      const text = plainTextEmail(rendered.props);
      const provider = options.provider ?? resendProvider(transport.apiKey);
      // Test-only override (never active on Vercel, see emailTestRecipient):
      // everything goes to the one test address, the stored recipient is untouched.
      let recipients = to;
      let subject = rendered.subject;
      if (transport.testRecipient) {
        (report.redirected ??= []).push({ template: row.template, audience: row.audience, intended: to.map(maskAddress) });
        recipients = [transport.testRecipient];
        subject = `[EMAIL TEST] ${subject}`;
      }
      // Same sender and reply-to for customer emails and staff alerts (EMAIL_FROM, EMAIL_REPLY_TO).
      const result = await provider.send({
        from: transport.from,
        to: recipients,
        subject,
        html,
        text,
        idempotencyKey: row.idempotencyKey,
        ...(transport.replyTo ? { replyTo: transport.replyTo } : {}),
      });
      if ("error" in result) {
        report[await recordFailure(db, row, result.error)]++;
        continue;
      }
      await finish(db, row.id, "SENT", { providerMessageId: result.id });
      report.sent++;
    } catch (error) {
      report[await recordFailure(db, row, error instanceof Error ? error.message : "send failed")]++;
    }
  }
  return report;
}
