-- Scholarship/discount support: a fixed-amount reduction per fee record,
-- with a reason for the school's own bookkeeping. fee_summary.amount_expected
-- becomes the *net* amount owed (sticker price minus discount) so every
-- existing consumer (dashboard, fees list, reminders, payment links, parent
-- portal, analytics, exports) automatically reflects the discounted amount
-- with no changes needed there — the original sticker price is still
-- available as sticker_amount_expected for the fee-management UI.

alter table public.fee_records add column if not exists discount_amount numeric(12, 2) not null default 0;
alter table public.fee_records add column if not exists discount_reason text;

drop view if exists public.fee_summary;
create view public.fee_summary
with (security_invoker = true)
as
select
  fr.id as fee_record_id,
  fr.school_id,
  fr.student_id,
  fr.session,
  fr.term,
  fr.fee_type_id,
  ft.name as fee_type_name,
  greatest(fr.amount_expected - fr.discount_amount, 0) as amount_expected,
  coalesce(sum(fp.amount), 0) as amount_paid,
  greatest(fr.amount_expected - fr.discount_amount, 0) - coalesce(sum(fp.amount), 0) as balance,
  case
    when coalesce(sum(fp.amount), 0) <= 0 then 'owing'
    when coalesce(sum(fp.amount), 0) >= greatest(fr.amount_expected - fr.discount_amount, 0) then 'paid'
    else 'partial'
  end as status,
  max(fp.payment_date) as last_payment_date,
  fr.amount_expected as sticker_amount_expected,
  fr.discount_amount,
  fr.discount_reason
from public.fee_records fr
join public.fee_types ft on ft.id = fr.fee_type_id
left join public.fee_payments fp on fp.fee_record_id = fr.id
group by fr.id, ft.name;

grant select on public.fee_summary to authenticated;
