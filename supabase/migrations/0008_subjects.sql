-- First-class subjects list per school, used to populate the score-entry
-- dropdown instead of free-typed subject names.

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists subjects_school_id_idx on public.subjects (school_id);

alter table public.subjects enable row level security;

create policy "subjects_select_same_school" on public.subjects
  for select using (school_id = public.current_school_id());

create policy "subjects_write_proprietor" on public.subjects
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "subjects_delete_proprietor" on public.subjects
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
