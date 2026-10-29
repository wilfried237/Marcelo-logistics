import { createElement } from "react";
import { getSiteUrl } from "@/lib/config/env";
import type { Database } from "@/lib/db/types";
import { QuoteAcknowledgementEmail, QuoteIssuedEmail, ShipmentUpdateEmail, StaffNewRequestEmail, emailTranslator, type EmailLocale } from "./templates";
import { sendEmail, type EmailOutcome } from "./send";

/** Sends the customer acknowledgement and (if configured) the staff notification. */
export async function notifyQuoteRequestReceived(
  db: Database,
  args: { requestId: string; reference: string; service: string; email: string; name: string; locale: EmailLocale },
): Promise<EmailOutcome> {
  const t = emailTranslator(args.locale);
  const outcome = await sendEmail(db, {
    template: "quote_acknowledgement",
    to: args.email,
    locale: args.locale,
    subject: t("emails.ack.subject", { reference: args.reference }),
    react: createElement(QuoteAcknowledgementEmail, { locale: args.locale, name: args.name, reference: args.reference }),
    entity: "quote_requests",
    entityId: args.requestId,
    idempotencyKey: `ack:${args.requestId}`,
  });
  const staffInbox = process.env.STAFF_NOTIFICATION_EMAIL;
  if (staffInbox) {
    const te = emailTranslator("en");
    await sendEmail(db, {
      template: "staff_new_request",
      to: staffInbox,
      locale: "en",
      subject: te("emails.staffNew.subject", { reference: args.reference }),
      react: createElement(StaffNewRequestEmail, { reference: args.reference, service: args.service, url: `${getSiteUrl()}/en/admin/quotes/${args.reference}` }),
      entity: "quote_requests",
      entityId: args.requestId,
      idempotencyKey: `staff-new:${args.requestId}`,
    });
  }
  return outcome;
}

export async function notifyQuoteIssued(
  db: Database,
  args: { quoteId: string; reference: string; email: string; name: string; locale: EmailLocale; amountMinor: number; currency: string; validUntil: Date },
): Promise<EmailOutcome> {
  const t = emailTranslator(args.locale);
  return sendEmail(db, {
    template: "quote_issued",
    to: args.email,
    locale: args.locale,
    subject: t("emails.quote.subject", { reference: args.reference }),
    react: createElement(QuoteIssuedEmail, { ...args, url: `${getSiteUrl()}/${args.locale}/portal/quotes/${args.reference}` }),
    entity: "quotes",
    entityId: args.quoteId,
    idempotencyKey: `quote-issued:${args.quoteId}`,
  });
}

export async function notifyShipmentUpdate(
  db: Database,
  args: { eventKey: string; reference: string; milestone: string; email: string; name: string; locale: EmailLocale },
): Promise<EmailOutcome> {
  const t = emailTranslator(args.locale);
  return sendEmail(db, {
    template: "shipment_update",
    to: args.email,
    locale: args.locale,
    subject: t("emails.shipment.subject", { reference: args.reference }),
    react: createElement(ShipmentUpdateEmail, { ...args, url: `${getSiteUrl()}/${args.locale}/track/${args.reference}` }),
    entity: "shipments",
    entityId: args.reference,
    idempotencyKey: `shipment-update:${args.eventKey}`,
  });
}
