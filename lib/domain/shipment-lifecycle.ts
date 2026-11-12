import type { MilestoneCode, ShipmentStatus } from "./enums";

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

/**
 * Optional milestone offered when staff change the status (Stage 5, option C,
 * approved 2026-11-12). Only statuses with an existing milestone code of the
 * same meaning are mapped; Booked, At destination and Cancelled have none
 * (no new milestone codes, T-01). Defaults: Delivered is ticked and public;
 * In transit and On hold are unticked, and internal if staff tick them, so no
 * customer email is ever sent without a deliberate choice.
 */
export const STATUS_MILESTONES: Readonly<Partial<Record<ShipmentStatus, { milestone: MilestoneCode; record: boolean; public: boolean }>>> = {
  IN_TRANSIT: { milestone: "IN_TRANSIT", record: false, public: false },
  ON_HOLD: { milestone: "ON_HOLD", record: false, public: false },
  DELIVERED: { milestone: "DELIVERED", record: true, public: true },
};

/**
 * Duplicate rule for the optional milestone: no second Delivered milestone
 * ever; for the others, none when the most recent milestone already has the
 * same code (a shipment can legitimately go on hold twice, with progress in
 * between). `existing` is newest first.
 */
export function isDuplicateMilestone(milestone: MilestoneCode, existing: readonly MilestoneCode[]): boolean {
  if (milestone === "DELIVERED") return existing.includes("DELIVERED");
  return existing[0] === milestone;
}
