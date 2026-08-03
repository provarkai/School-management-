-- School-level audit log — a plain, readable record of who did which
-- sensitive action and when, for accountability and disputes ("who
-- recorded this payment", "who approved this leave", "who withdrew this
-- student"). Deliberately not a generic per-column trigger-based diff
-- log: that produces raw before/after JSON a non-technical proprietor
-- can't read. Instead, each sensitive server action writes one
-- human-readable sentence via logActivity() (src/lib/activityLog.ts), the
-- same "explicit call at the one choke point" pattern already used for
-- message_logs (src/lib/messageLog.ts).
--
-- actor_name/actor_role are snapshotted at write time, not joined live
-- from app_users, so a log entry still reads sensibly after the staff
-- member who did it is renamed or removed.

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null,
  actor_role text not null,
  action text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_school_id_created_at_idx
  on public.activity_logs (school_id, created_at desc);

alter table public.activity_logs enable row level security;

-- Visible to the proprietor (or a delegated admin — current_role() already
-- treats one as the other) only. A regular teacher/staff member sees their
-- own actions reflected elsewhere (e.g. their own leave history); the
-- consolidated log is a management view.
create policy "activity_logs_select_proprietor" on public.activity_logs
  for select using (
    school_id = public.current_school_id() and public.current_role() = 'proprietor'
  );

-- Insert is self-attested: any signed-in staff member can write a log row
-- for their own school, but only naming themselves as the actor. This is
-- an audit trail of real actions taken through the app's own server
-- actions, not a security boundary in itself — the same person could
-- already perform the action being logged.
create policy "activity_logs_insert_self" on public.activity_logs
  for insert with check (school_id = public.current_school_id() and actor_id = auth.uid());
