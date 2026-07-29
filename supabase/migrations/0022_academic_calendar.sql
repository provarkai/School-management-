-- Academic calendar: school-wide events (term dates, holidays, exams, PTA
-- meetings) visible to every signed-in staff member and to linked parents,
-- managed by the proprietor only.

create table if not exists public.academic_calendar_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  description text,
  event_type text not null default 'event'
    check (event_type in ('term_start', 'term_end', 'holiday', 'exam', 'pta_meeting', 'event')),
  start_date date not null,
  end_date date,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists academic_calendar_events_school_id_idx on public.academic_calendar_events (school_id);
create index if not exists academic_calendar_events_start_date_idx on public.academic_calendar_events (start_date);

alter table public.academic_calendar_events enable row level security;

create policy "academic_calendar_events_select_same_school" on public.academic_calendar_events
  for select using (school_id = public.current_school_id());

create policy "academic_calendar_events_select_linked_parent" on public.academic_calendar_events
  for select using (public.school_has_linked_parent(school_id));

create policy "academic_calendar_events_write_proprietor" on public.academic_calendar_events
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "academic_calendar_events_update_proprietor" on public.academic_calendar_events
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "academic_calendar_events_delete_proprietor" on public.academic_calendar_events
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
