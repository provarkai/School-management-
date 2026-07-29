-- Digital document management for student records: file uploads (birth
-- certificate, medical records, transfer letters, etc.) stored in a private
-- Storage bucket, path-scoped as {school_id}/{student_id}/{filename} and
-- RLS-gated by a reusable "can this user act on this student" helper —
-- proprietor sees every student, a teacher only their own class's.

create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.students s
    where s.id = target_student_id
      and s.school_id = public.current_school_id()
      and (
        public.current_role() = 'proprietor'
        or s.class_id in (select id from public.classes where teacher_id = auth.uid())
      )
  );
$$;

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  label text not null,
  file_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists student_documents_school_id_idx on public.student_documents (school_id);
create index if not exists student_documents_student_id_idx on public.student_documents (student_id);

alter table public.student_documents enable row level security;

create policy "student_documents_select_scoped" on public.student_documents
  for select using (public.can_access_student(student_id));

create policy "student_documents_write_scoped" on public.student_documents
  for insert with check (
    school_id = public.current_school_id() and public.can_access_student(student_id)
  );

create policy "student_documents_delete_proprietor" on public.student_documents
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', false)
on conflict (id) do nothing;

drop policy if exists "student_documents_storage_select" on storage.objects;
create policy "student_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'student-documents'
    and public.can_access_student(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "student_documents_storage_insert" on storage.objects;
create policy "student_documents_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'student-documents'
    and public.can_access_student(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "student_documents_storage_delete" on storage.objects;
create policy "student_documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'student-documents'
    and public.current_role() = 'proprietor'
  );
