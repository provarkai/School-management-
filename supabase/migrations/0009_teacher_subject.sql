-- Lets a teacher's primary subject be recorded and shown on the Staff page.
alter table public.app_users add column if not exists subject text;
