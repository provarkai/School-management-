-- Student profile photos. Unlike staff/parent photos (self-service, keyed
-- by the account's own auth.uid()), students have no login of their own —
-- a proprietor/admin uploads on their behalf — so this needs its own
-- storage path scheme (avatars/students/{student_id}/...) and policies
-- scoped by school + current_role() rather than auth.uid().

alter table public.students add column if not exists photo_url text;

create policy "avatar_upload_student" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'students'
    and public.current_role() = 'proprietor'
    and exists (
      select 1 from public.students s
      where s.id = ((storage.foldername(name))[2])::uuid
        and s.school_id = public.current_school_id()
    )
  );

create policy "avatar_update_student" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'students'
    and public.current_role() = 'proprietor'
    and exists (
      select 1 from public.students s
      where s.id = ((storage.foldername(name))[2])::uuid
        and s.school_id = public.current_school_id()
    )
  );

create policy "avatar_delete_student" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'students'
    and public.current_role() = 'proprietor'
    and exists (
      select 1 from public.students s
      where s.id = ((storage.foldername(name))[2])::uuid
        and s.school_id = public.current_school_id()
    )
  );
