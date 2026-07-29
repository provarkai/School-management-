-- Assignment / homework management: teachers (and the proprietor) post
-- assignments against a class; visible to staff scoped the same way as
-- attendance/results, and to a linked parent via the existing
-- class_has_linked_parent() helper from migration 0014.

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject text,
  title text not null,
  description text,
  due_date date not null,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists assignments_school_id_idx on public.assignments (school_id);
create index if not exists assignments_class_id_idx on public.assignments (class_id);
create index if not exists assignments_due_date_idx on public.assignments (due_date);

alter table public.assignments enable row level security;

create policy "assignments_select_scoped" on public.assignments
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "assignments_select_linked_parent" on public.assignments
  for select using (public.class_has_linked_parent(class_id));

create policy "assignments_write_scoped" on public.assignments
  for insert with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "assignments_update_scoped" on public.assignments
  for update using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "assignments_delete_scoped" on public.assignments
  for delete using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );
