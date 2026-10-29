import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session cookie on the response produced by the locale
 * middleware. Authorisation is NOT decided here; pages and actions call
 * requireUser/requireRole on the server.
 */
export async function refreshSupabaseSession(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Validates and, if needed, refreshes the access token.
  await supabase.auth.getUser();
  return response;
}
