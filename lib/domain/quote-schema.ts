import { z } from "zod";
import { CANCELLATION_REASON_MAX } from "./quote-lifecycle";
import { CURRENCIES, LOCALES, MILESTONE_CODES, QUOTE_STATUSES, SHIPMENT_STATUSES } from "./enums";
import { SERVICE_CODES } from "./services";
import { isSelectableFor } from "./catalogue";

/*
 * Validation shared by forms (client) and server actions (server). Server-side
 * parsing is authoritative. Field limits mirror the database constraints.
 * Error messages are stable codes translated in the UI ("validation.<code>").
 */
const requiredText = (max: number) => z.string().trim().min(1, "required").max(max, "too_long");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "too_long")
    .optional()
    .transform((v) => (v ? v : undefined));
const optionalNumber = (max: number) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number({ error: "invalid" }).positive("invalid").max(max, "too_large").optional());

/** Optional catalogue choice, "<section>.<item>" (config/catalogue.ts); checked against the service below. */
const catalogueItem = z.string().trim().max(80, "too_long").optional().transform((v) => (v ? v : undefined));

/** Vehicle shipping method preference: container (personal effects allowed) or RORO. */
export const VEHICLE_SHIPPING_METHODS = ["container", "roro"] as const;

export const genericItemSchema = z
  .object({
    catalogueItem,
    description: requiredText(200),
    quantity: z.coerce.number({ error: "invalid" }).int("invalid").min(1, "invalid").max(100, "too_large"),
    weightKg: optionalNumber(50_000),
    lengthCm: optionalNumber(2_000),
    widthCm: optionalNumber(2_000),
    heightCm: optionalNumber(2_000),
  })
  .strict();

const currentYear = new Date().getFullYear();
export const vehicleItemSchema = z
  .object({
    vehicleMake: requiredText(60),
    vehicleModel: requiredText(60),
    vehicleYear: z.coerce.number({ error: "invalid" }).int("invalid").min(1950, "invalid").max(currentYear + 1, "invalid"),
    running: z.boolean().optional(),
    shippingMethod: z.enum(VEHICLE_SHIPPING_METHODS, { error: "invalid" }).optional(),
    catalogueItem,
    description: optionalText(200),
  })
  .strict();

const contactSchema = z
  .object({
    name: requiredText(120),
    email: z.string().trim().toLowerCase().max(254, "too_long").pipe(z.email("invalid_email")),
    /** International format with country code, e.g. +353 89 123 4567 or +237 6 95 73 90 33. */
    phone: z
      .string()
      .trim()
      .min(1, "required")
      .max(32, "too_long")
      .regex(/^\+[1-9][0-9 ()-]{6,30}$/, "invalid_phone")
      .refine((v) => {
        const digits = v.replace(/\D/g, "").length;
        return digits >= 8 && digits <= 15;
      }, "invalid_phone"),
  })
  .strict();

const baseFields = {
  originCountry: z.string().regex(/^[A-Z]{2}$/, "invalid"),
  destinationCountry: z.string().regex(/^[A-Z]{2}$/, "invalid"),
  destinationCity: optionalText(120),
  notes: optionalText(2000),
  contact: contactSchema,
  locale: z.enum(LOCALES),
  idempotencyKey: z.uuid("invalid"),
  /** Privacy notice acknowledged (recorded with the request). */
  privacyAccepted: z.literal(true, { error: "consent_required" }),
  /** Honeypot: must stay empty. Checked separately so bots get no hint. */
  website: z.string().max(200).optional(),
};

const GENERIC_SERVICES = SERVICE_CODES.filter((c) => c !== "vehicle") as [Exclude<(typeof SERVICE_CODES)[number], "vehicle">, ...Exclude<(typeof SERVICE_CODES)[number], "vehicle">[]];

export const quoteRequestInputSchema = z
  .discriminatedUnion("service", [
    z.object({ service: z.literal("vehicle"), items: z.array(vehicleItemSchema).min(1, "required").max(5, "too_many"), ...baseFields }).strict(),
    z.object({ service: z.enum(GENERIC_SERVICES), items: z.array(genericItemSchema).min(1, "required").max(20, "too_many"), ...baseFields }).strict(),
  ])
  .superRefine((value, ctx) => {
    // A catalogue choice must be a selectable item of the chosen service (never a surcharge or another service's item).
    value.items.forEach((item, index) => {
      if (item.catalogueItem && !isSelectableFor(value.service, item.catalogueItem)) {
        ctx.addIssue({ code: "custom", message: "invalid", path: ["items", index, "catalogueItem"] });
      }
    });
  });
export type QuoteRequestInput = z.infer<typeof quoteRequestInputSchema>;

/** Flattens Zod issues into { "contact.email": "invalid_email" } for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = /^[a-z_]+$/.test(issue.message) ? issue.message : "invalid";
  }
  return out;
}

// ---- Staff inputs -----------------------------------------------------------

export const transitionInputSchema = z
  .object({
    requestId: z.uuid(),
    to: z.enum(QUOTE_STATUSES),
    reason: z.string().trim().max(CANCELLATION_REASON_MAX, "too_long").optional(),
  })
  .refine((v) => v.to !== "CANCELLED" || (v.reason && v.reason.length > 0), { message: "required", path: ["reason"] });

export const sendQuoteInputSchema = z.object({
  requestId: z.uuid(),
  /** Major units as typed by staff, e.g. "450.00" for EUR, "250000" for XAF. */
  amount: z.string().trim().regex(/^\d{1,9}([.,]\d{1,2})?$/, "invalid"),
  currency: z.enum(CURRENCIES),
  inclusions: z.string().trim().max(2000, "too_long").default(""),
  exclusions: z.string().trim().max(2000, "too_long").default(""),
  validUntil: z.iso.date("invalid"),
});

export const QUOTE_LINE_KINDS = ["charge", "discount", "tax"] as const;

export const quoteLineInputSchema = z
  .object({
    kind: z.enum(QUOTE_LINE_KINDS),
    description: requiredText(200),
    quantity: z.string().trim().max(12, "too_long").optional(),
    unitPrice: z.string().trim().max(20, "too_long").optional(),
    rateBp: z.coerce.number({ error: "invalid" }).int("invalid").min(0, "invalid").max(10_000, "invalid").optional(),
  })
  .strict();

/** Staff quotation, priced line by line; totals are computed on the server (lib/domain/pricing.ts). */
export const issueQuoteInputSchema = z
  .object({
    requestId: z.uuid(),
    currency: z.enum(CURRENCIES),
    lines: z.array(quoteLineInputSchema).min(1, "required").max(50, "too_many"),
    inclusions: z.string().trim().max(2000, "too_long").default(""),
    exclusions: z.string().trim().max(2000, "too_long").default(""),
    validUntil: z.iso.date("invalid"),
  })
  .strict();
export type IssueQuoteInput = z.infer<typeof issueQuoteInputSchema>;

export const caseMessageBodySchema = z.string().trim().min(1, "required").max(4000, "too_long");

export const contactInputSchema = z
  .object({
    name: requiredText(120),
    email: z.string().trim().toLowerCase().max(254, "too_long").pipe(z.email("invalid_email")),
    phone: z
      .string()
      .trim()
      .max(32, "too_long")
      .regex(/^\+[1-9][0-9 ()-]{6,30}$/, "invalid_phone")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    topic: z.enum(["quote", "shipment", "general"]),
    relatedReference: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^(QR[A-Z2-7]{6}|ML[A-Z2-7]{10})$/, "invalid_reference")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    message: z.string().trim().min(10, "too_short").max(4000, "too_long"),
    locale: z.enum(LOCALES),
    idempotencyKey: z.uuid("invalid"),
    privacyAccepted: z.literal(true, { error: "consent_required" }),
    /** Honeypot. */
    website: z.string().max(200).optional(),
  })
  .strict();

export const shipmentEventInputSchema = z.object({
  shipmentId: z.uuid(),
  milestone: z.enum(MILESTONE_CODES),
  location: optionalText(120),
  occurredAt: z.iso.datetime({ local: true, offset: true, error: "invalid" }),
  noteEn: optionalText(1000),
  noteFr: optionalText(1000),
  public: z.boolean(),
});

export const shipmentUpdateInputSchema = z
  .object({
    shipmentId: z.uuid(),
    status: z.enum(SHIPMENT_STATUSES),
    etaFrom: z.iso.date("invalid").optional().or(z.literal("").transform(() => undefined)),
    etaTo: z.iso.date("invalid").optional().or(z.literal("").transform(() => undefined)),
    etaVisible: z.boolean(),
    /** Also record the milestone matching the new status (STATUS_MILESTONES); ignored when the status does not change. */
    recordMilestone: z.boolean().default(false),
    milestonePublic: z.boolean().default(false),
  })
  .refine((v) => !v.etaFrom || !v.etaTo || v.etaTo >= v.etaFrom, { message: "invalid_range", path: ["etaTo"] });
