import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { asLocalUser, createLocalShipment, localQuery, resetLocalLoginLimits } from "./local-db";

/*
 * Stage 6: staff supporting pages (audit history, notifications, job health) in a
 * real browser against the production build and the REAL local Supabase stack.
 */

for (const file of [".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}
const url = process.env.SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error("Staff journeys run only against the local Supabase stack.");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
const STAFF = "demo.staff@example.test";
const STAFF_PASSWORD = process.env.SEED_USER_PASSWORD ?? "local-only-demo-password";
const SECRET_PHONE = `+353 87 ${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

const customer = { email: `staff.pages.${randomUUID().slice(0, 8)}@example.test`, password: `Cust-${randomUUID()}`, id: "" };
const fixture = { shipmentRef: "", requestRef: "" };

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/en/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/en\/(portal|admin)/);
}

test.describe.serial("Stage 6 staff supporting pages", () => {
  test.beforeEach(async () => resetLocalLoginLimits());
  test.beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({ email: customer.email, password: customer.password, email_confirm: true, user_metadata: { full_name: "Staff Pages Journey", locale: "en" } });
    if (error || !data.user) throw new Error(`could not create the local test user: ${error?.message}`);
    customer.id = data.user.id;
    Object.assign(fixture, await createLocalShipment(customer.id, STAFF));
    // The customer changes their phone number: an audited change whose value must never be displayed.
    await asLocalUser(customer.id, "update public.customers set phone = $1 where user_id = $2", [SECRET_PHONE, customer.id]);
  });
  test.afterAll(async () => {
    await resetLocalLoginLimits();
    if (customer.id) await admin.auth.admin.deleteUser(customer.id).catch(() => undefined);
  });

  test("audit: search by reference, filters, field names without values, links and pages", async ({ page }) => {
    await signIn(page, STAFF, STAFF_PASSWORD);
    await page.goto(`/en/admin/audit?q=${fixture.shipmentRef.toLowerCase()}`);
    const rows = page.locator("main tbody tr");
    await expect(rows.first()).toBeVisible();
    for (const row of await rows.all()) await expect(row.getByRole("link", { name: fixture.shipmentRef })).toBeVisible();
    await expect(page.locator("main tbody").getByText("Shipment milestone").first()).toBeVisible();

    // Filters through the form.
    await page.goto("/en/admin/audit");
    await page.getByLabel("Record type").selectOption("customers");
    await page.getByLabel("Action").selectOption("update");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/entity=customers/);
    await expect(page.locator("main tbody").getByText("phone").first()).toBeVisible();
    // Never the value: not on the page, not in the HTML sent to the browser.
    expect(await page.content()).not.toContain(SECRET_PHONE.replace(/\s/g, ""));
    expect(await page.content()).not.toContain(SECRET_PHONE);

    await page.goto("/en/admin/audit?q=hello");
    await expect(page.getByText("Enter a quote request (QR…), shipment (ML…) or enquiry (CE…) reference.")).toBeVisible();

    // The local history is long enough to page through.
    await page.goto("/en/admin/audit");
    await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();
    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();
    await page.goto("/fr/admin/audit");
    await expect(page.getByRole("button", { name: "Appliquer les filtres" })).toBeVisible();
  });

  test("notifications: filters, links to the record, shipment email history, no re-send controls", async ({ page }) => {
    await signIn(page, STAFF, STAFF_PASSWORD);
    await page.goto("/en/admin/notifications");
    await page.locator("select[name=template]").selectOption("shipment_confirmed");
    await page.locator("select[name=audience]").selectOption("customer");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/template=shipment_confirmed/);
    const rows = page.locator("main tbody tr");
    for (const row of await rows.all()) await expect(row.getByText("shipment_confirmed")).toBeVisible();
    await page.locator("main tbody").getByRole("link", { name: fixture.shipmentRef }).click();
    await expect(page).toHaveURL(new RegExp(`/en/admin/shipments/${fixture.shipmentRef}$`));
    const history = page.locator("section", { has: page.getByRole("heading", { name: "Emails" }) });
    await expect(history.getByText("shipment_confirmed")).toBeVisible();
    await expect(history.getByText("shipment_update").first()).toBeVisible(); // the fixture's public milestone

    // D4: nothing on these pages can re-send an email.
    for (const path of ["/en/admin/notifications", "/en/admin/notifications?status=DEAD", `/en/admin/shipments/${fixture.shipmentRef}`]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: /retry|resend|re-send|send again|renvoyer/i }), path).toHaveCount(0);
    }
    await page.goto("/fr/admin/notifications");
    await expect(page.getByRole("button", { name: "Appliquer les filtres" })).toBeVisible();
  });

  test("job health: a stuck run raises the failure banner; normal successful runs raise no alarm", async ({ page }) => {
    // Local job_runs only: a run that started 20 minutes ago and never finished, then healthy runs.
    const stuck = await localQuery<{ id: string }>("insert into public.job_runs (job, started_at) values ('process-emails', now() - interval '20 minutes') returning id::text");
    try {
      await signIn(page, STAFF, STAFF_PASSWORD);
      await page.goto("/en/admin/notifications");
      await expect(page.getByRole("alert").filter({ hasText: "A scheduled job failed or did not finish within 15 minutes." })).toBeVisible();
      const health = page.locator("section", { has: page.getByRole("heading", { name: "Scheduled jobs" }) });
      await expect(health.getByText("1 run unfinished after 15 minutes")).toBeVisible();
      await expect(health.getByText("Send queued emails (daily)")).toBeVisible();
      await expect(health.getByText("Expire quotations (daily)")).toBeVisible();

      await localQuery("update public.job_runs set finished_at = now(), ok = true where id = $1::bigint", [stuck[0].id]);
      await localQuery("insert into public.job_runs (job, started_at, finished_at, ok) values ('expire-quotes', now() - interval '1 minute', now(), true), ('process-emails', now() - interval '1 minute', now(), true)");
      await page.reload();
      await expect(page.getByText("All scheduled jobs completed successfully in the last 36 hours.")).toBeVisible();
      await expect(page.locator("main").getByRole("alert")).toHaveCount(0); // the route announcer is role=alert too
      await page.goto("/fr/admin/notifications");
      await expect(page.getByText("Envoi des e-mails en attente (quotidien)")).toBeVisible();
    } finally {
      await localQuery("update public.job_runs set finished_at = coalesce(finished_at, now()), ok = coalesce(ok, true) where id = $1::bigint", [stuck[0].id]);
    }
  });

  test("audit is staff-only", async ({ page }) => {
    await signIn(page, customer.email, customer.password);
    expect((await page.goto("/en/admin/audit"))?.status()).toBe(404);
  });

  test("staff pages work on a phone and have no serious accessibility violations", async ({ browser }) => {
    const context = await browser.newContext({ ...devices["Pixel 7"] });
    const page = await context.newPage();
    await page.goto("/en/login");
    await page.getByLabel(/email/i).fill(STAFF);
    await page.getByLabel(/password/i).fill(STAFF_PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/en\/admin/);
    for (const path of ["/en/admin/audit", `/en/admin/audit?q=${fixture.shipmentRef}`, "/fr/admin/audit", "/en/admin/notifications", `/en/admin/shipments/${fixture.shipmentRef}`]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${path} ${v.id}`)).toEqual([]);
    }
    await context.close();
  });
});
