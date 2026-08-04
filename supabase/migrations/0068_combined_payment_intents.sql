-- A parent paying "the school fees" shouldn't need to know there are 4
-- different fee types underneath, or start 4 separate Paystack checkouts.
-- payment_intents.fee_record_id stays a single required FK (it's still
-- populated — with a representative outstanding fee_record — purely to
-- satisfy that constraint and keep every other consumer of this table
-- unchanged); this flag tells markPaymentIntentSuccess() to spread the
-- settled amount across every fee type the student owes on instead of
-- crediting it all to that one record.
alter table public.payment_intents
  add column if not exists covers_all_fee_types boolean not null default false;
