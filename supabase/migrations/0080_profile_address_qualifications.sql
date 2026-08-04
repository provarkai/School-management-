-- Staff profile gained "Address" and "Qualifications" fields, and the
-- parent profile gained "Address" — none of these existed on either table
-- before.
alter table public.app_users add column if not exists address text;
alter table public.app_users add column if not exists qualifications text;
alter table public.parents add column if not exists address text;
