import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOGUE, CATALOGUE_SECTION_KEYS, QUOTE_SERVICE_SECTIONS, SERVICE_SECTIONS, type CataloguePrice } from "@/config/catalogue";
import { allEntries, findEntry, formatAmount, isSelectableFor, priceMessage, requiresQuotation, selectableEntriesFor, structuredPrice } from "@/lib/domain/catalogue";
import { quoteRequestInputSchema } from "@/lib/domain/quote-schema";
import { SERVICE_CODES, SERVICE_OFFERINGS } from "@/lib/domain/services";

const en = JSON.parse(readFileSync("messages/en.json", "utf8"));
const fr = JSON.parse(readFileSync("messages/fr.json", "utf8"));
const get = (obj: unknown, path: string) => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
const price = (id: string) => findEntry(id)?.item.price;

describe("official price catalogue (client price list, 2026-11-10)", () => {
  it("has unique section and item keys and only positive whole amounts", () => {
    expect(CATALOGUE.map((s) => s.key)).toEqual([...CATALOGUE_SECTION_KEYS]);
    const ids = allEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { item } of allEntries()) {
      const amounts = item.price.kind === "range" ? [item.price.min, item.price.max] : "amount" in item.price ? [item.price.amount] : [];
      for (const amount of amounts) expect(Number.isInteger(amount) && amount > 0, item.key).toBe(true);
      if (item.price.kind === "range") expect(item.price.max).toBeGreaterThan(item.price.min);
    }
  });

  it("matches the client's figures exactly", () => {
    expect(price("vehicles.small_city_car")).toEqual({ kind: "from", amount: 1400 });
    expect(price("vehicles.double_cab_pickup")).toEqual({ kind: "from", amount: 2700 });
    for (const id of ["vehicles.light_van", "vehicles.large_van", "vehicles.specialist", "vehicles.customs_clearance"]) expect(price(id)).toEqual({ kind: "quote" });
    expect(price("vehicles.conformity_certificate")).toEqual({ kind: "fixed", amount: 100 });
    expect(price("parcels.laptop")).toEqual({ kind: "range", min: 50, max: 70 });
    expect(price("parcels.small_parcel")).toEqual({ kind: "from", amount: 40 });
    expect(price("parcels.standard_parcel")).toEqual({ kind: "quote" });
    expect(price("barrels.barrel_220_supplied")).toEqual({ kind: "fixed", amount: 240 });
    expect(price("cartons.yaounde_large")).toEqual({ kind: "fixed", amount: 215 });
    expect(price("furniture.sofa_6")).toEqual({ kind: "fixed", amount: 850 });
    expect(price("furniture.electrical_certificate")).toEqual({ kind: "fixed", amount: 10 });
    expect(price("air_freight.per_kg")).toEqual({ kind: "per_kg", amount: 14, minKg: 1 });
    expect(price("collection.home_collection_dublin")).toEqual({ kind: "fixed", amount: 25 });
    expect(price("collection.storage_after_48h")).toEqual({ kind: "per_day", amount: 2000, currency: "XAF" });
    // Sea freight is always individually quoted: no invented sea prices.
    for (const e of allEntries().filter((e) => e.section === "sea_freight")) expect(requiresQuotation(e.item.price)).toBe(true);
  });

  it("flags the overlapping 55-inch television bands instead of resolving them", () => {
    expect(findEntry("furniture.tv_47_55")?.item.clarification).toBe("P-07");
    expect(findEntry("furniture.tv_55_65")?.item.clarification).toBe("P-07");
  });

  it("has an English and a French label (and examples where declared) for every entry, section and group", () => {
    for (const messages of [en, fr]) {
      for (const section of CATALOGUE) {
        expect(get(messages, `catalogue.sections.${section.key}.title`)).toBeTypeOf("string");
        for (let n = 1; n <= section.notes; n++) expect(get(messages, `catalogue.sections.${section.key}.note${n}`), `${section.key}.note${n}`).toBeTypeOf("string");
        for (const group of section.groups) expect(get(messages, `catalogue.groups.${group.key}`)).toBeTypeOf("string");
      }
      for (const { section, item } of allEntries()) {
        expect(get(messages, `catalogue.items.${section}.${item.key}.label`), `${section}.${item.key}`).toBeTypeOf("string");
        if (item.examples) expect(get(messages, `catalogue.items.${section}.${item.key}.examples`)).toBeTypeOf("string");
        if (item.clarification) expect(get(messages, `catalogue.clarification.${item.clarification.replace("-", "")}`)).toBeTypeOf("string");
      }
    }
  });

  it("maps every service page and every quote service to existing sections", () => {
    expect(Object.keys(SERVICE_SECTIONS).sort()).toEqual(SERVICE_OFFERINGS.map((s) => s.key).sort());
    expect(Object.keys(QUOTE_SERVICE_SECTIONS).sort()).toEqual([...SERVICE_CODES].sort());
    for (const code of SERVICE_CODES) expect(selectableEntriesFor(code).length, code).toBeGreaterThan(0);
  });

  it("shows the collection, delivery and storage prices only on the parcels and barrels service pages (S-07)", () => {
    const withCollection = Object.entries(SERVICE_SECTIONS).filter(([, sections]) => sections.includes("collection")).map(([key]) => key).sort();
    expect(withCollection).toEqual(["barrels", "parcels"]);
  });

  it("never offers surcharges or fees as the item being shipped", () => {
    for (const code of SERVICE_CODES) for (const e of selectableEntriesFor(code)) expect(e.item.selectable).not.toBe(false);
    expect(isSelectableFor("vehicle", "vehicles.conformity_certificate")).toBe(false);
    expect(isSelectableFor("parcels", "furniture.electrical_certificate")).toBe(false);
    expect(isSelectableFor("vehicle", "parcels.envelope")).toBe(false);
    expect(isSelectableFor("barrels", "cartons.douala_small")).toBe(true);
  });
});

describe("price display", () => {
  it("formats euros per locale without decimals", () => {
    expect(formatAmount(1400, "en")).toBe("€1,400");
    expect(formatAmount(1400, "fr").replace(/\s/g, " ")).toBe("1 400 €");
    expect(formatAmount(2000, "en", "XAF")).toMatch(/2,000/);
  });

  it("chooses the right message for each price kind", () => {
    const cases: [CataloguePrice, string, Record<string, string>][] = [
      [{ kind: "fixed", amount: 20 }, "fixed", { amount: "€20" }],
      [{ kind: "from", amount: 1400 }, "from", { amount: "€1,400" }],
      [{ kind: "range", min: 50, max: 70 }, "range", { min: "€50", max: "€70" }],
      [{ kind: "per_kg", amount: 14, minKg: 1 }, "per_kg", { amount: "€14", minKg: "1" }],
      [{ kind: "quote" }, "quote", {}],
    ];
    for (const [p, key, values] of cases) expect(priceMessage(p, "en")).toEqual({ key, values });
    for (const kind of ["fixed", "from", "range", "per_kg", "per_day", "quote"]) {
      expect(get(en, `catalogue.price.${kind}`)).toBeTypeOf("string");
      expect(get(fr, `catalogue.price.${kind}`)).toBeTypeOf("string");
    }
  });

  it("gives structured data only for published prices", () => {
    expect(structuredPrice({ kind: "fixed", amount: 120 })).toEqual({ price: "120", priceCurrency: "EUR" });
    expect(structuredPrice({ kind: "from", amount: 1400 })).toEqual({ minPrice: "1400", priceCurrency: "EUR" });
    expect(structuredPrice({ kind: "quote" })).toBeNull();
  });
});

describe("quote request integration", () => {
  const base = {
    originCountry: "IE",
    destinationCountry: "CM",
    contact: { name: "Test Person", email: "test@example.com", phone: "+353 89 123 4567" },
    locale: "en",
    idempotencyKey: "6f1d2c1e-0d1b-4f2a-9b7e-1a2b3c4d5e6f",
    privacyAccepted: true,
  };

  it("accepts a catalogue choice that belongs to the service and keeps it in the stored items", () => {
    const parsed = quoteRequestInputSchema.safeParse({ ...base, service: "barrels", items: [{ catalogueItem: "barrels.barrel_220", description: "220-litre barrel", quantity: "2" }] });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.items[0]).toMatchObject({ catalogueItem: "barrels.barrel_220", quantity: 2 });
  });

  it("accepts a vehicle category and shipping method", () => {
    const parsed = quoteRequestInputSchema.safeParse({
      ...base,
      service: "vehicle",
      items: [{ vehicleMake: "Toyota", vehicleModel: "RAV4", vehicleYear: "2018", running: true, catalogueItem: "vehicles.midsize_suv", shippingMethod: "roro" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a catalogue choice from another service, a surcharge, or an unknown key", () => {
    for (const [service, catalogueItem] of [
      ["parcels", "vehicles.small_city_car"],
      ["parcels", "furniture.electrical_certificate"],
      ["barrels", "barrels.barrel_999"],
    ] as const) {
      const parsed = quoteRequestInputSchema.safeParse({ ...base, service, items: [{ catalogueItem, description: "x", quantity: "1" }] });
      expect(parsed.success, catalogueItem).toBe(false);
      if (!parsed.success) expect(parsed.error.issues.some((i) => i.path.join(".") === "items.0.catalogueItem")).toBe(true);
    }
    const badMethod = quoteRequestInputSchema.safeParse({ ...base, service: "vehicle", items: [{ vehicleMake: "A", vehicleModel: "B", vehicleYear: "2018", shippingMethod: "air" }] });
    expect(badMethod.success).toBe(false);
  });

  it("still accepts requests without a catalogue choice (unchanged behaviour)", () => {
    expect(quoteRequestInputSchema.safeParse({ ...base, service: "parcels", items: [{ description: "Clothes", quantity: "1" }] }).success).toBe(true);
    expect(quoteRequestInputSchema.safeParse({ ...base, service: "parcels", items: [{ catalogueItem: "", description: "Clothes", quantity: "1" }] }).success).toBe(true);
  });
});

describe("Stage 3 content parity", () => {
  it("has detail content (intro, at least one list) in both languages for every service", () => {
    for (const messages of [en, fr]) {
      for (const { key } of SERVICE_OFFERINGS) {
        expect(get(messages, `serviceDetail.services.${key}.intro`), key).toBeTypeOf("string");
        expect(get(messages, `serviceDetail.services.${key}.what1`), key).toBeTypeOf("string");
        expect(get(messages, `serviceDetail.services.${key}.info1`), key).toBeTypeOf("string");
      }
      for (let n = 1; n <= 12; n++) expect(get(messages, `prohibited.item${n}`)).toBeTypeOf("string");
    }
  });

  it("publishes no legal-review items and no unconfirmed contact details", () => {
    for (const file of ["messages/en.json", "messages/fr.json"]) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/BIFA|UKWA|\bRHA\b/);
      expect(text).not.toMatch(/€\s?400|400\s?€|€\s?150|150\s?€/); // compensation cap and prohibited-goods fee await legal review
      expect(text).not.toMatch(/896\s?160\s?927|marchelogistics\.com|info@marchelo/);
    }
  });
});
