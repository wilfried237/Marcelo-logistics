import { describe, expect, it } from "vitest";
import { planDeployMigration } from "../../scripts/deploy-migrate.mjs";

const SESSION = "postgresql://postgres.ref:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";

describe("production migrations on deploy", () => {
  it("never runs outside a Vercel production build (previews must not touch production)", () => {
    expect(planDeployMigration({ DIRECT_URL: SESSION }).action).toBe("skip");
    expect(planDeployMigration({ VERCEL: "1", VERCEL_ENV: "preview", DIRECT_URL: SESSION }).action).toBe("skip");
    expect(planDeployMigration({ VERCEL_ENV: "production", DIRECT_URL: SESSION }).action).toBe("skip");
  });

  it("skips production builds without any database", () => {
    expect(planDeployMigration({ VERCEL: "1", VERCEL_ENV: "production" })).toMatchObject({ action: "skip" });
  });

  it("fails production builds that have a database but cannot migrate it", () => {
    const prod = { VERCEL: "1", VERCEL_ENV: "production" };
    expect(planDeployMigration({ ...prod, DATABASE_URL: "postgresql://x@h:6543/db" }).action).toBe("fail");
    expect(planDeployMigration({ ...prod, DIRECT_URL: "not a url" }).action).toBe("fail");
    expect(planDeployMigration({ ...prod, DIRECT_URL: "postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" }).action).toBe("fail");
  });

  it("migrates the configured production database through a session connection", () => {
    expect(planDeployMigration({ VERCEL: "1", VERCEL_ENV: "production", DIRECT_URL: SESSION })).toEqual({
      action: "migrate",
      reason: "Vercel production build",
      host: "aws-0-eu-west-1.pooler.supabase.com",
    });
  });
});
