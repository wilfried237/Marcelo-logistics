/**
 * LOCAL DEVELOPMENT SEED DATA. Every record is fictitious and clearly marked
 * ("Demo", example.test addresses, DEMO references). Never run against a shared
 * or production database: scripts/seed.ts refuses non-local hosts.
 *
 * Works with any client that can run parameterised SQL, so the same function is
 * exercised by tests/db/seed.test.ts against PostgreSQL (PGlite).
 */
export type Query = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/** Runs a statement with auth.uid() = actor, so triggers record the right author. */
export type QueryAs = (actor: string, sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export interface SeedUsers {
  adminId: string;
  staffId: string;
  customerOneId: string;
  customerTwoId: string;
}

export interface SeedResult {
  quoteRequests: number;
  quotes: number;
  shipments: number;
  events: number;
}

const ITEMS = {
  barrels: [{ description: "Demo: barrel of household goods", quantity: 2, weightKg: 90 }],
  parcels: [{ description: "Demo: parcel of clothes", quantity: 3, weightKg: 12, lengthCm: 50, widthCm: 40, heightCm: 30 }],
  vehicle: [{ description: "Demo: hatchback car", quantity: 1, vehicleMake: "DemoMake", vehicleModel: "DemoModel", vehicleYear: 2015 }],
};

async function customerIdFor(query: Query, userId: string): Promise<string> {
  const rows = await query("select id from public.customers where user_id = $1", [userId]);
  if (!rows[0]) throw new Error(`seed: no customer record for user ${userId}`);
  return rows[0].id as string;
}

/**
 * Idempotent: requests are identified by their DEMO reference and skipped if
 * present, so re-running the seed does not duplicate data.
 */
export async function seedDemoData(query: Query, queryAs: QueryAs, users: SeedUsers): Promise<SeedResult> {
  const result: SeedResult = { quoteRequests: 0, quotes: 0, shipments: 0, events: 0 };
  const one = await customerIdFor(query, users.customerOneId);
  const two = await customerIdFor(query, users.customerTwoId);

  const request = async (reference: string, customerId: string, service: keyof typeof ITEMS, actor: string) => {
    const existing = await query("select id, status from public.quote_requests where reference = $1", [reference]);
    if (existing[0]) return { id: existing[0].id as string, created: false };
    const rows = await queryAs(
      actor,
      `insert into public.quote_requests (reference, customer_id, service_code, origin_country, destination_country, destination_city, items, notes, locale)
       values ($1, $2, $3, 'IE', 'CM', 'Demo City', $4::jsonb, 'Demo request created by the local seed.', 'en') returning id`,
      [reference, customerId, service, JSON.stringify(ITEMS[service])],
    );
    result.quoteRequests++;
    return { id: rows[0].id as string, created: true };
  };
  const transition = (id: string, status: string, reason: string | null = null) =>
    queryAs(users.staffId, "update public.quote_requests set status = $2, cancellation_reason = $3 where id = $1", [id, status, reason]);
  const sendQuote = async (requestId: string, amountMinor: number) => {
    const rows = await queryAs(
      users.staffId,
      `insert into public.quotes (quote_request_id, amount_minor, currency, inclusions, exclusions, valid_until, created_by, sent_at)
       values ($1, $2, 'EUR', 'Demo inclusions (example only)', 'Demo exclusions (example only)', now() + interval '14 days', $3, now()) returning id`,
      [requestId, amountMinor, users.staffId],
    );
    result.quotes++;
    return rows[0].id as string;
  };

  // 1. New request, untouched.
  await request("QRDEMOAA", one, "parcels", users.customerOneId);

  // 2. Under review, waiting for the customer.
  const waiting = await request("QRDEMOAB", one, "barrels", users.customerOneId);
  if (waiting.created) {
    await transition(waiting.id, "UNDER_REVIEW");
    await transition(waiting.id, "AWAITING_CUSTOMER");
  }

  // 3. Quoted, awaiting the customer's decision.
  const quoted = await request("QRDEMOAC", two, "vehicle", users.customerTwoId);
  if (quoted.created) {
    await transition(quoted.id, "UNDER_REVIEW");
    await sendQuote(quoted.id, 120000);
    await transition(quoted.id, "QUOTED");
  }

  // 4. Accepted with a shipment and events (one internal, one public).
  const accepted = await request("QRDEMOAD", two, "barrels", users.customerTwoId);
  if (accepted.created) {
    await transition(accepted.id, "UNDER_REVIEW");
    const quoteId = await sendQuote(accepted.id, 45000);
    await transition(accepted.id, "QUOTED");
    await queryAs(users.customerTwoId, "select public.customer_respond_to_quote($1, true)", [accepted.id]);
    const shipment = await queryAs(
      users.staffId,
      "insert into public.shipments (reference, quote_id, created_by, status) values ('MLDEMOAAAAAA', $1, $2, 'IN_TRANSIT') returning id",
      [quoteId, users.staffId],
    );
    result.shipments++;
    const shipmentId = shipment[0].id as string;
    for (const [milestone, daysAgo, isPublic, noteEn, noteFr] of [
      ["BOOKED", 10, true, "Demo: booking confirmed.", "Démo : réservation confirmée."],
      ["RECEIVED_AT_DEPOT", 8, true, "Demo: goods received.", "Démo : marchandises reçues."],
      ["RECEIVED_AT_DEPOT", 8, false, "Demo internal note: check packing list.", "Note interne démo."],
      ["DEPARTED_ORIGIN", 5, true, null, null],
    ] as const) {
      await queryAs(
        users.staffId,
        `insert into public.shipment_events (shipment_id, milestone_code, location, occurred_at, note_en, note_fr, public, created_by)
         values ($1, $2, 'Demo location', now() - make_interval(days => $3::int), $4, $5, $6, $7)`,
        [shipmentId, milestone, daysAgo, noteEn, noteFr, isPublic, users.staffId],
      );
      result.events++;
    }
  }

  // 5. Cancelled with a reason.
  const cancelled = await request("QRDEMOAE", one, "vehicle", users.customerOneId);
  if (cancelled.created) await transition(cancelled.id, "CANCELLED", "Demo: request withdrawn by the customer.");

  return result;
}
