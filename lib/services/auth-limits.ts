import type { Database } from "@/lib/db/types";
import { AUTH_LIMITS, hashKey, rateLimitHit } from "./rate-limit";

export type AuthAttempt = "login" | "register" | "reset";

/**
 * Application-level limits for authentication attempts, in addition to
 * Supabase Auth's own limits. Keys are hashed (never raw IPs or emails).
 * Fails closed: if the limiter cannot be consulted, the attempt is refused.
 */
export async function authAttemptAllowed(db: Database, attempt: AuthAttempt, clientId: string, email: string): Promise<boolean> {
  try {
    const perClient = await rateLimitHit(db, hashKey(`auth:${attempt}:client`, clientId), 600, AUTH_LIMITS.perClientPerTenMinutes);
    const perEmail =
      attempt === "reset"
        ? await rateLimitHit(db, hashKey("auth:reset:email", email), 3600, AUTH_LIMITS.resetPerEmailPerHour)
        : await rateLimitHit(db, hashKey(`auth:${attempt}:email`, email), 600, AUTH_LIMITS.perEmailPerTenMinutes);
    return perClient && perEmail;
  } catch (error) {
    console.error("auth rate limiter unavailable", error instanceof Error ? error.name : "unknown");
    return false;
  }
}
