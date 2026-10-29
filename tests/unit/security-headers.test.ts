import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security/headers";

const local = { development: false, https: false };

describe("security headers", () => {
  it("forbid framing and plugin content", () => {
    const csp = contentSecurityPolicy(local);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("only allow eval and websockets in development", () => {
    expect(contentSecurityPolicy(local)).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy(local)).not.toContain("ws:");
    expect(contentSecurityPolicy({ ...local, development: true })).toContain("'unsafe-eval'");
  });

  it("only send HSTS and upgrade-insecure-requests over HTTPS", () => {
    const keys = (o: typeof local) => securityHeaders(o).map((h) => h.key);
    expect(keys(local)).not.toContain("Strict-Transport-Security");
    expect(contentSecurityPolicy(local)).not.toContain("upgrade-insecure-requests");
    expect(keys({ ...local, https: true })).toContain("Strict-Transport-Security");
  });

  it("allow the configured Supabase origin for connections", () => {
    expect(contentSecurityPolicy({ ...local, supabaseUrl: "https://abc.supabase.co" })).toMatch(/connect-src 'self' https:\/\/abc\.supabase\.co wss:\/\/abc\.supabase\.co/);
  });

  it("include the baseline headers", () => {
    const keys = securityHeaders(local).map((h) => h.key);
    for (const key of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "X-Frame-Options"]) {
      expect(keys).toContain(key);
    }
  });
});
