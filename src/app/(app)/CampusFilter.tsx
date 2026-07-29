"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function CampusFilter({
  campuses,
  current,
}: {
  campuses: { id: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(campusId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (campusId) {
      params.set("campus", campusId);
    } else {
      params.delete("campus");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <select
      aria-label="Filter by campus"
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
    >
      <option value="">All campuses</option>
      {campuses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
