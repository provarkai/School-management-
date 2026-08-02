-- Dynamic curriculum/syllabus management: a school-wide, ordered list of
-- topics per subject+term (the actual curriculum plan — proprietor-defined,
-- same tier as the subjects list itself), separate from per-class progress
-- against it (which class teacher marks off as they actually teach it,
-- same access model as attendance/results/assignments).

create table if not exists public.syllabus_topics (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  subject text not null,
  session text not null,
  term text not null check (term in ('1', '2', '3')),
  position integer not null default 0,
  title text not null,
  description text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists syllabus_topics_school_id_idx on public.syllabus_topics (school_id);
create index if not exists syllabus_topics_subject_idx on public.syllabus_topics (school_id, subject, session, term);

alter table public.syllabus_topics enable row level security;

create policy "syllabus_topics_select_same_school" on public.syllabus_topics
  for select using (school_id = public.current_school_id());

create policy "syllabus_topics_write_proprietor" on public.syllabus_topics
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "syllabus_topics_update_proprietor" on public.syllabus_topics
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "syllabus_topics_delete_proprietor" on public.syllabus_topics
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create table if not exists public.class_topic_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  topic_id uuid not null references public.syllabus_topics (id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  updated_by uuid references public.app_users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (class_id, topic_id)
);

create index if not exists class_topic_progress_class_id_idx on public.class_topic_progress (class_id);
create index if not exists class_topic_progress_topic_id_idx on public.class_topic_progress (topic_id);

alter table public.class_topic_progress enable row level security;

create policy "class_topic_progress_select_linked_parent" on public.class_topic_progress
  for select using (public.class_has_linked_parent(class_id));

create policy "class_topic_progress_all_scoped" on public.class_topic_progress
  for all using (
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
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );
