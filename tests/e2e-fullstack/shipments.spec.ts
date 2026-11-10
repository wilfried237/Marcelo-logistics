import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createLocalShipment, resetLocalLoginLimits } from "./local-db";

/*
 * Stage 5: shipment management in a real browser, against the production build
 * and the REAL local Supabase stack (local only; see the config guard).
 * Two fresh local customers are created per run, so the demo accounts are untouched;
 * staff actions use the seeded demo staff account.
 */

for (const file of [".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}
const url = process.env.SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error("Shipment journeys run only against the local Supabase stack.");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
const STAFF = "demo.staff@example.test";
const STAFF_PASSWORD = process.env.SEED_USER_PASSWORD ?? "local-only-demo-password";

const owner = { email: `ship.owner.${randomUUID().slice(0, 8)}@example.test`, password: `Owner-${randomUUID()}`, id: "" };
const other = { email: `ship.other.${randomUUID().slice(0, 8)}@example.test`, password: `Other-${randomUUID()}`, id: "" };
const fixture = { shipmentRef: "", requestRef: "" };

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/en/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/en\/(portal|admin)/);
}

async function noOverflowAndAccessible(page: Page, path: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, path).toBeLessThanOrEqual(0);
  await expect(page.locator("h1"), path).toHaveCount(1);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${path} ${v.id}`)).toEqual([]);
}

async function phone(browser: Browser) {
  return (await browser.newContext({ ...devices["Pixel 7"] })).newPage();
}

test.describe.serial("Stage 5 shipment management", () => {
  test.beforeEach(async () => resetLocalLoginLimits());
  test.beforeAll(async () => {
    for (const person of [owner, other]) {
      const { data, error } = await admin.auth.admin.createUser({ email: person.email, password: person.password, email_confirm: true, user_metadata: { full_name: "Shipment Journey", locale: "en" } });
      if (error || !data.user) throw new Error(`could not create the local test user: ${error?.message}`);
      person.id = data.user.id;
    }
    Object.assign(fixture, await createLocalShipment(owner.id, STAFF));
  });
  test.afterAll(async () => {
    await resetLocalLoginLimits();
    // The shipment and request stay (the database protects them); only the logins are removed.
    for (const person of [owner, other]) if (person.id) await admin.auth.admin.deleteUser(person.id).catch(() => undefined);
  });

  test("the customer sees their shipment, its status, public progress and what has not been shared yet (EN and FR)", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto("/en/portal/shipments");
    await page.locator("main").getByRole("link", { name: new RegExp(fixture.shipmentRef) }).click();
    await page.waitForURL(new RegExp(`/en/portal/shipments/${fixture.shipmentRef}$`));
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(fixture.shipmentRef);
    await expect(main.getByText("No estimated arrival date has been shared yet.")).toBeVisible();
    await expect(main.getByText("Received at depot").first()).toBeVisible();
    await expect(main.getByText("Your barrel has arrived at our depot.")).toBeVisible();
    await expect(main.getByRole("link", { name: fixture.requestRef })).toHaveAttribute("href", `/en/portal/quotes/${fixture.requestRef}`);
    const text = await main.innerText();
    expect(text).not.toMatch(/INTERNAL|paperwork|Delayed|History|Staff member|demo\.staff/);
    // No staff controls are offered to customers.
    await expect(main.getByRole("button", { name: /save changes|record milestone/i })).toHaveCount(0);
    await expect(main.locator("select")).toHaveCount(0);

    await page.goto(`/fr/portal/shipments/${fixture.shipmentRef}`);
    await expect(page.locator("main").getByText("Aucune date d’arrivée estimée n’a encore été communiquée.")).toBeVisible();
    await expect(page.locator("main").getByText("Réservé le")).toBeVisible();
  });

  test("another customer, a signed-out visitor and malformed references get nothing", async ({ page, browser }) => {
    await signIn(page, other.email, other.password);
    const foreign = await page.goto(`/en/portal/shipments/${fixture.shipmentRef}`);
    expect(foreign?.status()).toBe(404);
    expect(await page.content()).not.toContain("Lucan depot");
    await page.goto("/en/portal/shipments");
    await expect(page.locator("main").getByText(fixture.shipmentRef)).toHaveCount(0);
    for (const bad of ["not-a-reference", "MLZZZZZZZZZZ", "%27%20or%201%3D1"]) expect((await page.goto(`/en/portal/shipments/${bad}`))?.status(), bad).toBe(404);
    // Customers never reach the staff shipment pages.
    expect((await page.goto(`/en/admin/shipments/${fixture.shipmentRef}`))?.status()).toBe(404);
    expect((await page.goto("/en/admin/shipments"))?.status()).toBe(404);

    const anonymous = await (await browser.newContext()).newPage();
    await anonymous.goto(`/en/portal/shipments/${fixture.shipmentRef}`);
    await expect(anonymous).toHaveURL(/\/en\/login/);
    await anonymous.goto(`/en/admin/shipments/${fixture.shipmentRef}`);
    await expect(anonymous).toHaveURL(/\/en\/login/);
    await anonymous.context().close();
  });

  test("staff find the shipment, see its details and history, and update its status through the allowed transitions", async ({ page }) => {
    await signIn(page, STAFF, STAFF_PASSWORD);
    await page.goto(`/en/admin/shipments?q=${fixture.shipmentRef.toLowerCase()}`);
    await expect(page.locator("main").getByRole("link", { name: new RegExp(fixture.shipmentRef) })).toHaveCount(1);
    await page.goto(`/en/admin/shipments?q=${fixture.requestRef}`);
    await expect(page.locator("main").getByRole("link", { name: new RegExp(fixture.shipmentRef) })).toHaveCount(1);
    await page.goto(`/en/admin/shipments?q=${fixture.shipmentRef}&status=DELIVERED`);
    await expect(page.locator("main").getByRole("link", { name: new RegExp(fixture.shipmentRef) })).toHaveCount(0);

    await page.goto(`/en/admin/shipments/${fixture.shipmentRef}`);
    const details = page.locator("section", { has: page.getByRole("heading", { name: "Shipment details" }) });
    await expect(details.getByText(owner.email)).toBeVisible();
    await expect(details.getByRole("link", { name: fixture.requestRef })).toBeVisible();
    await expect(details.getByText("Not recorded")).toBeVisible();
    const history = page.locator("section", { has: page.getByRole("heading", { name: "History" }) });
    await expect(history.getByText("Shipment created (Booked)")).toBeVisible();
    await expect(history.getByText("Milestone recorded: Delayed (Internal only)")).toBeVisible();
    // Staff see internal milestones that customers never see.
    await expect(page.getByText("INTERNAL: waiting for paperwork")).toBeVisible();

    // Only allowed next statuses are offered; DELIVERED is not reachable from BOOKED.
    await expect(page.locator("#status option[value='DELIVERED']")).toHaveCount(0);
    await page.locator("#status").selectOption("IN_TRANSIT");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible();
    await page.reload();
    await expect(history.getByText("Status changed from Booked to In transit")).toBeVisible();
    await expect(history.getByText("You").last()).toBeVisible();
    await expect(page.locator("#status option[value='BOOKED']")).toHaveCount(0);
    await page.goto(`/fr/admin/shipments/${fixture.shipmentRef}`);
    await expect(page.getByText("Statut modifié de Réservé à En transit")).toBeVisible();
  });

  test("the customer sees the staff update; unknown references are 404 for staff too", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto(`/en/portal/shipments/${fixture.shipmentRef}`);
    await expect(page.locator("main").getByText("In transit").first()).toBeVisible();
    await page.context().clearCookies();
    await signIn(page, STAFF, STAFF_PASSWORD);
    for (const bad of ["MLZZZZZZZZZZ", "not-a-reference"]) expect((await page.goto(`/en/admin/shipments/${bad}`))?.status(), bad).toBe(404);
  });

  test("shipment pages work on a phone and have no serious accessibility violations", async ({ browser }) => {
    const customerPage = await phone(browser);
    await customerPage.goto("/en/login");
    await customerPage.getByLabel(/email/i).fill(owner.email);
    await customerPage.getByLabel(/password/i).fill(owner.password);
    await customerPage.getByRole("button", { name: /sign in|log in/i }).click();
    await customerPage.waitForURL(/\/en\/portal/);
    for (const path of ["/en/portal/shipments", `/en/portal/shipments/${fixture.shipmentRef}`, `/fr/portal/shipments/${fixture.shipmentRef}`]) {
      await customerPage.goto(path);
      await noOverflowAndAccessible(customerPage, path);
    }
    await customerPage.context().close();

    await resetLocalLoginLimits();
    const staffPage = await phone(browser);
    await staffPage.goto("/en/login");
    await staffPage.getByLabel(/email/i).fill(STAFF);
    await staffPage.getByLabel(/password/i).fill(STAFF_PASSWORD);
    await staffPage.getByRole("button", { name: /sign in|log in/i }).click();
    await staffPage.waitForURL(/\/en\/admin/);
    for (const path of ["/en/admin/shipments", `/en/admin/shipments/${fixture.shipmentRef}`, `/fr/admin/shipments/${fixture.shipmentRef}`]) {
      await staffPage.goto(path);
      await noOverflowAndAccessible(staffPage, path);
    }
    await staffPage.context().close();
  });
});
