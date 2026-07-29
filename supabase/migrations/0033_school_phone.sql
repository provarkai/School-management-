-- A school-wide contact phone number (distinct from any individual staff
-- member's personal phone), editable in Settings and shown to parents on
-- their dashboard so they have a number to call the school office.

alter table public.schools add column if not exists phone text;
