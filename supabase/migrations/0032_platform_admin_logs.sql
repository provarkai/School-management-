-- Timestamped audit trail of platform-admin actions (school suspend/
-- reactivate, and any future admin actions), shown on the /admin
-- dashboard's "Recent activity" section.

create table if not exists public.platform_admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_school_id uuid references public.schools (id) on delete cascade,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists platform_admin_logs_created_at_idx on public.platform_admin_logs (created_at desc);

alter table public.platform_admin_logs enable row level security;

create policy "platform_admin_logs_select" on public.platform_admin_logs
  for select using (public.is_platform_admin());

create policy "platform_admin_logs_insert" on public.platform_admin_logs
  for insert with check (public.is_platform_admin());
