-- Free-text remarks on a student's termly report card. One row per
-- student/session/term, mirroring how results are scoped: the literal
-- proprietor or the student's class teacher can write; the UI further
-- restricts the "principal" field to managers, but that's enforced at the
-- app layer the same way results scoring already is.
create table if not exists public.report_remarks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  teacher_remark text,
  principal_remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, session, term)
);

create index if not exists report_remarks_school_id_idx on public.report_remarks (school_id);
create index if not exists report_remarks_student_id_idx on public.report_remarks (student_id);

alter table public.report_remarks enable row level security;

create policy "report_remarks_select_scoped" on public.report_remarks
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or exists (
        select 1 from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = report_remarks.student_id and c.teacher_id = auth.uid()
      )
    )
  );

create policy "report_remarks_select_linked_parent" on public.report_remarks
  for select using (public.is_linked_parent(student_id));

create policy "report_remarks_insert_scoped" on public.report_remarks
  for insert with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or exists (
        select 1 from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = report_remarks.student_id and c.teacher_id = auth.uid()
      )
    )
  );

create policy "report_remarks_update_scoped" on public.report_remarks
  for update using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or exists (
        select 1 from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = report_remarks.student_id and c.teacher_id = auth.uid()
      )
    )
  );
