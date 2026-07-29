-- Salary and payroll management. Salaries live in their own proprietor-only
-- table (rather than a column on app_users) so the existing
-- app_users_update_proprietor_or_self policy — which lets a staff member
-- update their own row — can never expose a path to editing their own pay.

create table if not exists public.staff_salaries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  staff_id uuid not null references public.app_users (id) on delete cascade,
  monthly_salary numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (staff_id)
);

create index if not exists staff_salaries_school_id_idx on public.staff_salaries (school_id);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  period text not null,
  status text not null default 'draft' check (status in ('draft', 'paid')),
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (school_id, period)
);

create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  payroll_run_id uuid not null references public.payroll_runs (id) on delete cascade,
  staff_id uuid not null references public.app_users (id) on delete cascade,
  base_salary numeric(12, 2) not null default 0,
  deductions numeric(12, 2) not null default 0,
  deduction_reason text,
  net_pay numeric(12, 2) generated always as (greatest(base_salary - deductions, 0)) stored,
  created_at timestamptz not null default now(),
  unique (payroll_run_id, staff_id)
);

create index if not exists payroll_runs_school_id_idx on public.payroll_runs (school_id);
create index if not exists payroll_entries_school_id_idx on public.payroll_entries (school_id);
create index if not exists payroll_entries_run_id_idx on public.payroll_entries (payroll_run_id);

alter table public.staff_salaries enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_entries enable row level security;

create policy "staff_salaries_proprietor_all" on public.staff_salaries
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "payroll_runs_proprietor_all" on public.payroll_runs
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "payroll_entries_proprietor_all" on public.payroll_entries
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');
