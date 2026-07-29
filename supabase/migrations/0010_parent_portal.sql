-- Full parent portal: real parent accounts (separate from staff app_users),
-- linked to one or more students by matching the parent's login email
-- against students.parent_email, with read-only RLS access to their own
-- children's fees, attendance, and results.

alter table public.students add column if not exists parent_email text;
create index if not exists students_parent_email_idx on public.students (lower(parent_email));

-- ---------------------------------------------------------------------------
-- parents — one row per parent auth account
-- ---------------------------------------------------------------------------
create table if not exists public.parents (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- parent_students — which children a parent account can see
-- ---------------------------------------------------------------------------
create table if not exists public.parent_students (
  parent_id uuid not null references public.parents (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

alter table public.parents enable row level security;
alter table public.parent_students enable row level security;

create policy "parents_select_own" on public.parents
  for select using (id = auth.uid());

create policy "parents_update_own" on public.parents
  for update using (id = auth.uid());

create policy "parent_students_select_own" on public.parent_students
  for select using (parent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Helper: is the current auth user a parent linked to this student?
-- ---------------------------------------------------------------------------
create or replace function public.is_linked_parent(target_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.parent_students ps
    where ps.parent_id = auth.uid() and ps.student_id = target_student_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Read-only parent access, layered on top of existing staff policies
-- (Postgres OR's multiple permissive policies together, so these only add
-- access — they never narrow what staff can already do).
-- ---------------------------------------------------------------------------
create policy "students_select_linked_parent" on public.students
  for select using (public.is_linked_parent(id));

create policy "classes_select_linked_parent" on public.classes
  for select using (
    exists (select 1 from public.students s where s.class_id = classes.id and public.is_linked_parent(s.id))
  );

create policy "schools_select_linked_parent" on public.schools
  for select using (
    exists (select 1 from public.students s where s.school_id = schools.id and public.is_linked_parent(s.id))
  );

create policy "fee_records_select_linked_parent" on public.fee_records
  for select using (public.is_linked_parent(student_id));

create policy "fee_payments_select_linked_parent" on public.fee_payments
  for select using (
    exists (
      select 1 from public.fee_records fr
      where fr.id = fee_payments.fee_record_id and public.is_linked_parent(fr.student_id)
    )
  );

create policy "attendance_select_linked_parent" on public.attendance
  for select using (public.is_linked_parent(student_id));

create policy "results_select_linked_parent" on public.results
  for select using (public.is_linked_parent(student_id));

-- ---------------------------------------------------------------------------
-- Auto-link: call after a parent signs in — matches their login email
-- against any student's parent_email that isn't linked yet.
-- ---------------------------------------------------------------------------
create or replace function public.link_my_children()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_email text;
begin
  select email into my_email from auth.users where id = auth.uid();
  if my_email is null then
    return;
  end if;

  insert into public.parent_students (parent_id, student_id)
  select auth.uid(), s.id
  from public.students s
  where s.parent_email is not null and lower(s.parent_email) = lower(my_email)
  on conflict (parent_id, student_id) do nothing;
end;
$$;

grant execute on function public.link_my_children() to authenticated;

-- ---------------------------------------------------------------------------
-- Signup now branches: parent accounts (raw_user_meta_data.account_type =
-- 'parent') get a parents row instead of an app_users staff row.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'account_type', 'staff') = 'parent' then
    insert into public.parents (id, name, email, phone)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
      new.email,
      new.raw_user_meta_data ->> 'phone'
    )
    on conflict (id) do nothing;
  else
    insert into public.app_users (id, email, name, role, school_id)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
      'teacher',
      null
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
