import { defineConfig, devices } from "@playwright/test";

// 3300: never the full-stack journeys port (3200), so a running journeys server is never reused.
const PORT = Number(process.env.E2E_PORT ?? 3300);

/**
 * End-to-end tests against a production build (`npm run build` first).
 * Uses the locally installed Google Chrome (channel "chrome"), so no browser
 * download is needed. Supabase/database are intentionally NOT configured here:
 * these tests verify the public site and the honest "unavailable" states.
 * `next start` would load .env.local (local Supabase); variables already present
 * in the environment win, even when empty, so the service variables are blanked.
 */
const NO_SERVICES = Object.fromEntries(
  ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "DIRECT_URL", "POSTGRES_URL", "POSTGRES_URL_NON_POOLING"].map((name) => [name, ""]),
);
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  workers: 2,
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { NEXT_TELEMETRY_DISABLED: "1", ...NO_SERVICES },
  },
});
