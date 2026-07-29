-- Non-teaching staff accounts: a school employs more than just teachers
-- (bursar, front desk, security, cleaners, etc). Add a generic 'staff' role
-- (no class/subject responsibilities, same restricted data access as
-- teachers otherwise get by having no class) plus a free-text job title for
-- display, mirroring how teachers already have a free-text `subject`.

alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users
  add constraint app_users_role_check check (role in ('proprietor', 'teacher', 'staff'));

alter table public.app_users add column if not exists job_title text;
