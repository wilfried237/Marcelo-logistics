import { withUser } from "@/lib/db/context";
import { domainErrorCode, isUniqueViolation } from "@/lib/db/errors";
import type { Database } from "@/lib/db/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import { assertStaff, type AppUser } from "@/lib/auth/types";
import { fieldErrors, shipmentEventInputSchema, shipmentUpdateInputSchema } from "@/lib/domain/quote-schema";
import { MAX_REFERENCE_ATTEMPTS, SHIPMENT_REFERENCE_PATTERN, generateShipmentReference, normaliseReference } from "@/lib/domain/references";
import type { ShipmentStatus } from "@/lib/domain/enums";
import { toShipmentHistory } from "@/lib/domain/shipment-history";
import { likeLiteral } from "@/lib/db/like";
import { STATUS_MILESTONES, isDuplicateMilestone } from "@/lib/domain/shipment-lifecycle";
import type { StaffActionResult } from "./quote-requests";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const shipmentSelect = {
  id: true,
  reference: true,
  serviceCode: true,
  status: true,
  etaFrom: true,
  etaTo: true,
  etaVisible: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ShipmentSelect;

const eventSelect = {
  id: true,
  milestoneCode: true,
  location: true,
  occurredAt: true,
  noteEn: true,
  noteFr: true,
  public: true,
} satisfies Prisma.ShipmentEventSelect;

/** Date columns are exchanged as ISO "YYYY-MM-DD" strings. */
const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const toShipmentView = <T extends { etaFrom: Date | null; etaTo: Date | null }>(s: T) => ({ ...s, etaFrom: isoDate(s.etaFrom), etaTo: isoDate(s.etaTo) });
const toEventView = ({ milestoneCode, ...e }: Prisma.ShipmentEventGetPayload<{ select: typeof eventSelect }>) => ({ ...e, milestone: milestoneCode });

// ---- Customer --------------------------------------------------------------

export async function listCustomerShipments(db: Database, user: AppUser) {
  if (!user.customerId) return [];
  const rows = await withUser(db, user.id, (tx) =>
    tx.shipment.findMany({ where: { customerId: user.customerId! }, select: shipmentSelect, orderBy: { createdAt: "desc" }, take: 200 }),
  );
  return rows.map(toShipmentView);
}

export async function getCustomerShipment(db: Database, user: AppUser, rawReference: string) {
  const reference = normaliseReference(rawReference);
  if (!user.customerId || !SHIPMENT_REFERENCE_PATTERN.test(reference)) return null;
  return withUser(db, user.id, async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { reference, customerId: user.customerId! },
      select: { ...shipmentSelect, quote: { select: { quoteRequest: { select: { reference: true } } } } },
    });
    if (!shipment) return null;
    // RLS returns only public events to customers; the filter makes it explicit.
    const events = await tx.shipmentEvent.findMany({ where: { shipmentId: shipment.id, public: true }, select: eventSelect, orderBy: { occurredAt: "desc" } });
    const { quote, ...rest } = toShipmentView(shipment);
    return {
      ...rest,
      quoteReference: quote.quoteRequest.reference,
      etaFrom: rest.etaVisible ? rest.etaFrom : null,
      etaTo: rest.etaVisible ? rest.etaTo : null,
      events: events.map(toEventView),
    };
  });
}

// ---- Staff -------------------------------------------------------------------

export interface StaffShipmentFilter {
  status?: ShipmentStatus;
  /** Shipment or quote request reference, customer name or email (partial, case-insensitive). */
  q?: string;
  /** "updated" (default): most recently updated first; "oldest": oldest created first. */
  sort?: "updated" | "oldest";
}

export async function listShipmentsForStaff(db: Database, user: AppUser, filter: StaffShipmentFilter = {}) {
  assertStaff(user);
  const q = filter.q?.trim().slice(0, 120);
  const where: Prisma.ShipmentWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: likeLiteral(normaliseReference(q)) } },
            { quote: { quoteRequest: { reference: { contains: likeLiteral(normaliseReference(q)) } } } },
            { customer: { name: { contains: likeLiteral(q), mode: "insensitive" } } },
            { customer: { email: { contains: likeLiteral(q.toLowerCase()) } } },
          ],
        }
      : {}),
  };
  const rows = await withUser(db, user.id, (tx) =>
    tx.shipment.findMany({
      where,
      select: { ...shipmentSelect, customer: { select: { name: true } } },
      orderBy: filter.sort === "oldest" ? { createdAt: "asc" } : { updatedAt: "desc" },
      take: 200,
    }),
  );
  return rows.map(({ customer, ...s }) => ({ ...toShipmentView(s), customerName: customer.name }));
}

export async function getShipmentForStaff(db: Database, user: AppUser, rawReference: string) {
  assertStaff(user);
  const reference = normaliseReference(rawReference);
  if (!SHIPMENT_REFERENCE_PATTERN.test(reference)) return null;
  return withUser(db, user.id, async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { reference },
      select: {
        ...shipmentSelect,
        customer: { select: { name: true, email: true, preferredLocale: true } },
        quote: { select: { quoteRequest: { select: { id: true, reference: true } } } },
      },
    });
    if (!shipment) return null;
    const events = await tx.shipmentEvent.findMany({ where: { shipmentId: shipment.id }, select: eventSelect, orderBy: { occurredAt: "desc" } });
    // History: the audit log rows for this shipment and its milestones (staff-only by RLS).
    const audit = await tx.auditLog.findMany({
      where: { OR: [{ entity: "shipments", entityId: shipment.id }, { entity: "shipment_events", entityId: { in: events.map((e) => e.id) } }] },
      select: { action: true, actor: true, before: true, after: true, at: true },
      // Rows from one transaction share a timestamp; the id keeps their real order.
      orderBy: [{ at: "asc" }, { id: "asc" }],
      take: 500,
    });
    // Staff names come from their linked customer record, as on the users page.
    const actorIds = [...new Set(audit.map((a) => a.actor).filter((a): a is string => a !== null))];
    const actors = actorIds.length
      ? await tx.customer.findMany({ where: { userId: { in: actorIds } }, select: { userId: true, name: true } })
      : [];
    const { customer, quote, ...rest } = toShipmentView(shipment);
    return {
      ...rest,
      customerName: customer.name,
      customerEmail: customer.email,
      customerLocale: customer.preferredLocale,
      quoteReference: quote.quoteRequest.reference,
      quoteRequestId: quote.quoteRequest.id,
      events: events.map(toEventView),
      history: toShipmentHistory(audit),
      actorNames: Object.fromEntries(actors.map((a) => [a.userId!, a.name])) as Record<string, string>,
    };
  });
}

/**
 * Creates the shipment for an ACCEPTED request (the database derives owner and service).
 * One shipment per request: the database also enforces one shipment per quote
 * (`shipments_quote_key`), so a concurrent second attempt fails the same way.
 */
export async function createShipmentForRequest(db: Database, user: AppUser, requestId: string): Promise<StaffActionResult<{ reference: string }>> {
  assertStaff(user);
  if (!UUID_PATTERN.test(requestId)) return { ok: false, code: "not_found" };
  try {
    const existing = await withUser(db, user.id, (tx) => tx.shipment.findFirst({ where: { quote: { quoteRequestId: requestId } }, select: { id: true } }));
    if (existing) return { ok: false, code: "shipment_exists" };
    const quote = await withUser(db, user.id, (tx) =>
      tx.quote.findFirst({ where: { quoteRequestId: requestId, sentAt: { not: null } }, select: { id: true }, orderBy: { sentAt: "desc" } }),
    );
    if (!quote) return { ok: false, code: "quote_not_accepted" };
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
      const reference = generateShipmentReference();
      try {
        // customer_id and service_code are overwritten by the trigger from the
        // accepted quote; the placeholders only satisfy the client's types.
        const created = await withUser(db, user.id, (tx) =>
          tx.shipment.create({
            data: { reference, quoteId: quote.id, createdBy: user.id, customerId: user.id, serviceCode: "parcels" },
            select: { reference: true },
          }),
        );
        return { ok: true, data: { reference: created.reference } };
      } catch (error) {
        if (isUniqueViolation(error, "reference")) continue;
        if (isUniqueViolation(error, "quote")) return { ok: false, code: "shipment_exists" };
        throw error;
      }
    }
    return { ok: false, code: "conflict" };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

export async function addShipmentEvent(db: Database, user: AppUser, raw: unknown): Promise<StaffActionResult> {
  assertStaff(user);
  const parsed = shipmentEventInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  try {
    await withUser(db, user.id, (tx) =>
      tx.shipmentEvent.create({
        data: {
          shipmentId: input.shipmentId,
          milestoneCode: input.milestone,
          location: input.location ?? null,
          occurredAt: new Date(input.occurredAt),
          noteEn: input.noteEn ?? null,
          noteFr: input.noteFr ?? null,
          public: input.public,
          createdBy: user.id,
        },
        select: { id: true },
      }),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

export async function setShipmentEventVisibility(db: Database, user: AppUser, eventId: string, visible: boolean): Promise<StaffActionResult> {
  assertStaff(user);
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { ok: false, code: "not_found" };
  try {
    const updated = await withUser(db, user.id, (tx) => tx.shipmentEvent.updateMany({ where: { id: eventId }, data: { public: visible } }));
    return updated.count ? { ok: true } : { ok: false, code: "not_found" };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

export type MilestoneOutcome = "recorded" | "skipped" | "none";

/**
 * Updates status and ETA and, when asked, records the milestone matching the
 * new status, in ONE transaction: if the transition is refused or the
 * milestone insert fails, nothing is saved. The database triggers still check
 * the transition, write both audit rows with the acting staff member, and
 * queue the customer email for a public milestone (once, keyed by its id).
 */
export async function updateShipment(db: Database, user: AppUser, raw: unknown): Promise<StaffActionResult<{ milestone: MilestoneOutcome }>> {
  assertStaff(user);
  const parsed = shipmentUpdateInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const toDate = (v?: string) => (v ? new Date(`${v}T00:00:00Z`) : null);
  try {
    const outcome = await withUser(db, user.id, async (tx): Promise<MilestoneOutcome | null> => {
      const current = await tx.shipment.findUnique({ where: { id: input.shipmentId }, select: { status: true } });
      if (!current) return null;
      await tx.shipment.updateMany({
        where: { id: input.shipmentId },
        data: { status: input.status, etaFrom: toDate(input.etaFrom), etaTo: toDate(input.etaTo), etaVisible: input.etaVisible },
      });
      const mapping = STATUS_MILESTONES[input.status];
      if (!input.recordMilestone || !mapping || current.status === input.status) return "none";
      const existing = await tx.shipmentEvent.findMany({
        where: { shipmentId: input.shipmentId },
        select: { milestoneCode: true },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      });
      if (isDuplicateMilestone(mapping.milestone, existing.map((e) => e.milestoneCode))) return "skipped";
      await tx.shipmentEvent.create({
        data: { shipmentId: input.shipmentId, milestoneCode: mapping.milestone, occurredAt: new Date(), public: input.milestonePublic, createdBy: user.id },
        select: { id: true },
      });
      return "recorded";
    });
    return outcome ? { ok: true, data: { milestone: outcome } } : { ok: false, code: "not_found" };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}
