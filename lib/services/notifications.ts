import { withUser } from "@/lib/db/context";
import type { Database, Tx } from "@/lib/db/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import { assertStaff, type AppUser } from "@/lib/auth/types";

/**
 * Staff notification history (Stage 6). Read-only views of the email outbox:
 * nothing here sends, re-queues or retries an email (owner decision D4: no
 * manual retry of DEAD emails). Recipient addresses, rendered content and
 * payloads are never selected.
 */

export const EMAIL_STATUSES = ["PENDING", "SENDING", "SENT", "DELIVERED", "FAILED", "DEAD", "BOUNCED", "COMPLAINED", "SKIPPED"] as const;
export type EmailStatusFilter = (typeof EMAIL_STATUSES)[number];
export const EMAIL_AUDIENCES = ["customer", "staff"] as const;
export const PROBLEM_STATUSES = ["FAILED", "DEAD", "BOUNCED", "COMPLAINED"] as const;
export const NOTIFICATIONS_PAGE_SIZE = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEMPLATE = /^[a-z_]{1,64}$/;

const emailSelect = {
  id: true,
  template: true,
  audience: true,
  status: true,
  attempts: true,
  entity: true,
  entityId: true,
  createdAt: true,
  sentAt: true,
  lastEvent: true,
  error: true,
} satisfies Prisma.EmailDeliverySelect;

export interface NotificationFilter {
  status?: string;
  template?: string;
  audience?: string;
  page?: number;
}

export type RecordLink = { href: string; label: string } | null;

/** Links each email to the quote request, shipment or enquiry it is about (when that record still exists). */
async function recordLinks(tx: Tx, rows: { entity: string; entityId: string }[]): Promise<(entity: string, id: string) => RecordLink> {
  const idsOf = (entity: string) => [...new Set(rows.filter((r) => r.entity === entity && UUID.test(r.entityId)).map((r) => r.entityId))];
  const [requests, quotes, shipments, events, messages, enquiries, documents] = await Promise.all([
    tx.quoteRequest.findMany({ where: { id: { in: idsOf("quote_requests") } }, select: { id: true, reference: true } }),
    tx.quote.findMany({ where: { id: { in: idsOf("quotes") } }, select: { id: true, quoteRequest: { select: { reference: true } } } }),
    tx.shipment.findMany({ where: { id: { in: idsOf("shipments") } }, select: { id: true, reference: true } }),
    tx.shipmentEvent.findMany({ where: { id: { in: idsOf("shipment_events") } }, select: { id: true, shipment: { select: { reference: true } } } }),
    tx.caseMessage.findMany({ where: { id: { in: idsOf("case_messages") } }, select: { id: true, quoteRequest: { select: { reference: true } } } }),
    tx.contactEnquiry.findMany({ where: { id: { in: idsOf("contact_enquiries") } }, select: { id: true, reference: true } }),
    tx.document.findMany({ where: { id: { in: idsOf("documents") } }, select: { id: true, ownerType: true, ownerId: true } }),
  ]);
  const [docRequests, docShipments] = await Promise.all([
    tx.quoteRequest.findMany({ where: { id: { in: documents.filter((d) => d.ownerType === "quote_request").map((d) => d.ownerId) } }, select: { id: true, reference: true } }),
    tx.shipment.findMany({ where: { id: { in: documents.filter((d) => d.ownerType === "shipment").map((d) => d.ownerId) } }, select: { id: true, reference: true } }),
  ]);
  const quote = (ref: string) => ({ href: `/admin/quotes/${ref}`, label: ref });
  const shipment = (ref: string) => ({ href: `/admin/shipments/${ref}`, label: ref });
  const map = new Map<string, { href: string; label: string }>();
  for (const r of requests) map.set(`quote_requests:${r.id}`, quote(r.reference));
  for (const q of quotes) map.set(`quotes:${q.id}`, quote(q.quoteRequest.reference));
  for (const s of shipments) map.set(`shipments:${s.id}`, shipment(s.reference));
  for (const e of events) map.set(`shipment_events:${e.id}`, shipment(e.shipment.reference));
  for (const m of messages) map.set(`case_messages:${m.id}`, quote(m.quoteRequest.reference));
  for (const c of enquiries) map.set(`contact_enquiries:${c.id}`, { href: "/admin/enquiries", label: c.reference });
  for (const d of documents) {
    const owner = d.ownerType === "quote_request" ? docRequests.find((r) => r.id === d.ownerId) : docShipments.find((s) => s.id === d.ownerId);
    if (owner) map.set(`documents:${d.id}`, d.ownerType === "quote_request" ? quote(owner.reference) : shipment(owner.reference));
  }
  return (entity, id) => map.get(`${entity}:${id}`) ?? null;
}

export async function listNotifications(db: Database, user: AppUser, filter: NotificationFilter = {}) {
  assertStaff(user);
  const page = Math.max(1, Math.min(10_000, Math.trunc(filter.page ?? 1) || 1));
  const where: Prisma.EmailDeliveryWhereInput = {};
  if (filter.status && (EMAIL_STATUSES as readonly string[]).includes(filter.status)) where.status = filter.status as EmailStatusFilter;
  if (filter.template && TEMPLATE.test(filter.template)) where.template = filter.template;
  if (filter.audience && (EMAIL_AUDIENCES as readonly string[]).includes(filter.audience)) where.audience = filter.audience;
  // Through RLS as well as assertStaff: email_deliveries is staff-only in the database too.
  return withUser(db, user.id, async (tx) => {
    const [total, rows, templates, problems] = await Promise.all([
      tx.emailDelivery.count({ where }),
      tx.emailDelivery.findMany({ where, select: emailSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * NOTIFICATIONS_PAGE_SIZE, take: NOTIFICATIONS_PAGE_SIZE }),
      tx.emailDelivery.findMany({ distinct: ["template"], select: { template: true }, orderBy: { template: "asc" } }),
      tx.emailDelivery.count({ where: { status: { in: [...PROBLEM_STATUSES] } } }),
    ]);
    const link = await recordLinks(tx, rows);
    return {
      emails: rows.map(({ entityId, ...e }) => ({ ...e, link: link(e.entity, entityId) })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE)),
      templates: templates.map((t) => t.template),
      problems,
    };
  });
}

/** Emails about one shipment: its confirmation and each milestone update (mirrors listEmailsForRequest). */
export async function listEmailsForShipment(db: Database, user: AppUser, shipmentId: string) {
  assertStaff(user);
  if (!UUID.test(shipmentId)) return [];
  return withUser(db, user.id, async (tx) => {
    const [events, documents] = await Promise.all([
      tx.shipmentEvent.findMany({ where: { shipmentId }, select: { id: true } }),
      tx.document.findMany({ where: { ownerType: "shipment", ownerId: shipmentId }, select: { id: true } }),
    ]);
    return tx.emailDelivery.findMany({
      where: { entityId: { in: [shipmentId, ...events.map((e) => e.id), ...documents.map((d) => d.id)] } },
      select: { id: true, template: true, audience: true, status: true, attempts: true, createdAt: true, sentAt: true, lastEvent: true, error: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });
}
