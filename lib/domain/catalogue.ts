import {
  CATALOGUE,
  CATALOGUE_CURRENCY,
  QUOTE_SERVICE_SECTIONS,
  type CatalogueItem,
  type CataloguePrice,
  type CatalogueSection,
  type CatalogueSectionKey,
} from "@/config/catalogue";
import type { ServiceCode } from "./services";

/*
 * Read-only helpers over the official price catalogue (config/catalogue.ts).
 * Pure functions, safe on the server and in the browser. Nothing here adds
 * prices together or derives a price: the catalogue is guidance only and the
 * owner's written quotation is the binding price.
 */

/** "<section>.<item>", e.g. "vehicles.small_city_car". Stored on quote request items. */
export type CatalogueItemId = `${CatalogueSectionKey}.${string}`;

export interface CatalogueEntry {
  id: CatalogueItemId;
  section: CatalogueSectionKey;
  group: string;
  item: CatalogueItem;
}

export function getSection(key: CatalogueSectionKey): CatalogueSection {
  const section = CATALOGUE.find((s) => s.key === key);
  if (!section) throw new Error(`Unknown catalogue section: ${key}`);
  return section;
}

/** Every catalogue entry in display order. */
export function allEntries(): CatalogueEntry[] {
  return CATALOGUE.flatMap((section) =>
    section.groups.flatMap((group) => group.items.map((item) => ({ id: `${section.key}.${item.key}` as CatalogueItemId, section: section.key, group: group.key, item }))),
  );
}

export function findEntry(id: string): CatalogueEntry | undefined {
  return allEntries().find((e) => e.id === id);
}

/** Items a customer may choose as "what I am shipping" for a quote service (no surcharges or fees). */
export function selectableEntriesFor(service: ServiceCode): CatalogueEntry[] {
  const sections = QUOTE_SERVICE_SECTIONS[service];
  return allEntries().filter((e) => sections.includes(e.section) && e.item.selectable !== false);
}

export function isSelectableFor(service: ServiceCode, id: string): boolean {
  return selectableEntriesFor(service).some((e) => e.id === id);
}

/** True when the business publishes no price and prepares an individual quotation. */
export function requiresQuotation(price: CataloguePrice): boolean {
  return price.kind === "quote";
}

const NUMBER_LOCALE: Record<string, string> = { en: "en-IE", fr: "fr-FR" };

/** Formats a whole amount, e.g. 1400 EUR -> "€1,400" (en) or "1 400 €" (fr). */
export function formatAmount(amount: number, locale: string, currency: string = CATALOGUE_CURRENCY): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[locale] ?? "en-IE", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

/**
 * The message key (under "catalogue.price") and its formatted arguments for a
 * price. Kept separate from React so it can be unit tested and reused in
 * server and client components alike.
 */
export function priceMessage(price: CataloguePrice, locale: string): { key: CataloguePrice["kind"]; values: Record<string, string> } {
  switch (price.kind) {
    case "fixed":
      return { key: "fixed", values: { amount: formatAmount(price.amount, locale, price.currency) } };
    case "from":
      return { key: "from", values: { amount: formatAmount(price.amount, locale) } };
    case "range":
      return { key: "range", values: { min: formatAmount(price.min, locale), max: formatAmount(price.max, locale) } };
    case "per_kg":
      return { key: "per_kg", values: { amount: formatAmount(price.amount, locale), minKg: String(price.minKg) } };
    case "per_day":
      return { key: "per_day", values: { amount: formatAmount(price.amount, locale, price.currency) } };
    case "quote":
      return { key: "quote", values: {} };
  }
}

/** Machine-readable price for structured data (JSON-LD); null when there is no published price. */
export function structuredPrice(price: CataloguePrice): { price?: string; minPrice?: string; maxPrice?: string; priceCurrency: string } | null {
  switch (price.kind) {
    case "fixed":
      return { price: String(price.amount), priceCurrency: price.currency ?? CATALOGUE_CURRENCY };
    case "from":
      return { minPrice: String(price.amount), priceCurrency: CATALOGUE_CURRENCY };
    case "range":
      return { minPrice: String(price.min), maxPrice: String(price.max), priceCurrency: CATALOGUE_CURRENCY };
    default:
      return null;
  }
}
