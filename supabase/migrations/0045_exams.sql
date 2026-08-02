-- Online examination system: multiple-choice exams a teacher (or the
-- proprietor) sets up against a class, auto-graded on submission. Students
-- have no login of their own — same as every other student-facing thing in
-- this app, they take the exam through their existing personal share link
-- (students.access_token, the same token /p/[token] already uses), so the
-- taking/submitting side runs through the admin client with the token as
-- the gate rather than through RLS.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject text,
  title text not null,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists exams_school_id_idx on public.exams (school_id);
create index if not exists exams_class_id_idx on public.exams (class_id);

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  position integer not null default 0,
  question_text text not null,
  options jsonb not null,
  correct_option integer not null,
  points numeric(6, 2) not null default 1 check (points > 0),
  created_at timestamptz not null default now()
);

create index if not exists exam_questions_exam_id_idx on public.exam_questions (exam_id);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(6, 2),
  max_score numeric(6, 2),
  created_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

create index if not exists exam_attempts_exam_id_idx on public.exam_attempts (exam_id);

create table if not exists public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  selected_option integer,
  unique (attempt_id, question_id)
);

alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_answers enable row level security;

create policy "exams_select_scoped" on public.exams
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "exams_write_scoped" on public.exams
  for insert with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "exams_update_scoped" on public.exams
  for update using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "exams_delete_scoped" on public.exams
  for delete using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "exam_questions_all_scoped" on public.exam_questions
  for all using (
    exists (
      select 1 from public.exams e
      where e.id = exam_questions.exam_id
        and e.school_id = public.current_school_id()
        and (public.current_role() = 'proprietor' or e.class_id in (select id from public.classes where teacher_id = auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.exams e
      where e.id = exam_questions.exam_id
        and e.school_id = public.current_school_id()
        and (public.current_role() = 'proprietor' or e.class_id in (select id from public.classes where teacher_id = auth.uid()))
    )
  );

create policy "exam_attempts_select_scoped" on public.exam_attempts
  for select using (
    exists (
      select 1 from public.exams e
      where e.id = exam_attempts.exam_id
        and e.school_id = public.current_school_id()
        and (public.current_role() = 'proprietor' or e.class_id in (select id from public.classes where teacher_id = auth.uid()))
    )
  );

create policy "exam_answers_select_scoped" on public.exam_answers
  for select using (
    exists (
      select 1 from public.exam_attempts a
      join public.exams e on e.id = a.exam_id
      where a.id = exam_answers.attempt_id
        and e.school_id = public.current_school_id()
        and (public.current_role() = 'proprietor' or e.class_id in (select id from public.classes where teacher_id = auth.uid()))
    )
  );
