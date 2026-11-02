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

describe("Vercel Supabase integration variables", () => {
  it("uses POSTGRES_URL_NON_POOLING for migrations and prefers the managed values", async () => {
    const { resolveDatabaseUrls } = await import("../../lib/db/connection.mjs");
    const env = { DATABASE_URL: "postgres://manual@localhost/x", DIRECT_URL: "postgres://manual@localhost/x", POSTGRES_URL: "postgres://pooled@h:6543/p", POSTGRES_URL_NON_POOLING: SESSION };
    expect(resolveDatabaseUrls(env)).toEqual({ app: "postgres://pooled@h:6543/p", direct: SESSION });
    expect(resolveDatabaseUrls({ DATABASE_URL: "a", DIRECT_URL: "b" })).toEqual({ app: "a", direct: "b" });
    expect(planDeployMigration({ VERCEL: "1", VERCEL_ENV: "production", POSTGRES_URL_NON_POOLING: SESSION }).action).toBe("migrate");
  });

  it("rejects the [YOUR-PASSWORD] placeholder from Supabase's connection dialog", () => {
    const placeholder = "postgresql://postgres.ref:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";
    expect(planDeployMigration({ VERCEL: "1", VERCEL_ENV: "production", DIRECT_URL: placeholder }).action).toBe("fail");
  });

  it("verifies Supabase TLS against the pinned root CA and leaves local URLs untouched", async () => {
    const { pgConnectionOptions, prismaCliUrl, SUPABASE_ROOT_CA } = await import("../../lib/db/connection.mjs");
    const supa = pgConnectionOptions("postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x");
    expect(supa.ssl).toEqual({ ca: SUPABASE_ROOT_CA, rejectUnauthorized: true });
    expect(supa.connectionString).not.toContain("sslmode");
    expect(SUPABASE_ROOT_CA).toContain("BEGIN CERTIFICATE");
    expect(pgConnectionOptions("postgresql://postgres:postgres@127.0.0.1:54322/postgres")).toEqual({ connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
    const cli = new URL(prismaCliUrl(SESSION, "/var/task/prisma/supabase-root-2021.crt"));
    expect(cli.searchParams.get("sslaccept")).toBe("strict");
    expect(cli.searchParams.get("sslcert")).toBe("/var/task/prisma/supabase-root-2021.crt");
  });
});
