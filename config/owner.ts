/**
 * OWNER-CONTROLLED BUSINESS FACTS
 *
 * This is the single place for business information that only the owner can
 * confirm. Anything unresolved carries the owner marker (see NEEDS_OWNER), either as a
 * value or in a comment on the line that must change. A release build fails
 * while any marker remains (scripts/check-owner-placeholders.mjs).
 *
 * Decision IDs refer to docs/DECISIONS-REQUIRED.md.
 * Translatable owner text (brand name, legal copy) lives in messages/*.json.
 */

export const NEEDS_OWNER = "{{NEEDS_OWNER}}"; // @owner-marker-definition

export type ContactChannel = {
  /** E.164 phone number (e.g. +3538xxxxxxx) or an email address. */
  value: string;
  /** How the value is shown to visitors, if different from `value`. */
  display?: string;
  /** Only verified channels are ever shown to visitors. */
  verified: boolean;
};

export const ownerConfig = {
  brand: {
    /**
     * Logo vectorised from public/LOGO.png (public/brand/*.svg; see components/brand/logo.tsx).
     * In use on every page at the developer's instruction of 2026-11-04 (A-01). It still
     * reads "MARCHELO LOGISTICS CARGO" while the business name is "Marchelo Logistics"
     * (B-01): the owner should confirm the artwork or supply an updated version.
     */
    logo: { src: "/brand/marchelo-logo.svg", reversedSrc: "/brand/marchelo-logo-reversed.svg", markSrc: "/brand/marchelo-mark.svg", width: 2528, height: 1360, approved: true },
  },

  /**
   * Company identity supplied by the client on 2026-11-10 (B-02, partly answered).
   * The company registration number and the VAT number were not supplied and must
   * never be invented: they stay null until the owner provides them.
   */
  company: {
    legalName: "MARCHELO LOGISTICS CARGO LTD",
    tradingName: "MARCHELO LOGISTICS DISTRIBUTION",
    registrationNumber: null as string | null,
    vatNumber: null as string | null,
  },

  contact: {
    // Supplied by the client on 2026-11-06 (C-01). `display` keeps the client's own spacing.
    irelandPhone: { value: "+353894840017", display: "+353 89 484 0017", verified: true } satisfies ContactChannel,
    cameroonPhone: { value: "+237659685479", display: "+237 6 59 68 54 79", verified: true } satisfies ContactChannel,
    email: { value: "info.cargo@marchelo-logistics.com", verified: true } satisfies ContactChannel,
    // WhatsApp on the same two numbers, confirmed by the owner on 2026-11-09 (C-01). No other WhatsApp contact exists.
    irelandWhatsApp: { value: "+353894840017", display: "+353 89 484 0017", verified: true } satisfies ContactChannel,
    cameroonWhatsApp: { value: "+237659685479", display: "+237 6 59 68 54 79", verified: true } satisfies ContactChannel,
  },

  /**
   * Opening hours confirmed by the owner on 2026-11-09 (C-01): the business is open
   * 24 hours a day, 7 days a week. This is business availability (phone, WhatsApp,
   * email, quote handling). It does NOT mean the Lucan office or the Douala location
   * is staffed 24/7 for drop-off or collection: handover times are agreed per shipment.
   */
  hours: { open24x7: true },

  /**
   * Where the business operates, exactly as supplied by the client (full
   * addresses confirmed on 2026-11-10).
   */
  locations: {
    ireland: { country: "IE", place: "12 Griffeen Glen Chase, Lucan, Co. Dublin, Ireland", kind: "office", phone: "irelandPhone", whatsapp: "irelandWhatsApp" },
    cameroon: { country: "CM", place: "Ndogsimbi, Douala, face Station-Service Gulfil, Cameroun", kind: "location", phone: "cameroonPhone", whatsapp: "cameroonWhatsApp" },
  },

  operations: {
    /**
     * Services the owner has confirmed: the client's list of 2026-11-06, plus
     * parcels, barrels and commercial cargo, confirmed on 2026-11-09 (S-01).
     */
    confirmedServices: ["air_freight", "sea_freight", "vehicle", "warehousing", "customs_clearance", "ecommerce", "parcels", "barrels", "commercial_cargo"] as string[],
    /**
     * Routes offered online (ISO 3166-1 alpha-2) and their monthly departure
     * windows (days of the month). Source: the client's message relayed by the
     * developer on 2026-11-03: express shipments every month, Ireland -> Cameroon
     * between the 10th and 15th, Cameroon -> Ireland between the 20th and 25th
     * (S-02). These are departure windows only; no transit or delivery times.
     */
    routes: [
      { origin: "IE", destination: "CM", departureDays: { from: 10, to: 15 } },
      { origin: "CM", destination: "IE", departureDays: { from: 20, to: 25 } },
    ],
  },

  pricing: {
    /**
     * Tax (VAT) rates staff may apply, in basis points (2300 = 23 %). Empty until
     * the VAT presentation is approved (P-03): tax lines are then unavailable and
     * staff state the tax treatment in the inclusions/exclusions text.
     */
    taxRatesBp: [] as number[],
  },

  notifications: {
    /**
     * Hours before a quotation's validity date when the customer gets a reminder.
     * null = no reminders (not approved). Example: 48.
     */
    quoteExpiryReminderHours: null as number | null,
  },

  legal: {
    /** Terms and conditions are never published until approved (L-01). */
    termsApproved: false, // {{NEEDS_OWNER}} L-01
    /** Privacy notice: controller identity and retention must be confirmed (L-02, L-03). */
    privacyApproved: false, // {{NEEDS_OWNER}} L-02
    /** Cookie policy: the inventory is factual; the wording awaits legal review (L-04). */
    cookiePolicyApproved: false, // {{NEEDS_OWNER}} L-04
  },
} as const;

export function isOwnerValueResolved(value: unknown): boolean {
  return typeof value === "string" ? !value.includes(NEEDS_OWNER) : value !== undefined && value !== null;
}

export type Route = (typeof ownerConfig.operations.routes)[number];

/** True only for a route listed in ownerConfig.operations.routes. */
export function isRouteOffered(origin: string, destination: string): boolean {
  return ownerConfig.operations.routes.some((r) => r.origin === origin && r.destination === destination);
}

/** Verified contact channels only. Unverified details are never shown. */
export function verifiedContacts() {
  const entries = Object.entries(ownerConfig.contact) as [keyof typeof ownerConfig.contact, ContactChannel][];
  return Object.fromEntries(entries.filter(([, channel]) => channel.verified)) as Partial<Record<keyof typeof ownerConfig.contact, ContactChannel>>;
}
