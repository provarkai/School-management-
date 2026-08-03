-- Repairs the duplicate classes left behind by session promotion.
--
-- Promotion used to create a fresh class row for the new session, so a
-- school ended up with two JSS1s, two JSS2s and so on after every
-- promotion — each holding a share of the students, timetable, attendance
-- and assignments. The app no longer does this (a class is a permanent
-- thing; students move through it), and this merges the rows that already
-- got split.
--
-- For each group of classes with the same name in the same school, the
-- OLDEST row wins, because that's the one carrying the timetable, class
-- teacher and attendance history. Everything pointing at the newer rows is
-- repointed to it, then the newer rows are deleted.
--
-- Names are matched case- and space-insensitively, so "Jss3" and "JSS3"
-- merge into one class rather than sitting side by side.
--
-- Safe to run on a database with no duplicates: every statement simply
-- matches nothing.

do $$
declare
  merged integer;
begin

  create temporary table class_merges on commit drop as
  select
    c.id            as duplicate_id,
    first_value(c.id) over (
      partition by c.school_id, lower(btrim(c.name))
      order by c.created_at, c.id
    )               as keep_id
  from public.classes c;

  delete from class_merges where duplicate_id = keep_id;

  select count(*) into merged from class_merges;
  raise notice 'Merging % duplicate class row(s)', merged;

  -- Students first: this is what puts each child back in the single
  -- surviving class for their year.
  update public.students s
  set class_id = m.keep_id
  from class_merges m
  where s.class_id = m.duplicate_id;

  update public.attendance a
  set class_id = m.keep_id
  from class_merges m
  where a.class_id = m.duplicate_id;

  update public.assignments x
  set class_id = m.keep_id
  from class_merges m
  where x.class_id = m.duplicate_id;

  update public.learning_resources r
  set class_id = m.keep_id
  from class_merges m
  where r.class_id = m.duplicate_id;

  update public.exams e
  set class_id = m.keep_id
  from class_merges m
  where e.class_id = m.duplicate_id;

  -- timetable_entries is unique on (class_id, period_slot_id, day_of_week).
  -- Where the surviving class already has that slot filled, the duplicate's
  -- entry is dropped rather than repointed — moving it would collide, and
  -- the older row is the one the school actually built.
  delete from public.timetable_entries t
  using class_merges m
  where t.class_id = m.duplicate_id
    and exists (
      select 1 from public.timetable_entries keep
      where keep.class_id = m.keep_id
        and keep.period_slot_id = t.period_slot_id
        and keep.day_of_week = t.day_of_week
    );

  update public.timetable_entries t
  set class_id = m.keep_id
  from class_merges m
  where t.class_id = m.duplicate_id;

  -- Same story for curriculum progress, unique on (class_id, topic_id).
  -- Where both rows exist, keep whichever is further along: a topic marked
  -- completed on either row was in fact taught.
  update public.class_topic_progress keep
  set status = 'completed'
  from public.class_topic_progress dup
  join class_merges m on dup.class_id = m.duplicate_id
  where keep.class_id = m.keep_id
    and keep.topic_id = dup.topic_id
    and dup.status = 'completed'
    and keep.status is distinct from 'completed';

  delete from public.class_topic_progress p
  using class_merges m
  where p.class_id = m.duplicate_id
    and exists (
      select 1 from public.class_topic_progress keep
      where keep.class_id = m.keep_id
        and keep.topic_id = p.topic_id
    );

  update public.class_topic_progress p
  set class_id = m.keep_id
  from class_merges m
  where p.class_id = m.duplicate_id;

  -- Promotion history: keep the trail pointing at classes that still exist.
  update public.student_promotions sp
  set from_class_id = m.keep_id
  from class_merges m
  where sp.from_class_id = m.duplicate_id;

  update public.student_promotions sp
  set to_class_id = m.keep_id
  from class_merges m
  where sp.to_class_id = m.duplicate_id;

  -- Nothing points at the duplicates any more.
  delete from public.classes c
  using class_merges m
  where c.id = m.duplicate_id;

  -- Tidy the surviving names so a school that typed "Jss3" once doesn't
  -- keep the odd one out.
  update public.classes
  set name = btrim(name)
  where name <> btrim(name);

end $$;
