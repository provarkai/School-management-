-- Per-school Paystack Subaccounts: online fee payments settle directly to
-- the school's own bank account instead of pooling in the platform's
-- single Paystack account. A school activates this in Settings by giving
-- their settlement bank details; src/lib/paystack.ts's createSubaccount()
-- registers it with Paystack and the resulting code is stored here.
--
-- No RLS changes needed: these are plain columns on tables that already
-- have the right policies (schools: proprietor can already update their own
-- row via updateSchoolProfile; payment_intents: still no insert/update
-- policy for authenticated/anon — every write is still service-role-only,
-- unchanged from 0013/0072).

alter table public.schools
  add column if not exists paystack_subaccount_code text,
  add column if not exists settlement_bank_code text,
  add column if not exists settlement_bank_name text,
  add column if not exists settlement_account_number text,
  add column if not exists settlement_account_name text;

-- Nullable, and only ever populated on a transaction that passed the fee
-- through to the payer (src/lib/payments.ts). NULL on every existing row
-- and on any future transaction where a school hasn't activated online
-- payments — those keep behaving exactly as before this migration.
--
-- `amount` keeps its original meaning throughout the codebase: the net fee
-- amount owed and the figure credited to fee_payments once a charge is
-- confirmed. `charged_amount` is what actually left the payer's card when
-- it differs from `amount` — the fee markup on top. markPaymentIntentSuccess
-- (src/lib/payments.ts) credits fee_payments from `amount`, never from
-- `charged_amount` or from Paystack's own reported charge, specifically so
-- a fee-inclusive markup is never mistaken for extra credit toward the
-- family's balance.
alter table public.payment_intents
  add column if not exists charged_amount numeric(12, 2),
  add column if not exists platform_fee numeric(12, 2),
  add column if not exists paystack_fee_estimate numeric(12, 2);
