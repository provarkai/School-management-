"use client";

import { deleteRoom } from "./actions";

export function RoomRow({
  room,
  occupied,
}: {
  room: { id: string; name: string; capacity: number | null };
  occupied: number;
}) {
  const full = room.capacity !== null && occupied >= room.capacity;

  return (
    <tr>
      <td className="px-3 py-2 font-medium text-zinc-900">{room.name}</td>
      <td className="px-3 py-2 text-zinc-500">
        {occupied}
        {room.capacity !== null ? ` / ${room.capacity}` : ""}
        {full && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Full
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <form action={deleteRoom.bind(null, room.id)}>
          <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
            Remove
          </button>
        </form>
      </td>
    </tr>
  );
}
