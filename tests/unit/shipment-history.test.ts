import { describe, expect, it } from "vitest";
import { toShipmentHistory, type AuditRow } from "@/lib/domain/shipment-history";
import { SHIPMENT_TRANSITIONS, STATUS_MILESTONES, canMoveShipment, isDuplicateMilestone } from "@/lib/domain/shipment-lifecycle";
import { MILESTONE_CODES, SHIPMENT_STATUSES } from "@/lib/domain/enums";

const at = new Date("2026-11-11T10:00:00Z");
const row = (action: string, before: unknown, after: unknown, actor: string | null = "u1"): AuditRow => ({ action, actor, before, after, at });

describe("shipment history from audit rows", () => {
  it("maps creation, status, ETA and milestone changes", () => {
    const history = toShipmentHistory([
      row("shipments.insert", null, { status: "BOOKED", customer_id: "c" }),
      row("shipments.status_changed", { status: "BOOKED" }, { status: "IN_TRANSIT" }),
      row("shipments.status_changed", { status: "IN_TRANSIT", eta_visible: false }, { status: "ON_HOLD", eta_visible: true }, "u2"),
      row("shipments.update", { eta_from: null }, { eta_from: "2026-12-01" }),
      row("shipment_events.insert", null, { milestone_code: "DEPARTED_ORIGIN", public: true }),
      row("shipment_events.update", { public: true }, { public: false }),
      row("shipment_events.update", { note_en: "a" }, { note_en: "b" }, null),
    ]);
    expect(history).toEqual([
      { kind: "created", at, actor: "u1", status: "BOOKED" },
      { kind: "status", at, actor: "u1", from: "BOOKED", to: "IN_TRANSIT", etaChanged: false },
      { kind: "status", at, actor: "u2", from: "IN_TRANSIT", to: "ON_HOLD", etaChanged: true },
      { kind: "eta", at, actor: "u1" },
      { kind: "milestone", at, actor: "u1", milestone: "DEPARTED_ORIGIN", public: true },
      { kind: "visibility", at, actor: "u1", public: false },
      { kind: "milestoneEdited", at, actor: null },
    ]);
  });

  it("ignores unknown actions and never trusts unexpected values", () => {
    const history = toShipmentHistory([
      row("shipments.delete", { status: "BOOKED" }, null),
      row("shipments.update", { updated_at: "x" }, { updated_at: "y" }),
      row("shipments.status_changed", { status: "<script>" }, { status: "LOST" }),
      row("shipment_events.insert", null, { milestone_code: "TELEPORTED", public: "yes" }),
      row("shipments.insert", "not an object", ["array"]),
    ]);
    expect(history).toEqual([
      { kind: "status", at, actor: "u1", from: null, to: null, etaChanged: false },
      { kind: "milestone", at, actor: "u1", milestone: null, public: false },
      { kind: "created", at, actor: "u1", status: null },
    ]);
  });
});

describe("shipment lifecycle", () => {
  it("delivered and cancelled are final; every other status can be put on hold or progress", () => {
    expect(SHIPMENT_TRANSITIONS.DELIVERED).toEqual([]);
    expect(SHIPMENT_TRANSITIONS.CANCELLED).toEqual([]);
    for (const s of SHIPMENT_STATUSES) expect(canMoveShipment(s, s)).toBe(true);
    expect(canMoveShipment("IN_TRANSIT", "BOOKED")).toBe(false);
    expect(canMoveShipment("AT_DESTINATION", "CANCELLED")).toBe(false);
    expect(canMoveShipment("ON_HOLD", "CANCELLED")).toBe(true);
  });
});

describe("milestone offered with a status change (option C)", () => {
  it("maps only In transit, On hold and Delivered, to existing milestone codes, with the approved defaults", () => {
    expect(STATUS_MILESTONES).toEqual({
      IN_TRANSIT: { milestone: "IN_TRANSIT", record: false, public: false },
      ON_HOLD: { milestone: "ON_HOLD", record: false, public: false },
      DELIVERED: { milestone: "DELIVERED", record: true, public: true },
    });
    for (const m of Object.values(STATUS_MILESTONES)) expect(MILESTONE_CODES).toContain(m!.milestone);
    expect(STATUS_MILESTONES.CANCELLED).toBeUndefined();
  });

  it("never allows a second Delivered; other milestones repeat only after something else happened", () => {
    expect(isDuplicateMilestone("DELIVERED", [])).toBe(false);
    expect(isDuplicateMilestone("DELIVERED", ["IN_TRANSIT", "DELIVERED"])).toBe(true);
    expect(isDuplicateMilestone("ON_HOLD", ["ON_HOLD", "IN_TRANSIT"])).toBe(true);
    expect(isDuplicateMilestone("ON_HOLD", ["IN_TRANSIT", "ON_HOLD"])).toBe(false);
    expect(isDuplicateMilestone("IN_TRANSIT", [])).toBe(false);
  });
});
