-- Fixes "infinite recursion detected in policy for relation students".
--
-- Root cause: students_select_scoped (0003) queries classes (to check a
-- teacher's own classes), and classes_select_linked_parent (0010) queries
-- students directly with a raw subquery — a two-table RLS cycle. Postgres
-- detects this at query-plan time and refuses to run ANY query touching
-- students or classes, regardless of role, which is why the proprietor
-- dashboard/students list started showing 0 results.
--
-- Fix: move the students-referencing checks behind security-definer helper
-- functions (same pattern already used successfully by is_linked_parent),
-- which run with RLS bypassed internally and break the cycle.

create or replace function public.class_has_linked_parent(target_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.students s
    where s.class_id = target_class_id and public.is_linked_parent(s.id)
  );
$$;

create or replace function public.school_has_linked_parent(target_school_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.students s
    where s.school_id = target_school_id and public.is_linked_parent(s.id)
  );
$$;

drop policy if exists "classes_select_linked_parent" on public.classes;
create policy "classes_select_linked_parent" on public.classes
  for select using (public.class_has_linked_parent(id));

drop policy if exists "schools_select_linked_parent" on public.schools;
create policy "schools_select_linked_parent" on public.schools
  for select using (public.school_has_linked_parent(id));
