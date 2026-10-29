import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/en", "/fr", "/en/services", "/en/quote", "/fr/quote", "/en/track", "/en/about", "/fr/faq", "/en/privacy", "/en/contact", "/en/login"];

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

  for (const path of ["/en", "/en/quote", "/en/track", "/en/login", "/en/faq"]) {
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

  test("security headers are present", async ({ request }) => {
    const response = await request.get("/en");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
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

  test("skip link moves focus to main content", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard test on desktop");
    await page.goto("/en");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
  });
});
