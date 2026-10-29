/**
 * Clearly fictitious tracking data for local UI development only.
 * Served only when ENABLE_DEMO_DATA=true in a non-production build.
 */
export interface DemoTrackingEvent {
  milestone: string;
  location: string;
  occurredAt: string;
}

export interface DemoShipment {
  reference: string;
  status: string;
  events: DemoTrackingEvent[];
}

export const DEMO_SHIPMENTS: Record<string, DemoShipment> = {
  MLDEMO000001: {
    reference: "MLDEMO000001",
    status: "IN_PROGRESS",
    events: [
      { milestone: "BOOKED", location: "Demo depot", occurredAt: "2026-01-05T10:00:00Z" },
      { milestone: "RECEIVED_AT_DEPOT", location: "Demo depot", occurredAt: "2026-01-06T14:30:00Z" },
      { milestone: "DEPARTED_ORIGIN", location: "Demo port", occurredAt: "2026-01-09T08:00:00Z" },
    ],
  },
};
