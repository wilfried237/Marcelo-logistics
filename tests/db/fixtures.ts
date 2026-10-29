import type { PGlite } from "@electric-sql/pglite";
import { asSystem, asUser, createUser } from "./harness";

export const ITEMS = JSON.stringify([{ description: "Barrel of household goods", quantity: 1, weightKg: 80 }]);

export async function insertRequest(client: PGlite, customerId: string, reference: string, actor: string | null = null) {
  const rows = await asSystem<{ id: string }>(
    client,
    `insert into public.quote_requests (reference, customer_id, service_code, origin_country, destination_country, destination_city, items, notes, locale)
     values ($1, $2, 'barrels', 'IE', 'CM', 'Douala', $3::jsonb, 'fragile items', 'en') returning id`,
    [reference, customerId, ITEMS],
    actor,
  );
  return rows[0].id;
}

/** Staff moves a request to QUOTED with one sent quote. Returns the quote id. */
export async function quoteRequest(client: PGlite, requestId: string, staffId: string, validDays = 14) {
  await asUser(client, staffId, "update public.quote_requests set status = 'UNDER_REVIEW' where id = $1", [requestId], { commit: true });
  const [quote] = await asUser<{ id: string }>(
    client,
    staffId,
    `insert into public.quotes (quote_request_id, amount_minor, currency, inclusions, exclusions, valid_until, created_by, sent_at)
     values ($1, 45000, 'EUR', 'Sea freight to Douala port', 'Customs duties', now() + interval '${Math.trunc(validDays)} days', $2, now()) returning id`,
    [requestId, staffId],
    { commit: true },
  );
  await asUser(client, staffId, "update public.quote_requests set status = 'QUOTED' where id = $1", [requestId], { commit: true });
  return quote.id;
}

/**
 * Two customers (A and B), one staff member and one admin. B's request is
 * accepted and has a shipment with one public and one internal event.
 */
export async function createScenario(client: PGlite) {
  const admin = await createUser(client, "admin@example.test", "admin", "Admin User");
  const staff = await createUser(client, "staff@example.test", "staff", "Staff User");
  const a = await createUser(client, "customer.a@example.test", "customer", "Customer A");
  const b = await createUser(client, "customer.b@example.test", "customer", "Customer B");

  const requestA = await insertRequest(client, a.customerId, "QRAAAAAA", a.id);
  const requestB = await insertRequest(client, b.customerId, "QRBBBBBB", b.id);

  const quoteB = await quoteRequest(client, requestB, staff.id);
  await asUser(client, b.id, "select public.customer_respond_to_quote($1, true)", [requestB], { commit: true });

  const [shipmentB] = await asUser<{ id: string }>(
    client,
    staff.id,
    `insert into public.shipments (reference, quote_id, created_by, eta_from, eta_to, eta_visible)
     values ('MLBBBBBBBBBB', $1, $2, current_date + 30, current_date + 45, false) returning id`,
    [quoteB, staff.id],
    { commit: true },
  );
  await asUser(
    client,
    staff.id,
    `insert into public.shipment_events (shipment_id, milestone_code, location, occurred_at, note_en, note_fr, public, created_by)
     values ($1, 'RECEIVED_AT_DEPOT', 'Dublin depot', now() - interval '2 days', 'Received', 'Reçu', true, $2),
            ($1, 'BOOKED', 'Dublin depot', now() - interval '1 day', 'INTERNAL: customer owes balance', 'INTERNE', false, $2)`,
    [shipmentB.id, staff.id],
    { commit: true },
  );
  const [documentB] = await asUser<{ id: string }>(
    client,
    b.id,
    `insert into public.documents (owner_type, owner_id, storage_key, original_name, mime, size_bytes, uploaded_by)
     values ('quote_request', $1, 'quote_request/b/invoice.pdf', 'invoice.pdf', 'application/pdf', 1000, $2) returning id`,
    [requestB, b.id],
    { commit: true },
  );

  return { admin, staff, a, b, requestA, requestB, quoteB, shipmentB: shipmentB.id, documentB: documentB.id };
}
