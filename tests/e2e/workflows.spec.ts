import { expect, test } from "@playwright/test";

test.describe("quote request (submission disabled by default)", () => {
  test("explains up front that online requests are unavailable", async ({ page }) => {
    await page.goto("/en/quote");
    await expect(page.getByRole("status").filter({ hasText: "Online requests are temporarily unavailable" })).toBeVisible();
  });

  test("validates each step, then disables submission honestly at review", async ({ page }) => {
    await page.goto("/en/quote");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("This field is required.")).toBeVisible();

    await page.getByRole("radio", { name: /Barrels and boxes/ }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Where is it going?" })).toBeFocused();
    await page.getByRole("button", { name: "Continue" }).click();

    // Items: description is required.
    await page.getByRole("button", { name: "Continue" }).click();
    const description = page.getByLabel("Description");
    await expect(description).toHaveAttribute("aria-invalid", "true");
    await description.fill("Barrel of clothes");
    await page.getByRole("button", { name: "Continue" }).click();

    // Contact: email must be valid.
    await page.getByLabel("Full name").fill("Test Person");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a valid email address, like name@example.com.")).toBeVisible();
    await page.getByLabel("Email").fill("test@example.test");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Check your request" })).toBeVisible();
    await expect(page.getByText("No price is calculated automatically.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send quote request" })).toBeDisabled();
    await expect(page.getByText(/Request received/)).toHaveCount(0);
  });

  test("works in French", async ({ page }) => {
    await page.goto("/fr/quote");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Ce champ est obligatoire.")).toBeVisible();
  });
});

test.describe("tracking", () => {
  test("search produces a shareable result URL", async ({ page }) => {
    await page.goto("/en/track");
    await page.getByLabel("Shipment reference").fill("ml-abcd efgh 23");
    await page.getByRole("button", { name: "Track" }).click();
    await expect(page).toHaveURL(/\/en\/track\/MLABCDEFGH23$/);
    // No database in this environment: an honest unavailable message, never fake data.
    await expect(page.getByText("Online tracking is not available yet.")).toBeVisible();
  });
});

test.describe("protected areas without configured accounts", () => {
  for (const path of ["/en/portal", "/fr/admin", "/en/admin/users"]) {
    test(`${path} shows an honest unavailable state and no data`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("body")).toContainText(/Accounts are not available yet|Les comptes ne sont pas encore disponibles/);
      await expect(page.locator("body")).not.toContainText(/ML\d|Acme|shadcn/);
    });
  }

  test("old dashboard URL redirects to the staff area", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/admin$/);
  });
});
