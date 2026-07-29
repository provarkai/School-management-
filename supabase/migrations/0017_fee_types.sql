-- Fee types: schools charge for more than tuition (PTA levy, exam fee,
-- uniform, feeding, transport, etc). Each fee_record now belongs to a
-- fee_type, so a student can owe several independent "ledgers" per term
-- instead of a single lump amount.

create table if not exists public.fee_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists fee_types_school_id_idx on public.fee_types (school_id);

alter table public.fee_types enable row level security;

create policy "fee_types_select_same_school" on public.fee_types
  for select using (school_id = public.current_school_id());

create policy "fee_types_write_proprietor" on public.fee_types
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "fee_types_update_proprietor" on public.fee_types
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "fee_types_delete_proprietor" on public.fee_types
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- Backfill: every existing school gets a default "School Fees" type, and
-- every existing fee_record is attributed to it.
insert into public.fee_types (school_id, name)
select id, 'School Fees' from public.schools
on conflict (school_id, name) do nothing;

alter table public.fee_records add column if not exists fee_type_id uuid references public.fee_types (id) on delete cascade;

update public.fee_records fr
set fee_type_id = ft.id
from public.fee_types ft
where fr.fee_type_id is null and ft.school_id = fr.school_id and ft.name = 'School Fees';

alter table public.fee_records alter column fee_type_id set not null;

alter table public.fee_records drop constraint if exists fee_records_student_id_session_term_key;
alter table public.fee_records
  add constraint fee_records_student_session_term_type_key unique (student_id, session, term, fee_type_id);

create index if not exists fee_records_fee_type_id_idx on public.fee_records (fee_type_id);

-- fee_summary now carries the fee type through (one row per fee_record, as
-- before — a student can have several rows per term, one per fee type).
create or replace view public.fee_summary
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
join public.fee_types ft on ft.id = fr.fee_type_id
left join public.fee_payments fp on fp.fee_record_id = fr.id
group by fr.id, ft.name;

grant select on public.fee_summary to authenticated;
