/**
 * Technical enum values. They are stored in the database and translated in the UI.
 * Never store or compare display labels.
 */
export const LOCALES = ["en", "fr"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const USER_ROLES = ["customer", "staff", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const QUOTE_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CUSTOMER",
  "QUOTED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const SHIPMENT_STATUSES = ["BOOKED", "IN_TRANSIT", "AT_DESTINATION", "DELIVERED", "ON_HOLD", "CANCELLED"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/** Default milestone set (owner decision T-01 may adjust labels or order). */
export const MILESTONE_CODES = [
  "BOOKED",
  "RECEIVED_AT_DEPOT",
  "DEPARTED_ORIGIN",
  "IN_TRANSIT",
  "ARRIVED_DESTINATION_PORT",
  "IN_CUSTOMS",
  "CUSTOMS_CLEARED",
  "READY_FOR_COLLECTION",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELAYED",
  "ON_HOLD",
] as const;
export type MilestoneCode = (typeof MILESTONE_CODES)[number];

/** Milestones that describe a problem rather than progress. */
export const EXCEPTION_MILESTONES: readonly MilestoneCode[] = ["DELAYED", "ON_HOLD"];

export const DOCUMENT_OWNER_TYPES = ["quote_request", "shipment"] as const;
export type DocumentOwnerType = (typeof DOCUMENT_OWNER_TYPES)[number];

export const EMAIL_STATUSES = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/** Currencies staff may quote in until owner decision P-03 says otherwise. */
export const CURRENCIES = ["EUR", "XAF"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** ISO 4217 minor-unit exponents: EUR has cents, XAF has none. */
export const CURRENCY_EXPONENT: Record<Currency, number> = { EUR: 2, XAF: 0 };

export const DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
