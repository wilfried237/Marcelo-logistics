import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { isAuthConfigured } from "@/lib/config/env";
import { linkErrorCode, safeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function localeFrom(next: string | null): string {
  const candidate = next?.split("/")[1];
  return (routing.locales as readonly string[]).includes(candidate ?? "") ? candidate! : routing.defaultLocale;
}

/**
 * Supabase email links (sign-up confirmation, password recovery, invitations)
 * return here with a PKCE `code` or a `token_hash`. The session is created
 * server-side, then the user is sent to a validated same-site path only.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next");
  const locale = localeFrom(next);
  const failWith = (code: "link_invalid" | "link_expired") => NextResponse.redirect(new URL(`/${locale}/login?error=${code}`, origin));
  const failure = failWith("link_invalid");
  if (!isAuthConfigured()) return failure;
  // Supabase redirects here with error parameters when a link is expired or already used.
  if (searchParams.get("error") || searchParams.get("error_code")) return failWith(linkErrorCode(searchParams));

  const supabase = await createSupabaseServerClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failWith(error.code === "flow_state_expired" || error.code === "otp_expired" ? "link_expired" : "link_invalid");
  } else if (tokenHash && (type === "signup" || type === "recovery" || type === "invite" || type === "email" || type === "magiclink")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return failWith(error.code === "otp_expired" ? "link_expired" : "link_invalid");
  } else {
    return failure;
  }

  const fallback = type === "recovery" || type === "invite" ? "/reset-password" : "/portal";
  return NextResponse.redirect(new URL(safeNextPath(next, locale, fallback), origin));
}
