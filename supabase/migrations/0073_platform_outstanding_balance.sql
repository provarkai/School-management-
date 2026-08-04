-- Monitoring item #4: platform-wide outstanding balance. "Fees processed"
-- (platform_totals.total_fees_processed) only ever grows — it says nothing
-- about how much is currently unpaid across every school. Mirrors the same
-- balance > 0 definition of "outstanding" already used by the debtors page
-- (src/app/(app)/debtors/page.tsx), computed directly against fee_records/
-- fee_payments rather than through the fee_summary view, since this runs
-- security definer and needs to see every school regardless of RLS —
-- aggregate-only, per the existing platform_totals()/platform_school_stats()
-- convention of never returning raw student/fee rows to the platform admin.
create or replace function public.platform_totals()
returns table (
  total_schools bigint,
  total_students bigint,
  total_fees_processed numeric,
  signups_this_month bigint,
  total_outstanding_balance numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.schools),
    (select count(*) from public.students),
    (select coalesce(sum(amount), 0) from public.fee_payments),
    (select count(*) from public.schools where created_at >= date_trunc('month', now())),
    (
      select coalesce(sum(balance), 0)
      from (
        select
          greatest(fr.amount_expected - fr.discount_amount, 0) - coalesce(sum(fp.amount), 0) as balance
        from public.fee_records fr
        left join public.fee_payments fp on fp.fee_record_id = fr.id
        group by fr.id, fr.amount_expected, fr.discount_amount
      ) per_record
      where balance > 0
    )
  where public.is_platform_admin();
$$;

grant execute on function public.platform_totals() to authenticated;
