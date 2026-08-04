-- New schools should not get the Facilities module (campuses/hostel/
-- transport) until a platform admin explicitly turns it on for them —
-- previously bootstrap_school() (0056) relied on the column default, which
-- was `true` (0069), so every new signup got Facilities on day one with no
-- platform-admin action at all. Flipping the default to `false` only
-- changes what *new* schools get; existing schools keep whatever value
-- they already have, so nobody currently using Facilities loses access.
alter table public.schools alter column facilities_enabled set default false;
