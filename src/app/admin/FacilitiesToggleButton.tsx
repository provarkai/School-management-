"use client";

import { setFacilitiesEnabled } from "./actions";

export function FacilitiesToggleButton({
  schoolId,
  enabled,
}: {
  schoolId: string;
  enabled: boolean;
}) {
  return (
    <form action={setFacilitiesEnabled.bind(null, schoolId, !enabled)}>
      <button
        type="submit"
        className={`rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm ${
          enabled
            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        }`}
      >
        {enabled ? "Disable" : "Enable"}
      </button>
    </form>
  );
}
