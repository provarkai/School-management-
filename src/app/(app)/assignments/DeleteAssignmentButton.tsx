"use client";

import { deleteAssignment } from "./actions";

export function DeleteAssignmentButton({ assignmentId }: { assignmentId: string }) {
  return (
    <form action={deleteAssignment.bind(null, assignmentId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Remove
      </button>
    </form>
  );
}
