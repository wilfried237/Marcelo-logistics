import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CONSENT_COOKIE, CONSENT_POLICY_VERSION } from "../../lib/consent/consent";

// Start every test as a first-time visitor (the shared config presets a choice).
test.use({ storageState: { cookies: [], origins: [] } });

async function consentValue(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === CONSENT_COOKIE)?.value;
}
const banner = (page: Page) => page.getByRole("region", { name: /Cookie consent|Consentement aux cookies/ });

test.describe("cookie consent", () => {
  test("first visit: discreet banner, three equal choices, only necessary cookies, no third-party requests", async ({ page, baseURL }) => {
    const hosts = new Set<string>();
    page.on("request", (request) => hosts.add(new URL(request.url()).host));
    await page.goto("/en");
    const region = banner(page);
    await expect(region).toBeVisible();
    const accept = region.getByRole("button", { name: "Accept all" });
    const reject = region.getByRole("button", { name: "Reject optional cookies" });
    await expect(accept).toBeVisible();
    await expect(reject).toBeVisible();
    await expect(region.getByRole("button", { name: "Customise preferences" })).toBeVisible();
    // Refusing is as easy as accepting: same styling and same size.
    expect(await reject.getAttribute("class")).toBe(await accept.getAttribute("class"));
    const [a, r] = [await accept.boundingBox(), await reject.boundingBox()];
    expect(Math.abs((a?.height ?? 0) - (r?.height ?? 0))).toBeLessThanOrEqual(1);
    // Before any choice: only the strictly necessary language cookie; nothing optional, nothing third-party.
    const names = (await page.context().cookies()).map((c) => c.name);
    expect(names.every((n) => n === "NEXT_LOCALE")).toBe(true);
    expect([...hosts]).toEqual([new URL(baseURL!).host]);
    // The page underneath stays usable (not a modal).
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(region.getByRole("link", { name: "Cookie policy" })).toHaveAttribute("href", "/en/cookies");
  });

  test("reject optional cookies: stored with the policy version, remembered across pages", async ({ page }) => {
    await page.goto("/en");
    await banner(page).getByRole("button", { name: "Reject optional cookies" }).click();
    await expect(banner(page)).toHaveCount(0);
    expect(await consentValue(page)).toMatch(new RegExp(`^${CONSENT_POLICY_VERSION}\\.0\\.0\\.0\\.\\d+$`));
    await page.goto("/en/services");
    await expect(banner(page)).toHaveCount(0);
  });

  test("accept all, then withdraw from the footer link", async ({ page }) => {
    await page.goto("/en");
    await banner(page).getByRole("button", { name: "Accept all" }).click();
    expect(await consentValue(page)).toMatch(/^\d+\.1\.1\.1\.\d+$/);
    await page.reload();
    await page.locator("footer").getByRole("button", { name: "Cookie preferences" }).click();
    const dialog = page.getByRole("dialog", { name: "Cookie preferences" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("switch", { name: /Analytics/ })).toBeChecked();
    await dialog.getByRole("button", { name: "Reject optional cookies" }).click();
    await expect(dialog).toHaveCount(0);
    expect(await consentValue(page)).toMatch(/^\d+\.0\.0\.0\.\d+$/);
  });

  test("customise: nothing pre-ticked, necessary locked on, a single category can be chosen", async ({ page }) => {
    await page.goto("/en");
    await banner(page).getByRole("button", { name: "Customise preferences" }).click();
    const dialog = page.getByRole("dialog", { name: "Cookie preferences" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Always active", { exact: true })).toBeVisible();
    const switches = dialog.getByRole("switch");
    await expect(switches).toHaveCount(3);
    for (const s of await switches.all()) await expect(s).not.toBeChecked();
    await expect(dialog.getByText("Not used on this website at present.")).toHaveCount(3);
    await dialog.getByRole("switch", { name: /Analytics/ }).check();
    await dialog.getByRole("button", { name: "Save my choices" }).click();
    expect(await consentValue(page)).toMatch(/^\d+\.0\.1\.0\.\d+$/);
    await expect(banner(page)).toHaveCount(0);
  });

  test("Escape closes the preferences without recording a choice", async ({ page }) => {
    await page.goto("/en");
    await banner(page).getByRole("button", { name: "Customise preferences" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await consentValue(page)).toBeUndefined();
    await expect(banner(page)).toBeVisible();
  });

  test("a choice made under an older policy version is asked again", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: CONSENT_COOKIE, value: `${CONSENT_POLICY_VERSION + 1}.1.1.1.${Math.floor(Date.now() / 1000)}`, url: baseURL! }]);
    await page.goto("/en");
    await expect(banner(page)).toBeVisible();
  });

  test("French banner, dialog and cookie policy page", async ({ page }) => {
    await page.goto("/fr");
    const region = banner(page);
    await expect(region.getByRole("button", { name: "Tout accepter" })).toBeVisible();
    await expect(region.getByRole("button", { name: "Refuser les cookies facultatifs" })).toBeVisible();
    await region.getByRole("button", { name: "Personnaliser mes choix" }).click();
    const dialog = page.getByRole("dialog", { name: "Préférences cookies" });
    await expect(dialog.getByText("Toujours actifs", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Enregistrer mes choix" }).click();
    expect(await consentValue(page)).toMatch(/^\d+\.0\.0\.0\.\d+$/);
    await page.goto("/fr/cookies");
    await expect(page.locator("h1")).toHaveText("Politique relative aux cookies");
    await expect(page.getByText("NEXT_LOCALE")).toBeVisible();
    await expect(page.getByText(CONSENT_COOKIE, { exact: true })).toBeVisible();
  });

  test("banner and dialog fit the screen and have no serious accessibility violations", async ({ page }) => {
    await page.goto("/en");
    const region = banner(page);
    const box = await region.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.height).toBeLessThan(viewport.height * 0.6);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const scan = async () => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
    expect(await scan()).toEqual([]);
    await region.getByRole("button", { name: "Customise preferences" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await scan()).toEqual([]);
  });
});
