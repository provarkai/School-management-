"use client";

import { setSchoolStatus } from "./actions";
import type { SchoolStatus } from "@/lib/types";

export function SchoolStatusButton({ schoolId, status }: { schoolId: string; status: SchoolStatus }) {
  const next: SchoolStatus = status === "active" ? "suspended" : "active";

  return (
    <form action={setSchoolStatus.bind(null, schoolId, next)}>
      <button
        type="submit"
        className={`rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm ${
          status === "active"
            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        }`}
      >
        {status === "active" ? "Suspend" : "Reactivate"}
      </button>
    </form>
  );
}
