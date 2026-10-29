import { describe, expect, it } from "vitest";
import { FLAG_NAMES, isDemoDataEnabled, isEnabled } from "@/lib/config/flags";
import { readFileSync } from "node:fs";

describe("feature flags", () => {
  it("default to off when unset", () => {
    for (const name of FLAG_NAMES) expect(isEnabled(name, {})).toBe(false);
  });

  it("only accept the exact string 'true'", () => {
    for (const value of ["1", "TRUE", "yes", "on", " true", ""]) {
      expect(isEnabled("ENABLE_QUOTE_SUBMISSION", { ENABLE_QUOTE_SUBMISSION: value })).toBe(false);
    }
    expect(isEnabled("ENABLE_QUOTE_SUBMISSION", { ENABLE_QUOTE_SUBMISSION: "true" })).toBe(true);
  });

  it("never serve demo data in production", () => {
    expect(isDemoDataEnabled({ ENABLE_DEMO_DATA: "true", NODE_ENV: "production" })).toBe(false);
    expect(isDemoDataEnabled({ ENABLE_DEMO_DATA: "true", NODE_ENV: "development" })).toBe(true);
  });

  it("are documented as false in .env.example", () => {
    const example = readFileSync(".env.example", "utf8");
    for (const name of FLAG_NAMES) expect(example).toMatch(new RegExp(`^${name}=false$`, "m"));
  });
});
