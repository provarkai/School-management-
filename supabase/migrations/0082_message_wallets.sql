-- Per-school SMS billing: every school now pays for what it sends (flat
-- rate per message, see MESSAGE_COST_KOBO in src/lib/messageWallet.ts),
-- prepaid into a wallet topped up via Paystack — same checkout machinery
-- fee payments already use (src/lib/paystack.ts), just crediting a wallet
-- instead of a fee_record.
--
-- Ledger, not a mutable counter: message_wallet_transactions is insert-only
-- and a school's balance is always sum(amount_kobo) over its own rows —
-- positive for a top-up, negative for a send, either sign for a manual
-- adjustment (e.g. refunding a failed send). Nothing ever UPDATEs a balance
-- in place, so the history is also the audit trail.

create table if not exists public.message_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  -- Positive = credit (topup/adjustment), negative = debit (a message sent).
  amount_kobo bigint not null,
  type text not null check (type in ('topup', 'debit', 'adjustment')),
  description text,
  message_log_id uuid references public.message_logs (id) on delete set null,
  -- Set only on 'topup' rows, and only for the Paystack reference that
  -- funded it — lets credit_message_wallet() below be replay-safe the same
  -- way markPaymentIntentSuccess() is for fee payments (webhook + redirect
  -- callback can both fire for the same charge).
  topup_reference text,
  created_at timestamptz not null default now()
);

create index if not exists message_wallet_transactions_school_id_idx
  on public.message_wallet_transactions (school_id, created_at desc);
create unique index if not exists message_wallet_transactions_topup_reference_idx
  on public.message_wallet_transactions (topup_reference) where topup_reference is not null;

alter table public.message_wallet_transactions enable row level security;

-- Financial detail — proprietor only, same visibility as message_logs itself.
create policy "message_wallet_transactions_select_proprietor" on public.message_wallet_transactions
  for select using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- No insert/update/delete policy for authenticated/anon: every write goes
-- through debit_message_wallet()/credit_message_wallet() below, both
-- service-role-only, so a balance can never be altered except through the
-- one atomic, race-safe path each function provides.

drop policy if exists "message_wallet_transactions_active_school_only" on public.message_wallet_transactions;
create policy "message_wallet_transactions_active_school_only" on public.message_wallet_transactions
  as restrictive for all
  using (public.school_is_active(school_id));

-- Mirrors payment_intents (0072/0013): one row per initiated Paystack
-- transaction, looked up by reference when the webhook/callback confirms it.
create table if not exists public.message_wallet_topups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  reference text not null unique,
  amount_kobo bigint not null check (amount_kobo > 0),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  authorization_url text,
  initiated_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists message_wallet_topups_school_id_idx on public.message_wallet_topups (school_id);
create index if not exists message_wallet_topups_reference_idx on public.message_wallet_topups (reference);

alter table public.message_wallet_topups enable row level security;

create policy "message_wallet_topups_select_proprietor" on public.message_wallet_topups
  for select using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- Writes (create on initiate, update on verify) happen through the
-- service-role admin client, same as payment_intents — no insert/update
-- policy needed for authenticated/anon.

drop policy if exists "message_wallet_topups_active_school_only" on public.message_wallet_topups;
create policy "message_wallet_topups_active_school_only" on public.message_wallet_topups
  as restrictive for all
  using (public.school_is_active(school_id));

-- Atomic check-and-debit for a single message send. Deliberately NOT
-- granted to `authenticated` — sendAndLogMessage() (src/lib/messageLog.ts)
-- always calls this through the service-role admin client, even when the
-- rest of that function is writing message_logs through the caller's own
-- RLS-bound session, because the balance check has to be race-safe across
-- every caller (a staff member's own send, a bulk broadcast loop, and the
-- weekly cron job all have to serialize against the same balance) and that
-- can't be guaranteed from a plain client-side read-then-insert.
--
-- Returns the new balance in kobo, or null if the balance was too low —
-- the caller blocks the send on null rather than letting balance go negative.
create or replace function public.debit_message_wallet(
  target_school_id uuid,
  debit_kobo bigint,
  debit_description text
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance bigint;
begin
  select coalesce(sum(amount_kobo), 0) into current_balance
  from public.message_wallet_transactions
  where school_id = target_school_id;

  if current_balance < debit_kobo then
    return null;
  end if;

  insert into public.message_wallet_transactions (school_id, amount_kobo, type, description)
  values (target_school_id, -debit_kobo, 'debit', debit_description);

  return current_balance - debit_kobo;
end;
$$;

-- Postgres grants EXECUTE on every new function to PUBLIC by default (unlike
-- tables, which get no default grants) — the same gotcha 0075 had to
-- retroactively close on several other RPCs. Revoke it explicitly before
-- granting only to service_role, or `grant ... to service_role` below adds a
-- second way in without ever closing the first.
revoke execute on function public.debit_message_wallet(uuid, bigint, text) from public;
grant execute on function public.debit_message_wallet(uuid, bigint, text) to service_role;

-- Credits a wallet — either a real top-up (reference set, replay-safe) or
-- an internal adjustment (e.g. refunding a message whose send failed after
-- the wallet was already debited for it; reference left null, always
-- applied). Same service-role-only grant as debit_message_wallet, for the
-- same reason: this is the only path that's allowed to move money into a
-- school's wallet, so nothing but trusted server code (the Paystack
-- webhook/callback, and sendAndLogMessage's own refund path) can reach it.
create or replace function public.credit_message_wallet(
  target_school_id uuid,
  credit_kobo bigint,
  credit_type text,
  credit_description text,
  reference text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance bigint;
begin
  if credit_type not in ('topup', 'adjustment') then
    raise exception 'credit_message_wallet: invalid credit_type %', credit_type;
  end if;

  if reference is not null and exists (
    select 1 from public.message_wallet_transactions where topup_reference = reference
  ) then
    -- Already credited by an earlier call for this same reference (webhook
    -- and redirect callback racing to confirm the same top-up) — no-op.
    null;
  else
    insert into public.message_wallet_transactions
      (school_id, amount_kobo, type, description, topup_reference)
    values (target_school_id, credit_kobo, credit_type, credit_description, reference);
  end if;

  select coalesce(sum(amount_kobo), 0) into new_balance
  from public.message_wallet_transactions
  where school_id = target_school_id;

  return new_balance;
end;
$$;

revoke execute on function public.credit_message_wallet(uuid, bigint, text, text, text) from public;
grant execute on function public.credit_message_wallet(uuid, bigint, text, text, text) to service_role;

-- A message that never went out because the wallet couldn't cover it — the
-- school still gets an entry in their delivery log explaining why, instead
-- of a reminder just silently not arriving.
alter table public.message_logs drop constraint if exists message_logs_status_check;
alter table public.message_logs
  add constraint message_logs_status_check check (status in ('sent', 'failed', 'mocked', 'blocked'));

-- Platform-admin cross-school visibility, same pattern as
-- platform_message_failures (0072): a security-definer RPC gated on
-- is_platform_admin() rather than a select policy on the ledger itself.
create or replace function public.platform_message_wallet_balances()
returns table (
  school_id uuid,
  school_name text,
  balance_kobo bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.name,
    coalesce(sum(t.amount_kobo), 0)::bigint
  from public.schools s
  left join public.message_wallet_transactions t on t.school_id = s.id
  where public.is_platform_admin()
  group by s.id, s.name;
$$;

grant execute on function public.platform_message_wallet_balances() to authenticated;
