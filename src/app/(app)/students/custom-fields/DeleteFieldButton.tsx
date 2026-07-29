"use client";

import { deleteFieldDefinition } from "./actions";

export function DeleteFieldButton({ fieldId }: { fieldId: string }) {
  return (
    <form action={deleteFieldDefinition.bind(null, fieldId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Remove
      </button>
    </form>
  );
}
