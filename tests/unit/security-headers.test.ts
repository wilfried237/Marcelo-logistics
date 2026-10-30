import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createNonce, forwardRequestHeaders, securityHeaders } from "@/lib/security/headers";

const local = { development: false, https: false };
const csp = (o: Partial<typeof local> & { supabaseUrl?: string } = {}) => contentSecurityPolicy({ ...local, ...o, nonce: "abc123==" });

describe("content security policy", () => {
  it("allows scripts only with the request nonce, never 'unsafe-inline'", () => {
    const script = /script-src ([^;]+)/.exec(csp())![1];
    expect(script).toContain("'nonce-abc123=='");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
  });

  it("forbids framing and plugin content", () => {
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) expect(csp()).toContain(d);
  });

  it("only allows eval and websockets in development", () => {
    expect(csp({ development: true })).toContain("'unsafe-eval'");
    expect(csp()).not.toContain("ws:");
  });

  it("allows the configured Supabase origin for connections", () => {
    expect(csp({ supabaseUrl: "https://abc.supabase.co" })).toMatch(/connect-src 'self' https:\/\/abc\.supabase\.co wss:\/\/abc\.supabase\.co/);
  });

  it("creates unpredictable base64 nonces", () => {
    const nonces = new Set(Array.from({ length: 100 }, createNonce));
    expect(nonces.size).toBe(100);
    for (const n of nonces) expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("static security headers", () => {
  it("include the baseline headers and HSTS only over HTTPS", () => {
    const keys = (o: typeof local) => securityHeaders(o).map((h) => h.key);
    for (const key of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "X-Frame-Options"]) expect(keys(local)).toContain(key);
    expect(keys(local)).not.toContain("Strict-Transport-Security");
    expect(keys({ ...local, https: true })).toContain("Strict-Transport-Security");
  });

  it("forwards request headers the same way NextResponse.next does", () => {
    const response = new Response(null);
    forwardRequestHeaders(response, new Headers({ "x-nonce": "n", cookie: "a=b" }));
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe("n");
    expect(response.headers.get("x-middleware-override-headers")).toBe("cookie,x-nonce");
  });

  it("keeps headers already forwarded by next-intl (the locale) and overrides only cookie/nonce/CSP", () => {
    const response = new Response(null);
    response.headers.set("x-middleware-override-headers", "cookie,x-next-intl-locale");
    response.headers.set("x-middleware-request-cookie", "old=1");
    response.headers.set("x-middleware-request-x-next-intl-locale", "fr");
    forwardRequestHeaders(response, new Headers({ cookie: "fresh=1", "x-nonce": "n", "x-next-intl-locale": "en" }));
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe("fr");
    expect(response.headers.get("x-middleware-request-cookie")).toBe("fresh=1");
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe("n");
  });
});
