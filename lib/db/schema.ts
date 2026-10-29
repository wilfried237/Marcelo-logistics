import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import {
  DOCUMENT_OWNER_TYPES,
  EMAIL_STATUSES,
  LOCALES,
  MILESTONE_CODES,
  QUOTE_STATUSES,
  SHIPMENT_STATUSES,
  USER_ROLES,
} from "@/lib/domain/enums";
import { SERVICE_CODES } from "@/lib/domain/services";

/*
 * Application schema (public). Row Level Security, policies, grants, functions
 * and triggers are defined in the hand-written migration drizzle/0001_*.sql.
 *
 * Delete behaviour: business, financial, shipment and audit history uses
 * ON DELETE RESTRICT so nothing is erased by a cascade. Only the 1:1 profile
 * row follows its auth user.
 */

export const userRole = pgEnum("user_role", USER_ROLES);
export const appLocale = pgEnum("app_locale", LOCALES);
export const serviceCode = pgEnum("service_code", SERVICE_CODES);
export const quoteStatus = pgEnum("quote_status", QUOTE_STATUSES);
export const shipmentStatus = pgEnum("shipment_status", SHIPMENT_STATUSES);
export const milestoneCode = pgEnum("milestone_code", MILESTONE_CODES);
export const documentOwnerType = pgEnum("document_owner_type", DOCUMENT_OWNER_TYPES);
export const emailStatus = pgEnum("email_status", EMAIL_STATUSES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** 1:1 with auth.users. Role is changed only through admin_set_user_role(). */
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  role: userRole("role").notNull().default("customer"),
  ...timestamps,
});

/**
 * A customer is a contact who requested a quote. user_id links the record to a
 * login once the customer has an account. Email is deliberately NOT unique: the
 * same person may submit several anonymous requests, and anonymous records are
 * never auto-linked to an account by email (that would let anyone claim another
 * person's history by registering with their address).
 */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => authUsers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    preferredLocale: appLocale("preferred_locale").notNull().default("en"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("customers_user_id_key").on(t.userId),
    index("customers_email_lower_idx").on(sql`lower(${t.email})`),
    check("customers_name_len", sql`char_length(btrim(${t.name})) between 1 and 120`),
    check("customers_email_format", sql`char_length(${t.email}) <= 254 and ${t.email} ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`),
    check("customers_phone_len", sql`${t.phone} is null or char_length(${t.phone}) between 5 and 32`),
  ],
);

export const quoteRequests = pgTable(
  "quote_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    serviceCode: serviceCode("service_code").notNull(),
    originCountry: char("origin_country", { length: 2 }).notNull(),
    destinationCountry: char("destination_country", { length: 2 }).notNull(),
    destinationCity: text("destination_city"),
    items: jsonb("items").notNull(),
    notes: text("notes"),
    status: quoteStatus("status").notNull().default("SUBMITTED"),
    locale: appLocale("locale").notNull(),
    cancellationReason: text("cancellation_reason"),
    /** Client-generated key so a retried submission never creates a duplicate. */
    idempotencyKey: uuid("idempotency_key"),
    submittedBy: uuid("submitted_by").references(() => authUsers.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("quote_requests_reference_key").on(t.reference),
    uniqueIndex("quote_requests_idempotency_key_key").on(t.idempotencyKey),
    index("quote_requests_customer_idx").on(t.customerId),
    index("quote_requests_status_created_idx").on(t.status, t.createdAt.desc()),
    check("quote_requests_reference_format", sql`${t.reference} ~ '^QR[A-Z2-7]{6}$'`),
    check("quote_requests_origin_format", sql`${t.originCountry} ~ '^[A-Z]{2}$'`),
    check("quote_requests_destination_format", sql`${t.destinationCountry} ~ '^[A-Z]{2}$'`),
    check("quote_requests_city_len", sql`${t.destinationCity} is null or char_length(${t.destinationCity}) <= 120`),
    check("quote_requests_notes_len", sql`${t.notes} is null or char_length(${t.notes}) <= 2000`),
    check(
      "quote_requests_items_shape",
      sql`jsonb_typeof(${t.items}) = 'array' and jsonb_array_length(${t.items}) between 1 and 50 and octet_length(${t.items}::text) <= 32768`,
    ),
    check(
      "quote_requests_cancellation_reason",
      sql`(${t.status} <> 'CANCELLED' or char_length(btrim(coalesce(${t.cancellationReason}, ''))) between 1 and 500)`,
    ),
  ],
);

/** Staff-entered quotes. Amounts are integer minor units (cents for EUR; XAF has none). */
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteRequestId: uuid("quote_request_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "restrict" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    inclusions: text("inclusions").notNull().default(""),
    exclusions: text("exclusions").notNull().default(""),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("quotes_request_idx").on(t.quoteRequestId),
    check("quotes_amount_positive", sql`${t.amountMinor} > 0 and ${t.amountMinor} < 1000000000000`),
    check("quotes_currency_allowed", sql`${t.currency} in ('EUR', 'XAF')`),
    check("quotes_text_len", sql`char_length(${t.inclusions}) <= 2000 and char_length(${t.exclusions}) <= 2000`),
    check("quotes_valid_after_creation", sql`${t.validUntil} > ${t.createdAt}`),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "restrict" }),
    /** Denormalised owner, set by trigger from the quote; never client-supplied. */
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    serviceCode: serviceCode("service_code").notNull(),
    status: shipmentStatus("status").notNull().default("BOOKED"),
    etaFrom: date("eta_from"),
    etaTo: date("eta_to"),
    /** An ETA is shown to customers only when staff explicitly approve it (T-02). */
    etaVisible: boolean("eta_visible").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("shipments_reference_key").on(t.reference),
    uniqueIndex("shipments_quote_key").on(t.quoteId),
    index("shipments_customer_idx").on(t.customerId),
    index("shipments_status_idx").on(t.status),
    check("shipments_reference_format", sql`${t.reference} ~ '^ML[A-Z2-7]{10}$'`),
    check("shipments_eta_order", sql`${t.etaFrom} is null or ${t.etaTo} is null or ${t.etaTo} >= ${t.etaFrom}`),
  ],
);

export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "restrict" }),
    milestoneCode: milestoneCode("milestone_code").notNull(),
    location: text("location"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    noteEn: text("note_en"),
    noteFr: text("note_fr"),
    /** Only public events reach customers; non-public events are staff-only working notes. */
    public: boolean("public").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("shipment_events_shipment_occurred_idx").on(t.shipmentId, t.occurredAt),
    check("shipment_events_location_len", sql`${t.location} is null or char_length(${t.location}) <= 120`),
    check(
      "shipment_events_notes_len",
      sql`coalesce(char_length(${t.noteEn}), 0) <= 1000 and coalesce(char_length(${t.noteFr}), 0) <= 1000`,
    ),
  ],
);

/** Metadata for private files in Supabase Storage (bucket "customer-documents"). */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: documentOwnerType("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    /** Set and checked by trigger from the owning record; never client-supplied. */
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    /** NULL = keep until a retention policy is approved (L-03). Nothing is auto-deleted. */
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("documents_storage_key_key").on(t.storageKey),
    index("documents_owner_idx").on(t.ownerType, t.ownerId),
    index("documents_customer_idx").on(t.customerId),
    check("documents_mime_allowed", sql`${t.mime} in ('application/pdf', 'image/jpeg', 'image/png')`),
    check("documents_size", sql`${t.sizeBytes} > 0 and ${t.sizeBytes} <= 10485760`),
    check("documents_name_len", sql`char_length(${t.originalName}) between 1 and 255`),
    check("documents_key_len", sql`char_length(${t.storageKey}) between 1 and 512`),
  ],
);

/** Append-only. Written only by SECURITY DEFINER triggers/functions. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actor: uuid("actor"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId), index("audit_log_at_idx").on(t.at.desc())],
);

/**
 * Fixed-window counters for server-side rate limiting. Needed because the app
 * runs as multiple serverless instances, where in-memory counters do not work.
 * Keys hold hashed identifiers, never raw IP addresses.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    hits: integer("hits").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_window_idx").on(t.windowStart)],
);

/**
 * Transactional email log. Needed so the app only tells a customer an email was
 * sent when the provider accepted it, and so retries are idempotent.
 */
export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    template: text("template").notNull(),
    recipient: text("recipient").notNull(),
    locale: appLocale("locale").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: emailStatus("status").notNull().default("PENDING"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("email_deliveries_idempotency_key").on(t.idempotencyKey),
    index("email_deliveries_entity_idx").on(t.entity, t.entityId),
    check("email_deliveries_error_len", sql`${t.error} is null or char_length(${t.error}) <= 1000`),
  ],
);

export type Customer = typeof customers.$inferSelect;
export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type Shipment = typeof shipments.$inferSelect;
export type ShipmentEvent = typeof shipmentEvents.$inferSelect;
export type DocumentRecord = typeof documents.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
