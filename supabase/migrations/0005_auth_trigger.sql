-- Auto-provision an app_users row whenever a Supabase Auth user is created,
-- and provide a safe (security definer) way for a brand-new user to create
-- their own school and become its proprietor.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, email, name, role, school_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'teacher',
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Lets a freshly-signed-up user (school_id still null) create a school and
-- become its proprietor in one step, without needing an existing proprietor
-- to grant access first (bootstrap / chicken-and-egg problem).
create or replace function public.bootstrap_school(school_name text, school_address text default null)
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

  insert into public.schools (name, address) values (school_name, school_address)
  returning id into new_school_id;

  update public.app_users
  set school_id = new_school_id, role = 'proprietor'
  where id = auth.uid();

  return new_school_id;
end;
$$;

grant execute on function public.bootstrap_school(text, text) to authenticated;
