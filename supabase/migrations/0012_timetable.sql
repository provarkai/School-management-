-- Timetabling: a school defines its daily period structure once
-- (period_slots), then each class gets a subject + teacher assigned per
-- weekday/period (timetable_entries). Read access follows the same rule as
-- classes (any staff in the school can view), writes are proprietor-only.
-- classes.share_token powers a public, read-only printable link per class,
-- mirroring the existing student share-link pattern.

create table if not exists public.period_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  position integer not null,
  label text not null,
  start_time time not null,
  end_time time not null,
  is_break boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, position)
);

create index if not exists period_slots_school_id_idx on public.period_slots (school_id);

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  period_slot_id uuid not null references public.period_slots (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 5), -- 1=Mon .. 5=Fri
  subject_id uuid references public.subjects (id) on delete set null,
  teacher_id uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, period_slot_id, day_of_week)
);

create index if not exists timetable_entries_school_id_idx on public.timetable_entries (school_id);
create index if not exists timetable_entries_class_id_idx on public.timetable_entries (class_id);
create index if not exists timetable_entries_teacher_idx on public.timetable_entries (teacher_id, day_of_week, period_slot_id);

drop trigger if exists set_updated_at on public.timetable_entries;
create trigger set_updated_at
  before update on public.timetable_entries
  for each row execute function public.set_updated_at();

alter table public.period_slots enable row level security;
alter table public.timetable_entries enable row level security;

create policy "period_slots_select_same_school" on public.period_slots
  for select using (school_id = public.current_school_id());

create policy "period_slots_write_proprietor" on public.period_slots
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "period_slots_update_proprietor" on public.period_slots
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "period_slots_delete_proprietor" on public.period_slots
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "timetable_entries_select_same_school" on public.timetable_entries
  for select using (school_id = public.current_school_id());

create policy "timetable_entries_write_proprietor" on public.timetable_entries
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "timetable_entries_update_proprietor" on public.timetable_entries
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "timetable_entries_delete_proprietor" on public.timetable_entries
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

alter table public.classes
  add column if not exists share_token text unique default encode(gen_random_bytes(16), 'hex');

update public.classes set share_token = encode(gen_random_bytes(16), 'hex') where share_token is null;

alter table public.classes alter column share_token set not null;

create index if not exists classes_share_token_idx on public.classes (share_token);
