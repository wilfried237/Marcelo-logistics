import { readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

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
 * - Migrations use DIRECT_URL (session connection, port 5432), never the pooler.
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
    url: process.env.DIRECT_URL ?? "postgresql://unused:unused@localhost:5432/unused",
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
