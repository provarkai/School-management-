-- Convenience view: fee balance + status per fee_record, driven off fee_payments.
create or replace view public.fee_summary
with (security_invoker = true)
as
select
  fr.id as fee_record_id,
  fr.school_id,
  fr.student_id,
  fr.session,
  fr.term,
  fr.amount_expected,
  coalesce(sum(fp.amount), 0) as amount_paid,
  fr.amount_expected - coalesce(sum(fp.amount), 0) as balance,
  case
    when coalesce(sum(fp.amount), 0) <= 0 then 'owing'
    when coalesce(sum(fp.amount), 0) >= fr.amount_expected then 'paid'
    else 'partial'
  end as status,
  max(fp.payment_date) as last_payment_date
from public.fee_records fr
left join public.fee_payments fp on fp.fee_record_id = fr.id
group by fr.id;

grant select on public.fee_summary to authenticated;
