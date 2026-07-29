-- Profile photos: every account can upload one (teachers, non-teaching
-- staff, parents) except the proprietor, per explicit product decision —
-- enforced both in the UI (no upload widget shown) and here at the RLS
-- level isn't practical to special-case by role for storage, so it's
-- enforced in the app_users update action instead.

alter table public.app_users add column if not exists photo_url text;
alter table public.parents add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar_public_read" on storage.objects;
create policy "avatar_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatar_upload_own" on storage.objects;
create policy "avatar_upload_own" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
