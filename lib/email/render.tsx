import { getSiteUrl } from "@/lib/config/env";
import type { Database } from "@/lib/db/types";
import { formatMinor, formatQuantity } from "@/lib/domain/pricing";
import { quoteLinkUrl } from "@/lib/services/quote-links";
import { TransactionalEmail, emailTranslator, type Breakdown, type EmailLocale, type Fact, type TransactionalEmailProps } from "./templates";

/*
 * Builds an outbox email from the CURRENT database records (the outbox row holds
 * only identifiers), so a retry always shows accurate data and no personal data
 * is copied into the outbox. Runs on the server's privileged connection, after
 * the business transaction has committed.
 */

export interface OutboxRow {
  id: string;
  template: string;
  audience: "customer" | "staff";
  recipient: string | null;
  locale: EmailLocale;
  entity: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export type Rendered = { subject: string; props: TransactionalEmailProps } | { skip: string };

const dateFmt = (locale: EmailLocale, d: Date) =>
  new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-IE", { dateStyle: "long", timeZone: "Europe/Dublin" }).format(d);
const dateTimeFmt = (d: Date) => new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" }).format(d);
const country = (locale: EmailLocale, code: string) => new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;

async function requestById(db: Database, id: string) {
  return db.quoteRequest.findUnique({
    where: { id },
    select: {
      id: true,
      reference: true,
      serviceCode: true,
      originCountry: true,
      destinationCountry: true,
      status: true,
      createdAt: true,
      customer: { select: { name: true, userId: true } },
    },
  });
}

function customerLink(site: string, locale: EmailLocale, reference: string, hasAccount: boolean): string {
  return quoteLinkUrl(reference, locale) ?? (hasAccount ? `${site}/${locale}/portal/quotes/${reference}` : `${site}/${locale}/contact`);
}

async function breakdownFor(db: Database, quoteId: string, locale: EmailLocale): Promise<{ breakdown: Breakdown; validUntil: Date } | null> {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { amountMinor: true, currency: true, inclusions: true, exclusions: true, validUntil: true, lines: { orderBy: { position: "asc" } } },
  });
  if (!quote) return null;
  const t = emailTranslator(locale);
  const money = (v: bigint) => formatMinor(v, quote.currency, locale);
  const lines = quote.lines.length
    ? quote.lines
        .filter((l) => l.kind !== "tax")
        .map((l) => ({
          description: l.description,
          quantity: formatQuantity(BigInt(l.quantity.mul(1000).toFixed(0))),
          unitPrice: money(l.kind === "discount" ? -l.unitAmountMinor : l.unitAmountMinor),
          amount: money(l.lineTotalMinor),
        }))
    : [{ description: t("emails.breakdown.title"), quantity: "1", unitPrice: money(quote.amountMinor), amount: money(quote.amountMinor) }];
  const tax = quote.lines.filter((l) => l.kind === "tax").reduce((sum, l) => sum + l.lineTotalMinor, 0n);
  return {
    validUntil: quote.validUntil,
    breakdown: {
      title: t("emails.breakdown.title"),
      labels: {
        description: t("emails.breakdown.description"),
        quantity: t("emails.breakdown.quantity"),
        unitPrice: t("emails.breakdown.unitPrice"),
        amount: t("emails.breakdown.amount"),
        subtotal: t("emails.breakdown.subtotal"),
        tax: t("emails.breakdown.tax"),
        total: t("emails.breakdown.total"),
        includes: t("emails.breakdown.includes"),
        excludes: t("emails.breakdown.excludes"),
      },
      lines,
      subtotal: money(quote.amountMinor - tax),
      tax: tax ? money(tax) : null,
      total: money(quote.amountMinor),
      inclusions: quote.inclusions,
      exclusions: quote.exclusions,
    },
  };
}

export async function renderOutboxEmail(db: Database, row: OutboxRow): Promise<Rendered> {
  const site = getSiteUrl();
  const locale: EmailLocale = row.audience === "staff" ? "en" : row.locale;
  const t = emailTranslator(locale);
  const ts = t; // staff strings live under emails.staff.* in both catalogues
  const base = { locale, siteUrl: site };

  // ---------------------------------------------------------------- customer
  if (row.audience === "customer") {
    const tk = (key: string, values?: Record<string, string>) => t(`emails.${row.template}.${key}` as "emails.common.team", values as never);
    const greet = (name: string) => t("emails.common.greeting", { name });

    if (row.entity === "quote_requests" || row.entity === "quotes") {
      const requestId = row.entity === "quotes" ? String(row.payload.quoteRequestId ?? "") : row.entityId;
      const request = await requestById(db, requestId);
      if (!request) return { skip: "request not found" };
      const ref = request.reference;
      const link = customerLink(site, locale, ref, request.customer.userId !== null);
      const facts: Fact[] = [
        { label: t("emails.common.reference"), value: ref },
        { label: t("emails.common.route"), value: `${country(locale, request.originCountry)} → ${country(locale, request.destinationCountry)}` },
        { label: t("emails.common.service"), value: t(`services.${request.serviceCode}.title` as "services.parcels.title") },
      ];
      const props: TransactionalEmailProps = {
        ...base,
        preview: tk("subject", { reference: ref }),
        heading: tk("heading"),
        greeting: greet(request.customer.name),
        paragraphs: [tk("body")],
        facts,
        cta: { label: tk("cta"), href: link },
      };
      switch (row.template) {
        case "quote_received":
          props.paragraphs.push(tk("next"));
          break;
        case "info_requested": {
          const message = await db.caseMessage.findFirst({
            where: { quoteRequestId: request.id, kind: "info_request" },
            orderBy: { createdAt: "desc" },
            select: { body: true },
          });
          props.callout = message?.body;
          break;
        }
        case "quote_issued":
        case "quote_updated":
        case "quote_expiring": {
          const quoteId = row.entity === "quotes" ? row.entityId : String(row.payload.quoteId ?? "");
          const quote = await breakdownFor(db, quoteId, locale);
          if (!quote) return { skip: "quote not found" };
          if (row.template === "quote_expiring") props.paragraphs = [tk("body", { date: dateFmt(locale, quote.validUntil) })];
          else props.paragraphs.push(tk("validUntil", { date: dateFmt(locale, quote.validUntil) }));
          props.breakdown = quote.breakdown;
          break;
        }
        case "quote_under_review":
        case "quote_expired":
        case "quote_accepted":
        case "quote_declined":
          break;
        default:
          return { skip: `unknown template ${row.template}` };
      }
      return { subject: tk("subject", { reference: ref }), props };
    }

    if (row.entity === "shipments" || row.entity === "shipment_events") {
      const event =
        row.entity === "shipment_events"
          ? await db.shipmentEvent.findUnique({ where: { id: row.entityId }, select: { milestoneCode: true, location: true, shipmentId: true } })
          : null;
      const shipmentId = event?.shipmentId ?? row.entityId;
      const shipment = await db.shipment.findUnique({
        where: { id: shipmentId },
        select: { reference: true, customer: { select: { name: true } }, quote: { select: { quoteRequest: { select: { reference: true } } } } },
      });
      if (!shipment) return { skip: "shipment not found" };
      const milestone = event ? t(`milestones.${event.milestoneCode}` as "milestones.BOOKED") : "";
      const values = { shipment: shipment.reference, milestone, reference: shipment.quote.quoteRequest.reference };
      const paragraphs = [tk("body", values)];
      if (row.template === "shipment_update" && event?.location) paragraphs.push(tk("locationLine", { location: event.location }));
      return {
        subject: tk("subject", values),
        props: {
          ...base,
          preview: tk("subject", values),
          heading: tk("heading"),
          greeting: greet(shipment.customer.name),
          paragraphs,
          facts: [
            { label: row.template === "shipment_confirmed" ? tk("trackingLabel") : t("emails.common.reference"), value: shipment.reference },
            ...(milestone ? [{ label: t("emails.common.status"), value: milestone }] : []),
          ],
          cta: { label: tk("cta"), href: `${site}/${locale}/track/${shipment.reference}` },
        },
      };
    }

    if (row.entity === "contact_enquiries") {
      const enquiry = await db.contactEnquiry.findUnique({ where: { id: row.entityId }, select: { reference: true, name: true } });
      if (!enquiry) return { skip: "enquiry not found" };
      return {
        subject: tk("subject", { reference: enquiry.reference }),
        props: {
          ...base,
          preview: tk("subject", { reference: enquiry.reference }),
          heading: tk("heading"),
          greeting: greet(enquiry.name),
          paragraphs: [tk("body")],
          facts: [{ label: t("emails.common.reference"), value: enquiry.reference }],
        },
      };
    }
    return { skip: `unknown entity ${row.entity}` };
  }

  // ------------------------------------------------------------------- staff
  const sk = (key: string, values?: Record<string, string>) => ts(`emails.staff.${row.template}.${key}` as "emails.staff.common.open", values as never);
  const staff = (values: Record<string, string>, facts: Fact[], href: string): Rendered => ({
    subject: sk("subject", values),
    props: {
      ...base,
      internal: true,
      preview: sk("subject", values),
      heading: sk("heading"),
      paragraphs: [sk(values.__bodyKey ?? "body", values)],
      actionRequired: sk("action", values),
      facts: [{ label: ts("emails.staff.common.event"), value: row.template.replace(/^staff_/, "").replaceAll("_", " ") }, ...facts],
      cta: { label: ts("emails.staff.common.open"), href },
    },
  });
  const when = (d: Date) => ({ label: ts("emails.staff.common.when"), value: `${dateTimeFmt(d)} (Dublin)` });

  switch (row.template) {
    case "staff_new_request":
    case "staff_quote_accepted":
    case "staff_quote_declined": {
      const request = await requestById(db, row.entityId);
      if (!request) return { skip: "request not found" };
      const route = `${country("en", request.originCountry)} → ${country("en", request.destinationCountry)}`;
      return staff(
        { reference: request.reference, service: t(`services.${request.serviceCode}.title` as "services.parcels.title"), route },
        [{ label: ts("emails.staff.common.reference"), value: request.reference }, { label: ts("emails.staff.common.customer"), value: request.customer.name }, when(new Date())],
        `${site}/en/admin/quotes/${request.reference}`,
      );
    }
    case "staff_customer_message": {
      const message = await db.caseMessage.findUnique({
        where: { id: row.entityId },
        select: { kind: true, createdAt: true, quoteRequest: { select: { reference: true, customer: { select: { name: true } } } }, shipment: { select: { reference: true } } },
      });
      if (!message) return { skip: "message not found" };
      const ref = message.quoteRequest.reference;
      const issue = message.kind === "issue_report";
      return staff(
        { reference: ref, shipment: message.shipment?.reference ?? "", __bodyKey: issue ? "bodyIssue" : "body" },
        [{ label: ts("emails.staff.common.reference"), value: issue && message.shipment ? message.shipment.reference : ref }, { label: ts("emails.staff.common.customer"), value: message.quoteRequest.customer.name }, when(message.createdAt)],
        issue && message.shipment ? `${site}/en/admin/shipments/${message.shipment.reference}` : `${site}/en/admin/quotes/${ref}`,
      );
    }
    case "staff_shipment_exception": {
      const shipmentId =
        row.entity === "shipment_events"
          ? (await db.shipmentEvent.findUnique({ where: { id: row.entityId }, select: { shipmentId: true } }))?.shipmentId
          : row.entityId;
      const shipment = shipmentId ? await db.shipment.findUnique({ where: { id: shipmentId }, select: { reference: true, customer: { select: { name: true } } } }) : null;
      if (!shipment) return { skip: "shipment not found" };
      const reason = String(row.payload.reason ?? "ON_HOLD") === "DELAYED" ? "delayed" : "on hold";
      return staff(
        { shipment: shipment.reference, reason },
        [{ label: ts("emails.staff.common.reference"), value: shipment.reference }, { label: ts("emails.staff.common.customer"), value: shipment.customer.name }, when(new Date())],
        `${site}/en/admin/shipments/${shipment.reference}`,
      );
    }
    case "staff_contact": {
      const enquiry = await db.contactEnquiry.findUnique({ where: { id: row.entityId }, select: { reference: true, topic: true, name: true, createdAt: true } });
      if (!enquiry) return { skip: "enquiry not found" };
      return staff(
        { reference: enquiry.reference, topic: enquiry.topic },
        [{ label: ts("emails.staff.common.reference"), value: enquiry.reference }, { label: ts("emails.staff.common.customer"), value: enquiry.name }, when(enquiry.createdAt)],
        `${site}/en/admin/enquiries`,
      );
    }
    case "staff_role_changed": {
      const user = await db.authUser.findUnique({ where: { id: row.entityId }, select: { email: true } });
      return staff(
        { user: user?.email ?? row.entityId, from: String(row.payload.from ?? "?"), to: String(row.payload.to ?? "?") },
        [when(new Date())],
        `${site}/en/admin/users`,
      );
    }
    case "staff_email_failure":
      return staff(
        { template: String(row.payload.template ?? "?"), reference: String(row.payload.reference ?? row.entityId), status: String(row.payload.status ?? "failed") },
        [when(new Date())],
        `${site}/en/admin/notifications`,
      );
    case "staff_document_uploaded": {
      // Reference, file type and size only: never the file name or its content.
      const doc = await db.document.findUnique({ where: { id: row.entityId }, select: { ownerType: true, ownerId: true, mime: true, sizeBytes: true, createdAt: true } });
      if (!doc) return { skip: "document not found" };
      const owner =
        doc.ownerType === "quote_request"
          ? await db.quoteRequest.findUnique({ where: { id: doc.ownerId }, select: { reference: true, customer: { select: { name: true } } } })
          : await db.shipment.findUnique({ where: { id: doc.ownerId }, select: { reference: true, customer: { select: { name: true } } } });
      if (!owner) return { skip: "document owner not found" };
      const type = ({ "application/pdf": "PDF", "image/jpeg": "JPEG", "image/png": "PNG" } as Record<string, string>)[doc.mime] ?? doc.mime;
      const size = `${Math.max(1, Math.ceil(doc.sizeBytes / 1024))} KB`;
      return staff(
        { reference: owner.reference, type, size },
        [{ label: ts("emails.staff.common.reference"), value: owner.reference }, { label: ts("emails.staff.common.customer"), value: owner.customer.name }, when(doc.createdAt)],
        doc.ownerType === "quote_request" ? `${site}/en/admin/quotes/${owner.reference}` : `${site}/en/admin/shipments/${owner.reference}`,
      );
    }
    case "staff_job_failure":
      return staff({ job: String(row.payload.job ?? "?"), error: String(row.payload.error ?? "unknown").slice(0, 300) }, [when(new Date())], `${site}/en/admin/notifications`);
    default:
      return { skip: `unknown template ${row.template}` };
  }
}

/** React element for a rendered email (used by the outbox and the previews). */
export function emailElement(props: TransactionalEmailProps) {
  return <TransactionalEmail {...props} />;
}
