"use client";

import { deleteStudentDocument } from "../actions";

export function DeleteDocumentButton({
  studentId,
  documentId,
  filePath,
}: {
  studentId: string;
  documentId: string;
  filePath: string;
}) {
  return (
    <form action={deleteStudentDocument.bind(null, studentId, documentId, filePath)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Remove
      </button>
    </form>
  );
}
