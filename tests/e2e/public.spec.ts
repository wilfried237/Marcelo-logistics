import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/en", "/fr", "/en/services", "/en/prices", "/fr/prices", "/en/services/vehicle", "/fr/services/barrels", "/en/services/customs_clearance", "/en/quote", "/fr/quote", "/en/track", "/en/about", "/fr/faq", "/en/privacy", "/en/cookies", "/fr/cookies", "/en/contact", "/en/login", "/en/how-it-works", "/fr/how-it-works", "/en/shipping-guide", "/fr/shipping-guide"];

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

  for (const path of ["/en", "/fr", "/en/services", "/fr/services", "/en/prices", "/fr/prices", "/en/services/vehicle", "/fr/services/parcels", "/en/shipping-guide", "/fr/faq", "/en/quote", "/en/track", "/en/login", "/en/faq", "/en/how-it-works", "/fr/shipping-guide", "/en/about", "/en/contact", "/en/cookies", "/fr/cookies"]) {
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

  test("photos and illustrations load, keep their aspect ratio and have descriptive alt text", async ({ page }) => {
    for (const path of ["/en", "/fr/services", "/en/how-it-works", "/en/about", "/en/shipping-guide"]) {
      await page.goto(path);
      const visuals = page.locator("main img[src*='/images/'], main img[src*='_next/image']");
      expect(await visuals.count(), path).toBeGreaterThan(0);
      for (const img of await visuals.all()) {
        if (!(await img.isVisible())) continue; // e.g. the contact illustration is hidden below md on the home page
        await img.scrollIntoViewIfNeeded();
        expect((await img.getAttribute("alt"))?.length ?? 0, `${path}: alt text`).toBeGreaterThan(10);
        await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        // Rendered size follows the intrinsic ratio unless the image is deliberately cropped (object-cover).
        const { ratio, natural, cover } = await img.evaluate((el) => {
          const i = el as HTMLImageElement;
          const r = i.getBoundingClientRect();
          return { ratio: r.width / r.height, natural: i.naturalWidth / i.naturalHeight, cover: getComputedStyle(i).objectFit === "cover" };
        });
        if (!cover) expect(Math.abs(ratio - natural), `${path}: distorted image`).toBeLessThan(0.05);
      }
    }
  });

  test("previews and local builds are not indexable; the sitemap lists both locales", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toMatch(/Disallow: \/\s/);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/en/shipping-guide");
    expect(sitemap).toContain("/fr/how-it-works");
    expect(sitemap).toContain("/fr/cookies");
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
    await expect(panel.getByRole("link")).toHaveCount(4);
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

test.describe("business information supplied by the client", () => {
  for (const locale of ["en", "fr"] as const) {
    test(`/${locale}/contact and the footer show both locations with working tel: and mailto: links`, async ({ page }) => {
      await page.goto(`/${locale}/contact`);
      const main = page.locator("main");
      await expect(main.getByText("12 Griffeen Glen Chase, Lucan, Co. Dublin, Ireland")).toBeVisible();
      await expect(main.getByText("Ndogsimbi, Douala, face Station-Service Gulfil, Cameroun")).toBeVisible();
      await expect(main.locator('a[href="tel:+353894840017"]')).toHaveText("+353 89 484 0017");
      await expect(main.locator('a[href="tel:+237659685479"]')).toHaveText("+237 6 59 68 54 79");
      await expect(main.locator('a[href="mailto:info.cargo@marchelo-logistics.com"]')).toHaveText("info.cargo@marchelo-logistics.com");
      const footer = page.locator("footer");
      await expect(footer.locator('a[href="tel:+353894840017"]')).toBeVisible();
      await expect(footer.locator('a[href="tel:+237659685479"]')).toBeVisible();
      await expect(footer.locator('a[href="mailto:info.cargo@marchelo-logistics.com"]')).toBeVisible();
      // The previous site's unverified details (a Gmail address and old numbers) are never shown.
      expect(await page.content()).not.toMatch(/@gmail\.com|\+353896160927|\+237695739033/);
    });

    test(`/${locale}/contact and the footer show the two confirmed WhatsApp numbers and 24/7 opening hours`, async ({ page }) => {
      await page.goto(`/${locale}/contact`);
      for (const scope of [page.locator("main"), page.locator("footer")]) {
        const ie = scope.locator('a[href="https://wa.me/353894840017"]');
        const cm = scope.locator('a[href="https://wa.me/237659685479"]');
        await expect(ie).toHaveText("+353 89 484 0017");
        await expect(cm).toHaveText("+237 6 59 68 54 79");
        for (const link of [ie, cm]) {
          await expect(link).toHaveAttribute("target", "_blank");
          await expect(link).toHaveAttribute("rel", /noopener/);
        }
        await expect(scope.getByText(locale === "en" ? "Open 24 hours a day, 7 days a week." : "Ouvert 24h/24 et 7j/7.")).toBeVisible();
        // 24/7 availability is never presented as 24/7 staffed drop-off: handover times are agreed per shipment.
        await expect(scope.getByText(locale === "en" ? /handing over or collecting goods are agreed with you/ : /remise et de retrait des marchandises sont convenus avec vous/)).toBeVisible();
      }
      // Exactly these two WhatsApp contacts, nothing else.
      expect(await page.locator('a[href^="https://wa.me/"]').count()).toBe(4);
    });
  }

  test("every service is confirmed: no 'availability on request' label on the services page or the quote form", async ({ page }) => {
    for (const path of ["/en/services", "/fr/services", "/en/quote"]) {
      await page.goto(path);
      await expect(page.getByText(/Availability on request|Disponibilité sur demande/)).toHaveCount(0);
    }
  });

  const SERVICES = {
    en: ["Air freight and express parcels", "Sea freight: full containers and groupage (FCL and LCL)", "Vehicle shipping", "Barrels and boxes", "Parcels and personal effects", "Commercial cargo", "Customs clearance", "Warehousing and distribution", "E-commerce and online shopping"],
    fr: ["Fret aérien et colis express", "Fret maritime : conteneurs complets et groupage", "Transport de véhicules", "Fûts et cartons", "Colis et effets personnels", "Marchandises commerciales", "Dédouanement", "Entreposage et distribution", "E-commerce et achats en ligne"],
  } as const;
  for (const locale of ["en", "fr"] as const) {
    test(`/${locale}/services lists every service, existing and added`, async ({ page }) => {
      await page.goto(`/${locale}/services`);
      const titles = await page.locator("main h4").allInnerTexts();
      expect(titles.map((s) => s.trim())).toEqual([...SERVICES[locale]]);
    });
  }
});
