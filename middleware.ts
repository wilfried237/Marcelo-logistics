import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { refreshSupabaseSession } from "./lib/supabase/middleware";
import { contentSecurityPolicy, createNonce, forwardRequestHeaders } from "./lib/security/headers";

const handleI18nRouting = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // Per-request CSP nonce: Next.js reads it from the request's CSP header and
  // adds it to its own scripts; the same policy is sent to the browser.
  const nonce = createNonce();
  const csp = contentSecurityPolicy({
    nonce,
    development: process.env.NODE_ENV === "development",
    https: process.env.VERCEL === "1",
    supabaseUrl: process.env.SUPABASE_URL || undefined,
  });

  const response = handleI18nRouting(request);
  // Refresh first: it may update the request cookies that pages must see.
  await refreshSupabaseSession(request, response);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  // Redirects (e.g. "/" -> "/en") render nothing, so only rendered responses need the forwarded headers.
  if (response.status < 300 || response.status >= 400) forwardRequestHeaders(response, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Locale handling for pages only. Excluded:
  // - /api and /api/*  (route handlers must never be redirected to /{locale}/api)
  // - Next.js internals (/_next, /_vercel)
  // - any path containing a dot (static files such as /LOGO.png)
  // "api(?:/|$)" is deliberately strict so a future page such as /api-docs keeps locale handling.
  matcher: ["/((?!api(?:/|$)|_next|_vercel|.*\\..*).*)"],
};
