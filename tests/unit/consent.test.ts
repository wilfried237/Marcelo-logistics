import { describe, expect, it } from "vitest";
import {
  ALL_OPTIONAL,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_DAYS,
  CONSENT_POLICY_VERSION,
  NO_OPTIONAL,
  OPTIONAL_COOKIES,
  consentCookieString,
  cookiesToRemove,
  hasConsent,
  newConsent,
  parseConsent,
  serializeConsent,
} from "@/lib/consent/consent";

const NOW = new Date("2026-11-09T12:00:00Z");

describe("cookie consent model", () => {
  it("round-trips a decision with its policy version and time, and stores no personal data", () => {
    const state = newConsent({ functional: true, analytics: false, marketing: true }, NOW);
    const value = serializeConsent(state);
    expect(value).toBe(`${CONSENT_POLICY_VERSION}.1.0.1.${NOW.getTime() / 1000}`);
    expect(parseConsent(value, NOW)).toEqual(state);
  });

  it("treats missing, malformed, outdated, future or expired values as no decision (banner shown again)", () => {
    const ts = NOW.getTime() / 1000;
    expect(parseConsent(undefined, NOW)).toBeNull();
    expect(parseConsent("", NOW)).toBeNull();
    expect(parseConsent("yes", NOW)).toBeNull();
    expect(parseConsent(`${CONSENT_POLICY_VERSION}.2.0.0.${ts}`, NOW)).toBeNull();
    expect(parseConsent(`${CONSENT_POLICY_VERSION + 1}.0.0.0.${ts}`, NOW)).toBeNull(); // policy changed
    expect(parseConsent(`${CONSENT_POLICY_VERSION}.0.0.0.${ts + 3600}`, NOW)).toBeNull(); // future
    expect(parseConsent(`${CONSENT_POLICY_VERSION}.0.0.0.${ts - (CONSENT_MAX_AGE_DAYS + 1) * 86_400}`, NOW)).toBeNull();
  });

  it("never grants an optional category without an explicit choice; necessary is always allowed", () => {
    expect(hasConsent(null, "necessary")).toBe(true);
    for (const category of ["functional", "analytics", "marketing"] as const) {
      expect(hasConsent(null, category)).toBe(false);
      expect(hasConsent(newConsent(NO_OPTIONAL, NOW), category)).toBe(false);
      expect(hasConsent(newConsent(ALL_OPTIONAL, NOW), category)).toBe(true);
    }
  });

  it("writes a first-party, Lax cookie that is Secure on HTTPS and expires after the retention period", () => {
    const state = newConsent(NO_OPTIONAL, NOW);
    const https = consentCookieString(state, true);
    expect(https.startsWith(`${CONSENT_COOKIE}=`)).toBe(true);
    expect(https).toContain("Path=/");
    expect(https).toContain("SameSite=Lax");
    expect(https).toContain(`Max-Age=${CONSENT_MAX_AGE_DAYS * 86_400}`);
    expect(https).toContain("Secure");
    expect(https).not.toMatch(/Domain=/i);
    expect(consentCookieString(state, false)).not.toContain("Secure");
  });

  it("matches the verified inventory: no optional cookie is in use, so withdrawal has nothing to delete today", () => {
    expect(OPTIONAL_COOKIES).toEqual({ functional: [], analytics: [], marketing: [] });
    expect(cookiesToRemove(NO_OPTIONAL)).toEqual([]);
  });
});
