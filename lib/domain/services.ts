import { ownerConfig } from "@/config/owner";

/**
 * Technical service codes stored on quote requests and shipments (PostgreSQL
 * enum "service_code"). Display text comes from messages ("services.<code>").
 * Adding a code here needs a database migration (enum value) first.
 */
export const SERVICE_CODES = ["parcels", "barrels", "air_freight", "sea_freight", "vehicle", "commercial_cargo"] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];

export function isServiceCode(value: unknown): value is ServiceCode {
  return typeof value === "string" && (SERVICE_CODES as readonly string[]).includes(value);
}

/**
 * Everything the business offers, as presented on the website. Shipping
 * services can be quoted online (they have a service code); the support
 * services added from the client's list on 2026-11-06 are handled through the
 * contact form until the quote form supports them (needs the enum migration
 * described in docs/DECISIONS-REQUIRED.md, S-04).
 */
export const SERVICE_OFFERINGS = [
  { key: "air_freight", group: "shipping", quoteCode: "air_freight" },
  { key: "sea_freight", group: "shipping", quoteCode: "sea_freight" },
  { key: "vehicle", group: "shipping", quoteCode: "vehicle" },
  { key: "barrels", group: "shipping", quoteCode: "barrels" },
  { key: "parcels", group: "shipping", quoteCode: "parcels" },
  { key: "commercial_cargo", group: "shipping", quoteCode: "commercial_cargo" },
  { key: "customs_clearance", group: "support", quoteCode: null },
  { key: "warehousing", group: "support", quoteCode: null },
  { key: "ecommerce", group: "support", quoteCode: null },
] as const satisfies readonly { key: string; group: "shipping" | "support"; quoteCode: ServiceCode | null }[];

export type ServiceOffering = (typeof SERVICE_OFFERINGS)[number];
export type ServiceKey = ServiceOffering["key"];

export function isServiceConfirmed(key: ServiceKey | ServiceCode): boolean {
  return (ownerConfig.operations.confirmedServices as readonly string[]).includes(key);
}
