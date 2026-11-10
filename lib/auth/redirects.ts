import { routing } from "@/i18n/routing";

const ALLOWED_PREFIXES = ["/portal", "/admin", "/reset-password"];

/**
 * Validates a post-login redirect target. Only same-site, locale-prefixed paths
 * into known areas are accepted; anything else falls back to the default.
 * Blocks open redirects such as "//evil.example", "https://…", "/\evil".
 */
export function safeNextPath(next: unknown, locale: string, fallback = "/portal"): string {
  const fallbackPath = `/${locale}${fallback}`;
  if (typeof next !== "string" || next.length > 300) return fallbackPath;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallbackPath;
  const match = /^\/([a-z]{2})(\/[^?#]*)?(\?[^#]*)?$/.exec(next);
  if (!match || !(routing.locales as readonly string[]).includes(match[1])) return fallbackPath;
  const path = match[2] ?? "/";
  if (!ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return fallbackPath;
  return next;
}

/**
 * Why an email link (invitation, recovery, sign-up confirmation) could not be
 * used, from the parameters Supabase adds when it redirects back with an error
 * (e.g. `error=access_denied&error_code=otp_expired`). Only two outcomes are
 * shown to people, and neither reveals whether an account exists:
 * - "link_expired": the link was valid but is too old or was already used;
 * - "link_invalid": anything else (malformed, tampered, unknown).
 */
export function linkErrorCode(params: { get(name: string): string | null }): "link_expired" | "link_invalid" {
  const code = params.get("error_code") ?? "";
  return code === "otp_expired" || code === "flow_state_expired" ? "link_expired" : "link_invalid";
}

/** Login page error codes that may be shown from the URL (anything else is ignored). */
export const LOGIN_URL_ERRORS = ["link_invalid", "link_expired"] as const;
export type LoginUrlError = (typeof LOGIN_URL_ERRORS)[number];
export function loginUrlError(value: unknown): LoginUrlError | null {
  return (LOGIN_URL_ERRORS as readonly unknown[]).includes(value) ? (value as LoginUrlError) : null;
}
