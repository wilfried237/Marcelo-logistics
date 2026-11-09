import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { checkTargets, parseArgs, provisionFirstAdmin } from "../../scripts/provision-admin.mjs";
import { DATABASE_URL, adminClient, createUser, sql, uniqueEmail } from "./env";

/*
 * First-administrator provisioning against the REAL local Supabase stack.
 * The script refuses when any administrator exists, so the existing local
 * administrators are demoted for the duration of this file and restored after.
 */

let demoted: string[] = [];
let db: pg.Client;
const SITE = "http://localhost:3000";

async function setRoles(ids: string[], role: "admin" | "customer") {
  if (!ids.length) return;
  await db.query("begin");
  await db.query("select set_config('app.role_change', 'allowed', true)");
  await db.query("update public.profiles set role = $2 where id = any($1::uuid[])", [ids, role]);
  await db.query("commit");
}

beforeAll(async () => {
  db = new pg.Client({ connectionString: DATABASE_URL });
  await db.connect();
  demoted = (await db.query<{ id: string }>("select id from public.profiles where role = 'admin'")).rows.map((r) => r.id);
  await setRoles(demoted, "customer");
});

afterAll(async () => {
  // Remove admins created here, then restore the original ones.
  const created = (await db.query<{ id: string }>("select id from public.profiles where role = 'admin'")).rows.map((r) => r.id).filter((id) => !demoted.includes(id));
  await setRoles(created, "customer");
  await setRoles(demoted, "admin");
  await db.end();
});

describe("first administrator provisioning (scripts/provision-admin.mjs)", () => {
  it("guards: never on Vercel, never a hosted project without an exact allow-list, all secrets required", () => {
    const local = { SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "k", DIRECT_URL: "postgresql://u:p@127.0.0.1:54322/postgres" };
    expect(checkTargets(local).ok).toBe(true);
    expect(checkTargets({ ...local, VERCEL: "1" }).ok).toBe(false);
    expect(checkTargets({ ...local, VERCEL_ENV: "production" }).ok).toBe(false);
    expect(checkTargets({ ...local, SUPABASE_SERVICE_ROLE_KEY: "" }).ok).toBe(false);
    const REF = "abcdefghij0123456789";
    const OTHER = "zzzzzzzzzz0123456789";
    const POOLER = "aws-0-eu-west-1.pooler.supabase.com";
    const hosted = {
      SUPABASE_URL: `https://${REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x",
      DIRECT_URL: `postgresql://postgres.${REF}:p@${POOLER}:5432/postgres`,
      ALLOW_PROVISION_HOSTS: `${REF}.supabase.co,${POOLER}`,
    };
    const opts = { projectRef: REF, shellEnv: hosted };
    expect(checkTargets(hosted, opts).ok).toBe(true);
    expect(checkTargets({ ...hosted, ALLOW_PROVISION_HOSTS: "" }, { ...opts, shellEnv: { ...hosted, ALLOW_PROVISION_HOSTS: "" } }).ok).toBe(false);
    expect(checkTargets({ ...hosted, ALLOW_PROVISION_HOSTS: `${REF}.supabase.co` }, opts).ok).toBe(false); // both hosts required
    // The operator must name the project, and it must be the one configured.
    expect(checkTargets(hosted, { shellEnv: hosted }).ok).toBe(false);
    expect(checkTargets(hosted, { ...opts, projectRef: OTHER }).ok).toBe(false);
    // API and database of different projects.
    const mismatch = { ...hosted, DIRECT_URL: `postgresql://postgres.${OTHER}:p@${POOLER}:5432/postgres` };
    expect(checkTargets(mismatch, { projectRef: REF, shellEnv: mismatch }).error).toMatch(/project mismatch/);
    // Hosted API with a local database (a variable forgotten in the shell, filled from .env.local).
    const mixed = { ...hosted, DIRECT_URL: "postgresql://u:p@127.0.0.1:54322/postgres" };
    expect(checkTargets(mixed, { projectRef: REF, shellEnv: mixed }).error).toMatch(/mixed targets/);
    // A secret that came from a .env file rather than the shell.
    const shellWithoutDb: Record<string, string> = { ...hosted };
    delete shellWithoutDb.DIRECT_URL;
    expect(checkTargets(hosted, { projectRef: REF, shellEnv: shellWithoutDb }).error).toMatch(/set these in the shell/);
    // Legacy JWT keys: must be service_role of the same project.
    const jwt = (claims: object) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
    const withKey = (key: string) => ({ ...hosted, SUPABASE_SERVICE_ROLE_KEY: key });
    expect(checkTargets(withKey(jwt({ role: "service_role", ref: REF })), { projectRef: REF, shellEnv: withKey(jwt({ role: "service_role", ref: REF })) }).ok).toBe(true);
    expect(checkTargets(withKey(jwt({ role: "anon", ref: REF })), { projectRef: REF, shellEnv: withKey(jwt({ role: "anon", ref: REF })) }).ok).toBe(false);
    expect(checkTargets(withKey(jwt({ role: "service_role", ref: OTHER })), { projectRef: REF, shellEnv: withKey(jwt({ role: "service_role", ref: OTHER })) }).ok).toBe(false);
    // Never echoes credentials in any refusal.
    for (const r of [checkTargets(mismatch, { projectRef: REF, shellEnv: mismatch }), checkTargets(mixed, { projectRef: REF, shellEnv: mixed })]) {
      expect(JSON.stringify(r)).not.toMatch(/:p@|sb_secret/);
    }
  });

  it("validates arguments: a real address, en/fr only, dry run unless --apply", () => {
    expect(parseArgs(["--email", "Owner@Example.com"])).toEqual({ email: "owner@example.com", locale: "en", apply: false, projectRef: "" });
    expect(parseArgs(["--email=o@x.ie", "--locale=fr", "--apply", "--project-ref", "abcdefghij0123456789"])).toEqual({ email: "o@x.ie", locale: "fr", apply: true, projectRef: "abcdefghij0123456789" });
    expect(parseArgs(["--email", "o@x.ie", "--project-ref", "short"])).toHaveProperty("error");
    expect(parseArgs(["--email", "not-an-email"])).toHaveProperty("error");
    expect(parseArgs(["--email", "o@x.ie", "--locale", "de"])).toHaveProperty("error");
    expect(parseArgs(["--email", "o@x.ie", "--role", "admin"])).toHaveProperty("error");
  });

  it("dry run changes nothing and sends nothing", async () => {
    const email = uniqueEmail("first.admin.dry");
    const result = await provisionFirstAdmin({ email, locale: "en", apply: false, siteUrl: SITE, db, auth: adminClient().auth.admin });
    expect(result).toEqual({ status: "planned", action: "invite" });
    expect(await sql("select 1 from auth.users where email = $1", [email])).toHaveLength(0);
  });

  it("invites a new address and gives it the admin role; then refuses any second run", async () => {
    const email = uniqueEmail("first.admin");
    const result = await provisionFirstAdmin({ email, locale: "fr", apply: true, siteUrl: SITE, db, auth: adminClient().auth.admin });
    expect(result.status).toBe("provisioned");
    expect(result.action).toBe("invite");
    const [row] = await sql<{ role: string; invited_at: Date | null; encrypted_password: string | null }>(
      "select p.role, u.invited_at, u.encrypted_password from public.profiles p join auth.users u on u.id = p.id where u.email = $1",
      [email],
    );
    expect(row.role).toBe("admin");
    expect(row.invited_at).not.toBeNull(); // the owner sets their own password from the invitation
    expect(row.encrypted_password ?? "").toBe("");
    // The role change went through the audited trusted path.
    expect(await sql("select 1 from public.audit_log where entity = 'profiles' and entity_id = $1", [result.userId])).not.toHaveLength(0);

    const again = await provisionFirstAdmin({ email: uniqueEmail("second.admin"), locale: "en", apply: true, siteUrl: SITE, db, auth: adminClient().auth.admin });
    expect(again.status).toBe("refused");
    expect(await sql("select count(*)::int as n from public.profiles where role = 'admin'")).toEqual([{ n: 1 }]);
  });

  it("promotes an existing account without sending an invitation (when no administrator exists)", async () => {
    const created = (await db.query<{ id: string }>("select id from public.profiles where role = 'admin'")).rows.map((r) => r.id);
    await setRoles(created, "customer");
    const user = await createUser("customer", "existing.owner");
    let invited = false;
    const auth = { inviteUserByEmail: async () => ((invited = true), { data: null, error: { message: "should not be called" } }) };
    const result = await provisionFirstAdmin({ email: user.email.toUpperCase(), locale: "en", apply: true, siteUrl: SITE, db, auth });
    expect(result).toMatchObject({ status: "provisioned", action: "promote", userId: user.id });
    expect(invited).toBe(false);
  });

  it("customers still cannot raise their own role (the trigger blocks it outside the trusted path)", async () => {
    const user = await createUser("customer", "self.elevate");
    await expect(sql("update public.profiles set role = 'admin' where id = $1", [user.id])).rejects.toThrow(/role_change_forbidden/);
  });
});
