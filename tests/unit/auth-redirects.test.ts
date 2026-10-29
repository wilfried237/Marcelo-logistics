import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirects";

describe("post-login redirect validation", () => {
  it("accepts same-site locale paths into known areas", () => {
    expect(safeNextPath("/fr/portal/quotes/QRABCDEF", "fr")).toBe("/fr/portal/quotes/QRABCDEF");
    expect(safeNextPath("/en/admin", "en")).toBe("/en/admin");
    expect(safeNextPath("/en/reset-password", "en")).toBe("/en/reset-password");
  });

  it.each([
    "//evil.example/en/portal",
    "https://evil.example/en/portal",
    "/\\evil.example",
    "javascript:alert(1)",
    "/de/portal",
    "/en/../admin",
    "/en/portalx",
    "/en/quote",
    "",
    null,
    42,
    `/en/portal${"a".repeat(400)}`,
    "/en/portal\nSet-Cookie: x",
  ])("rejects %s", (value) => {
    expect(safeNextPath(value, "en")).toBe("/en/portal");
  });

  it("uses the requested fallback", () => {
    expect(safeNextPath(undefined, "fr", "/admin")).toBe("/fr/admin");
  });
});
