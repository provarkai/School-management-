-- Staff attendance/lateness, separate from payroll itself — daily
-- present/late/absent marking for accountability. A proprietor can look
-- at a staff member's lateness count for the month and decide to add a
-- "Lateness/Absence" line item via the existing payroll deduction types,
-- but this table itself has no automatic link to payroll.

create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  staff_id uuid not null references public.app_users (id) on delete cascade,
  date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (staff_id, date)
);

create index if not exists staff_attendance_school_id_idx on public.staff_attendance (school_id);
create index if not exists staff_attendance_staff_id_date_idx on public.staff_attendance (staff_id, date);

alter table public.staff_attendance enable row level security;

create policy "staff_attendance_select_same_school" on public.staff_attendance
  for select using (school_id = public.current_school_id());

create policy "staff_attendance_insert_proprietor" on public.staff_attendance
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "staff_attendance_update_proprietor" on public.staff_attendance
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "staff_attendance_delete_proprietor" on public.staff_attendance
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
