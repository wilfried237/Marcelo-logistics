/**
 * Local-only seed: `npm run db:seed`.
 *
 * 1. Creates (or reuses) four fictitious auth users in the LOCAL Supabase stack
 *    through the Admin API: admin, staff and two customers (@example.test).
 * 2. Promotes admin/staff through the trusted role-change path.
 * 3. Inserts demo quote requests, quotes, shipments and events.
 *
 * Refuses to run unless both SUPABASE_URL and DIRECT_URL point at localhost.
 * The local password comes from SEED_USER_PASSWORD (default documented in
 * docs/LOCAL-SETUP.md); it is only valid on your own machine.
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { seedDemoData } from "./seed-data";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function requireLocal(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`seed: ${name} is not set`);
  const host = new URL(value).hostname;
  if (!LOCAL_HOSTS.has(host)) throw new Error(`seed: refusing to run against non-local ${name} host "${host}"`);
  return value;
}

async function main() {
  const supabaseUrl = requireLocal("SUPABASE_URL");
  const databaseUrl = requireLocal("DIRECT_URL");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("seed: SUPABASE_SERVICE_ROLE_KEY is not set (local stack key from `supabase status`)");
  const password = process.env.SEED_USER_PASSWORD ?? "local-only-demo-password";

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const sql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => {} });

  const ensureUser = async (email: string, fullName: string) => {
    const existing = await sql<{ id: string }[]>`select id from auth.users where email = ${email}`;
    if (existing[0]) return existing[0].id;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, locale: "en" } });
    if (error || !data.user) throw new Error(`seed: could not create ${email}: ${error?.message}`);
    return data.user.id;
  };

  try {
    const users = {
      adminId: await ensureUser("demo.admin@example.test", "Demo Admin"),
      staffId: await ensureUser("demo.staff@example.test", "Demo Staff"),
      customerOneId: await ensureUser("demo.customer1@example.test", "Demo Customer One"),
      customerTwoId: await ensureUser("demo.customer2@example.test", "Demo Customer Two"),
    };
    for (const [id, role] of [
      [users.adminId, "admin"],
      [users.staffId, "staff"],
    ] as const) {
      await sql.begin(async (tx) => {
        await tx`select set_config('app.role_change', 'allowed', true)`;
        await tx`update public.profiles set role = ${role} where id = ${id}`;
      });
    }
    const query = async (text: string, params: unknown[] = []) => (await sql.unsafe(text, params as never[])) as unknown as Record<string, unknown>[];
    const queryAs = (actor: string, text: string, params: unknown[] = []) =>
      sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: actor })}, true)`;
        return (await tx.unsafe(text, params as never[])) as unknown as Record<string, unknown>[];
      }) as Promise<Record<string, unknown>[]>;

    const result = await seedDemoData(query, queryAs, users);
    console.log("seed: done", result);
    console.log("seed: demo logins are demo.admin@, demo.staff@, demo.customer1@, demo.customer2@example.test (password: SEED_USER_PASSWORD).");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
