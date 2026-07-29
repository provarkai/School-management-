"use client";

import { useRouter } from "next/navigation";

export function ClassPicker({
  classes,
  current,
}: {
  classes: { id: string; name: string }[];
  current: string;
}) {
  const router = useRouter();

  return (
    <select
      aria-label="Choose class"
      value={current}
      onChange={(e) => router.push(`/timetable?class=${e.target.value}`)}
      className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
    >
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
