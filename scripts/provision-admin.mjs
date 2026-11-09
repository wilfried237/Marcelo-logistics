#!/usr/bin/env node
// Creates the FIRST administrator, once. Operator-only command-line tool: no web
// route, no API, nothing in the deployed application can run it.
//
//   node scripts/provision-admin.mjs --email owner@example.com [--locale fr]            (dry run: prints the plan)
//   node scripts/provision-admin.mjs --email owner@example.com [--locale fr] --apply    (does it)
//
// Why it exists: every later role change goes through the admin dashboard
// (setUserRole -> public.admin_set_user_role), which requires an existing
// administrator. The very first one therefore needs a trusted, server-side path.
//
// Safety:
// - Never runs on Vercel or in the app. Reads secrets from the environment
//   (.env.local / shell) and never prints them.
// - Local Supabase only, unless ALLOW_PROVISION_HOSTS lists BOTH the Supabase API
//   host and the database host exactly (owner approval, see docs/runbooks/first-admin.md).
// - Hosted: the API host, the database (host or pooler user) and --project-ref must all
//   name the same project; secrets must come from the shell, never from .env files; a
//   legacy JWT key must be a service_role key of that project; the key is checked
//   read-only against the Auth API before any change. Mixed local/hosted targets are refused.
// - Refuses if ANY administrator already exists (re-checked under the same
//   advisory lock as admin_set_user_role, so it cannot race the dashboard).
//   Further staff and administrators are invited from the dashboard.
// - No password is ever chosen or seen by the operator: a new user receives a
//   Supabase invitation email and sets their own password. An existing user is
//   promoted without any email.
// - The role change uses the database's trusted path (app.role_change), the
//   same one admin_set_user_role uses, and is recorded by the audit trigger.
import { pathToFileURL } from "node:url";
import { pgConnectionOptions, resolveDatabaseUrls } from "../lib/db/connection.mjs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** "owner.name@example.com" -> "o***@example.com" (logs never carry the full address). */
export function mask(email) {
  const [local, domain] = String(email).split("@");
  return `${(local ?? "").slice(0, 1)}***@${domain ?? ""}`;
}

/**
 * Decides whether this environment may be targeted. Returns the hosts (no secrets) or an error.
 * @param {Record<string, string | undefined>} env
 * @param {{ projectRef?: string, shellEnv?: Record<string, string | undefined> }} [options]
 */
export function checkTargets(env, options = {}) {
  if (env.VERCEL === "1" || env.VERCEL_ENV) return { ok: false, error: "refusing to run on Vercel: this is an operator command, run it from a trusted machine" };
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const dbUrl = resolveDatabaseUrls(env).direct;
  const missing = [!supabaseUrl && "SUPABASE_URL", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY", !dbUrl && "DIRECT_URL (or POSTGRES_URL_NON_POOLING)"].filter(Boolean);
  if (missing.length) return { ok: false, error: `missing environment: ${missing.join(", ")}` };
  let apiHost, dbHost;
  try {
    apiHost = new URL(supabaseUrl).hostname;
    dbHost = new URL(dbUrl).hostname;
  } catch {
    return { ok: false, error: "SUPABASE_URL or the database URL is not a valid URL" };
  }
  const allowed = new Set((env.ALLOW_PROVISION_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean));
  const blocked = [apiHost, dbHost].filter((h) => !LOCAL_HOSTS.has(h) && !allowed.has(h));
  if (blocked.length) {
    return { ok: false, error: `refusing non-local host(s): ${blocked.join(", ")}. After owner approval, set ALLOW_PROVISION_HOSTS to the exact host names (Supabase API and database).` };
  }
  const apiLocal = LOCAL_HOSTS.has(apiHost);
  const dbLocal = LOCAL_HOSTS.has(dbHost);
  // A half-local target would send a production invitation and then change a local database (or the reverse).
  if (apiLocal !== dbLocal) return { ok: false, error: "refusing mixed targets: the Supabase API and the database must both be local or both be the same hosted project" };
  if (apiLocal) return { ok: true, apiHost, dbHost, local: true, supabaseUrl, serviceKey, dbUrl };

  // Hosted project: every secret must come from the operator's shell, never from .env files,
  // so a forgotten variable cannot silently fall back to a local or stale value.
  if (options.shellEnv) {
    const dbVar = env.POSTGRES_URL_NON_POOLING?.trim() ? "POSTGRES_URL_NON_POOLING" : "DIRECT_URL";
    const fromFile = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", dbVar].filter((name) => options.shellEnv[name] !== env[name]);
    if (fromFile.length) return { ok: false, error: `for a hosted project, set these in the shell (not in .env files): ${fromFile.join(", ")}` };
  }
  // The API host, the database and the operator's --project-ref must name the same project.
  const apiRef = /^([a-z0-9]{20})\.supabase\.co$/.exec(apiHost)?.[1];
  let dbUser = "";
  try {
    dbUser = decodeURIComponent(new URL(dbUrl).username);
  } catch {
    // handled below
  }
  const dbRef = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(dbHost)?.[1] ?? /^postgres\.([a-z0-9]{20})$/.exec(dbUser)?.[1];
  if (!apiRef || !dbRef) return { ok: false, error: "cannot identify the Supabase project from SUPABASE_URL and the database URL (expected <ref>.supabase.co and db.<ref>.supabase.co or user postgres.<ref>)" };
  if (apiRef !== dbRef) return { ok: false, error: `project mismatch: the API is project ${apiRef}, the database is project ${dbRef}` };
  if (!options.projectRef) return { ok: false, error: "for a hosted project, --project-ref <ref> is required (Supabase → Project Settings → General → Project ID)" };
  if (options.projectRef !== apiRef) return { ok: false, error: `--project-ref ${options.projectRef} does not match the configured project ${apiRef}` };
  // Legacy JWT service keys carry their project and role; the newer sb_secret_ keys are checked against the API in main().
  if (serviceKey.startsWith("eyJ")) {
    let claims = {};
    try {
      claims = JSON.parse(Buffer.from(serviceKey.split(".")[1] ?? "", "base64url").toString("utf8"));
    } catch {
      return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not a valid key" };
    }
    if (claims.role !== "service_role") return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not a service_role key" };
    if (claims.ref && claims.ref !== apiRef) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belongs to a different project" };
  }
  return { ok: true, apiHost, dbHost, local: false, projectRef: apiRef, supabaseUrl, serviceKey, dbUrl };
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const out = { email: "", locale: "en", apply: false, projectRef: "" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") out.apply = true;
    else if (arg === "--email") out.email = String(argv[++i] ?? "").trim().toLowerCase();
    else if (arg.startsWith("--email=")) out.email = arg.slice(8).trim().toLowerCase();
    else if (arg === "--locale") out.locale = String(argv[++i] ?? "");
    else if (arg.startsWith("--locale=")) out.locale = arg.slice(9);
    else if (arg === "--project-ref") out.projectRef = String(argv[++i] ?? "").trim();
    else if (arg.startsWith("--project-ref=")) out.projectRef = arg.slice(14).trim();
    else return { error: `unknown argument: ${arg}` };
  }
  if (!EMAIL_RE.test(out.email) || out.email.length > 254) return { error: "--email must be a valid email address" };
  if (!["en", "fr"].includes(out.locale)) return { error: "--locale must be en or fr" };
  if (out.projectRef && !/^[a-z0-9]{20}$/.test(out.projectRef)) return { error: "--project-ref must be the 20-character Supabase project ID" };
  return out;
}

async function adminCount(db) {
  const { rows } = await db.query("select count(*)::int as n from public.profiles where role = 'admin'");
  return rows[0].n;
}

/**
 * The provisioning itself. Dependencies are injected so tests can run it against local Supabase.
 * @param {{ email: string, locale: "en" | "fr", apply: boolean, siteUrl: string,
 *           db: import("pg").Client, auth: { inviteUserByEmail: Function } }} input
 * @returns {Promise<{ status: "refused" | "planned" | "provisioned", reason?: string, action?: "invite" | "promote", userId?: string }>}
 */
export async function provisionFirstAdmin({ email, locale, apply, siteUrl, db, auth }) {
  if ((await adminCount(db)) > 0) return { status: "refused", reason: "an administrator already exists; invite further staff from the admin dashboard" };

  const { rows: existing } = await db.query("select id from auth.users where lower(email) = lower($1) limit 1", [email]);
  const action = existing.length ? "promote" : "invite";
  if (!apply) return { status: "planned", action };

  let userId = existing[0]?.id;
  if (!userId) {
    // Same redirect as the dashboard invitation: the link opens the "choose a password" page.
    const { data, error } = await auth.inviteUserByEmail(email, {
      redirectTo: `${siteUrl.replace(/\/$/, "")}/api/auth/callback?next=${encodeURIComponent(`/${locale}/reset-password`)}`,
      data: { locale },
    });
    if (error || !data?.user?.id) return { status: "refused", reason: `invitation failed: ${error?.message ?? "no user returned"}` };
    userId = data.user.id;
  }

  await db.query("begin");
  try {
    // Same lock as public.admin_set_user_role: no concurrent role change can interleave.
    await db.query("select pg_advisory_xact_lock(hashtext('public.admin_set_user_role'))");
    if ((await adminCount(db)) > 0) {
      await db.query("rollback");
      return { status: "refused", reason: "an administrator was created meanwhile; nothing changed", userId };
    }
    const { rows } = await db.query("select role from public.profiles where id = $1 for update", [userId]);
    if (!rows.length) throw new Error("profile missing for the auth user (app_on_auth_user_created trigger not installed?)");
    await db.query("select set_config('app.role_change', 'allowed', true)");
    await db.query("update public.profiles set role = 'admin' where id = $1", [userId]);
    await db.query("select set_config('app.role_change', '', true)");
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
  return { status: "provisioned", action, userId };
}

async function main() {
  // Snapshot before .env files are read: hosted runs must use shell values only (see checkTargets).
  const shellEnv = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // optional
    }
  }
  const args = parseArgs(process.argv.slice(2));
  if ("error" in args) {
    console.error(`provision-admin: ${args.error}\nUsage: node scripts/provision-admin.mjs --email <address> [--locale en|fr] [--project-ref <ref>] [--apply]`);
    process.exit(2);
  }
  const target = checkTargets(process.env, { projectRef: args.projectRef, shellEnv });
  if (!target.ok) {
    console.error(`provision-admin: ${target.error}`);
    process.exit(1);
  }
  const siteUrl = process.env.SITE_URL?.trim();
  if (!siteUrl || (!target.local && !siteUrl.startsWith("https://"))) {
    console.error("provision-admin: SITE_URL must be set (https:// for a hosted project); the invitation link is built from it.");
    process.exit(1);
  }

  const { default: pg } = await import("pg");
  const { createClient } = await import("@supabase/supabase-js");
  const db = new pg.Client(pgConnectionOptions(target.dbUrl));
  await db.connect();
  try {
    const supabase = createClient(target.supabaseUrl, target.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    // Read-only preflight: this project's Auth API must accept the service key before anything else happens.
    const preflight = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (preflight.error) {
      console.error("provision-admin: the service key was rejected by this project's Supabase Auth API; nothing changed.");
      process.exit(1);
    }
    console.log(`provision-admin: target ${target.local ? "LOCAL" : `HOSTED project ${target.projectRef}`} (api ${target.apiHost}, db ${target.dbHost}); account ${mask(args.email)}; ${args.apply ? "APPLY" : "dry run"}`);
    const result = await provisionFirstAdmin({ ...args, siteUrl, db, auth: supabase.auth.admin });
    if (result.status === "refused") {
      console.error(`provision-admin: refused: ${result.reason}`);
      process.exit(1);
    }
    if (result.status === "planned") {
      console.log(
        result.action === "invite"
          ? "provision-admin: plan: send a Supabase invitation to this address, then give the new account the admin role. Re-run with --apply."
          : "provision-admin: plan: the account already exists; give it the admin role (no email is sent). Re-run with --apply.",
      );
      return;
    }
    console.log(
      result.action === "invite"
        ? "provision-admin: done. Invitation sent; the account has the admin role. The owner opens the email link, chooses a password, then signs in at /<locale>/login."
        : "provision-admin: done. The existing account now has the admin role.",
    );
  } finally {
    await db.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    // Error messages from pg/supabase-js never include credentials; the URL is not printed.
    console.error(`provision-admin: failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exit(1);
  });
}
