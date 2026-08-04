-- Platform admin school detail page: clicking a school on /admin needs to
-- show its proprietor and any delegated school admins' contact details.
-- app_users has no platform-admin select policy (by design — see 0027's
-- comment on aggregate-only access), so a direct
-- `.from("app_users").eq("school_id", ...)` from a platform admin session
-- returns zero rows under RLS. Same fix as platform_stuck_payments()/
-- platform_message_failures(): a security-definer RPC scoped to a single
-- school, returning only the people who actually administer it (the literal
-- proprietor, plus anyone with is_school_admin = true) rather than the full
-- staff/teacher roster.
create or replace function public.platform_school_contacts(target_school_id uuid)
returns table (
  id uuid,
  name text,
  email text,
  phone text,
  role text,
  is_school_admin boolean,
  job_title text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    au.id,
    au.name,
    au.email,
    au.phone,
    au.role,
    au.is_school_admin,
    au.job_title,
    au.created_at
  from public.app_users au
  where au.school_id = target_school_id
    and (au.role = 'proprietor' or au.is_school_admin = true)
    and public.is_platform_admin()
  order by (au.role = 'proprietor') desc, au.created_at asc;
$$;

grant execute on function public.platform_school_contacts(uuid) to authenticated;
