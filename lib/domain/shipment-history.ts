import { MILESTONE_CODES, SHIPMENT_STATUSES, type MilestoneCode, type ShipmentStatus } from "./enums";

/**
 * Staff-facing shipment history, derived from the append-only audit log
 * (written by database triggers on `shipments` and `shipment_events`). No
 * separate history table is needed: every row carries the acting user, the
 * time and the changed columns.
 */
export type ShipmentHistoryEntry =
  | { kind: "created"; at: Date; actor: string | null; status: ShipmentStatus | null }
  | { kind: "status"; at: Date; actor: string | null; from: ShipmentStatus | null; to: ShipmentStatus | null; etaChanged: boolean }
  | { kind: "eta"; at: Date; actor: string | null }
  | { kind: "milestone"; at: Date; actor: string | null; milestone: MilestoneCode | null; public: boolean }
  | { kind: "visibility"; at: Date; actor: string | null; public: boolean }
  | { kind: "milestoneEdited"; at: Date; actor: string | null };

export interface AuditRow {
  action: string;
  actor: string | null;
  before: unknown;
  after: unknown;
  at: Date;
}

const ETA_KEYS = ["eta_from", "eta_to", "eta_visible"];
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const status = (v: unknown): ShipmentStatus | null => ((SHIPMENT_STATUSES as readonly unknown[]).includes(v) ? (v as ShipmentStatus) : null);
const milestone = (v: unknown): MilestoneCode | null => ((MILESTONE_CODES as readonly unknown[]).includes(v) ? (v as MilestoneCode) : null);

/** Maps audit rows (oldest first) to history entries; unknown actions are skipped. */
export function toShipmentHistory(rows: readonly AuditRow[]): ShipmentHistoryEntry[] {
  const out: ShipmentHistoryEntry[] = [];
  for (const row of rows) {
    const before = obj(row.before);
    const after = obj(row.after);
    const base = { at: row.at, actor: row.actor };
    switch (row.action) {
      case "shipments.insert":
        out.push({ kind: "created", ...base, status: status(after.status) });
        break;
      case "shipments.status_changed":
        out.push({ kind: "status", ...base, from: status(before.status), to: status(after.status), etaChanged: ETA_KEYS.some((k) => k in after) });
        break;
      case "shipments.update":
        if (ETA_KEYS.some((k) => k in after)) out.push({ kind: "eta", ...base });
        break;
      case "shipment_events.insert":
        out.push({ kind: "milestone", ...base, milestone: milestone(after.milestone_code), public: after.public === true });
        break;
      case "shipment_events.update":
        out.push("public" in after ? { kind: "visibility", ...base, public: after.public === true } : { kind: "milestoneEdited", ...base });
        break;
    }
  }
  return out;
}
