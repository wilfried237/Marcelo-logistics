import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { refreshSupabaseSession } from "./lib/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);
  return refreshSupabaseSession(request, response);
}

export const config = {
  // Locale handling for pages only. Excluded:
  // - /api and /api/*  (route handlers must never be redirected to /{locale}/api)
  // - Next.js internals (/_next, /_vercel)
  // - any path containing a dot (static files such as /LOGO.png)
  // "api(?:/|$)" is deliberately strict so a future page such as /api-docs keeps locale handling.
  matcher: ["/((?!api(?:/|$)|_next|_vercel|.*\\..*).*)"],
};
