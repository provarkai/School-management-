-- Phase 8 — two-way parent comms, in-app.
--
-- Deliberately not SMS/WhatsApp replies: the school's outbound messages
-- already go out over Termii, but reading a reply back in requires an
-- inbound number and webhook wiring with its own ongoing cost, and the
-- "WhatsApp" sending today is actually plain SMS underneath. An in-app
-- inbox needs none of that — a parent already has a portal account, and
-- this reuses it. The trade-off, made deliberately: it only reaches a
-- parent who signs into the portal, not one who only ever reads the SMS
-- reminders.
--
-- A parent starts a conversation about one of their children, addressed
-- either to "the school office" (any manager) or to that child's current
-- class teacher. Staff reply from a school-wide inbox. Threads are
-- parent-initiated only in this first cut — staff reply, they don't cold-
-- start a new thread to a parent.

-- Staff could not read the parents table at all before now (its only
-- policy is "a parent sees their own row"), so there was no way to show
-- who sent a message. This mirrors how students.parent_name/parent_phone
-- are already plain columns any staff member at the school can read —
-- exposing the linked parent account's own name to the same audience adds
-- nothing beyond what's already visible.
create policy "parents_select_staff" on public.parents
  for select using (
    exists (
      select 1 from public.parent_students ps
      join public.students s on s.id = ps.student_id
      where ps.parent_id = parents.id and s.school_id = public.current_school_id()
    )
  );

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  parent_id uuid not null references public.parents (id) on delete cascade,
  recipient_kind text not null check (recipient_kind in ('office', 'teacher')),
  -- Snapshot of who "teacher" resolved to when the thread was opened, not
  -- a live lookup — if the class teacher changes later, an in-flight
  -- conversation doesn't silently jump to someone who was never part of
  -- it. The proprietor can always see it regardless (see the select
  -- policy), so nothing is stranded if the teacher_id becomes stale.
  teacher_id uuid references public.app_users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  parent_last_read_at timestamptz,
  staff_last_read_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint message_threads_teacher_matches_kind check (
    (recipient_kind = 'office' and teacher_id is null)
    or (recipient_kind = 'teacher' and teacher_id is not null)
  )
);

create index if not exists message_threads_school_id_idx on public.message_threads (school_id, last_message_at desc);
create index if not exists message_threads_parent_id_idx on public.message_threads (parent_id, last_message_at desc);
create index if not exists message_threads_teacher_id_idx on public.message_threads (teacher_id);

-- Enforces "at most one open thread per child+recipient" at the database
-- level, rather than trusting the reuse-lookup in the app (select an open
-- thread, else create one) to never race — two rapid sends from the same
-- parent could otherwise both miss each other's insert and end up with two
-- open threads for the same conversation.
create unique index if not exists message_threads_one_open_per_recipient
  on public.message_threads (parent_id, student_id, recipient_kind)
  where status = 'open';

create table if not exists public.message_thread_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads (id) on delete cascade,
  sender_kind text not null check (sender_kind in ('parent', 'staff')),
  sender_parent_id uuid references public.parents (id) on delete set null,
  sender_staff_id uuid references public.app_users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint message_thread_posts_sender_matches_kind check (
    (sender_kind = 'parent' and sender_parent_id is not null and sender_staff_id is null)
    or (sender_kind = 'staff' and sender_staff_id is not null and sender_parent_id is null)
  )
);

create index if not exists message_thread_posts_thread_id_idx
  on public.message_thread_posts (thread_id, created_at);

alter table public.message_threads enable row level security;
alter table public.message_thread_posts enable row level security;

-- select: a parent sees their own threads; staff sees office threads (any
-- manager) or ones addressed to them specifically as the class teacher.
create policy "message_threads_select_parent" on public.message_threads
  for select using (parent_id = auth.uid());

create policy "message_threads_select_staff" on public.message_threads
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or (recipient_kind = 'teacher' and teacher_id = auth.uid())
    )
  );

-- insert: parent-initiated only. The teacher_id (when addressed to a
-- teacher) must actually be the student's current class teacher — without
-- this, a parent could point a thread at an arbitrary staff id and have it
-- land in that person's inbox regardless of any real connection to the
-- child.
create policy "message_threads_insert_parent" on public.message_threads
  for insert with check (
    parent_id = auth.uid()
    and public.is_linked_parent(student_id)
    and school_id = (select s.school_id from public.students s where s.id = student_id)
    and (
      (recipient_kind = 'office' and teacher_id is null)
      or (
        recipient_kind = 'teacher'
        and teacher_id is not null
        and teacher_id = (
          select c.teacher_id
          from public.classes c
          join public.students s on s.class_id = c.id
          where s.id = student_id
        )
      )
    )
  );

-- update: staff only (status, staff_last_read_at) — broad, since staff is
-- the trusted side of this relationship here. A parent's read-tracking
-- goes through mark_thread_read_parent() below instead of a direct UPDATE
-- grant, which sidesteps having to restrict column-by-column what a parent
-- may change on a thread they don't otherwise need write access to.
create policy "message_threads_update_staff" on public.message_threads
  for update using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or (recipient_kind = 'teacher' and teacher_id = auth.uid())
    )
  );

create or replace function public.mark_thread_read_parent(target_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.message_threads
  set parent_last_read_at = now()
  where id = target_thread_id and parent_id = auth.uid();
end;
$$;

grant execute on function public.mark_thread_read_parent(uuid) to authenticated;

-- Posts: visible/postable exactly where the parent thread itself is
-- visible — reusing the same two conditions rather than re-deriving them,
-- so a change to who can see a thread can't drift out of sync with who
-- can see its messages.
create policy "message_thread_posts_select" on public.message_thread_posts
  for select using (
    exists (
      select 1 from public.message_threads t
      where t.id = message_thread_posts.thread_id
        and (
          t.parent_id = auth.uid()
          or (
            t.school_id = public.current_school_id()
            and (
              public.current_role() = 'proprietor'
              or (t.recipient_kind = 'teacher' and t.teacher_id = auth.uid())
            )
          )
        )
    )
  );

create policy "message_thread_posts_insert_parent" on public.message_thread_posts
  for insert with check (
    sender_kind = 'parent'
    and sender_parent_id = auth.uid()
    and exists (select 1 from public.message_threads t where t.id = thread_id and t.parent_id = auth.uid())
  );

create policy "message_thread_posts_insert_staff" on public.message_thread_posts
  for insert with check (
    sender_kind = 'staff'
    and sender_staff_id = auth.uid()
    and exists (
      select 1 from public.message_threads t
      where t.id = thread_id
        and t.school_id = public.current_school_id()
        and (
          public.current_role() = 'proprietor'
          or (t.recipient_kind = 'teacher' and t.teacher_id = auth.uid())
        )
    )
  );

-- A new post bumps the thread so it sorts to the top and shows as unread,
-- and a parent's reply reopens a closed thread — run as security definer
-- because the inserting party (very often the parent, who holds no direct
-- UPDATE grant on message_threads at all) needs this side effect to apply
-- regardless of their own write access to the thread row.
create or replace function public.bump_thread_on_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.message_threads
  set
    last_message_at = new.created_at,
    status = case when new.sender_kind = 'parent' then 'open' else status end
  where id = new.thread_id;
  return new;
end;
$$;

create trigger message_thread_posts_bump
  after insert on public.message_thread_posts
  for each row execute function public.bump_thread_on_new_post();
