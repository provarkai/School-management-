-- Semi-automated bank transfer matching: bursar logs a transfer alert
-- (amount/narration/date), the app suggests candidate students, and a
-- confirmed match records the payment against that student's fee record.

create table if not exists public.bank_transfer_alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  narration text not null,
  transfer_date date not null default current_date,
  status text not null default 'unmatched' check (status in ('unmatched', 'matched', 'ignored')),
  matched_student_id uuid references public.students (id) on delete set null,
  matched_fee_payment_id uuid references public.fee_payments (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists bank_transfer_alerts_school_id_idx on public.bank_transfer_alerts (school_id);
create index if not exists bank_transfer_alerts_status_idx on public.bank_transfer_alerts (status);

alter table public.bank_transfer_alerts enable row level security;

create policy "bank_transfer_alerts_proprietor_all" on public.bank_transfer_alerts
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');
