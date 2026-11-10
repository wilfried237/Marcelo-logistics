/**
 * OFFICIAL PRICE CATALOGUE (guide prices)
 *
 * The single source of truth for every price shown on the website. Supplied by
 * the client and confirmed by the owner as official on 2026-11-10 (Stage 3).
 * Page components never hold prices: they render this file through
 * lib/domain/catalogue.ts and components/pricing/*.
 *
 * Rules:
 * - Amounts are whole units of the stated currency (all EUR except the one
 *   storage charge the client states in XAF; see docs/DECISIONS-REQUIRED.md, P-09).
 * - Nothing here is a final price. The written quotation prepared by the owner
 *   is the only binding price (P-01). The website never totals these figures.
 * - Do not add a price the client has not supplied. Unknown prices are
 *   `{ kind: "quote" }` (individual quotation).
 * - Labels, examples and notes are translated in messages/*.json under
 *   "catalogue" (keys mirror the structure below).
 */
import type { ServiceCode, ServiceKey } from "@/lib/domain/services";

export type CatalogueCurrency = "EUR" | "XAF";

export type CataloguePrice =
  /** A fixed price, e.g. €20. */
  | { kind: "fixed"; amount: number; currency?: CatalogueCurrency }
  /** A starting price, e.g. from €1,400. */
  | { kind: "from"; amount: number }
  /** A price range, e.g. €50–€70. */
  | { kind: "range"; min: number; max: number }
  /** A rate per kilogram with a minimum weight, e.g. €14/kg from 1 kg. */
  | { kind: "per_kg"; amount: number; minKg: number }
  /** A daily charge, e.g. 2,000 XAF per day. */
  | { kind: "per_day"; amount: number; currency: CatalogueCurrency }
  /** No published price: the business prepares an individual quotation. */
  | { kind: "quote" };

/** Open questions that affect how an item may be presented (docs/DECISIONS-REQUIRED.md). */
export type ClarificationId = "P-07" | "P-08" | "P-09";

export interface CatalogueItem {
  /** Unique within its section. Stored on quote requests as "<section>.<key>". */
  key: string;
  price: CataloguePrice;
  /** True when messages hold "catalogue.items.<section>.<key>.examples". */
  examples?: boolean;
  /**
   * False for surcharges and fees (certificates, collection, storage): they are
   * shown in price tables but cannot be chosen as the item being shipped.
   */
  selectable?: boolean;
  /** Shown with a note asking the customer to confirm the price in the quotation. */
  clarification?: ClarificationId;
}

export interface CatalogueGroup {
  /** Translated as "catalogue.groups.<key>". */
  key: string;
  items: readonly CatalogueItem[];
}

export const CATALOGUE_SECTION_KEYS = ["vehicles", "parcels", "barrels", "cartons", "furniture", "sea_freight", "air_freight", "collection"] as const;
export type CatalogueSectionKey = (typeof CATALOGUE_SECTION_KEYS)[number];

export interface CatalogueSection {
  key: CatalogueSectionKey;
  groups: readonly CatalogueGroup[];
  /** Numbered notes translated as "catalogue.sections.<key>.note<n>", shown under the table. */
  notes: number;
}

export const CATALOGUE_CURRENCY: CatalogueCurrency = "EUR";

export const CATALOGUE: readonly CatalogueSection[] = [
  {
    key: "vehicles",
    notes: 4,
    groups: [
      {
        key: "vehicle_categories",
        items: [
          { key: "small_city_car", price: { kind: "from", amount: 1400 }, examples: true },
          { key: "compact_saloon", price: { kind: "from", amount: 1600 }, examples: true },
          { key: "family_saloon", price: { kind: "from", amount: 1800 }, examples: true },
          { key: "compact_suv", price: { kind: "from", amount: 1900 }, examples: true },
          { key: "midsize_suv", price: { kind: "from", amount: 2100 }, examples: true },
          { key: "large_suv", price: { kind: "from", amount: 2300 }, examples: true },
          { key: "double_cab_pickup", price: { kind: "from", amount: 2700 }, examples: true },
          { key: "light_van", price: { kind: "quote" }, examples: true },
          { key: "large_van", price: { kind: "quote" }, examples: true },
          { key: "specialist", price: { kind: "quote" }, examples: true },
        ],
      },
      {
        key: "vehicle_extras",
        items: [
          { key: "customs_clearance", price: { kind: "quote" }, selectable: false },
          { key: "conformity_certificate", price: { kind: "fixed", amount: 100 }, selectable: false },
        ],
      },
    ],
  },
  {
    key: "parcels",
    notes: 2,
    groups: [
      {
        key: "parcel_items",
        items: [
          { key: "envelope", price: { kind: "fixed", amount: 20 } },
          { key: "mobile_phone", price: { kind: "fixed", amount: 25 } },
          { key: "tablet", price: { kind: "fixed", amount: 30 } },
          { key: "laptop", price: { kind: "range", min: 50, max: 70 } },
          { key: "small_parcel", price: { kind: "from", amount: 40 } },
          { key: "standard_parcel", price: { kind: "quote" } },
        ],
      },
    ],
  },
  {
    key: "barrels",
    notes: 1,
    groups: [
      {
        key: "barrel_sizes",
        items: [
          { key: "barrel_120", price: { kind: "fixed", amount: 120 } },
          { key: "barrel_220", price: { kind: "fixed", amount: 200 } },
          { key: "barrel_220_supplied", price: { kind: "fixed", amount: 240 } },
        ],
      },
    ],
  },
  {
    key: "cartons",
    notes: 1,
    groups: [
      {
        key: "cartons_douala",
        items: [
          { key: "douala_small", price: { kind: "fixed", amount: 75 } },
          { key: "douala_medium", price: { kind: "fixed", amount: 95 } },
          { key: "douala_large", price: { kind: "fixed", amount: 190 } },
        ],
      },
      {
        key: "cartons_yaounde",
        items: [
          { key: "yaounde_small", price: { kind: "fixed", amount: 90 } },
          { key: "yaounde_medium", price: { kind: "fixed", amount: 125 } },
          { key: "yaounde_large", price: { kind: "fixed", amount: 215 } },
        ],
      },
    ],
  },
  {
    key: "furniture",
    notes: 1,
    groups: [
      {
        key: "sofas",
        items: [
          { key: "sofa_1", price: { kind: "fixed", amount: 200 } },
          { key: "sofa_2", price: { kind: "fixed", amount: 300 } },
          { key: "sofa_3", price: { kind: "fixed", amount: 450 } },
          { key: "sofa_6", price: { kind: "fixed", amount: 850 } },
        ],
      },
      {
        key: "televisions",
        items: [
          { key: "tv_28_32", price: { kind: "fixed", amount: 50 } },
          { key: "tv_33_37", price: { kind: "fixed", amount: 60 } },
          { key: "tv_43_45", price: { kind: "fixed", amount: 80 } },
          // The client's bands "47–55" and "55–65" both include 55 inches (P-07).
          // A 55-inch screen is never assigned to either band automatically.
          { key: "tv_47_55", price: { kind: "fixed", amount: 100 }, clarification: "P-07" },
          { key: "tv_55_65", price: { kind: "fixed", amount: 150 }, clarification: "P-07" },
        ],
      },
      {
        key: "appliance_extras",
        items: [{ key: "electrical_certificate", price: { kind: "fixed", amount: 10 }, selectable: false }],
      },
      {
        key: "bicycles",
        items: [
          { key: "bicycle_child", price: { kind: "fixed", amount: 50 } },
          { key: "bicycle_medium", price: { kind: "fixed", amount: 90 } },
          { key: "bicycle_large", price: { kind: "fixed", amount: 150 } },
        ],
      },
      {
        key: "mattresses",
        items: [
          { key: "mattress_140", price: { kind: "fixed", amount: 100 } },
          { key: "mattress_180", price: { kind: "fixed", amount: 120 } },
          { key: "mattress_200", price: { kind: "fixed", amount: 150 } },
        ],
      },
    ],
  },
  {
    key: "sea_freight",
    notes: 1,
    groups: [
      {
        key: "sea_options",
        items: [
          { key: "from_half_m3", price: { kind: "quote" } },
          { key: "from_1_m3", price: { kind: "quote" } },
          { key: "groupage", price: { kind: "quote" } },
          { key: "container_20", price: { kind: "quote" } },
          { key: "container_40", price: { kind: "quote" } },
        ],
      },
    ],
  },
  {
    key: "air_freight",
    notes: 1,
    groups: [
      {
        key: "air_options",
        items: [
          { key: "per_kg", price: { kind: "per_kg", amount: 14, minKg: 1 } },
          { key: "wholesale", price: { kind: "quote" } },
        ],
      },
    ],
  },
  {
    key: "collection",
    notes: 1,
    groups: [
      {
        key: "collection_delivery",
        items: [
          { key: "home_collection_dublin", price: { kind: "fixed", amount: 25 }, selectable: false },
          { key: "collection_other_ireland", price: { kind: "quote" }, selectable: false },
          { key: "delivery_other_destinations", price: { kind: "quote" }, selectable: false },
          // Stated by the client in XAF; never converted (P-09).
          { key: "storage_after_48h", price: { kind: "per_day", amount: 2000, currency: "XAF" }, selectable: false, clarification: "P-09" },
        ],
      },
    ],
  },
];

/** Price sections shown on each service page, in order. */
export const SERVICE_SECTIONS: Record<ServiceKey, readonly CatalogueSectionKey[]> = {
  air_freight: ["air_freight", "collection"],
  sea_freight: ["sea_freight", "collection"],
  vehicle: ["vehicles"],
  barrels: ["barrels", "cartons", "collection"],
  parcels: ["parcels", "furniture", "collection"],
  commercial_cargo: ["sea_freight", "air_freight"],
  customs_clearance: [],
  warehousing: ["collection"],
  // No price was supplied for forwarding online purchases: quoted individually.
  ecommerce: [],
};

/**
 * Catalogue items a customer may pick for each service in the quote form.
 * Furniture and appliances are offered under "Parcels and personal effects" and
 * cartons under "Barrels and boxes" (assumption recorded as S-05).
 */
export const QUOTE_SERVICE_SECTIONS: Record<ServiceCode, readonly CatalogueSectionKey[]> = {
  parcels: ["parcels", "furniture"],
  barrels: ["barrels", "cartons"],
  air_freight: ["air_freight"],
  sea_freight: ["sea_freight"],
  vehicle: ["vehicles"],
  commercial_cargo: ["sea_freight", "air_freight"],
};
