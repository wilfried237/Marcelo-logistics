-- Legacy email rows (written by the inline sender before 20261104000000_backend_mvp)
-- The new outbox delivers every PENDING/FAILED row. Rows written by the old code
-- have other shapes (old templates, shipment references instead of ids, staff
-- inbox stored as a customer recipient), so they must never be picked up:
--   * unsent legacy rows are closed as SKIPPED (never sent late, never retried);
--   * legacy staff rows are re-labelled as staff alerts and their stored inbox
--     address is removed (the new design never stores it).
-- Legacy rows are identified by their idempotency key prefixes, which the new
-- code never uses (it uses "<template>:<id>"). Sent history is otherwise kept.
-- Idempotent: running it again changes nothing.

update public.email_deliveries
   set status = 'SKIPPED',
       error = 'legacy row closed by migration 20261104000100_outbox_legacy_rows',
       locked_at = null
 where status in ('PENDING', 'FAILED', 'SENDING')
   and (idempotency_key like 'ack:%'
     or idempotency_key like 'staff-new:%'
     or idempotency_key like 'quote-issued:%'
     or idempotency_key like 'shipment-update:%');

update public.email_deliveries
   set audience = 'staff',
       recipient = null
 where idempotency_key like 'staff-new:%'
   and (audience <> 'staff' or recipient is not null);
