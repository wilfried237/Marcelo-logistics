import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);

/**
 * End-to-end tests against a production build (`npm run build` first).
 * Uses the locally installed Google Chrome (channel "chrome"), so no browser
 * download is needed. Supabase/database are intentionally NOT configured here:
 * these tests verify the public site and the honest "unavailable" states.
 */
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
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
});
