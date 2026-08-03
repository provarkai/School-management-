"use client";

import { updateHostelWarden } from "./actions";

export function HostelWardenSelect({
  hostelId,
  wardenId,
  staff,
}: {
  hostelId: string;
  wardenId: string | null;
  staff: { id: string; name: string }[];
}) {
  return (
    <form
      action={updateHostelWarden}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <input type="hidden" name="hostel_id" value={hostelId} />
      <select
        name="warden_id"
        defaultValue={wardenId ?? ""}
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
      >
        <option value="">No warden assigned</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </form>
  );
}
