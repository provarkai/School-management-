"use client";

import { deleteCalendarEvent } from "./actions";

export function DeleteCalendarEventButton({ eventId }: { eventId: string }) {
  return (
    <form action={deleteCalendarEvent.bind(null, eventId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Remove
      </button>
    </form>
  );
}
