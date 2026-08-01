-- Admissions pipeline: track prospective students (inquiry -> entrance
-- test -> offer/waitlist -> enrolled) before they become a real student
-- record. Tagged with `session` like fees/results/expenses so the pipeline
-- naturally resets each admissions cycle while old cycles stay visible.
-- Treated like fees/expenses (current_role(), not is_owner()) — a
-- delegated school admin can run admissions too.

create table if not exists public.admission_prospects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  campus_id uuid references public.campuses (id) on delete set null,
  session text not null,
  full_name text not null,
  date_of_birth date,
  desired_class text,
  parent_name text,
  parent_phone text,
  parent_email text,
  status text not null default 'inquiry' check (
    status in ('inquiry', 'contacted', 'test_scheduled', 'tested', 'offered', 'waitlisted', 'enrolled', 'rejected', 'withdrawn')
  ),
  entrance_test_score numeric(5, 2),
  notes text,
  converted_student_id uuid references public.students (id) on delete set null,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admission_prospects_school_id_idx on public.admission_prospects (school_id);
create index if not exists admission_prospects_session_idx on public.admission_prospects (school_id, session);
create index if not exists admission_prospects_status_idx on public.admission_prospects (school_id, status);

alter table public.admission_prospects enable row level security;

create policy "admission_prospects_select_same_school" on public.admission_prospects
  for select using (school_id = public.current_school_id());

create policy "admission_prospects_insert_proprietor" on public.admission_prospects
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "admission_prospects_update_proprietor" on public.admission_prospects
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "admission_prospects_delete_proprietor" on public.admission_prospects
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
