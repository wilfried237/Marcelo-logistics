-- =============================================================================
-- 0001 security model: helper functions, integrity triggers, audit log,
-- Row Level Security, grants and the public tracking function.
--
-- Requires Supabase's auth schema (auth.users, auth.uid()) and the roles
-- anon, authenticated and service_role. Every statement is idempotent
-- (create or replace / drop ... if exists) so a re-run is safe.
--
-- Access model:
--   anon           : no table access. Only public_track_shipment().
--   authenticated  : RLS-filtered access. Customers see their own records;
--                    staff/admin rights come from public.profiles.role, which
--                    users cannot change themselves.
--   service_role   : bypasses RLS. Used only server-side for Storage and
--                    admin invitations, always after application checks.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Identity helpers (SECURITY DEFINER so policies never recurse)
-- -----------------------------------------------------------------------------
create or replace function public.app_current_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;
--> statement-breakpoint
create or replace function public.app_is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_current_role() in ('staff', 'admin'), false)
$$;
--> statement-breakpoint
create or replace function public.app_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_current_role() = 'admin', false)
$$;
--> statement-breakpoint
create or replace function public.app_owns_customer(p_customer_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and exists (select 1 from public.customers c where c.id = p_customer_id and c.user_id = auth.uid())
$$;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 2. Quote lifecycle table (kept in sync with lib/domain/quote-lifecycle.ts by a test)
-- -----------------------------------------------------------------------------
create or replace function public.app_quote_transition_allowed(p_from public.quote_status, p_to public.quote_status)
returns boolean language sql immutable set search_path = '' as $$
  select (p_from::text, p_to::text) in (
    ('SUBMITTED', 'UNDER_REVIEW'),
    ('UNDER_REVIEW', 'AWAITING_CUSTOMER'), ('UNDER_REVIEW', 'QUOTED'),
    ('AWAITING_CUSTOMER', 'UNDER_REVIEW'), ('AWAITING_CUSTOMER', 'QUOTED'),
    ('QUOTED', 'ACCEPTED'), ('QUOTED', 'DECLINED'), ('QUOTED', 'EXPIRED')
  ) or (p_to::text = 'CANCELLED' and p_from::text <> 'CANCELLED')
$$;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 3. Audit log: written by trigger in the same transaction as the change
-- -----------------------------------------------------------------------------
-- Arguments: column names whose values must not be copied into the log
-- (personal data). Changed redacted columns are recorded as "[redacted]".
create or replace function public.app_audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_action text;
  v_key text;
  v_id text;
  i integer;
begin
  v_id := case when tg_op = 'DELETE' then to_jsonb(old) ->> 'id' else to_jsonb(new) ->> 'id' end;
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_before := to_jsonb(old);
  else
    -- Keep only the columns that changed (ignoring updated_at).
    select jsonb_object_agg(n.key, o.value), jsonb_object_agg(n.key, n.value)
      into v_before, v_after
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o on o.key = n.key
     where n.value is distinct from o.value and n.key <> 'updated_at';
    if v_after is null then
      return null;
    end if;
  end if;

  for i in 0 .. coalesce(tg_nargs, 0) - 1 loop
    v_key := tg_argv[i];
    if v_before ? v_key then v_before := jsonb_set(v_before, array[v_key], '"[redacted]"'); end if;
    if v_after ? v_key then v_after := jsonb_set(v_after, array[v_key], '"[redacted]"'); end if;
  end loop;

  v_action := tg_table_name || '.' || lower(tg_op);
  if tg_op = 'UPDATE' and v_after ? 'status' then v_action := tg_table_name || '.status_changed'; end if;
  if tg_op = 'UPDATE' and v_after ? 'role' then v_action := tg_table_name || '.role_changed'; end if;

  insert into public.audit_log (actor, action, entity, entity_id, before, after)
  values (auth.uid(), v_action, tg_table_name, v_id, v_before, v_after);
  return null;
end
$$;
--> statement-breakpoint
create or replace function public.app_audit_log_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only' using errcode = 'insufficient_privilege';
end
$$;
--> statement-breakpoint
drop trigger if exists audit_log_no_update_delete on public.audit_log;
--> statement-breakpoint
create trigger audit_log_no_update_delete before update or delete on public.audit_log
  for each row execute function public.app_audit_log_append_only();
--> statement-breakpoint
drop trigger if exists audit_log_no_truncate on public.audit_log;
--> statement-breakpoint
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.app_audit_log_append_only();
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 4. updated_at maintenance
-- -----------------------------------------------------------------------------
create or replace function public.app_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 5. Integrity rules
-- -----------------------------------------------------------------------------
-- Errors use SQLSTATE P0001 and a stable message code the application maps.

-- 5a. Profiles: role changes only through admin_set_user_role()
create or replace function public.app_enforce_profile_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id then
    raise exception 'immutable_field' using errcode = 'P0001';
  end if;
  if new.role is distinct from old.role and coalesce(current_setting('app.role_change', true), '') <> 'allowed' then
    raise exception 'role_change_forbidden' using errcode = 'P0001';
  end if;
  return new;
end
$$;
--> statement-breakpoint

-- 5b. Quote requests: immutable identity, validated status transitions
create or replace function public.app_enforce_quote_request_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.reference <> old.reference or new.customer_id <> old.customer_id or new.created_at <> old.created_at
     or new.submitted_by is distinct from old.submitted_by or new.idempotency_key is distinct from old.idempotency_key
     or new.locale <> old.locale then
    raise exception 'immutable_field' using errcode = 'P0001';
  end if;

  if new.status <> old.status then
    if not public.app_quote_transition_allowed(old.status, new.status) then
      raise exception 'invalid_quote_transition' using errcode = 'P0001', detail = old.status || ' -> ' || new.status;
    end if;
    if new.status = 'QUOTED' and not exists (
      select 1 from public.quotes q where q.quote_request_id = new.id and q.sent_at is not null
    ) then
      raise exception 'sent_quote_required' using errcode = 'P0001';
    end if;
    if new.status = 'ACCEPTED' and not exists (
      select 1 from public.quotes q where q.quote_request_id = new.id and q.sent_at is not null and q.valid_until > now()
    ) then
      raise exception 'quote_not_valid' using errcode = 'P0001';
    end if;
    if new.status <> 'CANCELLED' then
      new.cancellation_reason := null;
    end if;
  elsif new.cancellation_reason is distinct from old.cancellation_reason then
    raise exception 'immutable_field' using errcode = 'P0001';
  end if;
  return new;
end
$$;
--> statement-breakpoint

-- 5c. Quotes: created while the request is under review; frozen once sent
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
--> statement-breakpoint

-- 5d. Shipments: owner and service derived from an ACCEPTED quote request
create or replace function public.app_enforce_shipment_rules() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_request record;
begin
  if tg_op = 'INSERT' then
    select r.customer_id, r.service_code, r.status into v_request
      from public.quotes q join public.quote_requests r on r.id = q.quote_request_id
     where q.id = new.quote_id and q.sent_at is not null;
    if v_request is null or v_request.status <> 'ACCEPTED' then
      raise exception 'quote_not_accepted' using errcode = 'P0001';
    end if;
    if auth.uid() is not null and new.created_by <> auth.uid() then
      raise exception 'created_by_mismatch' using errcode = 'P0001';
    end if;
    new.customer_id := v_request.customer_id;
    new.service_code := v_request.service_code;
    return new;
  end if;

  if new.reference <> old.reference or new.quote_id <> old.quote_id or new.customer_id <> old.customer_id
     or new.service_code <> old.service_code or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'immutable_field' using errcode = 'P0001';
  end if;
  return new;
end
$$;
--> statement-breakpoint

-- 5e. Shipment events: author is the session user; only visibility/notes editable
create or replace function public.app_enforce_shipment_event_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.created_by <> auth.uid() then
      raise exception 'created_by_mismatch' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.shipment_id <> old.shipment_id or new.milestone_code <> old.milestone_code or new.occurred_at <> old.occurred_at
     or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'immutable_field' using errcode = 'P0001';
  end if;
  return new;
end
$$;
--> statement-breakpoint

-- 5f. Documents: owning customer derived from the owner record
create or replace function public.app_enforce_document_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid;
begin
  if tg_op = 'INSERT' then
    if new.owner_type = 'quote_request' then
      select r.customer_id into v_customer from public.quote_requests r where r.id = new.owner_id;
    else
      select s.customer_id into v_customer from public.shipments s where s.id = new.owner_id;
    end if;
    if v_customer is null then
      raise exception 'document_owner_not_found' using errcode = 'P0001';
    end if;
    if auth.uid() is not null and new.uploaded_by <> auth.uid() then
      raise exception 'created_by_mismatch' using errcode = 'P0001';
    end if;
    new.customer_id := v_customer;
    return new;
  end if;
  if row(new.owner_type, new.owner_id, new.customer_id, new.storage_key, new.original_name, new.mime, new.size_bytes, new.uploaded_by, new.created_at)
     is distinct from row(old.owner_type, old.owner_id, old.customer_id, old.storage_key, old.original_name, old.mime, old.size_bytes, old.uploaded_by, old.created_at) then
    raise exception 'immutable_field' using errcode = 'P0001';
  end if;
  return new;
end
$$;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 6. Trigger wiring
-- -----------------------------------------------------------------------------
drop trigger if exists profiles_rules on public.profiles;
--> statement-breakpoint
create trigger profiles_rules before update on public.profiles for each row execute function public.app_enforce_profile_rules();
--> statement-breakpoint
drop trigger if exists quote_requests_rules on public.quote_requests;
--> statement-breakpoint
create trigger quote_requests_rules before update on public.quote_requests for each row execute function public.app_enforce_quote_request_rules();
--> statement-breakpoint
drop trigger if exists quotes_rules on public.quotes;
--> statement-breakpoint
create trigger quotes_rules before insert or update on public.quotes for each row execute function public.app_enforce_quote_rules();
--> statement-breakpoint
drop trigger if exists shipments_rules on public.shipments;
--> statement-breakpoint
create trigger shipments_rules before insert or update on public.shipments for each row execute function public.app_enforce_shipment_rules();
--> statement-breakpoint
drop trigger if exists shipment_events_rules on public.shipment_events;
--> statement-breakpoint
create trigger shipment_events_rules before insert or update on public.shipment_events for each row execute function public.app_enforce_shipment_event_rules();
--> statement-breakpoint
drop trigger if exists documents_rules on public.documents;
--> statement-breakpoint
create trigger documents_rules before insert or update on public.documents for each row execute function public.app_enforce_document_rules();
--> statement-breakpoint
drop trigger if exists profiles_touch on public.profiles;
--> statement-breakpoint
create trigger profiles_touch before update on public.profiles for each row execute function public.app_touch_updated_at();
--> statement-breakpoint
drop trigger if exists customers_touch on public.customers;
--> statement-breakpoint
create trigger customers_touch before update on public.customers for each row execute function public.app_touch_updated_at();
--> statement-breakpoint
drop trigger if exists quote_requests_touch on public.quote_requests;
--> statement-breakpoint
create trigger quote_requests_touch before update on public.quote_requests for each row execute function public.app_touch_updated_at();
--> statement-breakpoint
drop trigger if exists quotes_touch on public.quotes;
--> statement-breakpoint
create trigger quotes_touch before update on public.quotes for each row execute function public.app_touch_updated_at();
--> statement-breakpoint
drop trigger if exists shipments_touch on public.shipments;
--> statement-breakpoint
create trigger shipments_touch before update on public.shipments for each row execute function public.app_touch_updated_at();
--> statement-breakpoint
-- Audit triggers (personal fields redacted)
drop trigger if exists profiles_audit on public.profiles;
--> statement-breakpoint
create trigger profiles_audit after insert or update or delete on public.profiles for each row execute function public.app_audit_row();
--> statement-breakpoint
drop trigger if exists customers_audit on public.customers;
--> statement-breakpoint
create trigger customers_audit after insert or update or delete on public.customers for each row execute function public.app_audit_row('name', 'email', 'phone');
--> statement-breakpoint
drop trigger if exists quote_requests_audit on public.quote_requests;
--> statement-breakpoint
create trigger quote_requests_audit after insert or update or delete on public.quote_requests for each row execute function public.app_audit_row('items', 'notes', 'destination_city');
--> statement-breakpoint
drop trigger if exists quotes_audit on public.quotes;
--> statement-breakpoint
create trigger quotes_audit after insert or update or delete on public.quotes for each row execute function public.app_audit_row();
--> statement-breakpoint
drop trigger if exists shipments_audit on public.shipments;
--> statement-breakpoint
create trigger shipments_audit after insert or update or delete on public.shipments for each row execute function public.app_audit_row();
--> statement-breakpoint
drop trigger if exists shipment_events_audit on public.shipment_events;
--> statement-breakpoint
create trigger shipment_events_audit after insert or update or delete on public.shipment_events for each row execute function public.app_audit_row();
--> statement-breakpoint
drop trigger if exists documents_audit on public.documents;
--> statement-breakpoint
create trigger documents_audit after insert or update or delete on public.documents for each row execute function public.app_audit_row('original_name');
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 7. New auth users: profile (customer role) + linked customer record
-- -----------------------------------------------------------------------------
create or replace function public.app_handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_locale public.app_locale;
begin
  insert into public.profiles (id, role) values (new.id, 'customer') on conflict (id) do nothing;
  if new.email is not null then
    v_name := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), 120);
    v_locale := case when new.raw_user_meta_data ->> 'locale' = 'fr' then 'fr' else 'en' end;
    insert into public.customers (user_id, name, email, preferred_locale)
    values (new.id, v_name, lower(new.email), v_locale)
    on conflict (user_id) do nothing;
  end if;
  return new;
end
$$;
--> statement-breakpoint
drop trigger if exists app_on_auth_user_created on auth.users;
--> statement-breakpoint
create trigger app_on_auth_user_created after insert on auth.users for each row execute function public.app_handle_new_user();
--> statement-breakpoint
create or replace function public.app_handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.customers set email = lower(new.email) where user_id = new.id;
  end if;
  return new;
end
$$;
--> statement-breakpoint
drop trigger if exists app_on_auth_user_email_changed on auth.users;
--> statement-breakpoint
create trigger app_on_auth_user_email_changed after update of email on auth.users for each row execute function public.app_handle_user_email_change();
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 8. Privileged operations exposed as functions (each checks the caller)
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_found boolean;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  perform set_config('app.role_change', 'allowed', true);
  update public.profiles set role = p_role where id = p_user_id;
  v_found := found;
  perform set_config('app.role_change', '', true);
  if not v_found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end
$$;
--> statement-breakpoint
create or replace function public.customer_respond_to_quote(p_quote_request_id uuid, p_accept boolean) returns public.quote_status
language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid;
  v_status public.quote_status;
begin
  select r.customer_id, r.status into v_customer, v_status from public.quote_requests r where r.id = p_quote_request_id;
  -- Same error whether the request does not exist or belongs to someone else.
  if v_customer is null or not public.app_owns_customer(v_customer) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_status <> 'QUOTED' then
    raise exception 'invalid_quote_transition' using errcode = 'P0001';
  end if;
  update public.quote_requests
     set status = case when p_accept then 'ACCEPTED'::public.quote_status else 'DECLINED'::public.quote_status end
   where id = p_quote_request_id;
  return case when p_accept then 'ACCEPTED'::public.quote_status else 'DECLINED'::public.quote_status end;
end
$$;
--> statement-breakpoint
-- Called by the server or a scheduled job (not exposed to clients).
create or replace function public.app_expire_quotes() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.quote_requests r set status = 'EXPIRED'
   where r.status = 'QUOTED'
     and not exists (select 1 from public.quotes q where q.quote_request_id = r.id and q.sent_at is not null and q.valid_until > now());
  get diagnostics v_count = row_count;
  return v_count;
end
$$;
--> statement-breakpoint
-- Fixed-window rate limiter for server use (not exposed to clients).
create or replace function public.app_rate_limit_hit(p_key text, p_window_seconds integer, p_max integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  if p_window_seconds <= 0 or p_max <= 0 or char_length(p_key) > 200 then
    raise exception 'invalid_rate_limit' using errcode = 'P0001';
  end if;
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end
$$;
--> statement-breakpoint
-- Public tracking: explicit allowlist of fields; only public events; ETA only
-- when staff approved it. Unknown references return NULL (no existence leak).
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
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 9. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
--> statement-breakpoint
alter table public.customers enable row level security;
--> statement-breakpoint
alter table public.quote_requests enable row level security;
--> statement-breakpoint
alter table public.quotes enable row level security;
--> statement-breakpoint
alter table public.shipments enable row level security;
--> statement-breakpoint
alter table public.shipment_events enable row level security;
--> statement-breakpoint
alter table public.documents enable row level security;
--> statement-breakpoint
alter table public.audit_log enable row level security;
--> statement-breakpoint
alter table public.rate_limits enable row level security;
--> statement-breakpoint
alter table public.email_deliveries enable row level security;
--> statement-breakpoint
drop policy if exists profiles_select on public.profiles;
--> statement-breakpoint
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.app_is_staff());
--> statement-breakpoint
drop policy if exists customers_select on public.customers;
--> statement-breakpoint
create policy customers_select on public.customers for select to authenticated
  using (user_id = auth.uid() or public.app_is_staff());
--> statement-breakpoint
drop policy if exists customers_update on public.customers;
--> statement-breakpoint
create policy customers_update on public.customers for update to authenticated
  using (user_id = auth.uid() or public.app_is_staff())
  with check (user_id = auth.uid() or public.app_is_staff());
--> statement-breakpoint
drop policy if exists quote_requests_select on public.quote_requests;
--> statement-breakpoint
create policy quote_requests_select on public.quote_requests for select to authenticated
  using (public.app_owns_customer(customer_id) or public.app_is_staff());
--> statement-breakpoint
drop policy if exists quote_requests_staff_update on public.quote_requests;
--> statement-breakpoint
create policy quote_requests_staff_update on public.quote_requests for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());
--> statement-breakpoint
drop policy if exists quotes_select on public.quotes;
--> statement-breakpoint
create policy quotes_select on public.quotes for select to authenticated
  using (
    public.app_is_staff()
    or (sent_at is not null and exists (
      select 1 from public.quote_requests r where r.id = quote_request_id and public.app_owns_customer(r.customer_id)))
  );
--> statement-breakpoint
drop policy if exists quotes_staff_insert on public.quotes;
--> statement-breakpoint
create policy quotes_staff_insert on public.quotes for insert to authenticated with check (public.app_is_staff());
--> statement-breakpoint
drop policy if exists quotes_staff_update on public.quotes;
--> statement-breakpoint
create policy quotes_staff_update on public.quotes for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());
--> statement-breakpoint
drop policy if exists shipments_select on public.shipments;
--> statement-breakpoint
create policy shipments_select on public.shipments for select to authenticated
  using (public.app_owns_customer(customer_id) or public.app_is_staff());
--> statement-breakpoint
drop policy if exists shipments_staff_insert on public.shipments;
--> statement-breakpoint
create policy shipments_staff_insert on public.shipments for insert to authenticated with check (public.app_is_staff());
--> statement-breakpoint
drop policy if exists shipments_staff_update on public.shipments;
--> statement-breakpoint
create policy shipments_staff_update on public.shipments for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());
--> statement-breakpoint
drop policy if exists shipment_events_select on public.shipment_events;
--> statement-breakpoint
create policy shipment_events_select on public.shipment_events for select to authenticated
  using (
    public.app_is_staff()
    or (public and exists (select 1 from public.shipments s where s.id = shipment_id and public.app_owns_customer(s.customer_id)))
  );
--> statement-breakpoint
drop policy if exists shipment_events_staff_insert on public.shipment_events;
--> statement-breakpoint
create policy shipment_events_staff_insert on public.shipment_events for insert to authenticated with check (public.app_is_staff());
--> statement-breakpoint
drop policy if exists shipment_events_staff_update on public.shipment_events;
--> statement-breakpoint
create policy shipment_events_staff_update on public.shipment_events for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());
--> statement-breakpoint
drop policy if exists documents_select on public.documents;
--> statement-breakpoint
create policy documents_select on public.documents for select to authenticated
  using (public.app_owns_customer(customer_id) or public.app_is_staff());
--> statement-breakpoint
drop policy if exists documents_insert on public.documents;
--> statement-breakpoint
create policy documents_insert on public.documents for insert to authenticated
  with check (public.app_owns_customer(customer_id) or public.app_is_staff());
--> statement-breakpoint
drop policy if exists documents_staff_update on public.documents;
--> statement-breakpoint
create policy documents_staff_update on public.documents for update to authenticated
  using (public.app_is_staff()) with check (public.app_is_staff());
--> statement-breakpoint
drop policy if exists audit_log_staff_select on public.audit_log;
--> statement-breakpoint
create policy audit_log_staff_select on public.audit_log for select to authenticated using (public.app_is_staff());
--> statement-breakpoint
drop policy if exists email_deliveries_staff_select on public.email_deliveries;
--> statement-breakpoint
create policy email_deliveries_staff_select on public.email_deliveries for select to authenticated using (public.app_is_staff());
--> statement-breakpoint
-- rate_limits: no policies -> no client access at all.

-- -----------------------------------------------------------------------------
-- 10. Grants (Supabase grants everything to anon/authenticated by default)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
--> statement-breakpoint
revoke all on all sequences in schema public from anon, authenticated;
--> statement-breakpoint
revoke execute on all functions in schema public from public, anon, authenticated;
--> statement-breakpoint
alter default privileges in schema public revoke all on tables from anon, authenticated;
--> statement-breakpoint
alter default privileges in schema public revoke all on sequences from anon, authenticated;
--> statement-breakpoint
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
--> statement-breakpoint
-- Column lists deliberately omit staff identifiers (created_by, uploaded_by)
-- so they are never returned to customers.
grant select on public.profiles to authenticated;
--> statement-breakpoint
grant select (id, user_id, name, email, phone, preferred_locale, created_at, updated_at) on public.customers to authenticated;
--> statement-breakpoint
grant update (name, phone, preferred_locale) on public.customers to authenticated;
--> statement-breakpoint
grant select (id, reference, customer_id, service_code, origin_country, destination_country, destination_city, items, notes, status, locale, cancellation_reason, created_at, updated_at)
  on public.quote_requests to authenticated;
--> statement-breakpoint
grant update (status, cancellation_reason) on public.quote_requests to authenticated;
--> statement-breakpoint
grant select (id, quote_request_id, amount_minor, currency, inclusions, exclusions, valid_until, sent_at, created_at, updated_at)
  on public.quotes to authenticated;
--> statement-breakpoint
grant insert (quote_request_id, amount_minor, currency, inclusions, exclusions, valid_until, created_by, sent_at) on public.quotes to authenticated;
--> statement-breakpoint
grant update (amount_minor, currency, inclusions, exclusions, valid_until, sent_at) on public.quotes to authenticated;
--> statement-breakpoint
grant select (id, reference, quote_id, customer_id, service_code, status, eta_from, eta_to, eta_visible, created_at, updated_at)
  on public.shipments to authenticated;
--> statement-breakpoint
grant insert (reference, quote_id, customer_id, service_code, status, eta_from, eta_to, eta_visible, created_by) on public.shipments to authenticated;
--> statement-breakpoint
grant update (status, eta_from, eta_to, eta_visible) on public.shipments to authenticated;
--> statement-breakpoint
grant select (id, shipment_id, milestone_code, location, occurred_at, note_en, note_fr, public, created_at)
  on public.shipment_events to authenticated;
--> statement-breakpoint
grant insert (shipment_id, milestone_code, location, occurred_at, note_en, note_fr, public, created_by) on public.shipment_events to authenticated;
--> statement-breakpoint
grant update (location, note_en, note_fr, public) on public.shipment_events to authenticated;
--> statement-breakpoint
grant select (id, owner_type, owner_id, customer_id, original_name, mime, size_bytes, retention_until, created_at)
  on public.documents to authenticated;
--> statement-breakpoint
grant insert (owner_type, owner_id, customer_id, storage_key, original_name, mime, size_bytes, uploaded_by) on public.documents to authenticated;
--> statement-breakpoint
grant update (retention_until) on public.documents to authenticated;
--> statement-breakpoint
grant select on public.audit_log to authenticated;
--> statement-breakpoint
grant select on public.email_deliveries to authenticated;
--> statement-breakpoint
grant execute on function public.app_current_role() to authenticated;
--> statement-breakpoint
grant execute on function public.app_is_staff() to authenticated;
--> statement-breakpoint
grant execute on function public.app_is_admin() to authenticated;
--> statement-breakpoint
grant execute on function public.app_owns_customer(uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.app_quote_transition_allowed(public.quote_status, public.quote_status) to authenticated;
--> statement-breakpoint
grant execute on function public.admin_set_user_role(uuid, public.user_role) to authenticated;
--> statement-breakpoint
grant execute on function public.customer_respond_to_quote(uuid, boolean) to authenticated;
--> statement-breakpoint
grant execute on function public.public_track_shipment(text) to anon, authenticated;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- 11. Private storage bucket (only when running on Supabase)
-- No storage.objects policies are created: clients cannot read or write files
-- directly. The server uses the service role after ownership checks and hands
-- out short-lived signed URLs.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('customer-documents', 'customer-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
    on conflict (id) do nothing;
  end if;
end
$$;
