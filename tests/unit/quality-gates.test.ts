import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkMessages, icuArgs } from "../../scripts/check-i18n.mjs";
import { findPlaceholders, isReleaseBuild, MARKER } from "../../scripts/check-owner-placeholders.mjs";
import { BANNED_PHRASES } from "../../scripts/check-security.mjs";

describe("i18n parity check", () => {
  it("passes for the real message files", () => {
    const en = JSON.parse(readFileSync("messages/en.json", "utf8"));
    const fr = JSON.parse(readFileSync("messages/fr.json", "utf8"));
    expect(checkMessages({ en, fr })).toEqual([]);
  });

  it("detects missing, extra, empty and mismatched-argument keys", () => {
    const problems: string[] = checkMessages({
      en: { a: "Hello {name}", b: "x", c: "ok" },
      fr: { a: "Bonjour", c: "", d: "extra" },
    });
    expect(problems.join("\n")).toMatch(/missing key "b"/);
    expect(problems.join("\n")).toMatch(/extra key "d"/);
    expect(problems.join("\n")).toMatch(/"c" is empty/);
    expect(problems.join("\n")).toMatch(/ICU arguments/);
  });

  it("rejects leftover technical placeholders", () => {
    expect(checkMessages({ en: { a: "TODO write this" }, fr: { a: "TODO" } }).length).toBeGreaterThan(0);
  });

  it("extracts only top-level ICU argument names", () => {
    expect(icuArgs("{count, plural, one {# item} other {# items}} for {name}")).toEqual(["count", "name"]);
  });
});

describe("owner placeholder release gate", () => {
  it("is strict only for release builds", () => {
    expect(isReleaseBuild({})).toBe(false);
    expect(isReleaseBuild({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isReleaseBuild({ VERCEL_ENV: "production" })).toBe(true);
    expect(isReleaseBuild({ RELEASE_BUILD: "true" })).toBe(true);
  });

  it("finds unresolved markers in owner content but ignores the marker definition", () => {
    // A fixture, so the test does not depend on which owner answers have arrived.
    const messages = join(mkdtempSync(join(tmpdir(), "owner-gate-")), "en.json");
    writeFileSync(messages, JSON.stringify({ brand: { name: MARKER } }, null, 2));
    const hits: string[] = findPlaceholders(["config/owner.ts", messages]);
    expect(hits.some((h) => h.startsWith(messages))).toBe(true);
    expect(hits.some((h) => h.startsWith("config/owner.ts"))).toBe(true);
    expect(hits.some((h) => h.includes("@owner-marker-definition"))).toBe(false);
    expect(MARKER).toBe("{{NEEDS_OWNER}}");
  });
});

describe("content integrity", () => {
  it("published messages contain no unverified claims", () => {
    for (const file of ["messages/en.json", "messages/fr.json"]) {
      const text = readFileSync(file, "utf8");
      for (const re of BANNED_PHRASES as RegExp[]) expect(re.test(text), `${file} matches ${re}`).toBe(false);
    }
  });
});
