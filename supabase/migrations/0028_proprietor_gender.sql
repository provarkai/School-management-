-- Lets the school owner identify as "Proprietor" or "Proprietress" at
-- registration (a common distinction in Nigerian schools), used anywhere the
-- role is displayed instead of always saying "Proprietor".

alter table public.app_users add column if not exists gender text check (gender in ('male', 'female'));

-- Postgres treats a different parameter count as a distinct overload rather
-- than a replacement, which would leave the old 2-arg version callable and
-- create ambiguity for PostgREST's RPC resolution — drop it explicitly first.
drop function if exists public.bootstrap_school(text, text);

create or replace function public.bootstrap_school(
  school_name text,
  school_address text default null,
  proprietor_gender text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_school_id uuid;
  existing_school_id uuid;
begin
  select school_id into existing_school_id from public.app_users where id = auth.uid();

  if existing_school_id is not null then
    raise exception 'Account is already linked to a school';
  end if;

  if proprietor_gender is not null and proprietor_gender not in ('male', 'female') then
    raise exception 'Invalid gender value';
  end if;

  insert into public.schools (name, address) values (school_name, school_address)
  returning id into new_school_id;

  update public.app_users
  set school_id = new_school_id, role = 'proprietor', gender = proprietor_gender
  where id = auth.uid();

  return new_school_id;
end;
$$;

grant execute on function public.bootstrap_school(text, text, text) to authenticated;
