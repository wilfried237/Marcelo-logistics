import { withUser } from "@/lib/db/context";
import type { Database, Tx } from "@/lib/db/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import { assertStaff, isAdmin, type AppUser } from "@/lib/auth/types";
import { dublinLocalToIso } from "@/lib/domain/time";
import { CONTACT_REFERENCE_PATTERN, QUOTE_REFERENCE_PATTERN, SHIPMENT_REFERENCE_PATTERN, normaliseReference } from "@/lib/domain/references";

/**
 * Staff audit history (Stage 6). Reads the append-only audit_log (written only by
 * database triggers; staff-only by RLS). PRIVACY (owner decision D3): only the
 * NAMES of changed fields leave this module. Old and new values are read to work
 * out which fields changed and are then discarded; they are never returned.
 */

/** Tables with an audit trigger (migrations 20261029000001 and 20261104000000). */
export const AUDIT_ENTITIES = [
  "quote_requests",
  "quotes",
  "quote_line_items",
  "shipments",
  "shipment_events",
  "documents",
  "case_messages",
  "contact_enquiries",
  "customers",
  "profiles",
] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const AUDIT_ACTIONS = ["insert", "update", "status_changed", "role_changed", "delete"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_PAGE_SIZE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface AuditFilter {
  entity?: string;
  action?: string;
  /** A user id, or "system" for changes made without a signed-in user. */
  actor?: string;
  /** Irish calendar dates, inclusive. */
  from?: string;
  to?: string;
  /** A quote request (QR…), shipment (ML…) or contact enquiry (CE…) reference. */
  q?: string;
  page?: number;
}

export interface AuditEntry {
  id: number;
  at: Date;
  entity: AuditEntity | string;
  action: AuditAction | string;
  /** Changed field names (updates); empty for creations and deletions. Never values. */
  fields: string[];
  actor: { id: string | null; name: string | null };
  link: { href: string; label: string } | null;
}

const keysOf = (v: unknown): string[] => (v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v as object) : []);

/** Field names only: the keys of the changed-columns object for updates, nothing for inserts and deletes. */
export function changedFieldNames(action: string, before: unknown, after: unknown): string[] {
  const kind = action.slice(action.indexOf(".") + 1);
  if (kind === "insert" || kind === "delete") return [];
  return [...new Set([...keysOf(after), ...keysOf(before)])].filter((k) => k !== "updated_at").sort();
}

/** The audited records that belong to a reference (the record itself and its dependants). */
async function idsForReference(tx: Tx, raw: string): Promise<string[] | null> {
  const ref = normaliseReference(raw);
  if (QUOTE_REFERENCE_PATTERN.test(ref)) {
    const request = await tx.quoteRequest.findUnique({ where: { reference: ref }, select: { id: true } });
    if (!request) return [];
    const quotes = await tx.quote.findMany({ where: { quoteRequestId: request.id }, select: { id: true } });
    const [lines, messages, documents] = await Promise.all([
      tx.quoteLineItem.findMany({ where: { quoteId: { in: quotes.map((q) => q.id) } }, select: { id: true } }),
      tx.caseMessage.findMany({ where: { quoteRequestId: request.id }, select: { id: true } }),
      tx.document.findMany({ where: { ownerType: "quote_request", ownerId: request.id }, select: { id: true } }),
    ]);
    return [request.id, ...quotes.map((x) => x.id), ...lines.map((x) => x.id), ...messages.map((x) => x.id), ...documents.map((x) => x.id)];
  }
  if (SHIPMENT_REFERENCE_PATTERN.test(ref)) {
    const shipment = await tx.shipment.findUnique({ where: { reference: ref }, select: { id: true } });
    if (!shipment) return [];
    const [events, messages, documents] = await Promise.all([
      tx.shipmentEvent.findMany({ where: { shipmentId: shipment.id }, select: { id: true } }),
      tx.caseMessage.findMany({ where: { shipmentId: shipment.id }, select: { id: true } }),
      tx.document.findMany({ where: { ownerType: "shipment", ownerId: shipment.id }, select: { id: true } }),
    ]);
    return [shipment.id, ...events.map((x) => x.id), ...messages.map((x) => x.id), ...documents.map((x) => x.id)];
  }
  if (CONTACT_REFERENCE_PATTERN.test(ref)) {
    const enquiry = await tx.contactEnquiry.findUnique({ where: { reference: ref }, select: { id: true } });
    return enquiry ? [enquiry.id] : [];
  }
  return null; // not a reference
}

/** Next Irish calendar day, for an inclusive "to" date. */
function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Links to the records behind a page of entries (only for records that still exist and the user may open). */
async function linksFor(tx: Tx, user: AppUser, rows: { entity: string; entityId: string }[]) {
  const idsOf = (entity: string) => [...new Set(rows.filter((r) => r.entity === entity && UUID.test(r.entityId)).map((r) => r.entityId))];
  const [requests, quotes, lines, shipments, events, messages, documents, enquiries] = await Promise.all([
    tx.quoteRequest.findMany({ where: { id: { in: idsOf("quote_requests") } }, select: { id: true, reference: true } }),
    tx.quote.findMany({ where: { id: { in: idsOf("quotes") } }, select: { id: true, quoteRequest: { select: { reference: true } } } }),
    tx.quoteLineItem.findMany({ where: { id: { in: idsOf("quote_line_items") } }, select: { id: true, quote: { select: { quoteRequest: { select: { reference: true } } } } } }),
    tx.shipment.findMany({ where: { id: { in: idsOf("shipments") } }, select: { id: true, reference: true } }),
    tx.shipmentEvent.findMany({ where: { id: { in: idsOf("shipment_events") } }, select: { id: true, shipment: { select: { reference: true } } } }),
    tx.caseMessage.findMany({ where: { id: { in: idsOf("case_messages") } }, select: { id: true, quoteRequest: { select: { reference: true } } } }),
    tx.document.findMany({ where: { id: { in: idsOf("documents") } }, select: { id: true, ownerType: true, ownerId: true } }),
    tx.contactEnquiry.findMany({ where: { id: { in: idsOf("contact_enquiries") } }, select: { id: true, reference: true } }),
  ]);
  const docOwners = {
    requests: await tx.quoteRequest.findMany({ where: { id: { in: documents.filter((d) => d.ownerType === "quote_request").map((d) => d.ownerId) } }, select: { id: true, reference: true } }),
    shipments: await tx.shipment.findMany({ where: { id: { in: documents.filter((d) => d.ownerType === "shipment").map((d) => d.ownerId) } }, select: { id: true, reference: true } }),
  };
  const quoteLink = (ref: string) => ({ href: `/admin/quotes/${ref}`, label: ref });
  const shipmentLink = (ref: string) => ({ href: `/admin/shipments/${ref}`, label: ref });
  const map = new Map<string, { href: string; label: string }>();
  for (const r of requests) map.set(`quote_requests:${r.id}`, quoteLink(r.reference));
  for (const q of quotes) map.set(`quotes:${q.id}`, quoteLink(q.quoteRequest.reference));
  for (const l of lines) map.set(`quote_line_items:${l.id}`, quoteLink(l.quote.quoteRequest.reference));
  for (const s of shipments) map.set(`shipments:${s.id}`, shipmentLink(s.reference));
  for (const e of events) map.set(`shipment_events:${e.id}`, shipmentLink(e.shipment.reference));
  for (const m of messages) map.set(`case_messages:${m.id}`, quoteLink(m.quoteRequest.reference));
  for (const d of documents) {
    const owner = d.ownerType === "quote_request" ? docOwners.requests.find((r) => r.id === d.ownerId) : docOwners.shipments.find((s) => s.id === d.ownerId);
    if (owner) map.set(`documents:${d.id}`, d.ownerType === "quote_request" ? quoteLink(owner.reference) : shipmentLink(owner.reference));
  }
  for (const c of enquiries) map.set(`contact_enquiries:${c.id}`, { href: "/admin/enquiries", label: c.reference });
  const listLink = (entity: string) =>
    entity === "customers" ? { href: "/admin/customers", label: "" } : entity === "profiles" && isAdmin(user) ? { href: "/admin/users", label: "" } : null;
  return (entity: string, entityId: string) => map.get(`${entity}:${entityId}`) ?? listLink(entity);
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  pages: number;
  /** True when `q` was given but is not a QR, ML or CE reference. */
  invalidReference: boolean;
}

export async function searchAudit(db: Database, user: AppUser, filter: AuditFilter = {}): Promise<AuditPage> {
  assertStaff(user);
  const page = Math.max(1, Math.min(10_000, Math.trunc(filter.page ?? 1) || 1));
  return withUser(db, user.id, async (tx) => {
    const where: Prisma.AuditLogWhereInput = {};
    if (filter.entity && (AUDIT_ENTITIES as readonly string[]).includes(filter.entity)) where.entity = filter.entity;
    if (filter.action && (AUDIT_ACTIONS as readonly string[]).includes(filter.action)) where.action = { endsWith: `.${filter.action}` };
    if (filter.actor === "system") where.actor = null;
    else if (filter.actor && UUID.test(filter.actor)) where.actor = filter.actor;
    const at: Prisma.DateTimeFilter = {};
    const startOf = (date: string | undefined) => {
      const iso = date && DATE.test(date) ? dublinLocalToIso(`${date}T00:00`) : null;
      return iso ? new Date(iso) : undefined;
    };
    const from = startOf(filter.from);
    const to = filter.to && DATE.test(filter.to) ? startOf(nextDay(filter.to)) : undefined;
    if (from) at.gte = from;
    if (to) at.lt = to;
    if (at.gte || at.lt) where.at = at;
    let invalidReference = false;
    if (filter.q?.trim()) {
      const ids = await idsForReference(tx, filter.q.trim().slice(0, 40));
      if (ids === null) invalidReference = true;
      where.entityId = { in: ids ?? [] };
    }

    const [total, rows] = await Promise.all([
      tx.auditLog.count({ where }),
      tx.auditLog.findMany({
        where,
        select: { id: true, actor: true, action: true, entity: true, entityId: true, before: true, after: true, at: true },
        orderBy: [{ at: "desc" }, { id: "desc" }],
        skip: (page - 1) * AUDIT_PAGE_SIZE,
        take: AUDIT_PAGE_SIZE,
      }),
    ]);
    const actorIds = [...new Set(rows.map((r) => r.actor).filter((a): a is string => a !== null))];
    const names = actorIds.length ? await tx.customer.findMany({ where: { userId: { in: actorIds } }, select: { userId: true, name: true } }) : [];
    const nameOf = new Map(names.map((n) => [n.userId, n.name]));
    const link = await linksFor(tx, user, rows);
    const entries: AuditEntry[] = rows.map((r) => ({
      id: Number(r.id),
      at: r.at,
      entity: r.entity,
      action: r.action.slice(r.action.indexOf(".") + 1),
      // Values end here: only the field names are kept.
      fields: changedFieldNames(r.action, r.before, r.after),
      actor: { id: r.actor, name: r.actor ? (nameOf.get(r.actor) ?? null) : null },
      link: link(r.entity, r.entityId),
    }));
    return { entries, total, page, pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)), invalidReference };
  });
}

/** Staff and admins who can appear as actors (for the filter), with names where known. */
export async function listAuditActors(db: Database, user: AppUser) {
  assertStaff(user);
  return withUser(db, user.id, async (tx) => {
    const staff = await tx.profile.findMany({ where: { role: { in: ["staff", "admin"] } }, select: { id: true }, take: 200 });
    const names = await tx.customer.findMany({ where: { userId: { in: staff.map((s) => s.id) } }, select: { userId: true, name: true } });
    const nameOf = new Map(names.map((n) => [n.userId, n.name]));
    return staff.map((s) => ({ id: s.id, name: nameOf.get(s.id) ?? null })).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  });
}
