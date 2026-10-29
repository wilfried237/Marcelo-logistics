import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The matcher must be a literal in middleware.ts (Next.js analyses it statically),
// so the test reads it from the source file. Runtime behaviour is additionally
// verified against a production build (see docs/TESTING.md, "routing probes").
const source = readFileSync("middleware.ts", "utf8");
const literal = /matcher:\s*\["(.+?)"\]/.exec(source)?.[1];
const matcher = new RegExp(`^${literal!.replace(/\\\\/g, "\\")}$`);

describe("middleware matcher", () => {
  it("is defined", () => expect(literal).toBeTruthy());

  it.each(["/", "/en", "/fr/quote", "/en/track/MLABC", "/en/api-docs", "/apiary"])("handles page path %s", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each(["/api", "/api/track", "/api/quote", "/api/auth/callback", "/_next/static/chunk.js", "/_vercel/insights", "/LOGO.png", "/favicon.ico"])(
    "skips %s",
    (path) => {
      expect(matcher.test(path)).toBe(false);
    },
  );
});
