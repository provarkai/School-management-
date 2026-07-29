"use client";

import { useTransition } from "react";
import { setSchoolAdmin } from "./actions";

export function SchoolAdminToggle({
  staffId,
  isAdmin,
}: {
  staffId: string;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
      <input
        type="checkbox"
        defaultChecked={isAdmin}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            await setSchoolAdmin(staffId, next);
          });
        }}
        className="rounded border-zinc-300"
      />
      Admin
    </label>
  );
}
