"use client";

import { deleteResource } from "./actions";

export function DeleteResourceButton({
  resourceId,
  filePath,
}: {
  resourceId: string;
  filePath: string | null;
}) {
  return (
    <form action={deleteResource.bind(null, resourceId, filePath)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Delete
      </button>
    </form>
  );
}
