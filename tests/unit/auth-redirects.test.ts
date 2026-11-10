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

describe("email link failures (Stage 4)", () => {
  const params = (q: string) => new URLSearchParams(q);
  it("tells an expired or already-used link apart from an invalid one, without revealing anything about the account", async () => {
    const { linkErrorCode } = await import("@/lib/auth/redirects");
    expect(linkErrorCode(params("error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"))).toBe("link_expired");
    expect(linkErrorCode(params("error_code=flow_state_expired"))).toBe("link_expired");
    expect(linkErrorCode(params("error=access_denied&error_code=bad_jwt"))).toBe("link_invalid");
    expect(linkErrorCode(params("error=server_error"))).toBe("link_invalid");
  });

  it("only shows known error codes taken from the login URL", async () => {
    const { loginUrlError } = await import("@/lib/auth/redirects");
    expect(loginUrlError("link_expired")).toBe("link_expired");
    expect(loginUrlError("link_invalid")).toBe("link_invalid");
    expect(loginUrlError("<script>")).toBeNull();
    expect(loginUrlError(["link_invalid"])).toBeNull();
    expect(loginUrlError(undefined)).toBeNull();
  });
});
