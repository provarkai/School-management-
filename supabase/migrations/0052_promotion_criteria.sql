-- Promotion criteria — turns the one-click session promotion from "move
-- everybody up" into a decision the results actually inform.
--
-- Three numbers, because that is what a Nigerian primary/secondary school
-- actually writes on a report card ("Promoted to Primary 4" / "To repeat
-- Primary 3"): the overall session average a student must reach, the mark
-- that counts as a pass in a single subject, and how many subjects a
-- student may fail and still go up.
--
-- Attendance is deliberately NOT a criterion. Session start/end dates
-- aren't stored anywhere, so any attendance rate would be computed over a
-- guessed window — too fuzzy to hang a repeat decision on.
--
-- The criteria produce a *recommendation*. The proprietor sees it beside
-- each student's average and can override it before promoting; nothing is
-- decided automatically.

alter table public.schools
  add column if not exists promotion_min_average numeric(5, 2) not null default 40,
  add column if not exists promotion_subject_pass_mark numeric(5, 2) not null default 40,
  add column if not exists promotion_max_failed_subjects integer not null default 3;

-- ---------------------------------------------------------------------------
-- student_promotions — the record of what each promotion run decided.
-- Until now a promotion left no trace beyond the students' new class_id,
-- so "why is this child repeating Primary 3?" had no answer.
-- ---------------------------------------------------------------------------
create table if not exists public.student_promotions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  from_session text not null,
  to_session text not null,
  -- Class names are stored alongside the ids so the history stays readable
  -- even if a class is later renamed or deleted.
  from_class_id uuid references public.classes (id) on delete set null,
  from_class_name text not null,
  to_class_id uuid references public.classes (id) on delete set null,
  to_class_name text,
  decision text not null check (decision in ('promoted', 'repeated', 'graduated')),
  -- Null where the school entered no results for the student that session.
  average_score numeric(5, 2),
  subjects_failed integer,
  subjects_counted integer,
  /** True when the proprietor overrode what the criteria recommended. */
  overridden boolean not null default false,
  decided_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists student_promotions_school_id_idx on public.student_promotions (school_id);
create index if not exists student_promotions_student_id_idx on public.student_promotions (student_id);

alter table public.student_promotions enable row level security;

create policy "student_promotions_select_same_school" on public.student_promotions
  for select using (school_id = public.current_school_id());

create policy "student_promotions_insert_proprietor" on public.student_promotions
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "student_promotions_update_proprietor" on public.student_promotions
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "student_promotions_delete_proprietor" on public.student_promotions
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
