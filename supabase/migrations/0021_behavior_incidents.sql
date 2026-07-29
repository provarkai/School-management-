-- Student behavior / disciplinary record tracking.
-- Proprietor sees every incident; a teacher sees/logs only incidents for
-- students in their own class, mirroring the results/attendance RLS pattern.

create table if not exists public.behavior_incidents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  incident_date date not null default current_date,
  category text not null check (category in ('merit', 'demerit')),
  severity text not null default 'minor' check (severity in ('minor', 'major', 'severe')),
  description text not null,
  action_taken text,
  recorded_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists behavior_incidents_school_id_idx on public.behavior_incidents (school_id);
create index if not exists behavior_incidents_student_id_idx on public.behavior_incidents (student_id);

alter table public.behavior_incidents enable row level security;

create policy "behavior_incidents_select_scoped" on public.behavior_incidents
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or exists (
        select 1 from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = behavior_incidents.student_id and c.teacher_id = auth.uid()
      )
    )
  );

create policy "behavior_incidents_write_scoped" on public.behavior_incidents
  for insert with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or exists (
        select 1 from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = behavior_incidents.student_id and c.teacher_id = auth.uid()
      )
    )
  );

create policy "behavior_incidents_update_scoped" on public.behavior_incidents
  for update using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or exists (
        select 1 from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = behavior_incidents.student_id and c.teacher_id = auth.uid()
      )
    )
  );

create policy "behavior_incidents_delete_proprietor" on public.behavior_incidents
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
