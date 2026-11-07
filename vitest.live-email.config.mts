import { defineConfig } from "vitest/config";
import base from "./vitest.config.mts";

/*
 * Live email run (manual only, never part of `npm test`): drives every email
 * scenario through the real outbox and the real Resend API, with the
 * EMAIL_TEST_RECIPIENT override so every message goes to ONE test inbox.
 * See tests/live-email/all-scenarios.live.ts for the required environment.
 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/live-email/**/*.live.ts"],
    exclude: ["node_modules/**"],
    fileParallelism: false,
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
