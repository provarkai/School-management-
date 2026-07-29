-- Custom fields for student info: a proprietor defines school-specific
-- extra fields (e.g. blood group, bus stop, state of origin) and values are
-- filled in per student. Definitions are visible school-wide; values follow
-- the same read scoping as the students table itself (proprietor sees all,
-- a teacher sees only their own class's students) but are proprietor-write
-- only, since these are administrative record fields.

create table if not exists public.student_field_definitions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text', 'number', 'date', 'select')),
  options text[],
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, label)
);

create index if not exists student_field_definitions_school_id_idx on public.student_field_definitions (school_id);

create table if not exists public.student_field_values (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  field_definition_id uuid not null references public.student_field_definitions (id) on delete cascade,
  value text,
  updated_at timestamptz not null default now(),
  unique (student_id, field_definition_id)
);

create index if not exists student_field_values_school_id_idx on public.student_field_values (school_id);
create index if not exists student_field_values_student_id_idx on public.student_field_values (student_id);

alter table public.student_field_definitions enable row level security;
alter table public.student_field_values enable row level security;

create policy "student_field_definitions_select_same_school" on public.student_field_definitions
  for select using (school_id = public.current_school_id());

create policy "student_field_definitions_write_proprietor" on public.student_field_definitions
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "student_field_definitions_update_proprietor" on public.student_field_definitions
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "student_field_definitions_delete_proprietor" on public.student_field_definitions
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "student_field_values_select_scoped" on public.student_field_values
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or exists (
        select 1 from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = student_field_values.student_id and c.teacher_id = auth.uid()
      )
    )
  );

create policy "student_field_values_write_proprietor" on public.student_field_values
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "student_field_values_update_proprietor" on public.student_field_values
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "student_field_values_delete_proprietor" on public.student_field_values
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
