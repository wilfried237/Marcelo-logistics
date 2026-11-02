import "server-only";
import { z } from "zod";
import { isEnabled } from "./flags";
import { resolveDatabaseUrls } from "@/lib/db/connection.mjs";

/**
 * Server configuration, validated at the server boundary where it is used.
 * Errors name the missing variable, never its value.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

type Env = Record<string, string | undefined>;

const url = z.string().url();
const postgresUrl = z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL");

function read<T>(schema: z.ZodType<T>, name: string, env: Env): T {
  const value = env[name];
  if (value === undefined || value === "") throw new ConfigurationError(`${name} is not set`);
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ConfigurationError(`${name} is invalid (${parsed.error.issues[0]?.message ?? "bad value"})`);
  return parsed.data;
}

/** POSTGRES_URL (Vercel Supabase integration) or DATABASE_URL. */
export function isDatabaseConfigured(env: Env = process.env): boolean {
  return Boolean(resolveDatabaseUrls(env).app);
}

export function getDatabaseUrl(env: Env = process.env): string {
  return read(postgresUrl, "DATABASE_URL", { DATABASE_URL: resolveDatabaseUrls(env).app });
}

export function isAuthConfigured(env: Env = process.env): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

export function getSupabasePublicConfig(env: Env = process.env) {
  return { url: read(url, "SUPABASE_URL", env), anonKey: read(z.string().min(20), "SUPABASE_ANON_KEY", env) };
}

/** Service-role key: bypasses RLS. Server-only, never logged, never sent to browsers. */
export function getServiceRoleKey(env: Env = process.env): string {
  return read(z.string().min(20), "SUPABASE_SERVICE_ROLE_KEY", env);
}

export function isStorageConfigured(env: Env = process.env): boolean {
  return isAuthConfigured(env) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSiteUrl(env: Env = process.env): string {
  return read(url, "SITE_URL", { SITE_URL: env.SITE_URL || "http://localhost:3000" }).replace(/\/$/, "");
}

export type EmailTransport = { kind: "resend"; apiKey: string; from: string } | { kind: "log" } | { kind: "disabled"; reason: string };

/**
 * Real email requires the flag, an API key and a verified sender (C-02).
 * In non-production builds, EMAIL_DEV_LOG=true records emails without sending.
 */
export function getEmailTransport(env: Env = process.env): EmailTransport {
  if (isEnabled("ENABLE_TRANSACTIONAL_EMAIL", env)) {
    if (!env.RESEND_API_KEY) return { kind: "disabled", reason: "RESEND_API_KEY is not set" };
    if (!env.EMAIL_FROM) return { kind: "disabled", reason: "EMAIL_FROM is not set" };
    return { kind: "resend", apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM };
  }
  if (env.NODE_ENV !== "production" && env.EMAIL_DEV_LOG === "true") return { kind: "log" };
  return { kind: "disabled", reason: "ENABLE_TRANSACTIONAL_EMAIL is not true" };
}

/**
 * Online quote submission is offered only when every prerequisite holds:
 * the flag, a database (persistent storage and rate limiting) and a working
 * acknowledgement email channel.
 */
export function quoteSubmissionStatus(env: Env = process.env): { available: true } | { available: false; reason: string } {
  if (!isEnabled("ENABLE_QUOTE_SUBMISSION", env)) return { available: false, reason: "flag_disabled" };
  if (!isDatabaseConfigured(env)) return { available: false, reason: "database_not_configured" };
  if (getEmailTransport(env).kind === "disabled") return { available: false, reason: "email_not_configured" };
  return { available: true };
}

/** Document uploads need Storage (service role) and the explicit flag (retention policy L-03). */
export function documentUploadsAvailable(env: Env = process.env): boolean {
  return isEnabled("ENABLE_DOCUMENT_UPLOADS", env) && isStorageConfigured(env) && isDatabaseConfigured(env);
}
