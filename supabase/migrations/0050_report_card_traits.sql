-- Affective and psychomotor domains — the behavioural/skills ratings that
-- appear on essentially every Nigerian primary and secondary report card
-- alongside the academic table (punctuality, neatness, handwriting,
-- sports...), rated on a 1-5 scale per student per term.
--
-- Kept as a school-configurable catalogue rather than fixed columns
-- because the trait list genuinely varies between schools, and primary
-- schools tend to carry more of them than secondary.

create table if not exists public.report_card_traits (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  domain text not null check (domain in ('affective', 'psychomotor')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists report_card_traits_school_id_idx
  on public.report_card_traits (school_id);

alter table public.report_card_traits enable row level security;

create policy "report_card_traits_select_same_school" on public.report_card_traits
  for select using (school_id = public.current_school_id());

create policy "report_card_traits_write_proprietor" on public.report_card_traits
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create table if not exists public.student_trait_ratings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  trait_id uuid not null references public.report_card_traits (id) on delete cascade,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  rating smallint not null check (rating between 1 and 5),
  updated_by uuid references public.app_users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (student_id, trait_id, session, term)
);

create index if not exists student_trait_ratings_student_idx
  on public.student_trait_ratings (student_id, session, term);

alter table public.student_trait_ratings enable row level security;

-- Reuses can_access_student() from 0024, so a class teacher rates their own
-- class and the proprietor rates anyone — the same rule as scores.
create policy "student_trait_ratings_all_scoped" on public.student_trait_ratings
  for all using (public.can_access_student(student_id))
  with check (
    school_id = public.current_school_id() and public.can_access_student(student_id)
  );

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
-- Seed a conventional starting list for existing schools
-- ---------------------------------------------------------------------------
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

-- Same list for schools created from here on.
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

  insert into public.grade_bands (school_id, letter, min_score)
  values
    (new_school_id, 'A', 70),
    (new_school_id, 'B', 60),
    (new_school_id, 'C', 50),
    (new_school_id, 'D', 45),
    (new_school_id, 'E', 40),
    (new_school_id, 'F', 0);

  insert into public.report_card_traits (school_id, name, domain, position)
  values
    (new_school_id, 'Punctuality', 'affective', 0),
    (new_school_id, 'Neatness', 'affective', 1),
    (new_school_id, 'Honesty', 'affective', 2),
    (new_school_id, 'Politeness', 'affective', 3),
    (new_school_id, 'Attentiveness', 'affective', 4),
    (new_school_id, 'Cooperation', 'affective', 5),
    (new_school_id, 'Handwriting', 'psychomotor', 6),
    (new_school_id, 'Drawing & Painting', 'psychomotor', 7),
    (new_school_id, 'Sports', 'psychomotor', 8),
    (new_school_id, 'Musical Skills', 'psychomotor', 9),
    (new_school_id, 'Handling of Tools', 'psychomotor', 10);

  return new_school_id;
end;
$$;

grant execute on function public.bootstrap_school(text, text, text) to authenticated;
