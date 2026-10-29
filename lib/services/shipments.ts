import { and, desc, eq, sql } from "drizzle-orm";
import { withUser } from "@/lib/db/context";
import { domainErrorCode, isUniqueViolation } from "@/lib/db/errors";
import { customers, quoteRequests, quotes, shipmentEvents, shipments } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { assertStaff, type AppUser } from "@/lib/auth/types";
import { fieldErrors, shipmentEventInputSchema, shipmentUpdateInputSchema } from "@/lib/domain/quote-schema";
import { MAX_REFERENCE_ATTEMPTS, SHIPMENT_REFERENCE_PATTERN, generateShipmentReference, normaliseReference } from "@/lib/domain/references";
import type { StaffActionResult } from "./quote-requests";

const shipmentColumns = {
  id: shipments.id,
  reference: shipments.reference,
  serviceCode: shipments.serviceCode,
  status: shipments.status,
  etaFrom: shipments.etaFrom,
  etaTo: shipments.etaTo,
  etaVisible: shipments.etaVisible,
  createdAt: shipments.createdAt,
  updatedAt: shipments.updatedAt,
};

const eventColumns = {
  id: shipmentEvents.id,
  milestone: shipmentEvents.milestoneCode,
  location: shipmentEvents.location,
  occurredAt: shipmentEvents.occurredAt,
  noteEn: shipmentEvents.noteEn,
  noteFr: shipmentEvents.noteFr,
  public: shipmentEvents.public,
};

// ---- Customer --------------------------------------------------------------

export async function listCustomerShipments(db: Database, user: AppUser) {
  if (!user.customerId) return [];
  return withUser(db, user.id, (tx) =>
    tx.select(shipmentColumns).from(shipments).where(eq(shipments.customerId, user.customerId!)).orderBy(desc(shipments.createdAt)),
  );
}

export async function getCustomerShipment(db: Database, user: AppUser, rawReference: string) {
  const reference = normaliseReference(rawReference);
  if (!user.customerId || !SHIPMENT_REFERENCE_PATTERN.test(reference)) return null;
  return withUser(db, user.id, async (tx) => {
    const [shipment] = await tx
      .select({ ...shipmentColumns, quoteReference: quoteRequests.reference })
      .from(shipments)
      .innerJoin(quotes, eq(quotes.id, shipments.quoteId))
      .innerJoin(quoteRequests, eq(quoteRequests.id, quotes.quoteRequestId))
      .where(and(eq(shipments.reference, reference), eq(shipments.customerId, user.customerId!)));
    if (!shipment) return null;
    // RLS returns only public events to customers; the filter makes it explicit.
    const events = await tx
      .select(eventColumns)
      .from(shipmentEvents)
      .where(and(eq(shipmentEvents.shipmentId, shipment.id), eq(shipmentEvents.public, true)))
      .orderBy(desc(shipmentEvents.occurredAt));
    return {
      ...shipment,
      etaFrom: shipment.etaVisible ? shipment.etaFrom : null,
      etaTo: shipment.etaVisible ? shipment.etaTo : null,
      events,
    };
  });
}

// ---- Staff -------------------------------------------------------------------

export async function listShipmentsForStaff(db: Database, user: AppUser) {
  assertStaff(user);
  return withUser(db, user.id, (tx) =>
    tx
      .select({ ...shipmentColumns, customerName: customers.name })
      .from(shipments)
      .innerJoin(customers, eq(customers.id, shipments.customerId))
      .orderBy(desc(shipments.updatedAt))
      .limit(200),
  );
}

export async function getShipmentForStaff(db: Database, user: AppUser, rawReference: string) {
  assertStaff(user);
  const reference = normaliseReference(rawReference);
  if (!SHIPMENT_REFERENCE_PATTERN.test(reference)) return null;
  return withUser(db, user.id, async (tx) => {
    const [shipment] = await tx
      .select({ ...shipmentColumns, customerName: customers.name, customerEmail: customers.email, quoteReference: quoteRequests.reference })
      .from(shipments)
      .innerJoin(customers, eq(customers.id, shipments.customerId))
      .innerJoin(quotes, eq(quotes.id, shipments.quoteId))
      .innerJoin(quoteRequests, eq(quoteRequests.id, quotes.quoteRequestId))
      .where(eq(shipments.reference, reference));
    if (!shipment) return null;
    const events = await tx.select(eventColumns).from(shipmentEvents).where(eq(shipmentEvents.shipmentId, shipment.id)).orderBy(desc(shipmentEvents.occurredAt));
    return { ...shipment, events };
  });
}

/** Creates the shipment for an ACCEPTED request (the database derives owner and service). */
export async function createShipmentForRequest(db: Database, user: AppUser, requestId: string): Promise<StaffActionResult<{ reference: string }>> {
  assertStaff(user);
  try {
    return await withUser(db, user.id, async (tx) => {
      const [quote] = await tx
        .select({ id: quotes.id })
        .from(quotes)
        .where(and(eq(quotes.quoteRequestId, requestId), sql`${quotes.sentAt} is not null`))
        .orderBy(desc(quotes.sentAt))
        .limit(1);
      if (!quote) return { ok: false, code: "quote_not_accepted" } as const;
      for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
        const reference = generateShipmentReference();
        try {
          // A savepoint keeps the transaction usable if the reference collides.
          const [created] = await tx.transaction((sp) =>
            sp.insert(shipments).values({ reference, quoteId: quote.id, createdBy: user.id } as typeof shipments.$inferInsert).returning({ reference: shipments.reference }),
          );
          return { ok: true, data: { reference: created.reference } } as const;
        } catch (error) {
          if (isUniqueViolation(error, "shipments_reference_key")) continue;
          throw error;
        }
      }
      return { ok: false, code: "conflict" } as const;
    });
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
      tx.insert(shipmentEvents).values({
        shipmentId: input.shipmentId,
        milestoneCode: input.milestone,
        location: input.location ?? null,
        occurredAt: new Date(input.occurredAt),
        noteEn: input.noteEn ?? null,
        noteFr: input.noteFr ?? null,
        public: input.public,
        createdBy: user.id,
      }),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

export async function setShipmentEventVisibility(db: Database, user: AppUser, eventId: string, visible: boolean): Promise<StaffActionResult> {
  assertStaff(user);
  try {
    const rows = await withUser(db, user.id, (tx) =>
      tx.update(shipmentEvents).set({ public: visible }).where(eq(shipmentEvents.id, eventId)).returning({ id: shipmentEvents.id }),
    );
    return rows.length ? { ok: true } : { ok: false, code: "not_found" };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

export async function updateShipment(db: Database, user: AppUser, raw: unknown): Promise<StaffActionResult> {
  assertStaff(user);
  const parsed = shipmentUpdateInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  try {
    const rows = await withUser(db, user.id, (tx) =>
      tx
        .update(shipments)
        .set({ status: input.status, etaFrom: input.etaFrom ?? null, etaTo: input.etaTo ?? null, etaVisible: input.etaVisible })
        .where(eq(shipments.id, input.shipmentId))
        .returning({ id: shipments.id }),
    );
    return rows.length ? { ok: true } : { ok: false, code: "not_found" };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}
