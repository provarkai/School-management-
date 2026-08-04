-- Two things a platform admin currently has no visibility into at all:
--
-- 1. Whether last night's backup actually ran. /api/cron/backup-schools
--    reports success/failure per school in its own HTTP response and then
--    that's gone — nothing is ever persisted. A backup job that silently
--    stops working looks identical, from the dashboard, to one still
--    running fine.
-- 2. Payment intents stuck at 'pending' — nothing in this codebase ever
--    sets a payment_intent's status to 'failed' (see lib/payments.ts), so
--    an abandoned checkout or a webhook that never arrived just sits at
--    'pending' forever with no signal to anyone.

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  school_count integer not null default 0,
  succeeded_count integer not null default 0,
  failed_count integer not null default 0,
  -- Set when the run couldn't start at all (e.g. storage env vars missing)
  -- — distinct from failed_count, which is per-school failures mid-run.
  config_error text,
  -- [{ "school_id": "...", "school_name": "...", "error": "..." }, ...]
  failures jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists backup_runs_created_at_idx on public.backup_runs (created_at desc);

alter table public.backup_runs enable row level security;

-- Written only by the backup cron via the service-role admin client, which
-- bypasses RLS — no insert policy needed, same as platform_admin_logs.
create policy "backup_runs_select_platform_admin" on public.backup_runs
  for select using (public.is_platform_admin());

-- Security-definer RPC, same pattern as platform_totals()/
-- platform_school_stats() — payment_intents has no platform-admin select
-- policy (by design; a proprietor and a linked parent are its only normal
-- readers), so this reads across every school without adding one.
create or replace function public.platform_stuck_payments(older_than_hours integer default 2)
returns table (
  id uuid,
  school_id uuid,
  school_name text,
  student_id uuid,
  student_name text,
  reference text,
  amount numeric,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    pi.id,
    pi.school_id,
    s.name,
    pi.student_id,
    st.full_name,
    pi.reference,
    pi.amount,
    pi.created_at
  from public.payment_intents pi
  join public.schools s on s.id = pi.school_id
  left join public.students st on st.id = pi.student_id
  where pi.status = 'pending'
    and pi.created_at < now() - make_interval(hours => older_than_hours)
    and public.is_platform_admin()
  order by pi.created_at asc;
$$;

grant execute on function public.platform_stuck_payments(integer) to authenticated;
