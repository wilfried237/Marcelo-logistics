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
    const hosted = { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", DIRECT_URL: "postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" };
    expect(checkTargets(hosted).ok).toBe(false);
    expect(checkTargets({ ...hosted, ALLOW_PROVISION_HOSTS: "abc.supabase.co" }).ok).toBe(false); // both hosts required
    expect(checkTargets({ ...hosted, ALLOW_PROVISION_HOSTS: "abc.supabase.co,aws-0-eu-west-1.pooler.supabase.com" }).ok).toBe(true);
    const refused = checkTargets(hosted);
    expect(JSON.stringify(refused)).not.toContain("u:p@"); // never echoes credentials
  });

  it("validates arguments: a real address, en/fr only, dry run unless --apply", () => {
    expect(parseArgs(["--email", "Owner@Example.com"])).toEqual({ email: "owner@example.com", locale: "en", apply: false });
    expect(parseArgs(["--email=o@x.ie", "--locale=fr", "--apply"])).toEqual({ email: "o@x.ie", locale: "fr", apply: true });
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
