"use client";

import { updateClassCampus } from "./actions";

export function ClassCampusSelect({
  classId,
  campusId,
  campuses,
}: {
  classId: string;
  campusId: string | null;
  campuses: { id: string; name: string }[];
}) {
  return (
    <form
      action={updateClassCampus}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <input type="hidden" name="class_id" value={classId} />
      <select
        name="campus_id"
        defaultValue={campusId ?? ""}
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
      >
        <option value="">Unassigned</option>
        {campuses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}
