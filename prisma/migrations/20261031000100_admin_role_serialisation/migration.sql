-- Fix: the last-administrator safeguard only covered self-demotion. Two
-- administrators demoting each other concurrently could both succeed and leave
-- no administrator. All role changes are now serialised with a transaction
-- advisory lock, and ANY demotion of an administrator is refused when it would
-- remove the last one. The caller's admin status is re-checked after the lock.
create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_current public.user_role;
  v_admins integer;
begin
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.admin_set_user_role'));

  -- Re-check after waiting: a concurrent change may have demoted the caller.
  if not public.app_is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select p.role into v_current from public.profiles p where p.id = p_user_id for update;
  if v_current is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_current = 'admin' and p_role <> 'admin' then
    select count(*) into v_admins from public.profiles where role = 'admin';
    if v_admins <= 1 then
      raise exception 'last_admin' using errcode = 'P0001';
    end if;
  end if;

  perform set_config('app.role_change', 'allowed', true);
  update public.profiles set role = p_role where id = p_user_id;
  perform set_config('app.role_change', '', true);
end
$$;

revoke execute on function public.admin_set_user_role(uuid, public.user_role) from public, anon;
grant execute on function public.admin_set_user_role(uuid, public.user_role) to authenticated;
