-- Super admin: platform-level oversight across every school, kept completely
-- separate from app_users/school_id so it can never be granted through the
-- app itself — only by inserting a row directly via SQL as the project owner.
-- RLS is enabled with zero policies, so even a signed-in user can't read this
-- table directly; the only access path is the is_platform_admin() function
-- below, which runs security definer (bypasses RLS internally).

create table if not exists public.platform_admins (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.platform_admins where id = auth.uid());
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Gating: a suspended school's staff/parents are blocked at the app layer
-- (see requireUser()/requireParent()). This column is the switch a platform
-- admin flips.
alter table public.schools add column if not exists status text not null default 'active' check (status in ('active', 'suspended'));

create policy "schools_select_platform_admin" on public.schools
  for select using (public.is_platform_admin());

create policy "schools_update_status_platform_admin" on public.schools
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Aggregate-only views for the admin dashboard — never raw student/fee rows,
-- so "bird's-eye view" can't become a backdoor into any school's actual data.
create or replace function public.platform_school_stats()
returns table (
  school_id uuid,
  student_count bigint,
  staff_count bigint,
  last_activity timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    (select count(*) from public.students st where st.school_id = s.id) as student_count,
    (select count(*) from public.app_users au where au.school_id = s.id) as staff_count,
    greatest(
      (select max(created_at) from public.students st where st.school_id = s.id),
      (select max(created_at) from public.fee_payments fp where fp.school_id = s.id),
      (select max(created_at) from public.attendance a where a.school_id = s.id)
    ) as last_activity
  from public.schools s
  where public.is_platform_admin();
$$;

grant execute on function public.platform_school_stats() to authenticated;

create or replace function public.platform_totals()
returns table (
  total_schools bigint,
  total_students bigint,
  total_fees_processed numeric,
  signups_this_month bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.schools),
    (select count(*) from public.students),
    (select coalesce(sum(amount), 0) from public.fee_payments),
    (select count(*) from public.schools where created_at >= date_trunc('month', now()))
  where public.is_platform_admin();
$$;

grant execute on function public.platform_totals() to authenticated;
