-- Re-orders the backfilled admission numbers from 0056 by class seniority
-- (SSS3 first, working down to the youngest class) instead of admission
-- date, and stops admission_number being editable per student — it's
-- fixed once assigned, only the school-wide prefix changes going forward
-- (Settings).
--
-- This only touches numbers this app generated itself (matching
-- "{prefix}-####" exactly for the student's own school). A number a
-- school typed in by hand, or imported from an old system, is left alone
-- — this is a re-run of an automatic backfill, not a way to overwrite a
-- real external record.

-- Ranks a class name by how senior it is, highest first: SSS > JSS >
-- Primary > Nursery/KG, and within a tier, the higher grade number is more
-- senior (SSS3 outranks SSS1). Unrecognised names — a custom class name,
-- or no class at all — sort last rather than erroring, since a school's
-- naming is free text and this only needs to produce a reasonable order,
-- not a perfect one.
create or replace function public.class_seniority_rank(class_name text)
returns integer
language plpgsql
as $$
declare
  n text := upper(btrim(coalesce(class_name, '')));
  m text[];
begin
  m := regexp_match(n, '^SSS?\s*([0-9]+)');
  if m is not null then
    return 400 + m[1]::integer;
  end if;

  m := regexp_match(n, '^JSS?\s*([0-9]+)');
  if m is not null then
    return 300 + m[1]::integer;
  end if;

  m := regexp_match(n, '^(?:PRY|PRIMARY|BASIC)\s*([0-9]+)');
  if m is not null then
    return 200 + m[1]::integer;
  end if;

  m := regexp_match(n, '^(?:NUR(?:SERY)?|KG|RECEPTION|PRE[- ]?NURSERY)\s*([0-9]*)');
  if m is not null then
    return 100 + coalesce(nullif(m[1], '')::integer, 0);
  end if;

  return 0;
end;
$$;

-- Clear only the auto-generated-looking numbers, then reset each school's
-- counter so the redo starts clean from 0001 again.
update public.students s
set admission_number = null
from public.schools sc
where s.school_id = sc.id
  and s.admission_number ~ ('^' || sc.admission_prefix || '-[0-9]{4,}$');

update public.schools set admission_seq = 0;

-- Reassign, most senior class first within each school; within the same
-- class, oldest admission first as a tiebreak.
do $$
declare
  r record;
begin
  for r in
    select st.id, st.school_id
    from public.students st
    left join public.classes c on c.id = st.class_id
    where st.admission_number is null
    order by
      st.school_id,
      public.class_seniority_rank(c.name) desc,
      st.admission_date nulls last,
      st.created_at,
      st.id
  loop
    update public.students
    set admission_number = public.next_admission_number(r.school_id)
    where id = r.id;
  end loop;
end $$;
