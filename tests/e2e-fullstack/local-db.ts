import pg from "pg";

/**
 * Test-only helpers for the full-stack suites (local Supabase database only;
 * playwright.fullstack.config.ts refuses any non-local DIRECT_URL).
 */

/**
 * Clears the application's sign-in rate-limit counters. Every local request
 * shares one client identifier, so suites that sign in many times would
 * otherwise trip the (intended) per-client login limit for the suites after
 * them. The limiter itself is unchanged and is exercised by its own tests.
 */
export async function resetLocalLoginLimits(): Promise<void> {
  const client = new pg.Client({ connectionString: localUrl("resetLocalLoginLimits") });
  await client.connect();
  try {
    await client.query("delete from public.rate_limits where key like 'auth:login:%'");
  } finally {
    await client.end();
  }
}

function localUrl(caller: string): string {
  const url = process.env.DIRECT_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error(`${caller}: local database only`);
  return url;
}

const REF_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const randomRef = (prefix: string, length: number) => prefix + Array.from({ length }, () => REF_ALPHABET[Math.floor(Math.random() * 32)]).join("");

/**
 * Builds an accepted quote request and its BOOKED shipment for a local test
 * customer, with one public and one internal milestone. Every step runs as the
 * role the application uses (staff or the customer, through RLS and the
 * database triggers), except the request row itself, which is inserted as the
 * server does for a signed-in submission.
 */
export async function createLocalShipment(customerUserId: string, staffEmail: string): Promise<{ shipmentRef: string; requestRef: string }> {
  const client = new pg.Client({ connectionString: localUrl("createLocalShipment") });
  await client.connect();
  const as = async <T extends pg.QueryResultRow>(userId: string, sql: string, params: unknown[] = []) => {
    await client.query("begin");
    try {
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
      await client.query("set local role authenticated");
      const result = await client.query<T>(sql, params);
      await client.query("commit");
      return result.rows;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  };
  try {
    const [{ id: staffId }] = (await client.query<{ id: string }>("select id from auth.users where email = $1", [staffEmail])).rows;
    const [{ id: customerId }] = (await client.query<{ id: string }>("select id from public.customers where user_id = $1", [customerUserId])).rows;
    const requestRef = randomRef("QR", 6);
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: customerUserId })]);
    const [{ id: requestId }] = (
      await client.query<{ id: string }>(
        `insert into public.quote_requests (reference, customer_id, service_code, origin_country, destination_country, destination_city, items, locale, submitted_by)
         values ($1, $2, 'barrels', 'IE', 'CM', 'Douala', '[{"description":"Stage 5 test barrel","quantity":1}]'::jsonb, 'en', $3) returning id`,
        [requestRef, customerId, customerUserId],
      )
    ).rows;
    await client.query("commit");
    await as(staffId, "update public.quote_requests set status = 'UNDER_REVIEW' where id = $1", [requestId]);
    const [quote] = await as<{ id: string }>(
      staffId,
      `insert into public.quotes (quote_request_id, amount_minor, currency, inclusions, exclusions, valid_until, created_by, sent_at)
       values ($1, 20000, 'EUR', 'Sea freight to Douala', 'Customs duties', now() + interval '14 days', $2, now()) returning id`,
      [requestId, staffId],
    );
    await as(staffId, "update public.quote_requests set status = 'QUOTED' where id = $1", [requestId]);
    await as(customerUserId, "select public.customer_respond_to_quote($1, true)", [requestId]);
    const shipmentRef = randomRef("ML", 10);
    const [shipment] = await as<{ id: string }>(staffId, "insert into public.shipments (reference, quote_id, created_by) values ($1, $2, $3) returning id", [shipmentRef, quote.id, staffId]);
    await as(
      staffId,
      `insert into public.shipment_events (shipment_id, milestone_code, location, occurred_at, note_en, note_fr, public, created_by)
       values ($1, 'RECEIVED_AT_DEPOT', 'Lucan depot', now() - interval '1 day', 'Your barrel has arrived at our depot.', 'Votre fût est arrivé à notre dépôt.', true, $2),
              ($1, 'DELAYED', null, now() - interval '1 hour', 'INTERNAL: waiting for paperwork', null, false, $2)`,
      [shipment.id, staffId],
    );
    return { shipmentRef, requestRef };
  } finally {
    await client.end();
  }
}

/** Customer emails queued for a shipment and its milestones, by template (local database only). */
export async function localShipmentEmails(shipmentRef: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: localUrl("localShipmentEmails") });
  await client.connect();
  try {
    const { rows } = await client.query<{ template: string }>(
      `select d.template from public.email_deliveries d
        where d.audience = 'customer'
          and d.entity_id in (select s.id::text from public.shipments s where s.reference = $1
                              union all
                              select e.id::text from public.shipment_events e join public.shipments s on s.id = e.shipment_id where s.reference = $1)
        order by d.created_at`,
      [shipmentRef],
    );
    return rows.map((r) => r.template);
  } finally {
    await client.end();
  }
}

/** Runs a statement as the given local user through RLS (local database only). Used to create audited changes. */
export async function asLocalUser(userId: string, sql: string, params: unknown[] = []): Promise<void> {
  const client = new pg.Client({ connectionString: localUrl("asLocalUser") });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
    await client.query("set local role authenticated");
    await client.query(sql, params);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}
