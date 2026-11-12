import { readFileSync } from "node:fs";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { ItemsList } from "@/components/app/record-lists";

// The locale-aware Link pulls in next/navigation, which needs the Next.js runtime; ItemsList does not use it.
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));

const messages = { en: JSON.parse(readFileSync("messages/en.json", "utf8")), fr: JSON.parse(readFileSync("messages/fr.json", "utf8")) };
const render = (locale: "en" | "fr", items: unknown, showCurrentGuidePrice?: boolean) =>
  renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      // children go in the third argument (react/no-children-prop); the props type requires them, hence the assertion.
      { locale, messages: messages[locale], timeZone: "Europe/Dublin" } as ComponentProps<typeof NextIntlClientProvider>,
      createElement(ItemsList, { items, showCurrentGuidePrice }),
    ),
  );

const stored = [
  { catalogueItem: "barrels.barrel_220", description: "Barrel of clothes", quantity: 2 },
  { vehicleMake: "Toyota", vehicleModel: "Yaris", vehicleYear: 2015, running: true, shippingMethod: "roro", catalogueItem: "vehicles.small_city_car" },
];

describe("stored request items", () => {
  it("customer views show the chosen item by name but never a catalogue price", () => {
    for (const locale of ["en", "fr"] as const) {
      const html = render(locale, stored);
      expect(html).toContain(locale === "en" ? "220-litre barrel" : "Fût de 220 litres");
      expect(html).toContain(locale === "en" ? "Small city car" : "Petite citadine");
      expect(html).not.toMatch(/€|guide price|prix indicatif/i);
    }
  });

  it("staff views add the current guide price, labelled as a reference only", () => {
    const html = render("en", stored, true);
    expect(html).toContain("Current guide price (reference only): €200");
    expect(html).toContain("Current guide price (reference only): From €1,400");
    expect(render("fr", stored, true)).toContain("Prix indicatif actuel (référence uniquement)");
  });

  it("renders requests made before the catalogue, and ignores unknown keys", () => {
    const html = render("en", [{ description: "Old request", quantity: 1, catalogueItem: "removed.item" }], true);
    expect(html).toContain("Old request");
    expect(html).not.toMatch(/guide price/i);
  });
});
