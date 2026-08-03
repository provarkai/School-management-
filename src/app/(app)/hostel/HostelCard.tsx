"use client";

import { useState } from "react";
import { renameHostel, deleteHostel } from "./actions";
import { HostelWardenSelect } from "./HostelWardenSelect";
import { NewRoomForm } from "./NewRoomForm";
import { RoomRow } from "./RoomRow";

export function HostelCard({
  hostel,
  staff,
  rooms,
  occupiedByRoom,
}: {
  hostel: { id: string; name: string; address: string | null; warden_id: string | null };
  staff: { id: string; name: string }[];
  rooms: { id: string; name: string; capacity: number | null }[];
  occupiedByRoom: Map<string, number>;
}) {
  const [editing, setEditing] = useState(false);

  const totalOccupied = rooms.reduce((sum, r) => sum + (occupiedByRoom.get(r.id) ?? 0), 0);

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      {editing ? (
        <form
          action={async (formData) => {
            await renameHostel(formData);
            setEditing(false);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="hostel_id" value={hostel.id} />
          <label className="text-xs font-medium text-zinc-700">
            Name
            <input
              name="name"
              defaultValue={hostel.name}
              required
              className="mt-1 block rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </label>
          <label className="text-xs font-medium text-zinc-700">
            Address
            <input
              name="address"
              defaultValue={hostel.address ?? ""}
              className="mt-1 block rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">{hostel.name}</h2>
            <p className="text-xs text-zinc-500">{hostel.address ?? "No address set"}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {rooms.length} room{rooms.length === 1 ? "" : "s"} · {totalOccupied} student
              {totalOccupied === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">Warden</p>
              <HostelWardenSelect hostelId={hostel.id} wardenId={hostel.warden_id} staff={staff} />
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              Edit
            </button>
            <form action={deleteHostel.bind(null, hostel.id)}>
              <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
                Remove
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-zinc-100">
        <table className="min-w-full divide-y divide-zinc-100 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-500">Room</th>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-500">Occupancy</th>
              <th className="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {rooms.map((room) => (
              <RoomRow key={room.id} room={room} occupied={occupiedByRoom.get(room.id) ?? 0} />
            ))}
            {rooms.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-3 text-center text-zinc-400">
                  No rooms yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NewRoomForm hostelId={hostel.id} />
    </section>
  );
}
