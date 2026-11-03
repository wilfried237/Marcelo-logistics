import { createHmac, timingSafeEqual } from "node:crypto";
import { getSiteUrl } from "@/lib/config/env";
import { QUOTE_REFERENCE_PATTERN } from "@/lib/domain/references";

/*
 * Signed quote links for customers without an account. A link carries the
 * request reference and an HMAC-SHA256 signature (192 bits, base64url) made
 * with QUOTE_LINK_SECRET, which never leaves the server. Nothing guessable is
 * stored; rotating the secret revokes every link at once. A valid link lets its
 * holder view the customer-visible quote, accept or decline it, and reply to an
 * information request; nothing else (no staff data, no other requests).
 */

const MIN_SECRET_LENGTH = 32;

function secret(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.QUOTE_LINK_SECRET;
  return value && value.length >= MIN_SECRET_LENGTH ? value : null;
}

export function quoteLinksEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return secret(env) !== null;
}

function signature(reference: string, key: string): string {
  return createHmac("sha256", key).update(`quote-link:v1:${reference}`).digest("base64url").slice(0, 32);
}

/** Token = reference + "." + signature, or null when links are not configured. */
export function createQuoteToken(reference: string, env: Record<string, string | undefined> = process.env): string | null {
  const key = secret(env);
  return key ? `${reference}.${signature(reference, key)}` : null;
}

/** Returns the reference for a genuine token, otherwise null (constant-time comparison). */
export function verifyQuoteToken(token: string, env: Record<string, string | undefined> = process.env): string | null {
  const key = secret(env);
  if (!key || typeof token !== "string" || token.length > 64) return null;
  const [reference, sig] = token.split(".");
  if (!reference || !sig || !QUOTE_REFERENCE_PATTERN.test(reference)) return null;
  const expected = Buffer.from(signature(reference, key));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? reference : null;
}

export function quoteLinkUrl(reference: string, locale: "en" | "fr", env: Record<string, string | undefined> = process.env): string | null {
  const token = createQuoteToken(reference, env);
  return token ? `${getSiteUrl(env)}/${locale}/quote/view/${token}` : null;
}
