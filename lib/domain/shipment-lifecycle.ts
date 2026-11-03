import type { ShipmentStatus } from "./enums";

/**
 * Permitted shipment status changes. The database enforces the same table in
 * app_shipment_transition_allowed (migration 20261104000000_backend_mvp); a test
 * keeps both identical. DELIVERED and CANCELLED are final: a delivered shipment
 * never silently returns to an earlier stage.
 */
export const SHIPMENT_TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = {
  BOOKED: ["IN_TRANSIT", "ON_HOLD", "CANCELLED"],
  IN_TRANSIT: ["AT_DESTINATION", "DELIVERED", "ON_HOLD"],
  AT_DESTINATION: ["DELIVERED", "ON_HOLD"],
  ON_HOLD: ["BOOKED", "IN_TRANSIT", "AT_DESTINATION", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canMoveShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return from === to || SHIPMENT_TRANSITIONS[from].includes(to);
}
