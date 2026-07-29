-- Paystack checkout integration: track each initiated transaction so the
-- webhook (and the redirect-back callback, best-effort) can find the right
-- fee_record and post exactly one fee_payments row per successful charge.

alter table public.fee_payments
  drop constraint if exists fee_payments_method_check;

alter table public.fee_payments
  add constraint fee_payments_method_check check (method in ('cash', 'transfer', 'paystack'));

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  fee_record_id uuid not null references public.fee_records (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  reference text not null unique,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  authorization_url text,
  fee_payment_id uuid references public.fee_payments (id) on delete set null,
  initiated_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists payment_intents_school_id_idx on public.payment_intents (school_id);
create index if not exists payment_intents_reference_idx on public.payment_intents (reference);
create index if not exists payment_intents_fee_record_id_idx on public.payment_intents (fee_record_id);

alter table public.payment_intents enable row level security;

-- Staff can see their school's payment intents (proprietor manages fees;
-- teachers have no fee access elsewhere either, so keep this proprietor-only).
create policy "payment_intents_select_proprietor" on public.payment_intents
  for select using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- Parents can see intents for their own linked children (to show payment status).
create policy "payment_intents_select_linked_parent" on public.payment_intents
  for select using (public.is_linked_parent(student_id));

-- All writes (create on initiate, update on verify) happen through the
-- service-role admin client (server actions + webhook), which bypasses RLS —
-- no insert/update policy needed for the anon/authenticated roles.
