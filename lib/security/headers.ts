/**
 * Security headers applied to every response (see next.config.ts).
 *
 * Known gap: script-src allows 'unsafe-inline' because the App Router emits
 * inline bootstrap scripts. A nonce-based CSP needs fully dynamic rendering;
 * it is tracked in docs/SECURITY.md.
 */
export type HeaderOptions = {
  /** next dev: React Refresh needs eval and a websocket. */
  development: boolean;
  /** Served over HTTPS (Vercel deployments). Enables HSTS and upgrade-insecure-requests. */
  https: boolean;
  /** Supabase project URL, allowed for browser auth/storage requests. */
  supabaseUrl?: string;
};

export function contentSecurityPolicy({ development, https, supabaseUrl }: HeaderOptions): string {
  const supabase = supabaseUrl ? [supabaseUrl, supabaseUrl.replace(/^http/, "ws")] : [];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
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

export function securityHeaders(options: HeaderOptions): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
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
