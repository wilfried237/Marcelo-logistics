#!/usr/bin/env node
// Keeps the production database schema in step with the code on every Vercel
// production deployment (owner approval recorded in docs/DECISIONS-REQUIRED.md, R-02).
//
// Runs as `postbuild`, so it only starts after `next build` has succeeded. It
// applies pending migrations with `prisma migrate deploy` (never `db push` or
// `migrate dev`); a failure fails the deployment, so new code never goes live
// against an out-of-date schema. Migrations are additive (a test forbids
// destructive SQL), so the previous deployment keeps working meanwhile.
//
// - Vercel preview, local and CI builds: skipped. Previews must never touch the
//   production database, even if they share environment variables.
// - Vercel production without any database configured: skipped with a warning.
// - Vercel production with a database: a session connection is required:
//   POSTGRES_URL_NON_POOLING (set by the Vercel Supabase integration) or
//   DIRECT_URL (Supabase "Session pooler", port 5432), never the transaction
//   pooler (port 6543).
import { spawnSync } from "node:child_process";
import { resolveDatabaseUrls } from "../lib/db/connection.mjs";

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ action: "skip" | "migrate" | "fail", reason: string, host?: string }}
 */
export function planDeployMigration(env) {
  if (env.VERCEL !== "1" || env.VERCEL_ENV !== "production") return { action: "skip", reason: "not a Vercel production build" };
  const { app, direct } = resolveDatabaseUrls(env);
  if (!direct && !app) return { action: "skip", reason: "no database configured for production" };
  if (!direct) return { action: "fail", reason: "a database URL is set but no session connection; connect the Vercel Supabase integration (POSTGRES_URL_NON_POOLING) or set DIRECT_URL (Supabase Session pooler, port 5432)" };
  let url;
  try {
    url = new URL(direct);
  } catch {
    return { action: "fail", reason: "the session connection URL is not a valid URL (check for a [YOUR-PASSWORD] placeholder)" };
  }
  if (url.port === "6543") return { action: "fail", reason: "the session connection points at the transaction pooler (port 6543); use the Session pooler (port 5432) for migrations" };
  if (/YOUR-PASSWORD|%5BYOUR/i.test(url.password)) return { action: "fail", reason: "the session connection still contains the [YOUR-PASSWORD] placeholder" };
  return { action: "migrate", reason: "Vercel production build", host: url.hostname };
}

function main() {
  const plan = planDeployMigration(process.env);
  if (plan.action === "skip") {
    console.log(`deploy-migrate: skipped (${plan.reason}).`);
    return;
  }
  if (plan.action === "fail") {
    console.error(`deploy-migrate: ${plan.reason}. See docs/DEPLOYMENT.md.`);
    process.exit(1);
  }
  console.log(`deploy-migrate: applying pending migrations to ${plan.host} (credentials are never printed).`);
  // Reuses the guarded migration script; the production host is allowed explicitly here.
  const result = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    stdio: "inherit",
    env: { ...process.env, ALLOW_MIGRATE_HOST: plan.host },
  });
  if (result.status !== 0) {
    console.error(
      "deploy-migrate: migration failed, so this deployment is stopped.\n" +
        "If the error is a connection timeout, DIRECT_URL probably uses the IPv6-only direct host (db.<project>.supabase.co);\n" +
        "Vercel needs the Supabase Session pooler connection string (IPv4, port 5432). See docs/DEPLOYMENT.md.",
    );
    process.exit(result.status ?? 1);
  }
}

if (process.argv[1]?.endsWith("deploy-migrate.mjs")) main();
