-- Learning resource distribution: a teacher (or proprietor) shares study
-- materials against a class — either an uploaded file or an external link
-- (YouTube, Google Drive, etc). Visibility mirrors assignments exactly:
-- staff scoped to their own class (or the proprietor sees all), plus a
-- linked parent via the existing class_has_linked_parent() helper.

create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject text,
  title text not null,
  description text,
  file_path text,
  file_name text,
  external_url text,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint learning_resources_has_content check (file_path is not null or external_url is not null)
);

create index if not exists learning_resources_school_id_idx on public.learning_resources (school_id);
create index if not exists learning_resources_class_id_idx on public.learning_resources (class_id);

alter table public.learning_resources enable row level security;

create policy "learning_resources_select_scoped" on public.learning_resources
  for select using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "learning_resources_select_linked_parent" on public.learning_resources
  for select using (public.class_has_linked_parent(class_id));

create policy "learning_resources_write_scoped" on public.learning_resources
  for insert with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

create policy "learning_resources_delete_scoped" on public.learning_resources
  for delete using (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or class_id in (select id from public.classes where teacher_id = auth.uid())
    )
  );

insert into storage.buckets (id, name, public)
values ('learning-resources', 'learning-resources', false)
on conflict (id) do nothing;

-- Path scheme: {school_id}/{class_id}/{filename} — foldername()[2] is the
-- class_id, checked the same way the table's own RLS is.
drop policy if exists "learning_resources_storage_select" on storage.objects;
create policy "learning_resources_storage_select" on storage.objects
  for select using (
    bucket_id = 'learning-resources'
    and (
      exists (
        select 1 from public.classes c
        where c.id = ((storage.foldername(name))[2])::uuid
          and c.school_id = public.current_school_id()
          and (public.current_role() = 'proprietor' or c.teacher_id = auth.uid())
      )
      or public.class_has_linked_parent(((storage.foldername(name))[2])::uuid)
    )
  );

drop policy if exists "learning_resources_storage_insert" on storage.objects;
create policy "learning_resources_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'learning-resources'
    and exists (
      select 1 from public.classes c
      where c.id = ((storage.foldername(name))[2])::uuid
        and c.school_id = public.current_school_id()
        and (public.current_role() = 'proprietor' or c.teacher_id = auth.uid())
    )
  );

drop policy if exists "learning_resources_storage_delete" on storage.objects;
create policy "learning_resources_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'learning-resources'
    and exists (
      select 1 from public.classes c
      where c.id = ((storage.foldername(name))[2])::uuid
        and c.school_id = public.current_school_id()
        and (public.current_role() = 'proprietor' or c.teacher_id = auth.uid())
    )
  );
