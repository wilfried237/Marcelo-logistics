/**
 * Options for the Supabase session cookies (merged over @supabase/ssr defaults).
 *
 * - httpOnly: every auth flow runs on the server, so page scripts never need
 *   the session token; an XSS bug cannot read it. A future browser-side
 *   Supabase client would not see the session and must not rely on it.
 * - secure: on HTTPS deployments (Vercel), never sent over plain HTTP. Local
 *   development runs on http://localhost, where Secure cookies are not set.
 * - sameSite lax: sent on top-level navigation (email links work), not on
 *   cross-site subrequests.
 */
export function sessionCookieOptions(https = process.env.VERCEL === "1") {
  return { path: "/", sameSite: "lax", httpOnly: true, secure: https } as const;
}
