-- Broadcast alerts: one-off messages beyond fee reminders — "school closed
-- today", "PTA meeting Saturday" — sent to parents (all or one class) and/or
-- staff at once. Staff also get it posted into staff_notices so it shows
-- in-app, not just by SMS. This table is just a sent-history log; the
-- actual send happens via the existing Termii wrapper, same as fee
-- reminders.

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  message text not null,
  audience text not null,
  recipient_count integer not null default 0,
  sent_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists broadcasts_school_id_idx on public.broadcasts (school_id);

alter table public.broadcasts enable row level security;

create policy "broadcasts_select_same_school" on public.broadcasts
  for select using (school_id = public.current_school_id());

create policy "broadcasts_insert_proprietor" on public.broadcasts
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "broadcasts_delete_proprietor" on public.broadcasts
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');
