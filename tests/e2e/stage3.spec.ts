import { expect, test } from "@playwright/test";

/** Stage 3: price catalogue, service pages, shipping guide, FAQ and quote-form guidance. Read-only (no submission). */
test.describe("prices", () => {
  test("the prices page shows EUR guide prices, quotation-only items and the disclosure, in English", async ({ page }) => {
    await page.goto("/en/prices");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1, name: "Prices" })).toBeVisible();
    const row = (name: string) => main.getByRole("row", { name: new RegExp(name) });
    await expect(row("Small city car")).toContainText("From €1,400");
    await expect(row("Laptop")).toContainText("€50–€70");
    await expect(row("220-litre barrel supplied by Marchelo Logistics")).toContainText("€240");
    await expect(row("Large commercial van")).toContainText("Individual quotation");
    await expect(row("Express air freight from 1 kg")).toContainText("€14 per kg (from 1 kg)");
    await expect(row("Television, 55–65 inches")).toContainText("Is your screen exactly 55 inches?");
    await expect(main.getByText("Listed prices include applicable VAT.")).toBeVisible();
    await expect(main.getByText("Vehicle customs clearance is not included in the shipping price and is quoted separately.")).toBeVisible();
    // The table of contents jumps to each section.
    await main.getByRole("link", { name: "Standard cartons" }).click();
    await expect(page).toHaveURL(/#cartons$/);
  });

  test("the French prices page formats euros the French way", async ({ page }) => {
    await page.goto("/fr/prices");
    const main = page.locator("main");
    await expect(main.getByRole("row", { name: /Petite citadine/ })).toContainText(/À partir de 1\s400\s€/);
    await expect(main.getByRole("row", { name: /Grand utilitaire/ })).toContainText("Sur devis");
    await expect(main.getByText("Les prix affichés incluent la TVA applicable.")).toBeVisible();
  });

  test("structured data is present, nonced and does not make the page indexable", async ({ page, request }) => {
    await page.goto("/en/prices");
    const script = page.locator('script[type="application/ld+json"]');
    await expect(script).toHaveCount(1);
    // Browsers hide the nonce attribute after parsing; the value stays on the element's property.
    expect(await script.evaluate((el) => (el as HTMLScriptElement).nonce)).toBeTruthy();
    const data = JSON.parse((await script.textContent()) ?? "{}");
    expect(data["@type"]).toBe("OfferCatalog");
    expect((await request.get("/robots.txt")).ok()).toBe(true);
    expect(await (await request.get("/robots.txt")).text()).toMatch(/Disallow: \//);
  });
});

test.describe("service pages", () => {
  test("every service on the services page links to a detail page", async ({ page }) => {
    await page.goto("/en/services");
    const links = page.locator('main a[href^="/en/services/"]');
    expect(await links.count()).toBeGreaterThanOrEqual(9);
    await page.locator("main h4").getByRole("link", { name: "Vehicle shipping" }).click();
    await expect(page).toHaveURL(/\/en\/services\/vehicle$/);
    await expect(page.locator("h1")).toHaveText("Vehicle shipping");
  });

  test("the vehicle page explains container vs RORO, the NCT rule and links to a pre-selected quote", async ({ page }) => {
    await page.goto("/en/services/vehicle");
    const main = page.locator("main");
    await expect(main.getByText("RORO shipping: no personal effects may be left inside the vehicle.")).toBeVisible();
    await expect(main.getByText(/The NCT must not have expired more than two years ago/)).toBeVisible();
    await expect(main.getByRole("row", { name: /Technical conformity certificate/ })).toContainText("€100");
    await main.getByRole("link", { name: "Request a quote for this service" }).first().click();
    await expect(page).toHaveURL(/\/en\/quote\?service=vehicle$/);
    await expect(page.getByRole("radio", { name: /Vehicle shipping/ })).toBeChecked();
  });

  test("support services without an online quote send customers to the contact page", async ({ page }) => {
    await page.goto("/fr/services/customs_clearance");
    await expect(page.locator("h1")).toHaveText("Dédouanement");
    await expect(page.locator("main").getByRole("link", { name: "Nous poser une question sur ce service" }).first()).toHaveAttribute("href", "/fr/contact");
  });

  test("an unknown service returns 404", async ({ page }) => {
    expect((await page.goto("/en/services/teleportation"))?.status()).toBe(404);
  });
});

test.describe("shipping guide and FAQ", () => {
  test("the guide shows payment rules, the official prohibited goods list and its disclaimer", async ({ page }) => {
    await page.goto("/en/shipping-guide");
    const main = page.locator("main");
    await expect(main.getByText("We accept bank transfer and Revolut.")).toBeVisible();
    await expect(main.getByText("Sea freight groupage: a 20% deposit is due at booking.")).toBeVisible();
    await expect(main.locator("#prohibited li")).toHaveCount(12);
    await expect(main.getByText(/does not replace current customs and transport regulations/)).toBeVisible();
    await expect(main.getByText("These are our own business policies. They do not affect your statutory rights.")).toBeVisible();
  });

  test("the French FAQ is grouped by topic and answers the XAF question", async ({ page }) => {
    await page.goto("/fr/faq");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 2 })).toHaveCount(6);
    await main.getByText("Puis-je payer en francs CFA (XAF) ?").click();
    await expect(main.getByText("Uniquement pour les envois du Cameroun vers l’Irlande.")).toBeVisible();
  });
});

test.describe("quote form guidance (submission disabled in this environment)", () => {
  test("choosing a catalogue item shows its guide price, pre-fills the description and appears at review", async ({ page }) => {
    await page.goto("/en/quote?service=barrels&item=barrels.barrel_220");
    await expect(page.getByRole("radio", { name: /Barrels and boxes/ })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    const itemType = page.getByLabel(/Item type/);
    await expect(itemType).toHaveValue("barrels.barrel_220");
    await expect(page.getByText("Guide price: €200")).toBeVisible();
    await itemType.selectOption("cartons.yaounde_medium");
    await expect(page.getByText("Guide price: €125")).toBeVisible();
    await expect(page.getByLabel("Description")).toHaveValue("Medium carton (Yaoundé)");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Full name").fill("Test Person");
    await page.getByLabel("Email").fill("test@example.test");
    await page.getByLabel(/Phone/).fill("+353 89 123 4567");
    await page.getByLabel(/I have read how my information/).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Medium carton \(Yaoundé\) \(Guide price: €125\)/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send quote request" })).toBeDisabled();
  });

  test("vehicles show a category with guide price and a shipping method; vans need a quotation", async ({ page }) => {
    await page.goto("/fr/quote?service=vehicle");
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel(/Catégorie de véhicule/).selectOption("vehicles.light_van");
    await expect(page.getByText("Cet article fait l’objet d’un devis individuel.")).toBeVisible();
    await page.getByLabel(/Catégorie de véhicule/).selectOption("vehicles.compact_suv");
    await expect(page.getByText(/Prix indicatif : À partir de 1\s900\s€/)).toBeVisible();
    await expect(page.getByLabel(/Mode d’expédition/).locator("option")).toHaveCount(3);
  });

  test("unknown or mismatched pre-selections are ignored", async ({ page }) => {
    await page.goto("/en/quote?service=parcels&item=vehicles.small_city_car");
    await expect(page.getByRole("radio", { name: /Parcels and personal effects/ })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel(/Item type/)).toHaveValue("");
    await page.goto("/en/quote?service=rockets");
    for (const radio of await page.getByRole("radio").all()) await expect(radio).not.toBeChecked();
  });
});
