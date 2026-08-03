-- Auto-generated, stable admission numbers.
--
-- admission_number has been a free-text field the proprietor had to
-- remember to type in — nothing ever set it. That's why the result-checker
-- PIN page (0055) came up empty for real students: it requires an
-- admission number, and most students never had one. This makes it
-- {school abbreviation}-{sequence}, assigned once when a student is
-- created and never regenerated, so it stays fixed for the student's
-- entire time at the school — exactly the "doesn't change over the
-- student's lifecycle" a real admission number is supposed to be.

alter table public.schools add column if not exists admission_prefix text
  check (admission_prefix is null or admission_prefix ~ '^[A-Z0-9]{2,8}$');
alter table public.schools add column if not exists admission_seq integer not null default 0;

-- Derived once from the school name — initials of each word, uppercased
-- ("Oduntan Secondary School" -> "OSS"). The proprietor can change it in
-- Settings afterwards if it clashes with their existing paper records or
-- just looks wrong.
update public.schools
set admission_prefix = (
  select upper(string_agg(left(word, 1), ''))
  from unnest(regexp_split_to_array(btrim(name), '\s+')) as word
  where word <> ''
)
where admission_prefix is null;

-- A single-word name produces a 1-letter initial, which is legal but not
-- useful — fall back to the name's first three letters instead.
update public.schools
set admission_prefix = upper(regexp_replace(left(name, 3), '[^A-Za-z0-9]', '', 'g'))
where admission_prefix is not null and length(admission_prefix) < 2;

-- A name that produced nothing usable at all (pure punctuation/whitespace)
-- falls back to a fixed prefix rather than leaving the school unable to
-- admit a student until someone notices the column is still null.
update public.schools
set admission_prefix = 'SCH'
where admission_prefix is null or length(admission_prefix) < 2;

alter table public.schools alter column admission_prefix set not null;

-- Atomically claims the next number for a school. The row lock an UPDATE
-- takes implicitly is what makes this safe under concurrent calls — two
-- students created in the same second can never be handed the same
-- number, which a "read admission_seq, then write admission_seq + 1" pair
-- of separate statements could not guarantee.
--
-- security invoker (the default): it relies on the caller already holding
-- UPDATE rights on their own school row via schools_update_proprietor. If
-- RLS blocks the call, the UPDATE simply affects zero rows, which the null
-- check below turns into a clear exception instead of silently returning
-- a wrong result.
create or replace function public.next_admission_number(target_school_id uuid)
returns text
language plpgsql
as $$
declare
  result_prefix text;
  result_seq integer;
begin
  update public.schools
  set admission_seq = admission_seq + 1
  where id = target_school_id
  returning admission_prefix, admission_seq into result_prefix, result_seq;

  if result_prefix is null then
    raise exception 'Could not claim an admission number for school %', target_school_id;
  end if;

  return result_prefix || '-' || lpad(result_seq::text, 4, '0');
end;
$$;

-- Backfill every existing student who has never had one — oldest
-- admission first, so the new sequence at least roughly follows the order
-- they actually joined in. Only fills nulls; nothing already set is
-- touched.
do $$
declare
  s record;
begin
  for s in
    select id, school_id
    from public.students
    where admission_number is null
    order by school_id, admission_date nulls last, created_at, id
  loop
    update public.students
    set admission_number = public.next_admission_number(s.school_id)
    where id = s.id;
  end loop;
end $$;

-- Same defaults for schools created from here on.
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
  derived_prefix text;
begin
  select school_id into existing_school_id from public.app_users where id = auth.uid();

  if existing_school_id is not null then
    raise exception 'Account is already linked to a school';
  end if;

  if proprietor_gender is not null and proprietor_gender not in ('male', 'female') then
    raise exception 'Invalid gender value';
  end if;

  derived_prefix := upper((
    select string_agg(left(word, 1), '')
    from unnest(regexp_split_to_array(btrim(school_name), '\s+')) as word
    where word <> ''
  ));
  if derived_prefix is null or length(derived_prefix) < 2 then
    derived_prefix := upper(regexp_replace(left(school_name, 3), '[^A-Za-z0-9]', '', 'g'));
  end if;
  if derived_prefix is null or length(derived_prefix) < 2 then
    derived_prefix := 'SCH';
  end if;

  insert into public.schools (name, address, admission_prefix)
  values (school_name, school_address, derived_prefix)
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
