-- Lets the proprietor delegate day-to-day management to a trusted staff
-- member ("school admin") without making them the literal owner. This is
-- distinct from platform_admins (the SaaS operator's cross-school access) —
-- a school admin's power is scoped to their own school, same as a proprietor.

alter table public.app_users add column if not exists is_school_admin boolean not null default false;

-- Only the literal proprietor may grant/revoke admin status — enforced here
-- at the trigger level so it holds regardless of how the update arrives
-- (this app's UI, or a direct REST call), not just via an app-layer check.
create or replace function public.protect_school_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_school_admin is distinct from old.is_school_admin then
    if not exists (
      select 1 from public.app_users where id = auth.uid() and role = 'proprietor'
    ) then
      raise exception 'Only the proprietor can change admin status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_school_admin_flag on public.app_users;
create trigger protect_school_admin_flag
  before update on public.app_users
  for each row execute function public.protect_school_admin_flag();

-- current_role() becomes "effective role" — a school admin is treated as a
-- proprietor by every existing RLS policy that checks current_role() =
-- 'proprietor', with zero changes needed to those policies. Salary data is
-- the one place this is deliberately NOT enough (see is_owner() below).
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when role = 'proprietor' then 'proprietor'
    when is_school_admin then 'proprietor'
    else role
  end
  from public.app_users where id = auth.uid();
$$;

-- Strict literal-owner check, ignoring is_school_admin — used to keep the
-- most sensitive data (salaries) restricted to the actual proprietor even
-- after current_role() above becomes admin-inclusive.
create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select role = 'proprietor' from public.app_users where id = auth.uid();
$$;

-- Re-point the three payroll tables' policies at is_owner() instead of
-- current_role(), so a delegated admin still can't see or change salaries.
drop policy if exists "staff_salaries_proprietor_all" on public.staff_salaries;
create policy "staff_salaries_proprietor_all" on public.staff_salaries
  for all using (school_id = public.current_school_id() and public.is_owner())
  with check (school_id = public.current_school_id() and public.is_owner());

drop policy if exists "payroll_runs_proprietor_all" on public.payroll_runs;
create policy "payroll_runs_proprietor_all" on public.payroll_runs
  for all using (school_id = public.current_school_id() and public.is_owner())
  with check (school_id = public.current_school_id() and public.is_owner());

drop policy if exists "payroll_entries_proprietor_all" on public.payroll_entries;
create policy "payroll_entries_proprietor_all" on public.payroll_entries
  for all using (school_id = public.current_school_id() and public.is_owner())
  with check (school_id = public.current_school_id() and public.is_owner());
