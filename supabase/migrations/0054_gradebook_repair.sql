-- Re-runnable repair for migrations 0048 and 0050.
--
-- Those two scripts create policies with bare `create policy`, which fails
-- if the policy is already there. So a database that hit an error partway
-- through 0048 (the missing can_access_student from 0024 did exactly this)
-- and then re-ran it aborted near the top the second time — leaving the
-- tables in place, which makes a table-existence audit report success,
-- while everything below the abort point, including all the seed data, was
-- never applied.
--
-- Every statement here is safe to run repeatedly: policies are dropped
-- first, columns use `if not exists`, seeds use `on conflict do nothing`.
-- Running it on a database where 0048 and 0050 completed cleanly changes
-- nothing.

-- ---------------------------------------------------------------------------
-- Policies from 0048
-- ---------------------------------------------------------------------------
drop policy if exists "assessment_components_select_same_school" on public.assessment_components;
create policy "assessment_components_select_same_school" on public.assessment_components
  for select using (school_id = public.current_school_id());

drop policy if exists "assessment_components_write_proprietor" on public.assessment_components;
create policy "assessment_components_write_proprietor" on public.assessment_components
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

drop policy if exists "result_component_scores_all_scoped" on public.result_component_scores;
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

drop policy if exists "grade_bands_select_same_school" on public.grade_bands;
create policy "grade_bands_select_same_school" on public.grade_bands
  for select using (school_id = public.current_school_id());

drop policy if exists "grade_bands_write_proprietor" on public.grade_bands;
create policy "grade_bands_write_proprietor" on public.grade_bands
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- The 40/60 ceilings, which block a school configuring 30/70
-- ---------------------------------------------------------------------------
alter table public.results drop constraint if exists results_ca_score_check;
alter table public.results drop constraint if exists results_exam_score_check;
alter table public.results add constraint results_ca_score_check check (ca_score >= 0);
alter table public.results add constraint results_exam_score_check check (exam_score >= 0);

-- ---------------------------------------------------------------------------
-- Grading trigger: security definer so a teacher saving a score still gets
-- a grade back when the function reads the RLS-protected grade_bands.
-- ---------------------------------------------------------------------------
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
-- results.subject_id and the student record columns
-- ---------------------------------------------------------------------------
alter table public.results add column if not exists subject_id uuid references public.subjects (id) on delete set null;

update public.results r
set subject_id = s.id
from public.subjects s
where r.subject_id is null
  and s.school_id = r.school_id
  and lower(btrim(s.name)) = lower(btrim(r.subject));

alter table public.students add column if not exists admission_number text;
alter table public.students add column if not exists gender text;
alter table public.students add column if not exists address text;
alter table public.students add column if not exists guardian_name text;
alter table public.students add column if not exists guardian_phone text;
alter table public.students add column if not exists guardian_relationship text;
alter table public.students add column if not exists blood_group text;
alter table public.students add column if not exists genotype text;
alter table public.students add column if not exists allergies text;
alter table public.students add column if not exists emergency_contact_name text;
alter table public.students add column if not exists emergency_contact_phone text;

-- ---------------------------------------------------------------------------
-- Per-student subject registration
-- ---------------------------------------------------------------------------
create table if not exists public.student_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  session text not null,
  created_at timestamptz not null default now(),
  unique (student_id, subject_id, session)
);

create index if not exists student_subjects_student_id_idx on public.student_subjects (student_id);

alter table public.student_subjects enable row level security;

drop policy if exists "student_subjects_select_scoped" on public.student_subjects;
create policy "student_subjects_select_scoped" on public.student_subjects
  for select using (school_id = public.current_school_id());

drop policy if exists "student_subjects_write_proprietor" on public.student_subjects;
create policy "student_subjects_write_proprietor" on public.student_subjects
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- Policies from 0050
-- ---------------------------------------------------------------------------
drop policy if exists "report_card_traits_select_same_school" on public.report_card_traits;
create policy "report_card_traits_select_same_school" on public.report_card_traits
  for select using (school_id = public.current_school_id());

drop policy if exists "report_card_traits_write_proprietor" on public.report_card_traits;
create policy "report_card_traits_write_proprietor" on public.report_card_traits
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

drop policy if exists "student_trait_ratings_all_scoped" on public.student_trait_ratings;
create policy "student_trait_ratings_all_scoped" on public.student_trait_ratings
  for all using (public.can_access_student(student_id))
  with check (
    school_id = public.current_school_id() and public.can_access_student(student_id)
  );

drop policy if exists "student_trait_ratings_select_linked_parent" on public.student_trait_ratings;
create policy "student_trait_ratings_select_linked_parent" on public.student_trait_ratings
  for select using (
    exists (
      select 1 from public.students s
      where s.id = student_trait_ratings.student_id
        and s.class_id is not null
        and public.class_has_linked_parent(s.class_id)
    )
  );

-- ---------------------------------------------------------------------------
-- The seeds — the part that was actually missing
-- ---------------------------------------------------------------------------
insert into public.assessment_components (school_id, name, kind, max_score, position)
select s.id, c.name, c.kind, c.max_score, c.position
from public.schools s
cross join (values
  ('CA1', 'ca', 20::numeric, 0),
  ('CA2', 'ca', 20::numeric, 1),
  ('Exam', 'exam', 60::numeric, 2)
) as c(name, kind, max_score, position)
on conflict (school_id, name) do nothing;

insert into public.grade_bands (school_id, letter, min_score)
select s.id, g.letter, g.min_score
from public.schools s
cross join (values
  ('A', 70::numeric),
  ('B', 60::numeric),
  ('C', 50::numeric),
  ('D', 45::numeric),
  ('E', 40::numeric),
  ('F', 0::numeric)
) as g(letter, min_score)
on conflict (school_id, letter) do nothing;

insert into public.report_card_traits (school_id, name, domain, position)
select s.id, t.name, t.domain, t.position
from public.schools s
cross join (values
  ('Punctuality', 'affective', 0),
  ('Neatness', 'affective', 1),
  ('Honesty', 'affective', 2),
  ('Politeness', 'affective', 3),
  ('Attentiveness', 'affective', 4),
  ('Cooperation', 'affective', 5),
  ('Handwriting', 'psychomotor', 6),
  ('Drawing & Painting', 'psychomotor', 7),
  ('Sports', 'psychomotor', 8),
  ('Musical Skills', 'psychomotor', 9),
  ('Handling of Tools', 'psychomotor', 10)
) as t(name, domain, position)
on conflict (school_id, name) do nothing;
