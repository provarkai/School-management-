"use client";

import { updateStaffJobTitle } from "./actions";

export function StaffJobTitleInput({
  staffId,
  jobTitle,
}: {
  staffId: string;
  jobTitle: string | null;
}) {
  return (
    <form action={updateStaffJobTitle} className="flex items-center gap-1">
      <input type="hidden" name="staff_id" value={staffId} />
      <input
        name="job_title"
        defaultValue={jobTitle ?? ""}
        placeholder="Job title"
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-32 rounded-md border border-zinc-300 px-2 py-1 text-sm"
      />
    </form>
  );
}
