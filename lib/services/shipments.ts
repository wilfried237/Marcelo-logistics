import { withUser } from "@/lib/db/context";
import { domainErrorCode, isUniqueViolation } from "@/lib/db/errors";
import type { Database } from "@/lib/db/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import { assertStaff, type AppUser } from "@/lib/auth/types";
import { fieldErrors, shipmentEventInputSchema, shipmentUpdateInputSchema } from "@/lib/domain/quote-schema";
import { MAX_REFERENCE_ATTEMPTS, SHIPMENT_REFERENCE_PATTERN, generateShipmentReference, normaliseReference } from "@/lib/domain/references";
import type { StaffActionResult } from "./quote-requests";

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

export async function listShipmentsForStaff(db: Database, user: AppUser) {
  assertStaff(user);
  const rows = await withUser(db, user.id, (tx) =>
    tx.shipment.findMany({ select: { ...shipmentSelect, customer: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
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
        quote: { select: { quoteRequest: { select: { reference: true } } } },
      },
    });
    if (!shipment) return null;
    const events = await tx.shipmentEvent.findMany({ where: { shipmentId: shipment.id }, select: eventSelect, orderBy: { occurredAt: "desc" } });
    const { customer, quote, ...rest } = toShipmentView(shipment);
    return {
      ...rest,
      customerName: customer.name,
      customerEmail: customer.email,
      customerLocale: customer.preferredLocale,
      quoteReference: quote.quoteRequest.reference,
      events: events.map(toEventView),
    };
  });
}

/** Creates the shipment for an ACCEPTED request (the database derives owner and service). */
export async function createShipmentForRequest(db: Database, user: AppUser, requestId: string): Promise<StaffActionResult<{ reference: string }>> {
  assertStaff(user);
  try {
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

export async function updateShipment(db: Database, user: AppUser, raw: unknown): Promise<StaffActionResult> {
  assertStaff(user);
  const parsed = shipmentUpdateInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const toDate = (v?: string) => (v ? new Date(`${v}T00:00:00Z`) : null);
  try {
    const updated = await withUser(db, user.id, (tx) =>
      tx.shipment.updateMany({
        where: { id: input.shipmentId },
        data: { status: input.status, etaFrom: toDate(input.etaFrom), etaTo: toDate(input.etaTo), etaVisible: input.etaVisible },
      }),
    );
    return updated.count ? { ok: true } : { ok: false, code: "not_found" };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}
