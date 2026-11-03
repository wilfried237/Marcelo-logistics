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
  /** E.164 phone number, e.g. +3538xxxxxxx */
  value: string;
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

  contact: {
    // These values were found in the previous site code. They are NOT yet verified
    // by the owner and are therefore never displayed (C-01).
    irelandPhone: { value: "+353896160927", verified: false } satisfies ContactChannel, // {{NEEDS_OWNER}} C-01
    irelandWhatsApp: { value: "+353896160927", verified: false } satisfies ContactChannel, // {{NEEDS_OWNER}} C-01
    cameroonPhone: { value: "+237695739033", verified: false } satisfies ContactChannel, // {{NEEDS_OWNER}} C-01
    email: { value: "marchelodis@gmail.com", verified: false } satisfies ContactChannel, // {{NEEDS_OWNER}} C-01
  },

  operations: {
    /**
     * Service codes the owner has confirmed as currently offered. Until confirmed,
     * every category is shown as "availability to be confirmed" (S-01).
     */
    confirmedServices: [] as string[], // {{NEEDS_OWNER}} S-01
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

  legal: {
    /** Terms and conditions are never published until approved (L-01). */
    termsApproved: false, // {{NEEDS_OWNER}} L-01
    /** Privacy notice: controller identity and retention must be confirmed (L-02, L-03). */
    privacyApproved: false, // {{NEEDS_OWNER}} L-02
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
