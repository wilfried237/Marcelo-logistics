import { describe, expect, it } from "vitest";
import pg from "pg";
import { DATABASE_URL, PASSWORD, adminClient, anonClient, createUser, signIn, sql, uniqueEmail } from "./env";

/* Executed against the REAL local Supabase stack: GoTrue, PostgREST, Storage, Postgres 17, Mailpit. */

const MAILPIT = "http://127.0.0.1:54324";

/** HTML of the latest email sent to the address by the local GoTrue (captured by Mailpit, never delivered). */
async function confirmationEmail(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const list = (await res.json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) return ((await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML: string }).HTML;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email for ${to}`);
}

describe("Supabase Auth (local GoTrue)", () => {
  // C-03 (2026-11-04): open customer registration with mandatory email verification.
  it("open sign-up: unverified until the emailed cross-device link is used, then signs in", async () => {
    const email = uniqueEmail("signup");
    const redirect = "http://localhost:3000/api/auth/callback?next=%2Fen%2Fportal";
    const { data, error } = await anonClient().auth.signUp({ email, password: PASSWORD, options: { emailRedirectTo: redirect, data: { full_name: "Open Signup", locale: "en" } } });
    expect(error).toBeNull();
    expect(data.session).toBeNull(); // no session before verification
    expect(data.user?.email_confirmed_at ?? null).toBeNull();

    const before = await anonClient().auth.signInWithPassword({ email, password: PASSWORD });
    expect(before.error).not.toBeNull(); // "Email not confirmed"

    const html = await confirmationEmail(email);
    expect(html).toContain("Confirm your email address");
    const href = /href="([^"]*token_hash=[^"]*)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
    expect(href).toBeDefined();
    const link = new URL(href as string);
    expect(link.origin + link.pathname).toBe("http://localhost:3000/api/auth/callback"); // our callback, not the Supabase host
    expect(link.searchParams.get("next")).toBe("/en/portal");
    expect(link.searchParams.get("type")).toBe("email");

    const verified = await anonClient().auth.verifyOtp({ type: "email", token_hash: link.searchParams.get("token_hash") as string });
    expect(verified.error).toBeNull();
    expect(verified.data.user?.email_confirmed_at).toBeTruthy();
    const reused = await anonClient().auth.verifyOtp({ type: "email", token_hash: link.searchParams.get("token_hash") as string });
    expect(reused.error).not.toBeNull(); // one-time link

    const client = await signIn(email);
    const { data: me } = await client.auth.getUser();
    expect(me.user?.id).toBe(data.user?.id);
  });

  it("open sign-up cannot escalate privileges: metadata roles are ignored and the role column is protected", async () => {
    const email = uniqueEmail("escalate");
    const { data, error } = await anonClient().auth.signUp({ email, password: PASSWORD, options: { data: { full_name: "Mallory", role: "admin", locale: "fr" } } });
    expect(error).toBeNull();
    const id = data.user?.id as string;
    const [row] = await sql<{ role: string; email: string; locale: string }>(
      "select p.role, c.email, c.preferred_locale as locale from public.profiles p join public.customers c on c.user_id = p.id where p.id = $1",
      [id],
    );
    expect(row).toEqual({ role: "customer", email, locale: "fr" });

    await sql("update auth.users set email_confirmed_at = now() where id = $1", [id]);
    const client = await signIn(email);
    await client.auth.updateUser({ data: { role: "admin" } }); // user metadata is user-writable: must not matter
    const attempt = await client.from("profiles").update({ role: "admin" }).eq("id", id);
    expect(attempt.error).not.toBeNull();
    const [after] = await sql<{ role: string }>("select role from public.profiles where id = $1", [id]);
    expect(after.role).toBe("customer");
    const staffOnly = await client.from("audit_log").select("id").limit(1);
    expect(staffOnly.data ?? []).toEqual([]);
  });

  it("signing up again with a registered address gives no session and cannot take over the account", async () => {
    const user = await createUser("customer", "dupe");
    // GoTrue may answer "user_already_exists"; the app's register action maps every such
    // answer to the same "check your email" response, so the form does not reveal accounts.
    const { data } = await anonClient().auth.signUp({ email: user.email, password: `${PASSWORD}-other` });
    expect(data.session).toBeNull();
    expect(data.user?.id === user.id && data.user?.email_confirmed_at ? "leaked" : "ok").toBe("ok");
    const takeover = await anonClient().auth.signInWithPassword({ email: user.email, password: `${PASSWORD}-other` });
    expect(takeover.error).not.toBeNull();
    const original = await signIn(user.email); // password unchanged
    expect((await original.auth.getUser()).data.user?.id).toBe(user.id);
  });

  it("signs in with valid credentials and rejects wrong passwords with a generic error", async () => {
    const user = await createUser("customer", "login");
    const client = await signIn(user.email);
    const { data } = await client.auth.getUser();
    expect(data.user?.id).toBe(user.id);
    const wrong = await anonClient().auth.signInWithPassword({ email: user.email, password: "wrong-password-123" });
    const unknown = await anonClient().auth.signInWithPassword({ email: uniqueEmail("nobody"), password: "wrong-password-123" });
    expect(wrong.error?.message).toBe(unknown.error?.message); // no account enumeration
  });

  it("enforces the 12-character minimum on password updates", async () => {
    const user = await createUser("customer", "pwpolicy");
    const client = await signIn(user.email);
    const { error } = await client.auth.updateUser({ password: "short-pw" });
    expect(error).not.toBeNull();
  });

  it("recovery tokens work once; invalid and reused tokens are refused", async () => {
    const user = await createUser("customer", "recovery");
    const { data, error } = await adminClient().auth.admin.generateLink({ type: "recovery", email: user.email });
    expect(error).toBeNull();
    const tokenHash = data.properties?.hashed_token as string;
    const first = await anonClient().auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    expect(first.error).toBeNull();
    expect(first.data.user?.id).toBe(user.id);
    const reused = await anonClient().auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    expect(reused.error).not.toBeNull();
    const invalid = await anonClient().auth.verifyOtp({ type: "recovery", token_hash: "0".repeat(56) });
    expect(invalid.error).not.toBeNull();
  });

  it("sign-out revokes the refresh token", async () => {
    const user = await createUser("customer", "signout");
    const client = await signIn(user.email);
    const { data: session } = await client.auth.getSession();
    const refreshToken = session.session?.refresh_token as string;
    await client.auth.signOut();
    const reuse = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
    expect(reuse.error).not.toBeNull();
  });

  it("invited users get a customer profile and no elevated role", async () => {
    const email = uniqueEmail("invite");
    const { data, error } = await adminClient().auth.admin.inviteUserByEmail(email);
    expect(error).toBeNull();
    const [profile] = await sql<{ role: string; email: string }>(
      "select p.role, c.email from public.profiles p join public.customers c on c.user_id = p.id where p.id = $1",
      [data.user?.id],
    );
    expect(profile).toEqual({ role: "customer", email });
  });
});

describe("Row Level Security through the real PostgREST API", () => {
  it("isolates customers and hides staff identifiers", async () => {
    const a = await createUser("customer", "rls.a");
    const b = await createUser("customer", "rls.b");
    await sql(
      `insert into public.quote_requests (reference, customer_id, service_code, origin_country, destination_country, items, locale)
       values ($1, $2, 'parcels', 'IE', 'CM', '[{"description":"x","quantity":1}]', 'en')`,
      [`QR${Math.random().toString(36).replace(/[^a-z]/g, "").toUpperCase().replace(/[^A-Z]/g, "A").padEnd(6, "A").slice(0, 6)}`, b.customerId],
    );
    const clientA = await signIn(a.email);
    const own = await clientA.from("quote_requests").select("id, customer_id");
    expect(own.error).toBeNull();
    expect(own.data?.every((r) => r.customer_id === a.customerId)).toBe(true);
    const customers = await clientA.from("customers").select("id");
    expect(customers.data?.map((c) => c.id)).toEqual([a.customerId]);
    const audit = await clientA.from("audit_log").select("id");
    expect(audit.data).toEqual([]);
    const hidden = await clientA.from("quotes").select("created_by");
    expect(hidden.error?.code).toBe("42501"); // column not granted
  });

  it("denies anonymous table access and self-promotion", async () => {
    const anon = await anonClient().from("customers").select("id");
    expect(anon.error?.code).toBe("42501");
    const user = await createUser("customer", "escalate");
    const client = await signIn(user.email);
    const update = await client.from("profiles").update({ role: "admin" }).eq("id", user.id);
    expect(update.error?.code).toBe("42501");
    const rpc = await client.rpc("admin_set_user_role", { p_user_id: user.id, p_role: "admin" });
    expect(rpc.error?.message).toMatch(/forbidden/);
    const [{ role }] = await sql<{ role: string }>("select role from public.profiles where id = $1", [user.id]);
    expect(role).toBe("customer");
  });

  it("exposes only the allowlisted public tracking function to anon", async () => {
    const { data, error } = await anonClient().rpc("public_track_shipment", { p_reference: "MLAAAAAAAAAA" });
    expect(error).toBeNull();
    expect(data).toBeNull();
    const rateLimit = await anonClient().rpc("app_rate_limit_hit", { p_key: "x", p_window_seconds: 60, p_max: 1 });
    expect(rateLimit.error).not.toBeNull();
  });
});

describe("Storage (private bucket)", () => {
  it("lets only the service role read objects; clients cannot list or download", async () => {
    const owner = await createUser("customer", "storage");
    const key = `${owner.customerId}/quote_request/${crypto.randomUUID()}.pdf`;
    const pdf = new TextEncoder().encode("%PDF-1.7\n%test\n");
    const up = await adminClient().storage.from("customer-documents").upload(key, pdf, { contentType: "application/pdf" });
    expect(up.error).toBeNull();

    const anonDownload = await anonClient().storage.from("customer-documents").download(key);
    expect(anonDownload.error).not.toBeNull();
    const ownerClient = await signIn(owner.email);
    const ownerDownload = await ownerClient.storage.from("customer-documents").download(key);
    expect(ownerDownload.error).not.toBeNull(); // even the owner goes through the app's checked signed URL
    const list = await ownerClient.storage.from("customer-documents").list(owner.customerId);
    expect(list.data ?? []).toEqual([]);
    const publicUrl = await fetch(anonClient().storage.from("customer-documents").getPublicUrl(key).data.publicUrl);
    expect(publicUrl.ok).toBe(false);

    const signed = await adminClient().storage.from("customer-documents").createSignedUrl(key, 60);
    expect(signed.error).toBeNull();
    const res = await fetch(signed.data!.signedUrl);
    expect(res.ok).toBe(true);
    expect(await res.text()).toContain("%PDF-1.7");

    const disallowed = await adminClient().storage.from("customer-documents").upload(`${owner.customerId}/x.html`, new TextEncoder().encode("<script>"), { contentType: "text/html" });
    expect(disallowed.error).not.toBeNull(); // bucket allow-list: PDF, JPEG, PNG only
  });
});

describe("concurrency on real Postgres sessions", () => {
  it("two administrators demoting each other cannot remove the last administrator", async () => {
    // Make these two the only administrators in the local database, and give the
    // role back to the existing administrators (e.g. the seeded demo admin) afterwards.
    const a = await createUser("admin", "admin.a");
    const b = await createUser("admin", "admin.b");
    const others = (await sql<{ id: string }>("select id from public.profiles where role = 'admin' and id not in ($1, $2)", [a.id, b.id])).map((r) => r.id);
    try {
      await sql(
        "begin; select set_config('app.role_change','allowed', true); update public.profiles set role = 'staff' where role = 'admin' and id not in ($1, $2); commit;".replace(/\$1/, `'${a.id}'`).replace(/\$2/, `'${b.id}'`),
      );
      const session = async (actor: string, target: string) => {
        const client = new pg.Client({ connectionString: DATABASE_URL });
        await client.connect();
        try {
          await client.query("begin");
          await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: actor, role: "authenticated" })]);
          await client.query("set local role authenticated");
          await client.query("select public.admin_set_user_role($1, 'staff')", [target]);
          await new Promise((r) => setTimeout(r, 300)); // hold the transaction open to force overlap
          await client.query("commit");
          return "ok";
        } catch (error) {
          await client.query("rollback").catch(() => undefined);
          return (error as Error).message;
        } finally {
          await client.end();
        }
      };
      const results = await Promise.all([session(a.id, b.id), session(b.id, a.id)]);
      const [{ admins }] = await sql<{ admins: number }>("select count(*)::int as admins from public.profiles where role = 'admin'");
      expect(admins).toBe(1);
      expect(results.filter((r) => r === "ok")).toHaveLength(1);
      expect(results.find((r) => r !== "ok")).toMatch(/forbidden|last_admin/);
    } finally {
      const restore = others.map((id) => `'${id}'`).join(",");
      if (restore) await sql(`begin; select set_config('app.role_change','allowed', true); update public.profiles set role = 'admin' where id in (${restore}); commit;`);
    }
  });
});
