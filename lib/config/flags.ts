/**
 * Feature flags. Every flag defaults to OFF: only the exact string "true" enables it.
 *
 * A flag is NOT an authorisation mechanism. Code behind a flag must still enforce
 * authentication, authorisation, ownership and validation on its own.
 */
export const FLAG_NAMES = [
  "ENABLE_QUOTE_SUBMISSION",
  "ENABLE_DEMO_DATA",
  "ENABLE_PREVIEW_AREAS",
  "ENABLE_TRANSACTIONAL_EMAIL",
  "ENABLE_CUSTOMER_REGISTRATION",
] as const;

export type FlagName = (typeof FLAG_NAMES)[number];

type Env = Record<string, string | undefined>;

export function isEnabled(name: FlagName, env: Env = process.env): boolean {
  return env[name] === "true";
}

/** Demo data is never served by a production build, whatever the flag says. */
export function isDemoDataEnabled(env: Env = process.env): boolean {
  return isEnabled("ENABLE_DEMO_DATA", env) && env.NODE_ENV !== "production";
}
