/**
 * Authenticated journeys in a real browser against a LOCAL build connected to
 * the LOCAL Supabase stack (see docs/TESTING.md):
 *   npm run db:seed && npm run build && npx next start -p 3100
 *   node scripts/verify-local-journeys.mjs
 * Uses the fictitious seed users and the seed password. Prints no secrets.
 */
import { chromium } from "playwright";

const BASE = process.env.JOURNEY_BASE_URL ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error("verify-local-journeys: local URLs only");
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "local-only-demo-password";
const results = [];
const check = (name, ok) => { results.push(`${ok ? "PASS" : "FAIL"}  ${name}`); };

const browser = await chromium.launch({ channel: "chrome" });

async function login(email) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const violations = [];
  page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
  await page.goto(`${BASE}/en/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/(portal|admin)/, { timeout: 15000 }).catch(() => {});
  return { context, page, violations };
}

// Wrong password: generic error, no redirect
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/en/login`);
  await page.getByLabel(/email/i).fill("demo.customer1@example.test");
  await page.getByLabel(/password/i).fill("definitely-wrong-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForTimeout(2500);
  check("wrong password stays on login", page.url().includes("/en/login"));
  await context.close();
}

// Unauthenticated access to protected areas redirects to login
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/en/portal`);
  check("anonymous /en/portal -> login", page.url().includes("/login"));
  await page.goto(`${BASE}/en/admin`);
  check("anonymous /en/admin -> login", page.url().includes("/login"));
  await context.close();
}

// Customer
{
  const { context, page, violations } = await login("demo.customer1@example.test");
  check("customer lands on /en/portal", /\/en\/portal/.test(page.url()));
  const cookies = await context.cookies();
  const session = cookies.filter((c) => c.name.startsWith("sb-"));
  check("session cookie set", session.length > 0);
  check("session cookies HttpOnly + SameSite=Lax", session.length > 0 && session.every((c) => c.httpOnly && c.sameSite === "Lax"));
  check("session cookies not Secure on http://localhost", session.every((c) => !c.secure));
  const admin = await page.goto(`${BASE}/en/admin`);
  check("customer gets 404 on /en/admin", admin?.status() === 404);
  const users = await page.goto(`${BASE}/en/admin/users`);
  check("customer gets 404 on /en/admin/users", users?.status() === 404);
  await page.goto(`${BASE}/en/portal/quotes`);
  check("customer quotes page renders", (await page.locator("h1").count()) === 1);
  check("no CSP violations (customer)", violations.length === 0);
  // Sign out
  const signOut = page.getByRole("button", { name: /sign out|log out/i }).first();
  if (await signOut.count()) {
    await signOut.click();
    await page.waitForTimeout(1500);
    await page.goto(`${BASE}/en/portal`);
    check("after sign-out /en/portal -> login", page.url().includes("/login"));
  } else check("sign-out button found", false);
  await context.close();
}

// Staff
{
  const { context, page, violations } = await login("demo.staff@example.test");
  check("staff lands on /en/admin", /\/en\/admin/.test(page.url()));
  const users = await page.goto(`${BASE}/en/admin/users`);
  check("staff gets 404 on admin-only /en/admin/users", users?.status() === 404);
  await page.goto(`${BASE}/fr/admin`);
  check("staff area renders in French", (await page.locator("html").getAttribute("lang")) === "fr");
  check("no CSP violations (staff)", violations.length === 0);
  await context.close();
}

// Admin
{
  const { context, page } = await login("demo.admin@example.test");
  check("admin lands on /en/admin", /\/en\/admin/.test(page.url()));
  const users = await page.goto(`${BASE}/en/admin/users`);
  check(`admin can open /en/admin/users (status ${users?.status()}, ${new URL(page.url()).pathname})`, users?.status() === 200);
  await context.close();
}

await browser.close();
console.log(results.join("\n"));
const passed = results.filter((r) => r.startsWith("PASS")).length;
console.log(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
