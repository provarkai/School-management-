-- 0069 added schools.facilities_enabled and gated the Facilities pages/nav
-- at the app layer only — the underlying tables never learned about it, so
-- a school with Facilities disabled could still read or write campuses,
-- hostels, hostel_rooms, bus_routes and bus_stops by calling the Supabase
-- REST API directly with their own JWT, the same class of gap 0064 closed
-- for school suspension. Same fix, same pattern: a restrictive policy per
-- table, AND'd against whatever the existing permissive policies already
-- allow, gated on facilities_enabled instead of status. For every school
-- with the module on — the default — this changes nothing.
create or replace function public.school_facilities_enabled(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.schools
    where id = target_school_id and facilities_enabled = true
  );
$$;

drop policy if exists "campuses_facilities_enabled_only" on public.campuses;
create policy "campuses_facilities_enabled_only" on public.campuses
  as restrictive for all
  using (public.school_facilities_enabled(school_id));

drop policy if exists "hostels_facilities_enabled_only" on public.hostels;
create policy "hostels_facilities_enabled_only" on public.hostels
  as restrictive for all
  using (public.school_facilities_enabled(school_id));

drop policy if exists "hostel_rooms_facilities_enabled_only" on public.hostel_rooms;
create policy "hostel_rooms_facilities_enabled_only" on public.hostel_rooms
  as restrictive for all
  using (public.school_facilities_enabled(school_id));

drop policy if exists "bus_routes_facilities_enabled_only" on public.bus_routes;
create policy "bus_routes_facilities_enabled_only" on public.bus_routes
  as restrictive for all
  using (public.school_facilities_enabled(school_id));

drop policy if exists "bus_stops_facilities_enabled_only" on public.bus_stops;
create policy "bus_stops_facilities_enabled_only" on public.bus_stops
  as restrictive for all
  using (public.school_facilities_enabled(school_id));
