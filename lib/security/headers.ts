/**
 * Security headers.
 *
 * The Content-Security-Policy is built per request in proxy.ts with a
 * fresh nonce: scripts run only if they carry that nonce (or were loaded by a
 * nonced script, via 'strict-dynamic'). There is no 'unsafe-inline' for
 * scripts in production. Next.js reads the nonce from the request's CSP header
 * and applies it to its own scripts, which requires dynamic rendering (the
 * root layout reads request headers).
 *
 * Remaining exception: style-src keeps 'unsafe-inline' because React and Radix
 * set inline style attributes; styles cannot execute code.
 */
export type HeaderOptions = {
  /** next dev: React Refresh needs eval and a websocket. */
  development: boolean;
  /** Served over HTTPS (Vercel deployments). Enables HSTS and upgrade-insecure-requests. */
  https: boolean;
  /** Supabase project URL, allowed for browser auth/storage requests. */
  supabaseUrl?: string;
};

export function contentSecurityPolicy({ development, https, supabaseUrl, nonce }: HeaderOptions & { nonce: string }): string {
  const supabase = supabaseUrl ? [supabaseUrl, supabaseUrl.replace(/^http/, "ws")] : [];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(development ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...supabase, ...(development ? ["ws:", "wss:"] : [])],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
  };
  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** A base64 nonce from 16 random bytes (Edge and Node runtimes). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Static headers for every response (next.config.ts). The CSP is added per request by proxy.ts. */
export function securityHeaders(options: HeaderOptions): { key: string; value: string }[] {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()",
    },
  ];
  if (options.https) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  return headers;
}

/**
 * Forwards modified request headers to the page render on a response built by
 * another middleware (next-intl). Same mechanism as NextResponse.next({ request: { headers } }).
 */
export function forwardRequestHeaders(response: Response, requestHeaders: Headers, override: readonly string[] = ["cookie", "x-nonce", "content-security-policy"]): void {
  // Keep headers another middleware already forwards (next-intl passes the
  // locale this way); only the headers in `override` replace its values.
  const merged = new Headers();
  for (const key of response.headers.get("x-middleware-override-headers")?.split(",").filter(Boolean) ?? []) {
    const value = response.headers.get(`x-middleware-request-${key}`);
    if (value !== null) merged.set(key, value);
  }
  for (const [key, value] of requestHeaders) if (!merged.has(key) || override.includes(key)) merged.set(key, value);

  const keys: string[] = [];
  for (const [key, value] of merged) {
    response.headers.set(`x-middleware-request-${key}`, value);
    keys.push(key);
  }
  response.headers.set("x-middleware-override-headers", keys.join(","));
}
