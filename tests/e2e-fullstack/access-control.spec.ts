import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { resetLocalLoginLimits } from "./local-db";

/*
 * Stage 4: HTTP-level access matrix against the production build and the REAL
 * local Supabase stack (local database only; see playwright.fullstack.config.ts).
 * Every role is checked separately, with direct requests (no page navigation
 * helpers), so a missing server-side check cannot hide behind the UI.
 *
 * Roles: anonymous, customer one, customer two, staff, admin (seeded demo accounts).
 */

for (const file of [".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "local-only-demo-password";
const ACCOUNTS = {
  customer1: "demo.customer1@example.test",
  customer2: "demo.customer2@example.test",
  staff: "demo.staff@example.test",
  admin: "demo.admin@example.test",
} as const;
type Role = "anonymous" | keyof typeof ACCOUNTS;

let db: pg.Client;
const fixture: { requestRef?: string; shipmentRef?: string | null; createdRequestId?: string } = {};
const sessions = new Map<Role, APIRequestContext>();

async function signedInRequest(browser: Browser, role: Role): Promise<APIRequestContext> {
  const context = await browser.newContext();
  if (role !== "anonymous") {
    const page = await context.newPage();
    await page.goto("/en/login");
    await page.getByLabel(/email/i).fill(ACCOUNTS[role]);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(portal|admin)/);
    await page.close();
  }
  return context.request;
}

/** Status of a direct GET without following redirects; a redirect to /login counts as "login". */
async function access(role: Role, path: string): Promise<number | "login"> {
  const response = await sessions.get(role)!.get(path, { maxRedirects: 0 });
  const location = response.headers()["location"] ?? "";
  if (response.status() >= 300 && response.status() < 400 && /\/(en|fr)\/login/.test(location)) return "login";
  return response.status();
}

test.describe.serial("Stage 4 access control matrix", () => {
  test.beforeAll(async ({ browser }) => {
    await resetLocalLoginLimits();
    db = new pg.Client({ connectionString: process.env.DIRECT_URL });
    await db.connect();
    const owned = await db.query<{ reference: string }>(
      "select r.reference from public.quote_requests r join public.customers c on c.id = r.customer_id where c.email = $1 order by r.created_at limit 1",
      [ACCOUNTS.customer1],
    );
    if (owned.rows[0]) fixture.requestRef = owned.rows[0].reference;
    else {
      // Local test fixture owned by customer one (the local database only).
      const reference = `QR${randomUUID().replace(/[^A-Z2-7]/gi, "").toUpperCase().replace(/[01890]/g, "A").slice(0, 6).padEnd(6, "C")}`;
      const created = await db.query<{ id: string }>(
        `insert into public.quote_requests (reference, customer_id, service_code, origin_country, destination_country, items, locale)
         select $1, c.id, 'parcels', 'IE', 'CM', '[{"description":"access matrix fixture","quantity":1}]', 'en' from public.customers c where c.email = $2 returning id`,
        [reference, ACCOUNTS.customer1],
      );
      fixture.requestRef = reference;
      fixture.createdRequestId = created.rows[0].id;
    }
    const shipment = await db.query<{ reference: string }>(
      "select s.reference from public.shipments s join public.customers c on c.id = s.customer_id where c.email = $1 limit 1",
      [ACCOUNTS.customer1],
    );
    fixture.shipmentRef = shipment.rows[0]?.reference ?? null;
    for (const role of ["anonymous", "customer1", "customer2", "staff", "admin"] as const) sessions.set(role, await signedInRequest(browser, role));
  });

  test.afterAll(async () => {
    await resetLocalLoginLimits();
    if (fixture.createdRequestId) await db.query("delete from public.quote_requests where id = $1", [fixture.createdRequestId]).catch(() => undefined);
    await db?.end();
  });

  test("customer area: sign-in required; each customer reaches only their own records", async () => {
    for (const path of ["/en/portal", "/en/portal/quotes", "/en/portal/shipments", "/en/portal/profile", "/fr/portal"]) {
      expect(await access("anonymous", path), path).toBe("login");
      expect(await access("customer1", path), path).toBe(200);
      expect(await access("customer2", path), path).toBe(200);
    }
    const own = `/en/portal/quotes/${fixture.requestRef}`;
    expect(await access("customer1", own)).toBe(200);
    expect(await access("customer2", own)).toBe(404); // another customer's request: same answer as "does not exist"
    expect(await access("anonymous", own)).toBe("login");
    expect(await access("customer1", "/en/portal/quotes/QRZZZZZZ")).toBe(404);
    if (fixture.shipmentRef) {
      expect(await access("customer1", `/en/portal/shipments/${fixture.shipmentRef}`)).toBe(200);
      expect(await access("customer2", `/en/portal/shipments/${fixture.shipmentRef}`)).toBe(404);
    } else test.info().annotations.push({ type: "note", description: "no seeded shipment for customer one: shipment ownership covered by integration and RLS tests" });
    // The other customer's personal details never appear in their pages.
    const body = await (await sessions.get("customer2")!.get("/en/portal/quotes")).text();
    expect(body).not.toContain(ACCOUNTS.customer1);
    expect(body).not.toContain(fixture.requestRef!);
  });

  test("staff area: invisible (404) to customers, open to staff and admins; user management is admin-only", async () => {
    const staffPages = ["/en/admin", "/en/admin/quotes", "/en/admin/shipments", "/en/admin/customers", "/en/admin/enquiries", "/en/admin/audit", "/en/admin/notifications", `/en/admin/quotes/${fixture.requestRef}`];
    for (const path of staffPages) {
      expect(await access("anonymous", path), path).toBe("login");
      expect(await access("customer1", path), path).toBe(404);
      expect(await access("customer2", path), path).toBe(404);
      expect(await access("staff", path), path).toBe(200);
      expect(await access("admin", path), path).toBe(200);
    }
    expect(await access("staff", "/en/admin/users")).toBe(404);
    expect(await access("admin", "/en/admin/users")).toBe(200);
  });

  test("direct API access: documents, cron jobs, webhooks and the legacy endpoints", async () => {
    const doc = `/api/documents/${randomUUID()}`;
    expect(await access("anonymous", doc)).toBe(401);
    for (const role of ["customer1", "customer2", "staff"] as const) expect(await access(role, doc), role).toBe(404);
    expect(await access("anonymous", "/api/documents/not-a-uuid")).toBe(401);

    for (const job of ["/api/cron/process-emails", "/api/cron/expire-quotes", "/api/cron/retention"]) {
      for (const role of ["anonymous", "customer1", "staff", "admin"] as const) expect(await access(role, job), `${role} ${job}`).toBe(401); // a session is not a cron secret
      const wrong = await sessions.get("anonymous")!.get(job, { headers: { Authorization: "Bearer not-the-secret" }, maxRedirects: 0 });
      expect(wrong.status(), job).toBe(401);
    }
    const webhook = await sessions.get("customer1")!.post("/api/webhooks/resend", { data: { type: "email.delivered" } });
    expect([400, 401]).toContain(webhook.status()); // unsigned: refused
    expect((await sessions.get("customer1")!.get("/api/quote")).status()).toBe(405); // no data-returning GET
  });

  test("sign-in never redirects off-site, and email-link callbacks never create a session from forged input", async ({ browser }) => {
    // The `next` value is echoed into the form and validated on the server when the form is submitted.
    await resetLocalLoginLimits();
    for (const hostile of ["//evil.example/portal", "https://evil.example/en/portal", "/\\evil.example", "/en/../../evil"]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`/en/login?next=${encodeURIComponent(hostile)}`);
      await page.getByLabel(/email/i).fill(ACCOUNTS.customer1);
      await page.getByLabel(/password/i).fill(PASSWORD);
      await page.getByRole("button", { name: /sign in|log in/i }).click();
      // The hostile target is replaced by the customer's own area on this site.
      await page.waitForURL(/\/en\/portal$/);
      expect(new URL(page.url()).origin, hostile).toBe(new URL(test.info().project.use.baseURL!).origin);
      expect(page.url(), hostile).not.toContain("evil");
      await context.close();
    }
    // Email-link callback: missing or forged tokens never create a session.
    for (const query of ["", "?code=forged", "?token_hash=forged&type=recovery", "?token_hash=x&type=admin"]) {
      const callback = await sessions.get("anonymous")!.get(`/api/auth/callback${query}`, { maxRedirects: 0 });
      expect(callback.status(), query).toBe(307);
      expect(callback.headers()["location"], query).toMatch(/\/en\/login\?error=link_(invalid|expired)$/);
    }
    const expired = await sessions.get("anonymous")!.get("/api/auth/callback?error=access_denied&error_code=otp_expired&next=/fr/reset-password", { maxRedirects: 0 });
    expect(expired.headers()["location"]).toMatch(/\/fr\/login\?error=link_expired$/);
  });
});
