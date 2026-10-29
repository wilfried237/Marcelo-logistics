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
