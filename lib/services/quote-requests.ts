import { ownerConfig } from "@/config/owner";
import { quoteSubmissionStatus } from "@/lib/config/env";
import { withSystem, withUser } from "@/lib/db/context";
import { domainErrorCode, isUniqueViolation, type DomainErrorCode } from "@/lib/db/errors";
import type { Database } from "@/lib/db/types";
import type { Prisma } from "@/lib/generated/prisma/client";
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
  const fallbackNotify = { email: input.contact.email, name: input.contact.name, locale: input.locale };

  try {
    // Idempotent retry: the same client key returns the original request.
    const existing = await db.quoteRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, reference: true } });
    if (existing) return { ok: true, duplicate: true, reference: existing.reference, requestId: existing.id, notify: fallbackNotify };

    const allowedClient = await rateLimitHit(db, hashKey("quote:client", ctx.clientId), 3600, QUOTE_LIMITS.perClientPerHour);
    const allowedEmail = await rateLimitHit(db, hashKey("quote:email", input.contact.email), 86400, QUOTE_LIMITS.perEmailPerDay);
    if (!allowedClient || !allowedEmail) return { ok: false, code: "rate_limited" };

    const actor = ctx.user?.id ?? null;
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
      const reference = generateQuoteReference();
      try {
        const created = await withSystem(db, actor, async (tx) => {
          let customerId = ctx.user?.customerId ?? null;
          let notify = fallbackNotify;
          if (customerId) {
            const own = await tx.customer.findUnique({ where: { id: customerId }, select: { email: true, name: true } });
            if (own) notify = { ...notify, email: own.email, name: own.name };
          } else {
            const customer = await tx.customer.create({
              data: { name: input.contact.name, email: input.contact.email, phone: input.contact.phone ?? null, preferredLocale: input.locale },
              select: { id: true },
            });
            customerId = customer.id;
          }
          const request = await tx.quoteRequest.create({
            data: {
              reference,
              customerId,
              serviceCode: input.service,
              originCountry: input.originCountry,
              destinationCountry: input.destinationCountry,
              destinationCity: input.destinationCity ?? null,
              items: input.items as Prisma.InputJsonValue,
              notes: input.notes ?? null,
              locale: input.locale,
              idempotencyKey: input.idempotencyKey,
              submittedBy: ctx.user?.id ?? null,
            },
            select: { id: true, reference: true },
          });
          return { ...request, notify };
        });
        return { ok: true, duplicate: false, reference: created.reference, requestId: created.id, notify: created.notify };
      } catch (error) {
        if (isUniqueViolation(error, "reference")) continue; // collision: new reference
        if (isUniqueViolation(error, "idempotency")) {
          const dup = await db.quoteRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, reference: true } });
          if (dup) return { ok: true, duplicate: true, reference: dup.reference, requestId: dup.id, notify: fallbackNotify };
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

const requestSummary = {
  id: true,
  reference: true,
  serviceCode: true,
  originCountry: true,
  destinationCountry: true,
  destinationCity: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuoteRequestSelect;

const sentQuoteSelect = {
  id: true,
  amountMinor: true,
  currency: true,
  inclusions: true,
  exclusions: true,
  validUntil: true,
  sentAt: true,
} satisfies Prisma.QuoteSelect;

type RawQuote = Prisma.QuoteGetPayload<{ select: typeof sentQuoteSelect }>;
/** BigInt minor units -> number (amounts are bounded below 1e12 by a CHECK constraint). */
const toQuoteView = (q: RawQuote) => ({ ...q, amountMinor: Number(q.amountMinor) });

export async function listCustomerQuoteRequests(db: Database, user: AppUser) {
  if (!user.customerId) return [];
  return withUser(db, user.id, (tx) =>
    tx.quoteRequest.findMany({ where: { customerId: user.customerId! }, select: requestSummary, orderBy: { createdAt: "desc" }, take: 200 }),
  );
}

export async function getCustomerQuoteRequest(db: Database, user: AppUser, rawReference: string) {
  const reference = normaliseReference(rawReference);
  if (!user.customerId || !QUOTE_REFERENCE_PATTERN.test(reference)) return null;
  return withUser(db, user.id, async (tx) => {
    const request = await tx.quoteRequest.findFirst({
      where: { reference, customerId: user.customerId! },
      select: { ...requestSummary, items: true, notes: true, cancellationReason: true },
    });
    if (!request) return null;
    const sent = await tx.quote.findMany({ where: { quoteRequestId: request.id, sentAt: { not: null } }, select: sentQuoteSelect, orderBy: { sentAt: "desc" } });
    const shipment = sent.length ? await tx.shipment.findFirst({ where: { quoteId: { in: sent.map((q) => q.id) } }, select: { reference: true } }) : null;
    return { ...request, quotes: sent.map(toQuoteView), shipmentReference: shipment?.reference ?? null };
  });
}

export type RespondResult = { ok: true; status: QuoteStatus } | { ok: false; code: DomainErrorCode };

export async function respondToQuote(db: Database, user: AppUser, rawReference: string, accept: boolean): Promise<RespondResult> {
  const request = await getCustomerQuoteRequest(db, user, rawReference);
  if (!request) return { ok: false, code: "not_found" };
  try {
    const status = await withUser(db, user.id, async (tx) => {
      const rows = await tx.$queryRaw<{ status: QuoteStatus }[]>`select public.customer_respond_to_quote(${request.id}::uuid, ${accept}) as status`;
      return rows[0].status;
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
  const rows = await withUser(db, user.id, (tx) =>
    tx.quoteRequest.findMany({
      where: filter.status ? { status: filter.status } : undefined,
      select: { ...requestSummary, customer: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
  return rows.map(({ customer, ...r }) => ({ ...r, customerName: customer.name, customerEmail: customer.email }));
}

export async function countQuoteRequestsByStatus(db: Database, user: AppUser) {
  assertStaff(user);
  const groups = await withUser(db, user.id, (tx) => tx.quoteRequest.groupBy({ by: ["status"], _count: { _all: true } }));
  return groups.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function getQuoteRequestForStaff(db: Database, user: AppUser, rawReference: string) {
  assertStaff(user);
  const reference = normaliseReference(rawReference);
  if (!QUOTE_REFERENCE_PATTERN.test(reference)) return null;
  return withUser(db, user.id, async (tx) => {
    const request = await tx.quoteRequest.findUnique({
      where: { reference },
      select: {
        ...requestSummary,
        items: true,
        notes: true,
        locale: true,
        cancellationReason: true,
        customer: { select: { id: true, name: true, email: true, phone: true, preferredLocale: true, userId: true } },
      },
    });
    if (!request) return null;
    const requestQuotes = await tx.quote.findMany({ where: { quoteRequestId: request.id }, select: sentQuoteSelect, orderBy: { createdAt: "desc" } });
    const shipment = requestQuotes.length
      ? await tx.shipment.findFirst({ where: { quoteId: { in: requestQuotes.map((q) => q.id) } }, select: { reference: true } })
      : null;
    const history = await tx.auditLog.findMany({
      where: { entity: "quote_requests", entityId: request.id },
      select: { action: true, actor: true, before: true, after: true, at: true },
      orderBy: { at: "asc" },
    });
    const { customer, ...rest } = request;
    return {
      ...rest,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerLocale: customer.preferredLocale,
      customerHasAccount: customer.userId !== null,
      quotes: requestQuotes.map(toQuoteView),
      shipmentReference: shipment?.reference ?? null,
      history,
    };
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
      const current = await tx.quoteRequest.findUnique({ where: { id: requestId }, select: { status: true } });
      if (!current) return { ok: false, code: "not_found" } as const;
      if (!actorMayTransition(user.role, current.status, to)) return { ok: false, code: "invalid_quote_transition" } as const;
      // The status we checked is part of the WHERE clause: a concurrent change makes this a no-op
      // instead of overwriting it. The database trigger re-validates the transition as well.
      const updated = await tx.quoteRequest.updateMany({
        where: { id: requestId, status: current.status },
        data: { status: to, cancellationReason: to === "CANCELLED" ? reason! : null },
      });
      return updated.count === 1 ? ({ ok: true, data: { status: to } } as const) : ({ ok: false, code: "invalid_quote_transition" } as const);
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
      const request = await tx.quoteRequest.findUnique({
        where: { id: input.requestId },
        select: { id: true, reference: true, status: true, customer: { select: { email: true, name: true, preferredLocale: true } } },
      });
      if (!request) return { ok: false, code: "not_found" } as const;
      const quote = await tx.quote.create({
        data: {
          quoteRequestId: request.id,
          amountMinor: BigInt(amountMinor),
          currency: input.currency,
          inclusions: input.inclusions,
          exclusions: input.exclusions,
          validUntil,
          createdBy: user.id,
          sentAt: new Date(),
        },
        select: { id: true },
      });
      const moved = await tx.quoteRequest.updateMany({ where: { id: request.id, status: request.status }, data: { status: "QUOTED" } });
      if (moved.count !== 1) throw new Error("invalid_quote_transition");
      return {
        ok: true,
        data: { quoteId: quote.id, reference: request.reference, notify: { email: request.customer.email, name: request.customer.name, locale: request.customer.preferredLocale } },
      } as const;
    });
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}
