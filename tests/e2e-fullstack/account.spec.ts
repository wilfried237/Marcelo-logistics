import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { resetLocalLoginLimits } from "./local-db";

/*
 * Stage 4: customer account journeys in a real browser against the production
 * build and the REAL local Supabase Auth (local only; see the config guard).
 * Each run creates its own confirmed test customer through the local GoTrue
 * admin API (as an invitation would), so the shared demo accounts are untouched.
 */

for (const file of [".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}
const url = process.env.SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error("Account journeys run only against the local Supabase stack.");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const EMAIL = `account.${randomUUID().slice(0, 8)}@example.test`;
const FIRST_PASSWORD = `First-${randomUUID()}`;
const NEW_PASSWORD = `Second-${randomUUID()}`;
let userId = "";

async function signIn(page: Page, password: string, locale = "en") {
  await page.goto(`/${locale}/login`);
  await page.getByLabel(/e-?mail/i).fill(EMAIL);
  await page.getByLabel(/password|mot de passe/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in|se connecter|connexion/i }).click();
}

test.describe.serial("Stage 4 customer account", () => {
  test.beforeEach(async () => resetLocalLoginLimits());
  test.beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: FIRST_PASSWORD, email_confirm: true, user_metadata: { full_name: "Account Journey", locale: "en" } });
    if (error || !data.user) throw new Error(`could not create the local test user: ${error?.message}`);
    userId = data.user.id;
  });
  test.afterAll(async () => {
    await resetLocalLoginLimits();
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  });

  test("a new customer signs in, sees an empty portal and their profile, in English and French", async ({ page }) => {
    await signIn(page, FIRST_PASSWORD);
    await page.waitForURL(/\/en\/portal$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/en/portal/profile");
    await expect(page.getByRole("heading", { name: "Sign-in and security" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(EMAIL);
    await page.goto("/fr/portal/profile");
    await expect(page.getByRole("heading", { name: "Connexion et sécurité" })).toBeVisible();
  });

  test("account pages work on a phone and have no serious accessibility violations (EN and FR)", async ({ browser }) => {
    const context = await browser.newContext({ ...devices["Pixel 7"] });
    const page = await context.newPage();
    await page.goto("/en/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(FIRST_PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/en\/portal$/);
    for (const path of ["/en/portal", "/en/portal/quotes", "/en/portal/shipments", "/en/portal/profile", "/fr/portal/profile", "/en/reset-password", "/fr/login?error=link_expired"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
      await expect(page.locator("h1"), path).toHaveCount(1);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${path} ${v.id}`)).toEqual([]);
    }
    await context.close();
  });

  test("wrong passwords get one generic message; expired and invalid email links are explained", async ({ page }) => {
    await signIn(page, "definitely-not-the-password");
    await expect(page.locator("main").getByRole("alert")).toHaveText("Email or password is incorrect.");
    await page.goto("/en/login?error=link_expired");
    await expect(page.locator("main").getByRole("alert")).toContainText("This link has expired or has already been used.");
    await page.goto("/fr/login?error=link_invalid");
    await expect(page.locator("main").getByRole("alert")).toContainText("Ce lien est invalide");
    await page.goto("/en/login?error=<script>");
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  });

  test("the customer changes their password from the profile; the old one stops working", async ({ page }) => {
    await signIn(page, FIRST_PASSWORD);
    await page.waitForURL(/\/en\/portal$/);
    await page.goto("/en/portal/profile");
    await page.getByRole("link", { name: "Change your password" }).click();
    await page.waitForURL(/\/en\/reset-password$/);
    await page.getByLabel(/^new password/i).fill(FIRST_PASSWORD);
    await page.getByLabel(/confirm/i).fill(FIRST_PASSWORD);
    await page.getByRole("button", { name: /save|update|change|set/i }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Your new password must be different from your current one.");
    await page.getByLabel(/^new password/i).fill(NEW_PASSWORD);
    await page.getByLabel(/confirm/i).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /save|update|change|set/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /password/i })).toBeVisible();

    const other = await page.context().browser()!.newContext();
    const fresh = await other.newPage();
    await fresh.goto("/en/login");
    await fresh.getByLabel(/email/i).fill(EMAIL);
    await fresh.getByLabel(/password/i).fill(FIRST_PASSWORD);
    await fresh.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(fresh.locator("main").getByRole("alert")).toHaveText("Email or password is incorrect.");
    await other.close();
  });

  test("'sign out on all devices' ends the other browser's session too", async ({ browser }) => {
    const laptop = await browser.newContext();
    const phone = await browser.newContext();
    const a = await laptop.newPage();
    const b = await phone.newPage();
    for (const p of [a, b]) {
      await p.goto("/en/login");
      await p.getByLabel(/email/i).fill(EMAIL);
      await p.getByLabel(/password/i).fill(NEW_PASSWORD);
      await p.getByRole("button", { name: /sign in|log in/i }).click();
      await p.waitForURL(/\/en\/portal$/);
    }
    await a.goto("/en/portal/profile");
    await a.getByRole("button", { name: "Sign out on all devices" }).click();
    await a.waitForURL(/\/en\/login\?signedOut=all$/);
    await expect(a.getByText("You have been signed out on all your devices.")).toBeVisible();
    expect((await a.request.get("/en/portal", { maxRedirects: 0 })).headers()["location"] ?? "").toMatch(/\/en\/login/);
    // The phone's session was revoked on the server: its next request is sent to sign in.
    const response = await b.request.get("/en/portal", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toMatch(/\/en\/login/);
    await laptop.close();
    await phone.close();
  });

  test("ordinary sign-out ends only this session", async ({ page }) => {
    await signIn(page, NEW_PASSWORD);
    await page.waitForURL(/\/en\/portal$/);
    await page.getByRole("button", { name: /sign out/i }).first().click();
    await page.waitForURL(/\/en$/);
    expect((await page.request.get("/en/portal", { maxRedirects: 0 })).headers()["location"] ?? "").toMatch(/\/en\/login/);
  });
});
