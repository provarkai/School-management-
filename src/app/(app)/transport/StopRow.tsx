"use client";

import { deleteStop } from "./actions";

export function StopRow({
  stop,
  riders,
}: {
  stop: { id: string; name: string; pickup_time: string | null; drop_time: string | null };
  riders: number;
}) {
  return (
    <tr>
      <td className="px-3 py-2 font-medium text-zinc-900">{stop.name}</td>
      <td className="px-3 py-2 text-zinc-500">{stop.pickup_time ?? "—"}</td>
      <td className="px-3 py-2 text-zinc-500">{stop.drop_time ?? "—"}</td>
      <td className="px-3 py-2 text-zinc-500">{riders}</td>
      <td className="px-3 py-2 text-right">
        <form action={deleteStop.bind(null, stop.id)}>
          <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
            Remove
          </button>
        </form>
      </td>
    </tr>
  );
}
