-- Helper functions + triggers

-- Returns the school_id of the currently authenticated staff user.
-- security definer + fixed search_path so it can be used inside RLS policies
-- on app_users itself without infinite recursion.
create or replace function public.current_school_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select school_id from public.app_users where id = auth.uid();
$$;

-- Returns the role ('proprietor' | 'teacher') of the currently authenticated staff user.
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.app_users where id = auth.uid();
$$;

-- Generic updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.fee_records;
create trigger set_updated_at
  before update on public.fee_records
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.results;
create trigger set_updated_at
  before update on public.results
  for each row execute function public.set_updated_at();

-- Auto-derive letter grade from total score (CA + exam, out of 100)
create or replace function public.set_result_grade()
returns trigger
language plpgsql
as $$
begin
  new.grade := case
    when (new.ca_score + new.exam_score) >= 70 then 'A'
    when (new.ca_score + new.exam_score) >= 60 then 'B'
    when (new.ca_score + new.exam_score) >= 50 then 'C'
    when (new.ca_score + new.exam_score) >= 45 then 'D'
    when (new.ca_score + new.exam_score) >= 40 then 'E'
    else 'F'
  end;
  return new;
end;
$$;

drop trigger if exists set_result_grade on public.results;
create trigger set_result_grade
  before insert or update on public.results
  for each row execute function public.set_result_grade();
