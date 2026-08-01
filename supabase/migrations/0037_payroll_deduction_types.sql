-- Payroll deductions used to be a single free-typed amount + reason per
-- entry. Replace that with a proprietor-managed list of deduction types
-- (PAYE tax, pension, loan repayment, etc.) and allow multiple deduction
-- line items per staff member per payroll run — payroll_entries.deductions
-- / deduction_reason stay as-is (still what net_pay is generated from) but
-- are now kept in sync by the app from the sum of these line items instead
-- of being typed directly.
--
-- Salary data access rules carry over unchanged: is_owner() only (the
-- literal proprietor), never a delegated school admin.

create table if not exists public.deduction_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists deduction_types_school_id_idx on public.deduction_types (school_id);

create table if not exists public.payroll_entry_deductions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  payroll_entry_id uuid not null references public.payroll_entries (id) on delete cascade,
  deduction_type_id uuid not null references public.deduction_types (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists payroll_entry_deductions_entry_id_idx on public.payroll_entry_deductions (payroll_entry_id);

alter table public.deduction_types enable row level security;
alter table public.payroll_entry_deductions enable row level security;

create policy "deduction_types_proprietor_all" on public.deduction_types
  for all using (school_id = public.current_school_id() and public.is_owner())
  with check (school_id = public.current_school_id() and public.is_owner());

create policy "payroll_entry_deductions_proprietor_all" on public.payroll_entry_deductions
  for all using (school_id = public.current_school_id() and public.is_owner())
  with check (school_id = public.current_school_id() and public.is_owner());

-- Seed common Nigerian payroll deduction types for every existing school so
-- the picker isn't empty on first use; the proprietor can rename/remove/add
-- to this list freely afterward.
insert into public.deduction_types (school_id, name)
select s.id, t.name
from public.schools s
cross join (
  values ('PAYE Tax'), ('Pension'), ('NHF'), ('Loan Repayment'), ('Lateness/Absence'), ('Other')
) as t(name)
on conflict (school_id, name) do nothing;
