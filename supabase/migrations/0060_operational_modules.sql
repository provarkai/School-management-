-- Phase 9 — Hostel and Transport, as ordinary per-school operational
-- features (mirrors campuses: same-school select, proprietor-only write).
-- Library was explicitly ruled out. Neither module introduces platform
-- billing — the proprietor charges parents for a hostel bed or a bus seat
-- the same way as any other fee, by creating a "Hostel Fee" / "Transport
-- Fee" fee_type in the existing fee system; no code change was needed for
-- that part.

create table if not exists public.hostels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  address text,
  warden_id uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists hostels_school_id_idx on public.hostels (school_id);
create index if not exists hostels_warden_id_idx on public.hostels (warden_id);

create table if not exists public.hostel_rooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  hostel_id uuid not null references public.hostels (id) on delete cascade,
  name text not null,
  capacity integer,
  created_at timestamptz not null default now(),
  unique (hostel_id, name)
);

create index if not exists hostel_rooms_school_id_idx on public.hostel_rooms (school_id);
create index if not exists hostel_rooms_hostel_id_idx on public.hostel_rooms (hostel_id);

create table if not exists public.bus_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  driver_name text,
  driver_phone text,
  vehicle_info text,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index if not exists bus_routes_school_id_idx on public.bus_routes (school_id);

create table if not exists public.bus_stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  route_id uuid not null references public.bus_routes (id) on delete cascade,
  name text not null,
  pickup_time text,
  drop_time text,
  created_at timestamptz not null default now(),
  unique (route_id, name)
);

create index if not exists bus_stops_school_id_idx on public.bus_stops (school_id);
create index if not exists bus_stops_route_id_idx on public.bus_stops (route_id);

alter table public.students add column if not exists hostel_room_id uuid references public.hostel_rooms (id) on delete set null;
alter table public.students add column if not exists bus_stop_id uuid references public.bus_stops (id) on delete set null;

create index if not exists students_hostel_room_id_idx on public.students (hostel_room_id);
create index if not exists students_bus_stop_id_idx on public.students (bus_stop_id);

alter table public.hostels enable row level security;
alter table public.hostel_rooms enable row level security;
alter table public.bus_routes enable row level security;
alter table public.bus_stops enable row level security;

-- ---------------------------------------------------------------------------
-- hostels
-- ---------------------------------------------------------------------------
create policy "hostels_select_same_school" on public.hostels
  for select using (school_id = public.current_school_id());

create policy "hostels_write_proprietor" on public.hostels
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "hostels_update_proprietor" on public.hostels
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "hostels_delete_proprietor" on public.hostels
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- hostel_rooms
-- ---------------------------------------------------------------------------
create policy "hostel_rooms_select_same_school" on public.hostel_rooms
  for select using (school_id = public.current_school_id());

create policy "hostel_rooms_write_proprietor" on public.hostel_rooms
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "hostel_rooms_update_proprietor" on public.hostel_rooms
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "hostel_rooms_delete_proprietor" on public.hostel_rooms
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- bus_routes
-- ---------------------------------------------------------------------------
create policy "bus_routes_select_same_school" on public.bus_routes
  for select using (school_id = public.current_school_id());

create policy "bus_routes_write_proprietor" on public.bus_routes
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "bus_routes_update_proprietor" on public.bus_routes
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "bus_routes_delete_proprietor" on public.bus_routes
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- bus_stops
-- ---------------------------------------------------------------------------
create policy "bus_stops_select_same_school" on public.bus_stops
  for select using (school_id = public.current_school_id());

create policy "bus_stops_write_proprietor" on public.bus_stops
  for insert with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "bus_stops_update_proprietor" on public.bus_stops
  for update using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "bus_stops_delete_proprietor" on public.bus_stops
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- ---------------------------------------------------------------------------
-- Linked-parent visibility — a parent needs to see which room/stop their own
-- child is assigned to, including the parent hostel/route the room/stop
-- belongs to. Mirrors class_has_linked_parent's pattern: a security-definer
-- helper that walks from the assignment down to students, so the policy on
-- hostel_rooms/hostels never has to query students directly (which would
-- recurse back into students' own policies).
-- ---------------------------------------------------------------------------
create or replace function public.hostel_room_has_linked_parent(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.hostel_room_id = target_room_id and public.is_linked_parent(s.id)
  );
$$;

create or replace function public.hostel_has_linked_parent(target_hostel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hostel_rooms hr
    join public.students s on s.hostel_room_id = hr.id
    where hr.hostel_id = target_hostel_id and public.is_linked_parent(s.id)
  );
$$;

create or replace function public.bus_stop_has_linked_parent(target_stop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.bus_stop_id = target_stop_id and public.is_linked_parent(s.id)
  );
$$;

create or replace function public.bus_route_has_linked_parent(target_route_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bus_stops bs
    join public.students s on s.bus_stop_id = bs.id
    where bs.route_id = target_route_id and public.is_linked_parent(s.id)
  );
$$;

create policy "hostels_select_linked_parent" on public.hostels
  for select using (public.hostel_has_linked_parent(id));

create policy "hostel_rooms_select_linked_parent" on public.hostel_rooms
  for select using (public.hostel_room_has_linked_parent(id));

create policy "bus_routes_select_linked_parent" on public.bus_routes
  for select using (public.bus_route_has_linked_parent(id));

create policy "bus_stops_select_linked_parent" on public.bus_stops
  for select using (public.bus_stop_has_linked_parent(id));
