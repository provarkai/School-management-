-- Phase 1 of the gradebook rework — schema only; the class-grid entry UI
-- that consumes it lands next.
--
-- Design constraint driving everything here: `results` stays the canonical
-- per-subject row. Ten files read results.ca_score/exam_score (report card
-- PDFs, GPA, class ranking, analytics, the ad-hoc report builder, the
-- exam-score push) and none of them change. Component scores are a child
-- table whose sums are written back into ca_score/exam_score by the app —
-- the same cached-sum pattern payroll_entry_deductions already uses,
-- chosen there because net_pay is a generated column and here because the
-- blast radius of moving those columns would be the whole app.

-- ---------------------------------------------------------------------------
-- 1. Assessment components (CA1 / CA2 / Exam ... configurable per school)
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_components (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  -- Which half of results this component feeds. The sum of every 'ca'
  -- component lands in results.ca_score, every 'exam' one in exam_score.
  kind text not null check (kind in ('ca', 'exam')),
  max_score numeric(5, 2) not null check (max_score > 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists assessment_components_school_id_idx
  on public.assessment_components (school_id);

alter table public.assessment_components enable row level security;

create policy "assessment_components_select_same_school" on public.assessment_components
  for select using (school_id = public.current_school_id());

create policy "assessment_components_write_proprietor" on public.assessment_components
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create table if not exists public.result_component_scores (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  result_id uuid not null references public.results (id) on delete cascade,
  component_id uuid not null references public.assessment_components (id) on delete cascade,
  score numeric(5, 2) not null default 0 check (score >= 0),
  created_at timestamptz not null default now(),
  unique (result_id, component_id)
);

create index if not exists result_component_scores_result_id_idx
  on public.result_component_scores (result_id);

alter table public.result_component_scores enable row level security;

-- Reuses can_access_student() from 0024 so component scores inherit exactly
-- the same "proprietor sees all, teacher sees own class" rule as the parent
-- result row, without restating the join.
create policy "result_component_scores_all_scoped" on public.result_component_scores
  for all using (
    exists (
      select 1 from public.results r
      where r.id = result_component_scores.result_id
        and public.can_access_student(r.student_id)
    )
  )
  with check (
    exists (
      select 1 from public.results r
      where r.id = result_component_scores.result_id
        and public.can_access_student(r.student_id)
    )
  );

-- The 40/60 ceilings were only ever correct for the hardcoded split. A school
-- configuring 30/70 would fail the exam_score check, so the bounds move up to
-- the app, validated against each component's max_score.
alter table public.results drop constraint if exists results_ca_score_check;
alter table public.results drop constraint if exists results_exam_score_check;
alter table public.results add constraint results_ca_score_check check (ca_score >= 0);
alter table public.results add constraint results_exam_score_check check (exam_score >= 0);

-- ---------------------------------------------------------------------------
-- 2. Per-school grade bands (was hardcoded A>=70 ... in set_result_grade)
-- ---------------------------------------------------------------------------
create table if not exists public.grade_bands (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  letter text not null,
  min_score numeric(5, 2) not null check (min_score >= 0),
  -- Feeds GPA. Kept alongside the letter so a school using a 4.0 scale or
  -- non-A–F letters doesn't silently score 0 through lib/grading.ts.
  points numeric(4, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, letter)
);

create index if not exists grade_bands_school_id_idx on public.grade_bands (school_id);

alter table public.grade_bands enable row level security;

create policy "grade_bands_select_same_school" on public.grade_bands
  for select using (school_id = public.current_school_id());

create policy "grade_bands_write_proprietor" on public.grade_bands
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- security definer because the trigger now reads a second RLS-protected
-- table: a teacher saving a score must still get a grade back even though
-- the read is filtered by the school scope of the row being written.
create or replace function public.set_result_grade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  computed_total numeric;
  band_letter text;
begin
  computed_total := new.ca_score + new.exam_score;

  select gb.letter into band_letter
  from public.grade_bands gb
  where gb.school_id = new.school_id
    and computed_total >= gb.min_score
  order by gb.min_score desc
  limit 1;

  -- Falls back to the original fixed scale when a school has no bands
  -- configured, so grading can never silently start returning null.
  if band_letter is null then
    band_letter := case
      when computed_total >= 70 then 'A'
      when computed_total >= 60 then 'B'
      when computed_total >= 50 then 'C'
      when computed_total >= 45 then 'D'
      when computed_total >= 40 then 'E'
      else 'F'
    end;
  end if;

  new.grade := band_letter;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. results.subject_id — closes the free-text drift risk
-- ---------------------------------------------------------------------------
-- Left nullable and alongside the existing text column: historical rows may
-- name a subject that was never added to the subjects list, and nothing
-- reads the FK yet. The text column stays authoritative until the grid does.
alter table public.results
  add column if not exists subject_id uuid references public.subjects (id) on delete set null;

create index if not exists results_subject_id_idx on public.results (subject_id);

update public.results r
set subject_id = s.id
from public.subjects s
where r.subject_id is null
  and s.school_id = r.school_id
  and lower(trim(s.name)) = lower(trim(r.subject));

-- ---------------------------------------------------------------------------
-- 4. Per-student subject registration (SS science/arts/commercial splits)
-- ---------------------------------------------------------------------------
-- Per session rather than per term: a student's subject combination is
-- chosen at the start of the year, not re-picked each term.
create table if not exists public.student_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  session text not null,
  created_at timestamptz not null default now(),
  unique (student_id, subject_id, session)
);

create index if not exists student_subjects_student_id_idx
  on public.student_subjects (student_id, session);
create index if not exists student_subjects_subject_id_idx
  on public.student_subjects (subject_id, session);

alter table public.student_subjects enable row level security;

create policy "student_subjects_select_scoped" on public.student_subjects
  for select using (school_id = public.current_school_id());

create policy "student_subjects_write_proprietor" on public.student_subjects
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- 5. Fuller student records
-- ---------------------------------------------------------------------------
-- admission_number is the human-readable identifier Nigerian schools use
-- everywhere; ID cards, transfer certificates and result-checker PINs all
-- depend on it. Nullable because existing students don't have one yet, and
-- unique per school rather than globally.
alter table public.students add column if not exists admission_number text;
alter table public.students add column if not exists gender text check (gender in ('male', 'female'));
alter table public.students add column if not exists address text;
alter table public.students add column if not exists guardian_name text;
alter table public.students add column if not exists guardian_phone text;
alter table public.students add column if not exists guardian_relationship text;
alter table public.students add column if not exists blood_group text;
-- Genotype matters specifically here — sickle-cell status is information a
-- Nigerian school needs on hand, and it's the field most often lost when
-- migrating from a generic system.
alter table public.students add column if not exists genotype text;
alter table public.students add column if not exists allergies text;
alter table public.students add column if not exists emergency_contact_name text;
alter table public.students add column if not exists emergency_contact_phone text;

create unique index if not exists students_admission_number_unique
  on public.students (school_id, admission_number)
  where admission_number is not null;

-- ---------------------------------------------------------------------------
-- 6. Seed defaults for existing schools
-- ---------------------------------------------------------------------------
-- Deliberately mirrors the previous hardcoded behaviour exactly: two CAs
-- summing to 40 and an exam of 60, and the same A–F cutoffs. Existing rows
-- stay valid and every school sees identical grades the day this lands.
insert into public.assessment_components (school_id, name, kind, max_score, position)
select s.id, c.name, c.kind, c.max_score, c.position
from public.schools s
cross join (values
  ('CA1', 'ca', 20::numeric, 0),
  ('CA2', 'ca', 20::numeric, 1),
  ('Exam', 'exam', 60::numeric, 2)
) as c(name, kind, max_score, position)
on conflict (school_id, name) do nothing;

insert into public.grade_bands (school_id, letter, min_score, points)
select s.id, g.letter, g.min_score, g.points
from public.schools s
cross join (values
  ('A', 70::numeric, 5::numeric),
  ('B', 60::numeric, 4::numeric),
  ('C', 50::numeric, 3::numeric),
  ('D', 45::numeric, 2::numeric),
  ('E', 40::numeric, 1::numeric),
  ('F', 0::numeric, 0::numeric)
) as g(letter, min_score, points)
on conflict (school_id, letter) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Seed the same defaults for schools created from here on
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_school(
  school_name text,
  school_address text default null,
  proprietor_gender text default null
)
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

  if proprietor_gender is not null and proprietor_gender not in ('male', 'female') then
    raise exception 'Invalid gender value';
  end if;

  insert into public.schools (name, address) values (school_name, school_address)
  returning id into new_school_id;

  update public.app_users
  set school_id = new_school_id, role = 'proprietor', gender = proprietor_gender
  where id = auth.uid();

  insert into public.assessment_components (school_id, name, kind, max_score, position)
  values
    (new_school_id, 'CA1', 'ca', 20, 0),
    (new_school_id, 'CA2', 'ca', 20, 1),
    (new_school_id, 'Exam', 'exam', 60, 2);

  insert into public.grade_bands (school_id, letter, min_score, points)
  values
    (new_school_id, 'A', 70, 5),
    (new_school_id, 'B', 60, 4),
    (new_school_id, 'C', 50, 3),
    (new_school_id, 'D', 45, 2),
    (new_school_id, 'E', 40, 1),
    (new_school_id, 'F', 0, 0);

  return new_school_id;
end;
$$;

grant execute on function public.bootstrap_school(text, text, text) to authenticated;
