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
     * Existing logo file. It reads "MARCHELO LOGISTICS CARGO", so showing it would
     * choose the business name. Hidden until the owner approves it (B-01, B-03).
     */
    logo: { src: "/LOGO.png", width: 500, height: 500, approved: false }, // {{NEEDS_OWNER}} B-03
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
    /** ISO 3166-1 alpha-2 codes. Ireland -> Cameroon is the stated focus; others need approval (S-02). */
    originCountries: ["IE"],
    destinationCountries: ["CM"],
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

/** Verified contact channels only. Unverified details are never shown. */
export function verifiedContacts() {
  const entries = Object.entries(ownerConfig.contact) as [keyof typeof ownerConfig.contact, ContactChannel][];
  return Object.fromEntries(entries.filter(([, channel]) => channel.verified)) as Partial<Record<keyof typeof ownerConfig.contact, ContactChannel>>;
}
