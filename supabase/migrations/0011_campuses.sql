-- Multi-campus/branch support: a school (tenant) can have multiple physical
-- campuses. Classes and staff are optionally assigned to one campus, letting
-- the proprietor filter classes/students/staff and dashboard summaries by
-- campus. Campus is a sub-partition within the existing school_id tenant
-- boundary, so no new RLS beyond same-school select/write is needed.

create table if not exists public.campuses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists campuses_school_id_idx on public.campuses (school_id);

alter table public.campuses enable row level security;

create policy "campuses_select_same_school" on public.campuses
  for select using (school_id = public.current_school_id());

create policy "campuses_write_proprietor" on public.campuses
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "campuses_update_proprietor" on public.campuses
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "campuses_delete_proprietor" on public.campuses
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

alter table public.classes add column if not exists campus_id uuid references public.campuses (id) on delete set null;
alter table public.app_users add column if not exists campus_id uuid references public.campuses (id) on delete set null;

create index if not exists classes_campus_id_idx on public.classes (campus_id);
create index if not exists app_users_campus_id_idx on public.app_users (campus_id);
