-- Phase 6 — credentials: ID cards, transfer certificates, result-checker
-- PINs. No new tables for ID cards — they're generated entirely from
-- columns that already exist (photo_url, admission_number, blood_group,
-- etc. from 0048).

-- ---------------------------------------------------------------------------
-- Transfer certificates
-- ---------------------------------------------------------------------------
-- 'withdrawn' has been a legal students.status since 0039, but nothing ever
-- wrote it — there was no withdrawal flow. These three columns are what a
-- transfer certificate actually needs beyond the status flip itself: when
-- the student left, why, and the conduct remark schools are expected to
-- certify.
alter table public.students add column if not exists withdrawn_at date;
alter table public.students add column if not exists withdrawal_reason text;
alter table public.students add column if not exists conduct_remark text;

-- ---------------------------------------------------------------------------
-- Result-checker PINs — WAEC/NECO-style scratch cards. A school prints a
-- batch, sells or hands them out, and a parent without a parent-portal
-- account can look up one result using serial + PIN + the student's
-- admission number, at the public /check-result page.
-- ---------------------------------------------------------------------------
create table if not exists public.result_checker_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  quantity integer not null check (quantity > 0),
  -- Printed on the card as a suggested price. Not linked to the fee ledger —
  -- scratch-card sales are a school's own cash transaction, outside what
  -- the app tracks, same as how a printed report card isn't a fee record.
  price numeric(12, 2),
  note text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists result_checker_batches_school_id_idx
  on public.result_checker_batches (school_id);

-- serial is the lookup key at the public checker page, which has no
-- concept of "which school" — so it must be unique across the whole
-- platform, not just within one school.
create table if not exists public.result_checker_pins (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  batch_id uuid not null references public.result_checker_batches (id) on delete cascade,
  serial text not null unique,
  -- Plaintext, matching students.access_token (0007) and
  -- period_slots.share_token (0012) — this codebase's existing convention
  -- for an unguessable, admin-issued, single-purpose access code. Nothing
  -- more sensitive than one term's scores hangs off it, scoped further by
  -- also requiring the student's admission number.
  pin text not null,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  used_count integer not null default 0,
  first_used_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists result_checker_pins_batch_id_idx
  on public.result_checker_pins (batch_id);
create index if not exists result_checker_pins_serial_idx
  on public.result_checker_pins (serial);

alter table public.result_checker_batches enable row level security;
alter table public.result_checker_pins enable row level security;

-- Management (generating batches, viewing redemption stats) is
-- session-authenticated, so ordinary RLS applies. The public checker page
-- has no session at all and reads/updates through the service-role admin
-- client instead, the same way /p/[token] already does for the shared
-- student link — RLS is irrelevant to that path by design.
create policy "result_checker_batches_all_manager" on public.result_checker_batches
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "result_checker_pins_select_manager" on public.result_checker_pins
  for select using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "result_checker_pins_insert_manager" on public.result_checker_pins
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "result_checker_pins_delete_manager" on public.result_checker_pins
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
