-- Lets a platform admin turn the Facilities module (campuses, hostel,
-- transport) on or off per school — e.g. a plan/tier lever, or to hide it
-- for a school that doesn't board or bus students and would otherwise just
-- see empty pages. Defaults to true so every existing school keeps exactly
-- the access it already has.
alter table public.schools add column if not exists facilities_enabled boolean not null default true;
