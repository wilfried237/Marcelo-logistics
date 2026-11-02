import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";
import { prismaCliUrl, resolveDatabaseUrls } from "./lib/db/connection.mjs";

// Prisma does not load .env files itself; local values come from .env.local.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}

/**
 * Prisma CLI configuration.
 * - Migrations use a session connection: POSTGRES_URL_NON_POOLING (Vercel Supabase
 *   integration) or DIRECT_URL, never the transaction pooler. Supabase hosts are
 *   verified strictly against the pinned root CA (prisma/supabase-root-2021.crt).
 * - auth.users is owned by Supabase: Prisma models it but never migrates it.
 * - Apply migrations with `npm run db:migrate`, which refuses non-local hosts
 *   unless the owner-approved procedure is followed (docs/DATABASE.md).
 */
export default defineConfig({
  // Required for tables.external (Supabase-owned auth.users). Documented in docs/DATABASE.md.
  experimental: { externalTables: true },
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    initShadowDb: readFileSync("prisma/shadow-init.sql", "utf8"),
  },
  tables: { external: ["auth.users"] },
  datasource: {
    url: prismaCliUrl(resolveDatabaseUrls().direct ?? "postgresql://unused:unused@localhost:5432/unused", resolve("prisma/supabase-root-2021.crt")),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
