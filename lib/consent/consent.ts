/*
 * Cookie consent model (pure, no browser or Next.js imports: shared by the
 * server layout, the client banner, unit tests and the Playwright configs).
 *
 * Inventory at the time of writing (verified on the live site and in code):
 * the website sets ONLY strictly necessary cookies (language, sign-in session,
 * password-reset verifier, and this consent record). No functional, analytics
 * or marketing tool is installed, so every optional category is empty.
 *
 * Adding an optional tool later:
 *   1. load it only inside <ConsentGate category="..."> (never in <head>);
 *   2. list the cookies it sets in OPTIONAL_COOKIES so withdrawal removes them;
 *   3. describe it on the cookie policy page (messages: cookiePolicy);
 *   4. bump CONSENT_POLICY_VERSION so every visitor is asked again.
 */

export const CONSENT_COOKIE = "ml_consent";

/** Bump whenever categories, tools or purposes change: older choices are then ignored and the banner returns. */
export const CONSENT_POLICY_VERSION = 1;

/** How long a choice is remembered before the visitor is asked again. */
export const CONSENT_MAX_AGE_DAYS = 180;

export const OPTIONAL_CATEGORIES = ["functional", "analytics", "marketing"] as const;
export type OptionalCategory = (typeof OPTIONAL_CATEGORIES)[number];
export type ConsentCategory = "necessary" | OptionalCategory;
export type ConsentChoices = Record<OptionalCategory, boolean>;

export interface ConsentState {
  version: number;
  /** When the visitor made the choice (stored to the second). */
  decidedAt: Date;
  choices: ConsentChoices;
}

/** Cookies each optional category may set; deleted when consent is withdrawn. Empty: no optional tool in use. */
export const OPTIONAL_COOKIES: Record<OptionalCategory, readonly string[]> = {
  functional: [],
  analytics: [],
  marketing: [],
};

export const NO_OPTIONAL: ConsentChoices = { functional: false, analytics: false, marketing: false };
export const ALL_OPTIONAL: ConsentChoices = { functional: true, analytics: true, marketing: true };

/** "<version>.<functional>.<analytics>.<marketing>.<unix seconds>", e.g. "1.0.0.0.1762646400". No personal data. */
export function serializeConsent(state: ConsentState): string {
  const flags = OPTIONAL_CATEGORIES.map((c) => (state.choices[c] ? "1" : "0")).join(".");
  return `${state.version}.${flags}.${Math.floor(state.decidedAt.getTime() / 1000)}`;
}

/**
 * Reads the cookie value. Anything malformed, from another policy version or
 * dated in the future counts as "no decision", so the banner is shown again.
 */
export function parseConsent(value: string | undefined | null, now: Date = new Date()): ConsentState | null {
  const match = /^(\d{1,4})\.([01])\.([01])\.([01])\.(\d{9,11})$/.exec(value ?? "");
  if (!match) return null;
  const version = Number(match[1]);
  if (version !== CONSENT_POLICY_VERSION) return null;
  const decidedAt = new Date(Number(match[5]) * 1000);
  if (decidedAt.getTime() > now.getTime() + 5 * 60_000) return null;
  if (now.getTime() - decidedAt.getTime() > CONSENT_MAX_AGE_DAYS * 86_400_000) return null;
  return { version, decidedAt, choices: { functional: match[2] === "1", analytics: match[3] === "1", marketing: match[4] === "1" } };
}

export function hasConsent(state: ConsentState | null, category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  return state?.choices[category] === true;
}

export function newConsent(choices: ConsentChoices, now: Date = new Date()): ConsentState {
  return { version: CONSENT_POLICY_VERSION, decidedAt: now, choices: { ...choices } };
}

/** The Set-Cookie style string for document.cookie. First-party, readable by the banner, Lax, Secure on HTTPS. */
export function consentCookieString(state: ConsentState, secure: boolean): string {
  return `${CONSENT_COOKIE}=${serializeConsent(state)}; Path=/; Max-Age=${CONSENT_MAX_AGE_DAYS * 86_400}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Cookies to delete after a change of choices: those of every category that is now refused. */
export function cookiesToRemove(choices: ConsentChoices): string[] {
  return OPTIONAL_CATEGORIES.filter((c) => !choices[c]).flatMap((c) => [...OPTIONAL_COOKIES[c]]);
}
