import { CONSENT_COOKIE, NO_OPTIONAL, newConsent, serializeConsent } from "../lib/consent/consent";

/**
 * Playwright storage state with a current "reject optional" consent cookie, so
 * the cookie banner does not cover the page in suites that test other things.
 * tests/e2e/consent.spec.ts starts from an empty state to test the banner itself.
 */
export function consentStorageState() {
  return {
    cookies: [
      {
        name: CONSENT_COOKIE,
        value: serializeConsent(newConsent(NO_OPTIONAL)),
        domain: "localhost",
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };
}
