import pg from "pg";

/**
 * Test-only helpers for the full-stack suites (local Supabase database only;
 * playwright.fullstack.config.ts refuses any non-local DIRECT_URL).
 */

/**
 * Clears the application's sign-in rate-limit counters. Every local request
 * shares one client identifier, so suites that sign in many times would
 * otherwise trip the (intended) per-client login limit for the suites after
 * them. The limiter itself is unchanged and is exercised by its own tests.
 */
export async function resetLocalLoginLimits(): Promise<void> {
  const url = process.env.DIRECT_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error("resetLocalLoginLimits: local database only");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("delete from public.rate_limits where key like 'auth:login:%'");
  } finally {
    await client.end();
  }
}
