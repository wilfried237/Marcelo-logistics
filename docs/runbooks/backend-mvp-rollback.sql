-- ROLLBACK of 20261104000000_backend_mvp + 20261104000100_outbox_legacy_rows
-- LAST RESORT ONLY. Read docs/DEPLOYMENT.md "Migration runbook" first: the
-- schema change is additive and the previous application version runs on it,
-- so the normal recovery is an application rollback (Vercel Instant Rollback)
-- that keeps the schema. Use this script only if the schema itself must go.
--
-- DATA LOSS: drops quote line items, case messages (notes, customer replies,
-- issue reports), contact enquiries, job runs, request assignments and privacy
-- acknowledgement times created after the upgrade. Export them first
-- (DEPLOYMENT.md lists the commands). Customers, staff, requests, quotes,
-- shipments, events, documents and the audit log are not touched.
--
-- Not reversible by SQL: the extra email_status enum values (SENDING,
-- DELIVERED, BOUNCED, COMPLAINED, DEAD) stay defined but unused; harmless.
-- Tested: tests/db/upgrade-rehearsal.test.ts (schema returns to the pre-upgrade state).
begin;

-- 1. Triggers on tables that stay
drop trigger if exists quote_requests_extras on public.quote_requests;
drop trigger if exists quote_requests_notify on public.quote_requests;
drop trigger if exists shipments_transition on public.shipments;
drop trigger if exists shipments_notify on public.shipments;
drop trigger if exists shipment_events_notify on public.shipment_events;
drop trigger if exists profiles_notify on public.profiles;

-- 2. New tables (their triggers, policies and indexes go with them)
drop table if exists public.quote_line_items;
drop table if exists public.case_messages;
drop table if exists public.contact_enquiries;
drop table if exists public.job_runs;

-- 3. New functions
drop function if exists public.app_quote_line_amount(public.quote_line_kind, numeric, bigint);
drop function if exists public.app_quote_lines_total(uuid);
drop function if exists public.app_enforce_quote_line_rules();
drop function if exists public.app_enforce_quote_request_extras();
drop function if exists public.app_enforce_case_message_rules();
drop function if exists public.app_shipment_transition_allowed(public.shipment_status, public.shipment_status);
drop function if exists public.app_enforce_shipment_transition();
drop function if exists public.app_enqueue_email(text, text, text, text, text, text, public.app_locale, jsonb);
drop function if exists public.app_notify_quote_request();
drop function if exists public.app_notify_case_message();
drop function if exists public.app_notify_shipment();
drop function if exists public.app_notify_shipment_event();
drop function if exists public.app_notify_contact();
drop function if exists public.app_notify_role_change();
drop function if exists public.app_link_respond_to_quote(uuid, boolean);
drop type if exists public.quote_line_kind;
drop type if exists public.message_author;

-- 4. Replaced functions: previous definitions (20261029000001_security_model). Grants are kept.
create or replace function public.app_quote_transition_allowed(p_from public.quote_status, p_to public.quote_status)
returns boolean language sql immutable set search_path = '' as $$
  select (p_from::text, p_to::text) in (
    ('SUBMITTED', 'UNDER_REVIEW'),
    ('UNDER_REVIEW', 'AWAITING_CUSTOMER'), ('UNDER_REVIEW', 'QUOTED'),
    ('AWAITING_CUSTOMER', 'UNDER_REVIEW'), ('AWAITING_CUSTOMER', 'QUOTED'),
    ('QUOTED', 'ACCEPTED'), ('QUOTED', 'DECLINED'), ('QUOTED', 'EXPIRED')
  ) or (p_to::text = 'CANCELLED' and p_from::text <> 'CANCELLED')
$$;

create or replace function public.app_enforce_quote_rules() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_status public.quote_status;
begin
  if tg_op = 'INSERT' then
    select r.status into v_status from public.quote_requests r where r.id = new.quote_request_id;
    if v_status is null or v_status not in ('UNDER_REVIEW', 'AWAITING_CUSTOMER') then
      raise exception 'quote_request_not_under_review' using errcode = 'P0001';
    end if;
    if auth.uid() is not null and new.created_by <> auth.uid() then
      raise exception 'created_by_mismatch' using errcode = 'P0001';
    end if;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if old.sent_at is not null then
    raise exception 'quote_already_sent' using errcode = 'P0001';
  end if;
  if new.quote_request_id <> old.quote_request_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'immutable_field' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create or replace function public.public_track_shipment(p_reference text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'reference', s.reference,
    'serviceCode', s.service_code,
    'status', s.status,
    'etaFrom', case when s.eta_visible then s.eta_from end,
    'etaTo', case when s.eta_visible then s.eta_to end,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'milestone', e.milestone_code,
               'location', e.location,
               'occurredAt', e.occurred_at,
               'noteEn', e.note_en,
               'noteFr', e.note_fr) order by e.occurred_at desc)
        from public.shipment_events e
       where e.shipment_id = s.id and e.public), '[]'::jsonb)
  )
  from public.shipments s
  where s.reference = upper(btrim(p_reference))
    and upper(btrim(p_reference)) ~ '^ML[A-Z2-7]{10}$'
$$;

-- 5. Quote requests: assignment and privacy acknowledgement
drop index if exists public.quote_requests_assigned_idx;
alter table public.quote_requests drop constraint if exists quote_requests_assigned_to_profiles_id_fk;
alter table public.quote_requests drop column if exists assigned_to;
alter table public.quote_requests drop column if exists privacy_accepted_at;

-- 6. Email log: queued emails are closed (never sent late if the upgrade is
-- re-applied), new statuses mapped to the old ones, staff rows given a marker
-- recipient (the old schema requires one; the inbox address is not stored).
update public.email_deliveries set status = 'SKIPPED', error = 'closed by backend MVP rollback'
 where status::text in ('PENDING', 'SENDING');
update public.email_deliveries set status = 'SENT' where status::text = 'DELIVERED';
update public.email_deliveries set status = 'FAILED' where status::text in ('BOUNCED', 'COMPLAINED', 'DEAD');
update public.email_deliveries set recipient = '(staff inbox)' where recipient is null;
alter table public.email_deliveries drop constraint if exists email_deliveries_audience;
alter table public.email_deliveries drop constraint if exists email_deliveries_recipient;
alter table public.email_deliveries drop constraint if exists email_deliveries_attempts;
alter table public.email_deliveries drop constraint if exists email_deliveries_event_len;
drop index if exists public.email_deliveries_due_idx;
drop index if exists public.email_deliveries_provider_idx;
alter table public.email_deliveries
  drop column if exists attempts,
  drop column if exists audience,
  drop column if exists delivered_at,
  drop column if exists last_event,
  drop column if exists last_event_at,
  drop column if exists locked_at,
  drop column if exists next_attempt_at,
  drop column if exists payload;
alter table public.email_deliveries alter column recipient set not null;

-- 7. Prisma Migrate history (only present on databases migrated by Prisma)
do $$ begin
  if to_regclass('public._prisma_migrations') is not null then
    delete from public._prisma_migrations
     where migration_name in ('20261104000000_backend_mvp', '20261104000100_outbox_legacy_rows');
  end if;
end $$;

commit;
