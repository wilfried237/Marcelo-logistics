import { describe, expect, it } from "vitest";
import { formatMoney, toMinorUnits } from "@/lib/domain/money";
import { getEmailTransport, quoteSubmissionStatus, getDatabaseUrl, ConfigurationError } from "@/lib/config/env";

describe("money", () => {
  it("converts major units to integer minor units without floating point errors", () => {
    expect(toMinorUnits("450.50", "EUR")).toBe(45050);
    expect(toMinorUnits("0.29", "EUR")).toBe(29);
    expect(toMinorUnits("19,99", "EUR")).toBe(1999);
    expect(toMinorUnits("250000", "XAF")).toBe(250000);
  });
  it("rejects zero, negatives, garbage and decimals XAF cannot represent", () => {
    for (const bad of ["0", "-1", "abc", "1.234", "", "1e5"]) expect(toMinorUnits(bad, "EUR")).toBeNull();
    expect(toMinorUnits("10.50", "XAF")).toBeNull();
  });
  it("formats by locale and currency", () => {
    expect(formatMoney(45050, "EUR", "en")).toMatch(/450\.50/);
    expect(formatMoney(45050, "EUR", "fr")).toMatch(/450,50/);
    expect(formatMoney(250000, "XAF", "fr")).not.toMatch(/,00/);
  });
});

describe("configuration gates", () => {
  it("keeps quote submission unavailable unless flag, database and email are ready", () => {
    expect(quoteSubmissionStatus({})).toEqual({ available: false, reason: "flag_disabled" });
    expect(quoteSubmissionStatus({ ENABLE_QUOTE_SUBMISSION: "true" })).toEqual({ available: false, reason: "database_not_configured" });
    expect(quoteSubmissionStatus({ ENABLE_QUOTE_SUBMISSION: "true", DATABASE_URL: "postgres://x" })).toEqual({ available: false, reason: "email_not_configured" });
    expect(quoteSubmissionStatus({ ENABLE_QUOTE_SUBMISSION: "true", DATABASE_URL: "postgres://x", NODE_ENV: "development", EMAIL_DEV_LOG: "true" })).toEqual({ available: true });
  });
  it("never uses the dev email log in production", () => {
    expect(getEmailTransport({ NODE_ENV: "production", EMAIL_DEV_LOG: "true" }).kind).toBe("disabled");
    expect(getEmailTransport({ ENABLE_TRANSACTIONAL_EMAIL: "true", RESEND_API_KEY: "re_x" }).kind).toBe("disabled");
    expect(getEmailTransport({ ENABLE_TRANSACTIONAL_EMAIL: "true", RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.c" }).kind).toBe("resend");
  });
  it("reports missing configuration by name without leaking values", () => {
    expect(() => getDatabaseUrl({})).toThrow(ConfigurationError);
    expect(() => getDatabaseUrl({ DATABASE_URL: "mysql://secret-password@host" })).toThrow(/DATABASE_URL is invalid/);
    try { getDatabaseUrl({ DATABASE_URL: "mysql://secret-password@host" }); } catch (e) { expect(String(e)).not.toContain("secret-password"); }
  });
});
