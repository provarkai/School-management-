-- Lets a manager (proprietor or delegated admin) upload/replace their
-- school's logo into the existing "avatars" bucket, under a
-- school-logos/{school_id}/ prefix distinct from personal avatar paths
-- (which live at {user_id}/...). Reads are already public via the
-- existing avatar_public_read policy.

drop policy if exists "school_logo_insert" on storage.objects;
create policy "school_logo_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'school-logos'
    and (storage.foldername(name))[2] = public.current_school_id()::text
    and public.current_role() = 'proprietor'
  );

drop policy if exists "school_logo_update" on storage.objects;
create policy "school_logo_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'school-logos'
    and (storage.foldername(name))[2] = public.current_school_id()::text
    and public.current_role() = 'proprietor'
  );
