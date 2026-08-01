-- Expense tracking: operational costs (rent, utilities, supplies, etc.)
-- against a per-category termly budget, so the proprietor can see a real
-- income-vs-expense position for the term, not just fee collections.
-- Treated like fees/fee_types (manager-accessible via current_role()),
-- not like payroll — these are operational costs, not personal salary
-- figures, so a delegated school admin can see and record them too.

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  termly_budget numeric(12, 2),
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists expense_categories_school_id_idx on public.expense_categories (school_id);

alter table public.expense_categories enable row level security;

create policy "expense_categories_select_same_school" on public.expense_categories
  for select using (school_id = public.current_school_id());

create policy "expense_categories_insert_proprietor" on public.expense_categories
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "expense_categories_update_proprietor" on public.expense_categories
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "expense_categories_delete_proprietor" on public.expense_categories
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  category_id uuid not null references public.expense_categories (id) on delete restrict,
  campus_id uuid references public.campuses (id) on delete set null,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  vendor text,
  description text,
  recorded_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expenses_school_id_idx on public.expenses (school_id);
create index if not exists expenses_category_id_idx on public.expenses (category_id);
create index if not exists expenses_session_term_idx on public.expenses (school_id, session, term);

alter table public.expenses enable row level security;

create policy "expenses_select_same_school" on public.expenses
  for select using (school_id = public.current_school_id());

create policy "expenses_insert_proprietor" on public.expenses
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "expenses_update_proprietor" on public.expenses
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "expenses_delete_proprietor" on public.expenses
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
