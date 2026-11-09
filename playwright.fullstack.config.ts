import { defineConfig, devices } from "@playwright/test";
import { consentStorageState } from "./tests/consent-storage-state";

/*
 * Full-stack business journeys: production build + REAL local Supabase (Docker)
 * + the application's real email code talking to a local mock of the Resend API.
 * Never runs against hosted services: the database URL must be local.
 *
 *   npx supabase start ...   npm run db:migrate   npm run db:seed   npm run build
 *   npm run test:journeys
 */
for (const file of [".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}
const dbUrl = process.env.DIRECT_URL ?? "";
if (!/@(127\.0\.0\.1|localhost):/.test(dbUrl)) throw new Error("Journeys run only against a local Supabase database (DIRECT_URL must be local).");

const PORT = 3200;
const MOCK = 4010;
export const JOURNEY_ENV = {
  SITE_URL: `http://localhost:${PORT}`,
  ENABLE_QUOTE_SUBMISSION: "true",
  // Registration is closed until the official launch (owner, 2026-11-08). JOURNEY_REGISTRATION_OPEN=1
  // runs the open-registration journey instead (needs [auth] enable_signup = true locally).
  ENABLE_CUSTOMER_REGISTRATION: process.env.JOURNEY_REGISTRATION_OPEN === "1" ? "true" : "false",
  ENABLE_TRANSACTIONAL_EMAIL: "true",
  RESEND_API_KEY: "re_mock_local_only",
  RESEND_BASE_URL: `http://127.0.0.1:${MOCK}`,
  EMAIL_FROM: "Marchelo Logistics <notify@example.test>",
  STAFF_NOTIFICATION_EMAIL: "ops.journeys@example.test",
  QUOTE_LINK_SECRET: "journeys-local-quote-link-secret-0123456789",
  CRON_SECRET: "journeys-local-cron-secret-0123456789abcdef",
  RESEND_WEBHOOK_SECRET: "whsec_" + Buffer.from("journeys-webhook-secret-key-32b!").toString("base64"),
};

export default defineConfig({
  testDir: "tests/e2e-fullstack",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", channel: "chrome", storageState: consentStorageState() },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: [
    { command: `node tests/e2e-fullstack/mock-resend.mjs`, port: MOCK, reuseExistingServer: false, env: { MOCK_RESEND_PORT: String(MOCK) } },
    { command: `node node_modules/next/dist/bin/next start -p ${PORT}`, port: PORT, reuseExistingServer: false, timeout: 120_000, env: { ...process.env, ...JOURNEY_ENV } as Record<string, string> },
  ],
});
