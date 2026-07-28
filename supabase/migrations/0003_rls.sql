-- Row Level Security: multi-tenant isolation by school, teachers scoped to own class.

alter table public.schools enable row level security;
alter table public.app_users enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.fee_records enable row level security;
alter table public.fee_payments enable row level security;
alter table public.attendance enable row level security;
alter table public.results enable row level security;

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
create policy "schools_select_own" on public.schools
  for select using (id = public.current_school_id());

create policy "schools_update_proprietor" on public.schools
  for update using (id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- app_users
-- ---------------------------------------------------------------------------
create policy "app_users_select_same_school" on public.app_users
  for select using (school_id = public.current_school_id());

create policy "app_users_write_proprietor" on public.app_users
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "app_users_update_proprietor_or_self" on public.app_users
  for update using (
    school_id = public.current_school_id()
    and (public.current_role() = 'proprietor' or id = auth.uid())
  );

create policy "app_users_delete_proprietor" on public.app_users
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create policy "classes_select_same_school" on public.classes
  for select using (school_id = public.current_school_id());

create policy "classes_write_proprietor" on public.classes
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "classes_update_proprietor" on public.classes
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "classes_delete_proprietor" on public.classes
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- students — proprietor sees all, teacher sees own class only
-- ---------------------------------------------------------------------------
create policy "students_select_scoped" on public.students
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "students_write_proprietor" on public.students
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "students_update_proprietor" on public.students
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "students_delete_proprietor" on public.students
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- fee_records / fee_payments — proprietor/bursar only (no teacher access)
-- ---------------------------------------------------------------------------
create policy "fee_records_proprietor_all" on public.fee_records
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "fee_payments_proprietor_all" on public.fee_payments
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- attendance — proprietor full access, teacher scoped to own class
-- ---------------------------------------------------------------------------
create policy "attendance_select_scoped" on public.attendance
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "attendance_write_scoped" on public.attendance
  for insert with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "attendance_update_scoped" on public.attendance
  for update using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "attendance_delete_proprietor" on public.attendance
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- results — proprietor full access, teacher scoped to own class's students
-- ---------------------------------------------------------------------------
create policy "results_select_scoped" on public.results
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or exists (
        select 1 from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = results.student_id and c.teacher_id = auth.uid()
      )
    )
  );

create policy "results_write_scoped" on public.results
  for insert with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or exists (
        select 1 from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = results.student_id and c.teacher_id = auth.uid()
      )
    )
  );

create policy "results_update_scoped" on public.results
  for update using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or exists (
        select 1 from public.students s
        join public.classes c on c.id = s.class_id
        where s.id = results.student_id and c.teacher_id = auth.uid()
      )
    )
  );

create policy "results_delete_proprietor" on public.results
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
