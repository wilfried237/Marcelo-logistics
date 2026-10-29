import { ownerConfig } from "@/config/owner";

/**
 * Technical service codes. Display text comes from messages ("services.<code>").
 * The list reflects the categories the platform is designed to support; whether
 * each one is actually offered is an owner decision (S-01).
 */
export const SERVICE_CODES = ["parcels", "barrels", "air_freight", "sea_freight", "vehicle", "commercial_cargo"] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];

export function isServiceCode(value: unknown): value is ServiceCode {
  return typeof value === "string" && (SERVICE_CODES as readonly string[]).includes(value);
}

export function isServiceConfirmed(code: ServiceCode): boolean {
  return (ownerConfig.operations.confirmedServices as readonly string[]).includes(code);
}
