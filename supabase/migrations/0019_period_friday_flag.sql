-- Some Nigerian schools close early on Fridays (Jumat prayers, etc), so a
-- period slot can be marked as not applying on Fridays even though it's
-- part of the normal Mon-Thu day.

alter table public.period_slots add column if not exists applies_on_friday boolean not null default true;
