import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { ownerConfig } from "@/config/owner";
import { quoteSubmissionStatus } from "@/lib/config/env";
import { withSystem, withUser } from "@/lib/db/context";
import { domainErrorCode, isUniqueViolation, type DomainErrorCode } from "@/lib/db/errors";
import { auditLog, customers, quoteRequests, quotes, shipments } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { assertStaff, type AppUser } from "@/lib/auth/types";
import type { QuoteStatus } from "@/lib/domain/enums";
import { actorMayTransition } from "@/lib/domain/quote-lifecycle";
import { fieldErrors, quoteRequestInputSchema, sendQuoteInputSchema, transitionInputSchema } from "@/lib/domain/quote-schema";
import { MAX_REFERENCE_ATTEMPTS, QUOTE_REFERENCE_PATTERN, generateQuoteReference, normaliseReference } from "@/lib/domain/references";
import { toMinorUnits } from "@/lib/domain/money";
import { QUOTE_LIMITS, hashKey, rateLimitHit } from "./rate-limit";

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

export type SubmitFailure = "unavailable" | "invalid" | "rejected" | "rate_limited" | "route_not_offered" | "server_error";
export type SubmitResult =
  | { ok: true; reference: string; duplicate: boolean; requestId: string; notify: { email: string; name: string; locale: "en" | "fr" } }
  | { ok: false; code: SubmitFailure; fieldErrors?: Record<string, string> };

export interface SubmitContext {
  user: AppUser | null;
  /** Stable identifier for the client (e.g. IP address); hashed before storage. */
  clientId: string;
}

/**
 * Persists a quote request. Never reports success unless the database committed
 * the request. Customer identity comes from the session, never from the input.
 */
export async function submitQuoteRequest(
  db: Database,
  raw: unknown,
  ctx: SubmitContext,
  availability: ReturnType<typeof quoteSubmissionStatus> = quoteSubmissionStatus(),
): Promise<SubmitResult> {
  if (!availability.available) return { ok: false, code: "unavailable" };

  // Honeypot first: bots get a generic rejection and nothing is stored.
  if (raw && typeof raw === "object" && typeof (raw as { website?: unknown }).website === "string" && (raw as { website: string }).website.trim() !== "") {
    return { ok: false, code: "rejected" };
  }

  const parsed = quoteRequestInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;

  const origins = ownerConfig.operations.originCountries as readonly string[];
  const destinations = ownerConfig.operations.destinationCountries as readonly string[];
  if (!origins.includes(input.originCountry) || !destinations.includes(input.destinationCountry)) {
    return { ok: false, code: "route_not_offered", fieldErrors: { destinationCountry: "not_offered" } };
  }

  try {
    // Idempotent retry: the same client key returns the original request.
    const existing = await db
      .select({ id: quoteRequests.id, reference: quoteRequests.reference })
      .from(quoteRequests)
      .where(eq(quoteRequests.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing[0]) {
      return { ok: true, duplicate: true, reference: existing[0].reference, requestId: existing[0].id, notify: { email: input.contact.email, name: input.contact.name, locale: input.locale } };
    }

    const allowedClient = await rateLimitHit(db, hashKey("quote:client", ctx.clientId), 3600, QUOTE_LIMITS.perClientPerHour);
    const allowedEmail = await rateLimitHit(db, hashKey("quote:email", input.contact.email), 86400, QUOTE_LIMITS.perEmailPerDay);
    if (!allowedClient || !allowedEmail) return { ok: false, code: "rate_limited" };

    const actor = ctx.user?.id ?? null;
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
      const reference = generateQuoteReference();
      try {
        const created = await withSystem(db, actor, async (tx) => {
          let customerId = ctx.user?.customerId ?? null;
          let notify = { email: input.contact.email, name: input.contact.name, locale: input.locale };
          if (customerId) {
            const [own] = await tx.select({ email: customers.email, name: customers.name }).from(customers).where(eq(customers.id, customerId));
            if (own) notify = { ...notify, email: own.email, name: own.name };
          } else {
            const [customer] = await tx
              .insert(customers)
              .values({ name: input.contact.name, email: input.contact.email, phone: input.contact.phone ?? null, preferredLocale: input.locale })
              .returning({ id: customers.id });
            customerId = customer.id;
          }
          const [request] = await tx
            .insert(quoteRequests)
            .values({
              reference,
              customerId,
              serviceCode: input.service,
              originCountry: input.originCountry,
              destinationCountry: input.destinationCountry,
              destinationCity: input.destinationCity ?? null,
              items: input.items,
              notes: input.notes ?? null,
              locale: input.locale,
              idempotencyKey: input.idempotencyKey,
              submittedBy: ctx.user?.id ?? null,
            })
            .returning({ id: quoteRequests.id, reference: quoteRequests.reference });
          return { ...request, notify };
        });
        return { ok: true, duplicate: false, reference: created.reference, requestId: created.id, notify: created.notify };
      } catch (error) {
        if (isUniqueViolation(error, "quote_requests_reference_key")) continue; // collision: new reference
        if (isUniqueViolation(error, "quote_requests_idempotency_key_key")) {
          const [dup] = await db.select({ id: quoteRequests.id, reference: quoteRequests.reference }).from(quoteRequests).where(eq(quoteRequests.idempotencyKey, input.idempotencyKey));
          if (dup) return { ok: true, duplicate: true, reference: dup.reference, requestId: dup.id, notify: { email: input.contact.email, name: input.contact.name, locale: input.locale } };
        }
        throw error;
      }
    }
    return { ok: false, code: "server_error" };
  } catch (error) {
    console.error("quote submission failed", { code: domainErrorCode(error) });
    return { ok: false, code: "server_error" };
  }
}

// ---------------------------------------------------------------------------
// Customer views (RLS-enforced plus explicit ownership filter)
// ---------------------------------------------------------------------------

const customerRequestColumns = {
  id: quoteRequests.id,
  reference: quoteRequests.reference,
  serviceCode: quoteRequests.serviceCode,
  originCountry: quoteRequests.originCountry,
  destinationCountry: quoteRequests.destinationCountry,
  destinationCity: quoteRequests.destinationCity,
  status: quoteRequests.status,
  createdAt: quoteRequests.createdAt,
  updatedAt: quoteRequests.updatedAt,
};

export async function listCustomerQuoteRequests(db: Database, user: AppUser) {
  if (!user.customerId) return [];
  return withUser(db, user.id, (tx) =>
    tx.select(customerRequestColumns).from(quoteRequests).where(eq(quoteRequests.customerId, user.customerId!)).orderBy(desc(quoteRequests.createdAt)),
  );
}

const sentQuoteColumns = {
  id: quotes.id,
  amountMinor: quotes.amountMinor,
  currency: quotes.currency,
  inclusions: quotes.inclusions,
  exclusions: quotes.exclusions,
  validUntil: quotes.validUntil,
  sentAt: quotes.sentAt,
};

export async function getCustomerQuoteRequest(db: Database, user: AppUser, rawReference: string) {
  const reference = normaliseReference(rawReference);
  if (!user.customerId || !QUOTE_REFERENCE_PATTERN.test(reference)) return null;
  return withUser(db, user.id, async (tx) => {
    const [request] = await tx
      .select({ ...customerRequestColumns, items: quoteRequests.items, notes: quoteRequests.notes, cancellationReason: quoteRequests.cancellationReason })
      .from(quoteRequests)
      .where(and(eq(quoteRequests.reference, reference), eq(quoteRequests.customerId, user.customerId!)));
    if (!request) return null;
    const sent = await tx.select(sentQuoteColumns).from(quotes).where(and(eq(quotes.quoteRequestId, request.id), isNotNull(quotes.sentAt))).orderBy(desc(quotes.sentAt));
    const [shipment] = await tx
      .select({ reference: shipments.reference })
      .from(shipments)
      .where(inArray(shipments.quoteId, sent.length ? sent.map((q) => q.id) : ["00000000-0000-0000-0000-000000000000"]));
    return { ...request, quotes: sent, shipmentReference: shipment?.reference ?? null };
  });
}

export type RespondResult = { ok: true; status: QuoteStatus } | { ok: false; code: DomainErrorCode };

export async function respondToQuote(db: Database, user: AppUser, rawReference: string, accept: boolean): Promise<RespondResult> {
  const request = await getCustomerQuoteRequest(db, user, rawReference);
  if (!request) return { ok: false, code: "not_found" };
  try {
    const status = await withUser(db, user.id, async (tx) => {
      const rows = await tx.execute<{ status: QuoteStatus }>(sql`select public.customer_respond_to_quote(${request.id}::uuid, ${accept}) as status`);
      const list = (Array.isArray(rows) ? rows : (rows as { rows: { status: QuoteStatus }[] }).rows) as { status: QuoteStatus }[];
      return list[0].status;
    });
    return { ok: true, status };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

// ---------------------------------------------------------------------------
// Staff operations (role checked here AND by RLS/triggers)
// ---------------------------------------------------------------------------

export async function listQuoteRequestsForStaff(db: Database, user: AppUser, filter: { status?: QuoteStatus } = {}) {
  assertStaff(user);
  return withUser(db, user.id, (tx) =>
    tx
      .select({ ...customerRequestColumns, customerName: customers.name, customerEmail: customers.email })
      .from(quoteRequests)
      .innerJoin(customers, eq(customers.id, quoteRequests.customerId))
      .where(filter.status ? eq(quoteRequests.status, filter.status) : undefined)
      .orderBy(desc(quoteRequests.createdAt))
      .limit(200),
  );
}

export async function countQuoteRequestsByStatus(db: Database, user: AppUser) {
  assertStaff(user);
  return withUser(db, user.id, (tx) =>
    tx.select({ status: quoteRequests.status, count: sql<number>`count(*)::int` }).from(quoteRequests).groupBy(quoteRequests.status),
  );
}

export async function getQuoteRequestForStaff(db: Database, user: AppUser, rawReference: string) {
  assertStaff(user);
  const reference = normaliseReference(rawReference);
  if (!QUOTE_REFERENCE_PATTERN.test(reference)) return null;
  return withUser(db, user.id, async (tx) => {
    const [request] = await tx
      .select({
        ...customerRequestColumns,
        items: quoteRequests.items,
        notes: quoteRequests.notes,
        locale: quoteRequests.locale,
        cancellationReason: quoteRequests.cancellationReason,
        customerId: customers.id,
        customerName: customers.name,
        customerEmail: customers.email,
        customerPhone: customers.phone,
        customerLocale: customers.preferredLocale,
        customerHasAccount: sql<boolean>`${customers.userId} is not null`,
      })
      .from(quoteRequests)
      .innerJoin(customers, eq(customers.id, quoteRequests.customerId))
      .where(eq(quoteRequests.reference, reference));
    if (!request) return null;
    const requestQuotes = await tx.select(sentQuoteColumns).from(quotes).where(eq(quotes.quoteRequestId, request.id)).orderBy(desc(quotes.createdAt));
    const [shipment] = requestQuotes.length
      ? await tx.select({ reference: shipments.reference }).from(shipments).where(inArray(shipments.quoteId, requestQuotes.map((q) => q.id)))
      : [];
    const history = await tx
      .select({ action: auditLog.action, actor: auditLog.actor, before: auditLog.before, after: auditLog.after, at: auditLog.at })
      .from(auditLog)
      .where(and(eq(auditLog.entity, "quote_requests"), eq(auditLog.entityId, request.id)))
      .orderBy(asc(auditLog.at));
    return { ...request, quotes: requestQuotes, shipmentReference: shipment?.reference ?? null, history };
  });
}

export type StaffActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; code: DomainErrorCode | "invalid"; fieldErrors?: Record<string, string> };

export async function transitionQuoteRequest(db: Database, user: AppUser, raw: unknown): Promise<StaffActionResult<{ status: QuoteStatus }>> {
  assertStaff(user);
  const parsed = transitionInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid", fieldErrors: fieldErrors(parsed.error) };
  const { requestId, to, reason } = parsed.data;
  try {
    return await withUser(db, user.id, async (tx) => {
      const [current] = await tx.select({ status: quoteRequests.status }).from(quoteRequests).where(eq(quoteRequests.id, requestId));
      if (!current) return { ok: false, code: "not_found" } as const;
      if (!actorMayTransition(user.role, current.status, to)) return { ok: false, code: "invalid_quote_transition" } as const;
      const [updated] = await tx
        .update(quoteRequests)
        .set({ status: to, cancellationReason: to === "CANCELLED" ? reason! : null })
        .where(eq(quoteRequests.id, requestId))
        .returning({ status: quoteRequests.status });
      return updated ? ({ ok: true, data: { status: updated.status } } as const) : ({ ok: false, code: "not_found" } as const);
    });
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

/** Creates a quote entered manually by staff and sends it (request -> QUOTED) atomically. */
export async function sendQuote(
  db: Database,
  user: AppUser,
  raw: unknown,
): Promise<StaffActionResult<{ quoteId: string; reference: string; notify: { email: string; name: string; locale: "en" | "fr" } }>> {
  assertStaff(user);
  const parsed = sendQuoteInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const amountMinor = toMinorUnits(input.amount, input.currency);
  if (!amountMinor) return { ok: false, code: "invalid", fieldErrors: { amount: "invalid" } };
  const validUntil = new Date(`${input.validUntil}T23:59:59Z`);
  if (validUntil.getTime() <= Date.now()) return { ok: false, code: "invalid", fieldErrors: { validUntil: "in_past" } };

  try {
    return await withUser(db, user.id, async (tx) => {
      const [request] = await tx
        .select({ id: quoteRequests.id, reference: quoteRequests.reference, status: quoteRequests.status, email: customers.email, name: customers.name, locale: customers.preferredLocale })
        .from(quoteRequests)
        .innerJoin(customers, eq(customers.id, quoteRequests.customerId))
        .where(eq(quoteRequests.id, input.requestId));
      if (!request) return { ok: false, code: "not_found" } as const;
      const [quote] = await tx
        .insert(quotes)
        .values({
          quoteRequestId: request.id,
          amountMinor,
          currency: input.currency,
          inclusions: input.inclusions,
          exclusions: input.exclusions,
          validUntil,
          createdBy: user.id,
          sentAt: sql`now()`,
        })
        .returning({ id: quotes.id });
      await tx.update(quoteRequests).set({ status: "QUOTED" }).where(eq(quoteRequests.id, request.id));
      return { ok: true, data: { quoteId: quote.id, reference: request.reference, notify: { email: request.email, name: request.name, locale: request.locale } } } as const;
    });
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}
