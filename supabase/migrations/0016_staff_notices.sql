-- Staff notices: proprietor posts an announcement visible to all staff (or
-- a subset), separate from parent-facing reminders.

create table if not exists public.staff_notices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'teachers', 'staff')),
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists staff_notices_school_id_idx on public.staff_notices (school_id);

alter table public.staff_notices enable row level security;

create policy "staff_notices_select_same_school" on public.staff_notices
  for select using (school_id = public.current_school_id());

create policy "staff_notices_write_proprietor" on public.staff_notices
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "staff_notices_delete_proprietor" on public.staff_notices
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
