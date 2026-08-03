"use client";

import { cancelLeaveRequest } from "./actions";

export function CancelLeaveButton({ requestId }: { requestId: string }) {
  return (
    <form
      action={cancelLeaveRequest.bind(null, requestId)}
      onSubmit={(e) => {
        if (!confirm("Cancel this leave request?")) e.preventDefault();
      }}
    >
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Cancel
      </button>
    </form>
  );
}
