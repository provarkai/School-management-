"use client";

import { deleteSubject } from "./actions";

export function DeleteSubjectButton({ subjectId }: { subjectId: string }) {
  return (
    <form action={deleteSubject.bind(null, subjectId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Remove
      </button>
    </form>
  );
}
