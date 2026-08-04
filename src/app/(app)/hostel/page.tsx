import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { FacilitiesDisabledNotice } from "../FacilitiesDisabledNotice";
import { NewHostelForm } from "./NewHostelForm";
import { HostelCard } from "./HostelCard";

export default async function HostelPage() {
  const { profile, school } = await requireProprietor();
  if (!school?.facilities_enabled) return <FacilitiesDisabledNotice />;
  const supabase = await createClient();

  const [{ data: hostels }, { data: rooms }, { data: staff }, { data: students }] =
    await Promise.all([
      supabase
        .from("hostels")
        .select("id, name, address, warden_id")
        .eq("school_id", profile.school_id ?? "")
        .order("name"),
      supabase
        .from("hostel_rooms")
        .select("id, hostel_id, name, capacity")
        .eq("school_id", profile.school_id ?? "")
        .order("name"),
      supabase
        .from("app_users")
        .select("id, name")
        .eq("school_id", profile.school_id ?? "")
        .order("name"),
      supabase
        .from("students")
        .select("hostel_room_id")
        .eq("school_id", profile.school_id ?? "")
        .eq("status", "active")
        .not("hostel_room_id", "is", null),
    ]);

  const roomsByHostel = new Map<string, { id: string; name: string; capacity: number | null }[]>();
  for (const room of rooms ?? []) {
    const list = roomsByHostel.get(room.hostel_id) ?? [];
    list.push(room);
    roomsByHostel.set(room.hostel_id, list);
  }

  const occupiedByRoom = new Map<string, number>();
  for (const s of students ?? []) {
    if (!s.hostel_room_id) continue;
    occupiedByRoom.set(s.hostel_room_id, (occupiedByRoom.get(s.hostel_room_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Hostel</h1>
        <p className="text-sm text-zinc-500">
          Manage hostels and rooms, assign a warden to each, and see room occupancy. Assign a
          student to a room from their student record page. To charge for a bed, create a
          &ldquo;Hostel Fee&rdquo; fee type in Fees.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <NewHostelForm />
      </section>

      <div className="space-y-4">
        {(hostels ?? []).map((hostel) => (
          <HostelCard
            key={hostel.id}
            hostel={hostel}
            staff={staff ?? []}
            rooms={roomsByHostel.get(hostel.id) ?? []}
            occupiedByRoom={occupiedByRoom}
          />
        ))}
        {(hostels ?? []).length === 0 && (
          <p className="rounded-lg border border-zinc-200 bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
            No hostels yet — add your first one above.
          </p>
        )}
      </div>
    </div>
  );
}
