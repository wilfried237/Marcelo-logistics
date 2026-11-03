import { withSystem, withUser } from "@/lib/db/context";
import { domainErrorCode, isUniqueViolation, type DomainErrorCode } from "@/lib/db/errors";
import type { Database } from "@/lib/db/types";
import { assertStaff, type AppUser } from "@/lib/auth/types";
import type { QuoteStatus } from "@/lib/domain/enums";
import { caseMessageBodySchema, contactInputSchema, fieldErrors } from "@/lib/domain/quote-schema";
import { formatQuantity } from "@/lib/domain/pricing";
import { MAX_REFERENCE_ATTEMPTS, QUOTE_REFERENCE_PATTERN, SHIPMENT_REFERENCE_PATTERN, generateContactReference, normaliseReference } from "@/lib/domain/references";
import { CONTACT_LIMITS, LINK_LIMITS, hashKey, rateLimitHit } from "./rate-limit";
import { verifyQuoteToken } from "./quote-links";
import type { StaffActionResult } from "./quote-requests";

/*
 * Case handling: internal notes, information requests, customer replies, shipment
 * issue reports, request assignment, signed quote links and contact enquiries.
 * Staff operations run under RLS as the staff user; link operations run on the
 * privileged connection only after the link signature has been verified.
 * Every customer-facing or staff-facing email is queued by database triggers.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result<T = undefined> = { ok: true; data?: T } | { ok: false; code: DomainErrorCode | "invalid" | "rate_limited"; fieldErrors?: Record<string, string> };

// ------------------------------------------------------------------- staff

/** Internal note: never visible to customers (RLS + constraint). */
export async function addInternalNote(db: Database, user: AppUser, input: { requestId: unknown; body: unknown; shipmentId?: unknown }): Promise<StaffActionResult> {
  assertStaff(user);
  const body = caseMessageBodySchema.safeParse(input.body);
  if (!body.success) return { ok: false, code: "invalid", fieldErrors: { body: body.error.issues[0]?.message ?? "invalid" } };
  if (typeof input.requestId !== "string" || !UUID.test(input.requestId)) return { ok: false, code: "not_found" };
  const shipmentId = typeof input.shipmentId === "string" && UUID.test(input.shipmentId) ? input.shipmentId : null;
  try {
    await withUser(db, user.id, (tx) =>
      tx.caseMessage.create({
        data: { quoteRequestId: input.requestId as string, shipmentId, authorKind: "staff", authorId: user.id, internal: true, kind: "note", body: body.data },
        select: { id: true },
      }),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

/**
 * Asks the customer for information: records the question (visible to the
 * customer) and moves the request to AWAITING_CUSTOMER in one transaction; the
 * database queues the email, which quotes the question.
 */
export async function requestInformation(db: Database, user: AppUser, input: { requestId: unknown; body: unknown }): Promise<StaffActionResult> {
  assertStaff(user);
  const body = caseMessageBodySchema.safeParse(input.body);
  if (!body.success) return { ok: false, code: "invalid", fieldErrors: { body: body.error.issues[0]?.message ?? "invalid" } };
  if (typeof input.requestId !== "string" || !UUID.test(input.requestId)) return { ok: false, code: "not_found" };
  const requestId = input.requestId;
  try {
    return await withUser(db, user.id, async (tx) => {
      const current = await tx.quoteRequest.findUnique({ where: { id: requestId }, select: { status: true } });
      if (!current) return { ok: false, code: "not_found" } as const;
      if (current.status !== "UNDER_REVIEW") return { ok: false, code: "invalid_quote_transition" } as const;
      await tx.caseMessage.create({
        data: { quoteRequestId: requestId, authorKind: "staff", authorId: user.id, internal: false, kind: "info_request", body: body.data },
        select: { id: true },
      });
      const moved = await tx.quoteRequest.updateMany({ where: { id: requestId, status: "UNDER_REVIEW" }, data: { status: "AWAITING_CUSTOMER" } });
      if (moved.count !== 1) throw new Error("invalid_quote_transition");
      return { ok: true } as const;
    });
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

/** Assigns a request to a staff member (or clears it). The database checks the assignee's role. */
export async function assignRequest(db: Database, user: AppUser, input: { requestId: unknown; assigneeId: unknown }): Promise<StaffActionResult> {
  assertStaff(user);
  if (typeof input.requestId !== "string" || !UUID.test(input.requestId)) return { ok: false, code: "not_found" };
  const assignee = input.assigneeId === "" || input.assigneeId === null || input.assigneeId === undefined ? null : input.assigneeId;
  if (assignee !== null && (typeof assignee !== "string" || !UUID.test(assignee))) return { ok: false, code: "invalid" };
  try {
    const updated = await withUser(db, user.id, (tx) => tx.quoteRequest.updateMany({ where: { id: input.requestId as string }, data: { assignedTo: assignee } }));
    return updated.count ? { ok: true } : { ok: false, code: "not_found" };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

/** Staff members who can be assigned (privileged read after the staff check). */
export async function listAssignableStaff(db: Database, user: AppUser) {
  assertStaff(user);
  const rows = await db.profile.findMany({ where: { role: { in: ["staff", "admin"] } }, select: { id: true, role: true, user: { select: { email: true } } }, take: 100 });
  return rows.map((r) => ({ id: r.id, role: r.role, email: r.user.email ?? r.id }));
}

/** Email history for a request and its quotes/shipment (staff view). */
export async function listEmailsForRequest(db: Database, user: AppUser, requestId: string) {
  assertStaff(user);
  if (!UUID.test(requestId)) return [];
  const quotes = await db.quote.findMany({ where: { quoteRequestId: requestId }, select: { id: true, shipment: { select: { id: true } } } });
  const shipmentIds = quotes.flatMap((q) => (q.shipment ? [q.shipment.id] : []));
  const events = shipmentIds.length ? await db.shipmentEvent.findMany({ where: { shipmentId: { in: shipmentIds } }, select: { id: true } }) : [];
  const messages = await db.caseMessage.findMany({ where: { quoteRequestId: requestId }, select: { id: true } });
  const ids = [requestId, ...quotes.map((q) => q.id), ...shipmentIds, ...events.map((e) => e.id), ...messages.map((m) => m.id)];
  return db.emailDelivery.findMany({
    where: { entityId: { in: ids } },
    select: { id: true, template: true, audience: true, status: true, attempts: true, createdAt: true, sentAt: true, lastEvent: true, error: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// --------------------------------------------------------- signed-in customer

/** Customer reply on their own request (RLS: own requests only; never internal). */
export async function addCustomerReply(db: Database, user: AppUser, rawReference: string, rawBody: unknown): Promise<Result> {
  const reference = normaliseReference(rawReference);
  const body = caseMessageBodySchema.safeParse(rawBody);
  if (!body.success) return { ok: false, code: "invalid", fieldErrors: { body: body.error.issues[0]?.message ?? "invalid" } };
  if (!user.customerId || !QUOTE_REFERENCE_PATTERN.test(reference)) return { ok: false, code: "not_found" };
  try {
    return await withUser(db, user.id, async (tx) => {
      const request = await tx.quoteRequest.findFirst({ where: { reference, customerId: user.customerId! }, select: { id: true, status: true } });
      if (!request) return { ok: false, code: "not_found" } as const;
      if (request.status === "CANCELLED") return { ok: false, code: "invalid_quote_transition" } as const;
      await tx.caseMessage.create({ data: { quoteRequestId: request.id, authorKind: "customer", authorId: user.id, internal: false, kind: "customer_reply", body: body.data }, select: { id: true } });
      return { ok: true } as const;
    });
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

/** Customer reports a problem with one of their shipments; staff are alerted. */
export async function reportShipmentIssue(db: Database, user: AppUser, rawReference: string, rawBody: unknown): Promise<Result> {
  const reference = normaliseReference(rawReference);
  const body = caseMessageBodySchema.safeParse(rawBody);
  if (!body.success) return { ok: false, code: "invalid", fieldErrors: { body: body.error.issues[0]?.message ?? "invalid" } };
  if (!user.customerId || !SHIPMENT_REFERENCE_PATTERN.test(reference)) return { ok: false, code: "not_found" };
  try {
    return await withUser(db, user.id, async (tx) => {
      const shipment = await tx.shipment.findFirst({ where: { reference, customerId: user.customerId! }, select: { id: true, quote: { select: { quoteRequestId: true } } } });
      if (!shipment) return { ok: false, code: "not_found" } as const;
      await tx.caseMessage.create({
        data: { quoteRequestId: shipment.quote.quoteRequestId, shipmentId: shipment.id, authorKind: "customer", authorId: user.id, internal: false, kind: "issue_report", body: body.data },
        select: { id: true },
      });
      return { ok: true } as const;
    });
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

// -------------------------------------------------------------- signed links

export interface LinkQuoteView {
  reference: string;
  status: QuoteStatus;
  serviceCode: string;
  originCountry: string;
  destinationCountry: string;
  destinationCity: string | null;
  createdAt: Date;
  customerName: string;
  quote: {
    currency: string;
    amountMinor: number;
    validUntil: Date;
    /** Still within its validity date at the time of the request. */
    isValid: boolean;
    sentAt: Date;
    inclusions: string;
    exclusions: string;
    lines: { position: number; kind: string; description: string; quantity: string; unitAmountMinor: number; rateBp: number | null; lineTotalMinor: number }[];
  } | null;
  messages: { kind: string; authorKind: string; body: string; createdAt: Date }[];
  shipmentReference: string | null;
}

/**
 * Customer-visible view behind a signed link. Only what the customer is entitled
 * to see: no internal notes, no staff identities, no unsent quotes.
 */
export async function getQuoteForLink(db: Database, token: string): Promise<LinkQuoteView | null> {
  const reference = verifyQuoteToken(token);
  if (!reference) return null;
  const request = await db.quoteRequest.findUnique({
    where: { reference },
    select: {
      id: true,
      reference: true,
      status: true,
      serviceCode: true,
      originCountry: true,
      destinationCountry: true,
      destinationCity: true,
      createdAt: true,
      customer: { select: { name: true } },
      quotes: {
        where: { sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
        take: 1,
        select: {
          currency: true,
          amountMinor: true,
          validUntil: true,
          sentAt: true,
          inclusions: true,
          exclusions: true,
          shipment: { select: { reference: true } },
          lines: { orderBy: { position: "asc" }, select: { position: true, kind: true, description: true, quantity: true, unitAmountMinor: true, rateBp: true, lineTotalMinor: true } },
        },
      },
      messages: { where: { internal: false }, orderBy: { createdAt: "asc" }, select: { kind: true, authorKind: true, body: true, createdAt: true } },
    },
  });
  if (!request) return null;
  const q = request.quotes[0];
  return {
    reference: request.reference,
    status: request.status,
    serviceCode: request.serviceCode,
    originCountry: request.originCountry,
    destinationCountry: request.destinationCountry,
    destinationCity: request.destinationCity,
    createdAt: request.createdAt,
    customerName: request.customer.name,
    quote: q
      ? {
          currency: q.currency,
          amountMinor: Number(q.amountMinor),
          validUntil: q.validUntil,
          isValid: q.validUntil.getTime() > Date.now(),
          sentAt: q.sentAt!,
          inclusions: q.inclusions,
          exclusions: q.exclusions,
          lines: q.lines.map((l) => ({ ...l, quantity: formatQuantity(BigInt(l.quantity.mul(1000).toFixed(0))), unitAmountMinor: Number(l.unitAmountMinor), lineTotalMinor: Number(l.lineTotalMinor) })),
        }
      : null,
    messages: request.messages,
    shipmentReference: q?.shipment?.reference ?? null,
  };
}

/** Accept or decline through a signed link (rate-limited per client). */
export async function respondViaLink(db: Database, token: string, accept: boolean, clientId: string): Promise<Result<{ status: QuoteStatus }>> {
  const reference = verifyQuoteToken(token);
  if (!reference) return { ok: false, code: "not_found" };
  if (!(await rateLimitHit(db, hashKey("link:client", clientId), 600, LINK_LIMITS.perClientPerTenMinutes))) return { ok: false, code: "rate_limited" };
  try {
    const status = await withSystem(db, null, async (tx) => {
      const request = await tx.quoteRequest.findUnique({ where: { reference }, select: { id: true } });
      if (!request) throw new Error("not_found");
      const rows = await tx.$queryRaw<{ status: QuoteStatus }[]>`select public.app_link_respond_to_quote(${request.id}::uuid, ${accept}) as status`;
      return rows[0].status;
    });
    return { ok: true, data: { status } };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

/** Customer reply through a signed link (e.g. answering an information request). */
export async function replyViaLink(db: Database, token: string, rawBody: unknown, clientId: string): Promise<Result> {
  const reference = verifyQuoteToken(token);
  if (!reference) return { ok: false, code: "not_found" };
  const body = caseMessageBodySchema.safeParse(rawBody);
  if (!body.success) return { ok: false, code: "invalid", fieldErrors: { body: body.error.issues[0]?.message ?? "invalid" } };
  if (!(await rateLimitHit(db, hashKey("link:client", clientId), 600, LINK_LIMITS.perClientPerTenMinutes))) return { ok: false, code: "rate_limited" };
  try {
    return await withSystem(db, null, async (tx) => {
      const request = await tx.quoteRequest.findUnique({ where: { reference }, select: { id: true, status: true } });
      if (!request) return { ok: false, code: "not_found" } as const;
      if (request.status === "CANCELLED") return { ok: false, code: "invalid_quote_transition" } as const;
      await tx.caseMessage.create({ data: { quoteRequestId: request.id, authorKind: "customer", internal: false, kind: "customer_reply", body: body.data }, select: { id: true } });
      return { ok: true } as const;
    });
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

// --------------------------------------------------------- contact enquiries

export type ContactResult = { ok: true; reference: string } | { ok: false; code: "invalid" | "rejected" | "rate_limited" | "server_error"; fieldErrors?: Record<string, string> };

/** Persists a contact enquiry before anything is confirmed; emails are queued by the database. */
export async function submitContactEnquiry(db: Database, raw: unknown, clientId: string): Promise<ContactResult> {
  if (raw && typeof raw === "object" && typeof (raw as { website?: unknown }).website === "string" && (raw as { website: string }).website.trim() !== "") {
    return { ok: false, code: "rejected" };
  }
  const parsed = contactInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid", fieldErrors: fieldErrors(parsed.error) };
  const input = parsed.data;
  try {
    const existing = await db.contactEnquiry.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { reference: true } });
    if (existing) return { ok: true, reference: existing.reference };
    const okClient = await rateLimitHit(db, hashKey("contact:client", clientId), 3600, CONTACT_LIMITS.perClientPerHour);
    const okEmail = await rateLimitHit(db, hashKey("contact:email", input.email), 86400, CONTACT_LIMITS.perEmailPerDay);
    if (!okClient || !okEmail) return { ok: false, code: "rate_limited" };
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt++) {
      const reference = generateContactReference();
      try {
        await withSystem(db, null, (tx) =>
          tx.contactEnquiry.create({
            data: {
              reference,
              name: input.name,
              email: input.email,
              phone: input.phone ?? null,
              topic: input.topic,
              relatedReference: input.relatedReference ?? null,
              message: input.message,
              locale: input.locale,
              privacyAcceptedAt: new Date(),
              idempotencyKey: input.idempotencyKey,
            },
            select: { id: true },
          }),
        );
        return { ok: true, reference };
      } catch (error) {
        if (isUniqueViolation(error, "reference")) continue;
        if (isUniqueViolation(error, "idempotency")) {
          const dup = await db.contactEnquiry.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { reference: true } });
          if (dup) return { ok: true, reference: dup.reference };
        }
        throw error;
      }
    }
    return { ok: false, code: "server_error" };
  } catch (error) {
    console.error("contact submission failed", { code: domainErrorCode(error) });
    return { ok: false, code: "server_error" };
  }
}

export async function listContactEnquiries(db: Database, user: AppUser) {
  assertStaff(user);
  return withUser(db, user.id, (tx) =>
    tx.contactEnquiry.findMany({
      select: { id: true, reference: true, name: true, email: true, phone: true, topic: true, message: true, relatedReference: true, locale: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
}

export async function setContactStatus(db: Database, user: AppUser, id: unknown, status: unknown): Promise<StaffActionResult> {
  assertStaff(user);
  if (typeof id !== "string" || !UUID.test(id) || !["NEW", "IN_PROGRESS", "CLOSED"].includes(String(status))) return { ok: false, code: "invalid" };
  try {
    const updated = await withUser(db, user.id, (tx) => tx.contactEnquiry.updateMany({ where: { id }, data: { status: String(status) } }));
    return updated.count ? { ok: true } : { ok: false, code: "not_found" };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

/** Messages attached to a shipment (issue reports, internal notes) for staff. */
export async function listShipmentMessages(db: Database, user: AppUser, shipmentId: string) {
  assertStaff(user);
  if (!UUID.test(shipmentId)) return [];
  return withUser(db, user.id, (tx) =>
    tx.caseMessage.findMany({ where: { shipmentId }, select: { id: true, kind: true, authorKind: true, internal: true, body: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
  );
}

/** Email outbox and job history for the staff notification page (never shows the internal inbox address). */
export async function getNotificationOverview(db: Database, user: AppUser) {
  assertStaff(user);
  const [emails, problems, jobs] = await Promise.all([
    withUser(db, user.id, (tx) =>
      tx.emailDelivery.findMany({
        select: { id: true, template: true, audience: true, status: true, attempts: true, entity: true, createdAt: true, sentAt: true, nextAttemptAt: true, lastEvent: true, error: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ),
    withUser(db, user.id, (tx) => tx.emailDelivery.count({ where: { status: { in: ["FAILED", "DEAD", "BOUNCED", "COMPLAINED"] } } })),
    withUser(db, user.id, (tx) => tx.jobRun.findMany({ select: { id: true, job: true, startedAt: true, finishedAt: true, ok: true, error: true }, orderBy: { startedAt: "desc" }, take: 30 })),
  ]);
  return { emails, problems, jobs: jobs.map((j) => ({ ...j, id: String(j.id) })) };
}
