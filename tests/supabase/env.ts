import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Helpers for tests against a REAL local Supabase stack (`npx supabase start`).
 * They refuse to run against anything that is not localhost, so they can never
 * touch a shared or hosted project.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}

const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);

function localOnly(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: start the local stack and create .env.local (docs/LOCAL-SETUP.md)`);
  const host = new URL(value).hostname;
  if (!LOCAL.has(host)) throw new Error(`refusing to run Supabase tests against non-local ${name} host "${host}"`);
  return value;
}

export const SUPABASE_URL = localOnly("SUPABASE_URL");
export const DATABASE_URL = localOnly("DATABASE_URL");
const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const adminClient = () => createClient(SUPABASE_URL, serviceKey, opts);
export const anonClient = () => createClient(SUPABASE_URL, anonKey, opts);

export const PASSWORD = `Local-Test-${randomUUID()}`;
export const uniqueEmail = (label: string) => `${label}.${randomUUID().slice(0, 8)}@example.test`;

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

/** Creates a confirmed user through the Auth Admin API and sets the role through the trusted path. */
export async function createUser(role: "customer" | "staff" | "admin" = "customer", label = role) {
  const email = uniqueEmail(label);
  const { data, error } = await adminClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Test ${label}` } });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  if (role !== "customer") {
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.role_change', 'allowed', true)");
      await client.query("update public.profiles set role = $1 where id = $2", [role, data.user.id]);
      await client.query("commit");
    } finally {
      await client.end();
    }
  }
  const [customer] = await sql<{ id: string }>("select id from public.customers where user_id = $1", [data.user.id]);
  return { id: data.user.id, email, customerId: customer?.id as string };
}

/** Signed-in Supabase client (real GoTrue session; requests carry the user's JWT). */
export async function signIn(email: string, password = PASSWORD): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed: ${error.message}`);
  return client;
}
