-- Session promotion: bulk-advance an entire class to a new class/session
-- (e.g. SS1 -> SS2) instead of re-registering every student. Promotion
-- itself is plain app-level inserts/updates on the existing classes and
-- students tables (each session's classes are already separate rows, so
-- "promoting" just means creating next session's class rows and repointing
-- students.class_id at them) — the one schema change needed is a distinct
-- status for a class that finished out (e.g. SS3) instead of being
-- promoted, so those students stop showing as "withdrawn" (which implies
-- they left involuntarily).

alter table public.students drop constraint if exists students_status_check;
alter table public.students
  add constraint students_status_check check (status in ('active', 'withdrawn', 'graduated'));
