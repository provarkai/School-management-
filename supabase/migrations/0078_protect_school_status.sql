-- current_role() audit follow-up (0070): the one remaining over-grant.
--
-- schools_update_proprietor (0003) lets any manager — the literal
-- proprietor OR a delegated school admin, via current_role() — update any
-- column of their own school row, including `status`. 0064 explicitly
-- treats suspension as the enforcement lever for non-payment/abuse and
-- assumed reactivation was platform-admin-only (0027's
-- schools_update_status_platform_admin), but nothing actually stopped a
-- school's own manager from flipping status back to 'active' (undoing a
-- platform suspension) or bricking the school by suspending it.
--
-- Closed trigger-style, like 0030/0070: a school's status may only change
-- from a platform-admin context, or from a system context carrying no JWT
-- (SQL editor, seed scripts, the service-role admin client). The literal
-- proprietor is deliberately NOT exempt — 0064's whole point is that the
-- lever belongs to the platform, and the app never offered a self-suspend
-- UI (the only status writer is the platform admin's SchoolStatusButton).
-- Non-status column updates (name, address, session, promotion settings,
-- etc.) remain exactly as before: any manager of the school.
create or replace function public.protect_school_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if auth.uid() is not null and not public.is_platform_admin() then
      raise exception 'Only a platform admin can change school status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_school_status on public.schools;
create trigger protect_school_status
  before update on public.schools
  for each row execute function public.protect_school_status();
