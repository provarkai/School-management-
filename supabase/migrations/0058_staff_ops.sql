-- Phase 7 — staff ops: leave management, lesson notes, message delivery
-- logs.

-- ---------------------------------------------------------------------------
-- Leave requests
-- ---------------------------------------------------------------------------
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  staff_id uuid not null references public.app_users (id) on delete cascade,
  leave_type text not null check (
    leave_type in ('annual', 'sick', 'maternity', 'paternity', 'compassionate', 'unpaid', 'other')
  ),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.app_users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint leave_requests_date_order check (end_date >= start_date)
);

create index if not exists leave_requests_school_id_idx on public.leave_requests (school_id);
create index if not exists leave_requests_staff_id_idx on public.leave_requests (staff_id);

alter table public.leave_requests enable row level security;

-- A staff member sees and files their own requests; a manager sees every
-- request in the school to review them.
create policy "leave_requests_select_scoped" on public.leave_requests
  for select using (
    school_id = public.current_school_id()
    and (staff_id = auth.uid() or public.current_role() = 'proprietor')
  );

create policy "leave_requests_insert_scoped" on public.leave_requests
  for insert with check (
    school_id = public.current_school_id()
    and (staff_id = auth.uid() or public.current_role() = 'proprietor')
  );

-- A manager may update a request to any state (that's what reviewing is).
-- A staff member updating their OWN request may only ever land it on
-- 'cancelled' — the with check is what actually stops a plain staff
-- account from calling the API directly and setting their own request to
-- 'approved', which a using-only policy would allow since Postgres RLS
-- doesn't otherwise care which columns changed.
create policy "leave_requests_update_scoped" on public.leave_requests
  for update using (
    school_id = public.current_school_id()
    and (staff_id = auth.uid() or public.current_role() = 'proprietor')
  )
  with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or (staff_id = auth.uid() and status = 'cancelled')
    )
  );

-- No delete policy: a leave record is a permanent HR trail once created —
-- cancel it via status, don't erase it.

-- ---------------------------------------------------------------------------
-- Lesson notes — a teacher's planning document for a class/subject/date,
-- submitted for the proprietor's review before the lesson is delivered.
-- Deliberately staff-only: unlike assignments/resources, there is no
-- linked-parent select policy.
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject text not null,
  topic text not null,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  lesson_date date not null default current_date,
  content text,
  file_path text,
  file_name text,
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'approved', 'needs_revision')
  ),
  submitted_at timestamptz,
  reviewed_by uuid references public.app_users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_notes_has_content check (content is not null or file_path is not null)
);

create index if not exists lesson_notes_school_id_idx on public.lesson_notes (school_id);
create index if not exists lesson_notes_class_id_idx on public.lesson_notes (class_id);
create index if not exists lesson_notes_status_idx on public.lesson_notes (school_id, status);

create trigger lesson_notes_set_updated_at
  before update on public.lesson_notes
  for each row execute function public.set_updated_at();

alter table public.lesson_notes enable row level security;

-- Scoped exactly like assignments/resources (0026/0044): the class's own
-- teacher, or the proprietor, sees and writes it. No parent visibility.
create policy "lesson_notes_select_scoped" on public.lesson_notes
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "lesson_notes_insert_scoped" on public.lesson_notes
  for insert with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

-- A teacher may freely edit their own note while it's draft/submitted, but
-- the with check stops them writing status = 'approved' (or
-- 'needs_revision') themselves — that would let a direct API call
-- self-certify a lesson note without the proprietor ever reviewing it,
-- which a using-only policy would not prevent.
create policy "lesson_notes_update_scoped" on public.lesson_notes
  for update using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  )
  with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or (
        class_id in (select id from public.classes where teacher_id = auth.uid())
        and status in ('draft', 'submitted')
      )
    )
  );

create policy "lesson_notes_delete_scoped" on public.lesson_notes
  for delete using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

insert into storage.buckets (id, name, public)
values ('lesson-notes', 'lesson-notes', false)
on conflict (id) do nothing;

-- Path scheme matches learning-resources: {school_id}/{class_id}/{filename}.
drop policy if exists "lesson_notes_storage_select" on storage.objects;
create policy "lesson_notes_storage_select" on storage.objects
  for select using (
    bucket_id = 'lesson-notes'
    and exists (
      select 1 from public.classes c
      where c.id = ((storage.foldername(name))[2])::uuid
        and c.school_id = public.current_school_id()
        and (public.current_role() = 'proprietor' or c.teacher_id = auth.uid())
    )
  );

drop policy if exists "lesson_notes_storage_insert" on storage.objects;
create policy "lesson_notes_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'lesson-notes'
    and exists (
      select 1 from public.classes c
      where c.id = ((storage.foldername(name))[2])::uuid
        and c.school_id = public.current_school_id()
        and (public.current_role() = 'proprietor' or c.teacher_id = auth.uid())
    )
  );

drop policy if exists "lesson_notes_storage_delete" on storage.objects;
create policy "lesson_notes_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'lesson-notes'
    and exists (
      select 1 from public.classes c
      where c.id = ((storage.foldername(name))[2])::uuid
        and c.school_id = public.current_school_id()
        and (public.current_role() = 'proprietor' or c.teacher_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Message delivery logs — every SMS/WhatsApp send attempt through
-- lib/termii.ts, across fee reminders (manual, bulk and the weekly cron),
-- staff notices and broadcasts. None of these were ever recorded per
-- recipient before now: a school could only see an aggregate "sent to N
-- recipients", with no way to tell which parent or staff member it was,
-- or which ones actually failed.
-- ---------------------------------------------------------------------------
create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  purpose text not null check (purpose in ('fee_reminder', 'staff_notice', 'broadcast')),
  recipient_phone text not null,
  recipient_name text,
  student_id uuid references public.students (id) on delete set null,
  staff_id uuid references public.app_users (id) on delete set null,
  message text not null,
  status text not null check (status in ('sent', 'failed', 'mocked')),
  error text,
  sent_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists message_logs_school_id_idx on public.message_logs (school_id, created_at desc);
create index if not exists message_logs_student_id_idx on public.message_logs (student_id);

alter table public.message_logs enable row level security;

-- Manager-only: this is a delivery audit trail, not staff- or
-- parent-facing content.
create policy "message_logs_select_manager" on public.message_logs
  for select using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "message_logs_insert_manager" on public.message_logs
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');
