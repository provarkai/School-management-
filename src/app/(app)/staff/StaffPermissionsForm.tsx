"use client";

import { useTransition } from "react";
import { setStaffPermission } from "./actions";
import { STAFF_PERMISSION_LABELS, type StaffPermission } from "@/lib/types";

const ALL_PERMISSIONS: StaffPermission[] = ["fees", "expenses", "admissions"];

export function StaffPermissionsForm({
  staffId,
  granted,
}: {
  staffId: string;
  granted: StaffPermission[];
}) {
  const [pending, startTransition] = useTransition();
  const grantedSet = new Set(granted);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-zinc-900">Module permissions</h2>
      <p className="mb-3 text-xs text-zinc-500">
        Let this staff member use one module without making them a full admin.
      </p>
      <div className="flex flex-wrap gap-4">
        {ALL_PERMISSIONS.map((permission) => (
          <label key={permission} className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              defaultChecked={grantedSet.has(permission)}
              disabled={pending}
              onChange={(e) => {
                const next = e.target.checked;
                startTransition(async () => {
                  await setStaffPermission(staffId, permission, next);
                });
              }}
              className="rounded border-zinc-300"
            />
            {STAFF_PERMISSION_LABELS[permission]}
          </label>
        ))}
      </div>
    </div>
  );
}
