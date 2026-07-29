-- Security hardening: constrain what can be uploaded to each Storage bucket
-- at the bucket level (Supabase enforces size/mime-type limits itself on
-- upload — no app code can be tricked into skipping this check).

update storage.buckets
set
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';

update storage.buckets
set
  file_size_limit = 15 * 1024 * 1024,
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where id = 'student-documents';
