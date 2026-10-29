import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only reads the schema and needs no database.
// Migrations are applied with `npm run db:migrate` (scripts/db-migrate.mjs), which
// refuses non-local databases unless explicitly allowed. Never use `drizzle-kit push`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  schemaFilter: ["public"],
  dbCredentials: { url: process.env.DIRECT_URL ?? "postgres://localhost:5432/unused" },
  strict: true,
  verbose: true,
});
