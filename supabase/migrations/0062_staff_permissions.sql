-- Granular staff permissions: lets the proprietor delegate a single module
-- (Fees, Expenses, or the Admissions intake pipeline) to a specific
-- non-admin staff member — e.g. a bursar who should be able to record fee
-- payments without becoming a full delegated admin (is_school_admin),
-- which grants every manager capability across the whole school.
--
-- Payroll/salary is deliberately NOT grantable here. deduction_types and
-- payroll_entry_deductions already lock salary-adjacent writes to
-- is_owner() — the literal proprietor, not even a delegated admin (see
-- 0037_payroll_deduction_types.sql) — so extending grantable access to
-- payroll would cut against a decision already made deliberately elsewhere
-- in this schema. Admissions is granted for the intake pipeline only
-- (creating/updating/removing a prospect); actually enrolling a prospect
-- (convertProspectToStudent, which creates a permanent student record and
-- claims the next admission number) stays a manager-only action at the
-- application layer.

create table if not exists public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  staff_id uuid not null references public.app_users (id) on delete cascade,
  permission text not null check (permission in ('fees', 'expenses', 'admissions')),
  granted_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (staff_id, permission)
);

create index if not exists staff_permissions_school_id_idx on public.staff_permissions (school_id);
create index if not exists staff_permissions_staff_id_idx on public.staff_permissions (staff_id);

alter table public.staff_permissions enable row level security;

-- A staff member can see their own grants (so the app can decide what nav
-- to show them); the proprietor (or a delegated admin) sees everyone's, to
-- manage them.
create policy "staff_permissions_select" on public.staff_permissions
  for select using (
    school_id = public.current_school_id()
    and (public.current_role() = 'proprietor' or staff_id = auth.uid())
  );

create policy "staff_permissions_write_proprietor" on public.staff_permissions
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "staff_permissions_delete_proprietor" on public.staff_permissions
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_permissions sp
    where sp.staff_id = auth.uid()
      and sp.school_id = public.current_school_id()
      and sp.permission = perm
  );
$$;

-- ---------------------------------------------------------------------------
-- Additional permissive policies. Postgres OR's every permissive policy
-- that applies to a command together, so these simply widen who may act —
-- the original proprietor-only policies on each table are untouched.
-- ---------------------------------------------------------------------------
create policy "fee_types_permission_fees" on public.fee_types
  for all using (school_id = public.current_school_id() and public.has_permission('fees'))
  with check (school_id = public.current_school_id() and public.has_permission('fees'));

create policy "fee_records_permission_fees" on public.fee_records
  for all using (school_id = public.current_school_id() and public.has_permission('fees'))
  with check (school_id = public.current_school_id() and public.has_permission('fees'));

create policy "fee_payments_permission_fees" on public.fee_payments
  for all using (school_id = public.current_school_id() and public.has_permission('fees'))
  with check (school_id = public.current_school_id() and public.has_permission('fees'));

create policy "expense_categories_permission_expenses" on public.expense_categories
  for all using (school_id = public.current_school_id() and public.has_permission('expenses'))
  with check (school_id = public.current_school_id() and public.has_permission('expenses'));

create policy "expenses_permission_expenses" on public.expenses
  for all using (school_id = public.current_school_id() and public.has_permission('expenses'))
  with check (school_id = public.current_school_id() and public.has_permission('expenses'));

create policy "admission_prospects_permission_admissions" on public.admission_prospects
  for all using (school_id = public.current_school_id() and public.has_permission('admissions'))
  with check (school_id = public.current_school_id() and public.has_permission('admissions'));
