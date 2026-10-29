import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getDatabaseUrl } from "@/lib/config/env";
import * as schema from "./schema";
import type { Database } from "./types";

const globalForDb = globalThis as unknown as { __mlDb?: Database };

/**
 * Lazily created Drizzle client on DATABASE_URL (Supabase transaction pooler:
 * prepared statements disabled). Throws ConfigurationError if not configured.
 */
export function getDb(): Database {
  if (!globalForDb.__mlDb) {
    const client = postgres(getDatabaseUrl(), { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} });
    globalForDb.__mlDb = drizzle(client, { schema }) as unknown as Database;
  }
  return globalForDb.__mlDb;
}
