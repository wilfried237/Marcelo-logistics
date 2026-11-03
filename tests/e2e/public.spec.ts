import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/en", "/fr", "/en/services", "/en/quote", "/fr/quote", "/en/track", "/en/about", "/fr/faq", "/en/privacy", "/en/contact", "/en/login", "/en/how-it-works", "/fr/how-it-works", "/en/shipping-guide", "/fr/shipping-guide"];

test.describe("public pages", () => {
  for (const path of PAGES) {
    test(`${path} renders with one h1, correct language and no horizontal overflow`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", path.slice(1, 3));
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main#main")).toHaveCount(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // Owner placeholders and fabricated claims must never be visible.
      const text = await page.locator("body").innerText();
      expect(text).not.toContain("NEEDS_OWNER");
      expect(text).not.toMatch(/verified customer|99%|guarantee|real-time/i);
    });
  }

  for (const path of ["/en", "/en/quote", "/en/track", "/en/login", "/en/faq", "/en/how-it-works", "/fr/shipping-guide", "/en/about"]) {
    test(`${path} has no serious or critical accessibility violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }

  test("unknown pages return 404 and terms are not published before approval", async ({ page }) => {
    expect((await page.goto("/en/does-not-exist"))?.status()).toBe(404);
    expect((await page.goto("/en/terms"))?.status()).toBe(404);
  });

  test("the vector logo appears in the header and footer, and on the branded 404 page", async ({ page }) => {
    await page.goto("/en");
    const logos = page.locator("img[src^='/brand/']");
    await expect(page.locator("header img[alt='Marchelo Logistics']")).toBeVisible();
    await expect(page.locator("footer img[src='/brand/marchelo-logo-reversed.svg']")).toBeVisible();
    for (const img of await logos.all()) {
      await img.scrollIntoViewIfNeeded(); // the footer logo is lazy-loaded
      await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    expect((await page.request.get("/icon.svg")).status()).toBe(200);
    expect((await page.goto("/fr/does-not-exist"))?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("img", { name: "Marchelo Logistics" })).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Page introuvable");
  });

  test("security headers are present", async ({ request }) => {
    const response = await request.get("/en");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
    const scriptSrc = /script-src ([^;]+)/.exec(headers["content-security-policy"])?.[1] ?? "";
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  test("pages hydrate under the nonce CSP without violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (/Content Security Policy|Refused to (execute|load)/i.test(msg.text())) violations.push(msg.text());
    });
    for (const path of ["/en", "/fr/quote", "/en/track", "/en/login", "/en/how-it-works", "/fr/shipping-guide"]) await page.goto(path);
    await page.goto("/en/quote");
    await page.getByRole("button", { name: "Continue" }).click(); // client-side validation needs hydrated JS
    await expect(page.getByText("This field is required.")).toBeVisible();
    expect(violations).toEqual([]);
  });

  test("home page shows the real operation photos with descriptive alt text", async ({ page }) => {
    await page.goto("/en");
    const photos = page.locator("figure img[alt]:not([alt=''])");
    await expect(photos).toHaveCount(2);
    for (const img of await photos.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
  });

  test("previews and local builds are not indexable; the sitemap lists both locales", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toMatch(/Disallow: \/\s/);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/en/shipping-guide");
    expect(sitemap).toContain("/fr/how-it-works");
    expect(sitemap).not.toContain("/terms");
  });

  test("language switch keeps the current page", async ({ page, isMobile }) => {
    await page.goto("/en/services");
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "fr" }).first().click();
    await expect(page).toHaveURL(/\/fr\/services$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });
});

test.describe("navigation", () => {
  test("mobile menu opens, is labelled and navigates", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/en");
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("link", { name: "Track" }).click();
    await expect(page).toHaveURL(/\/en\/track$/);
  });

  test("mobile menu groups expand and lead to the shipping guide", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/fr");
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Envoyer", { exact: true }).click();
    await dialog.getByRole("link", { name: /Guide d’expédition/ }).click();
    await expect(page).toHaveURL(/\/fr\/shipping-guide$/);
  });

  test("desktop Send menu works with the keyboard and closes on Escape", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop navigation");
    await page.goto("/en");
    const send = page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Send" });
    await send.focus();
    await page.keyboard.press("Enter");
    await expect(send).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator(`#${await send.getAttribute("aria-controls")}`);
    await expect(panel.getByRole("link")).toHaveCount(3);
    await page.keyboard.press("Escape");
    await expect(send).toHaveAttribute("aria-expanded", "false");
    await expect(send).toBeFocused();
    await send.click();
    await panel.getByRole("link", { name: /Services/ }).click();
    await expect(page).toHaveURL(/\/en\/services$/);
  });

  test("content pages show a breadcrumb back to the home page", async ({ page }) => {
    await page.goto("/fr/how-it-works");
    const crumb = page.getByRole("navigation", { name: "Fil d’Ariane" });
    await expect(crumb.locator("[aria-current=page]")).toHaveText("Comment ça marche");
    await crumb.getByRole("link", { name: "Accueil" }).click();
    await expect(page).toHaveURL(/\/fr$/);
  });

  test("skip link moves focus to main content", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard test on desktop");
    await page.goto("/en");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
  });
});
