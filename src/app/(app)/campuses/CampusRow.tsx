"use client";

import { useState } from "react";
import { renameCampus, deleteCampus } from "./actions";

export function CampusRow({
  campus,
  classCount,
  staffCount,
}: {
  campus: { id: string; name: string; address: string | null };
  classCount: number;
  staffCount: number;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={4} className="px-4 py-3">
          <form
            action={async (formData) => {
              await renameCampus(formData);
              setEditing(false);
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="campus_id" value={campus.id} />
            <label className="text-xs font-medium text-zinc-700">
              Name
              <input
                name="name"
                defaultValue={campus.name}
                required
                className="mt-1 block rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </label>
            <label className="text-xs font-medium text-zinc-700">
              Address
              <input
                name="address"
                defaultValue={campus.address ?? ""}
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
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-2 font-medium text-zinc-900">{campus.name}</td>
      <td className="px-4 py-2 text-zinc-500">{campus.address ?? "—"}</td>
      <td className="px-4 py-2 text-zinc-500">
        {classCount} class{classCount === 1 ? "" : "es"} · {staffCount} staff
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            Edit
          </button>
          <form action={deleteCampus.bind(null, campus.id)}>
            <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
              Remove
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
