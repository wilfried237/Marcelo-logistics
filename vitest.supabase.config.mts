import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Tests against a REAL local Supabase stack (`npx supabase start` + `npm run db:migrate`).
 * Run with `npm run test:supabase`. They refuse non-local hosts (tests/supabase/env.ts).
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: root },
      { find: /^server-only$/, replacement: `${root}tests/stubs/server-only.ts` },
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["tests/supabase/**/*.test.ts"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
