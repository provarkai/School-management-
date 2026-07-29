"use client";

import { useActionState } from "react";
import { createCalendarEvent, type CalendarEventFormState } from "./actions";

const initialState: CalendarEventFormState = {};

export function CalendarEventForm() {
  const [state, formAction, pending] = useActionState(createCalendarEvent, initialState);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        {state.error && (
          <p className="mb-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        {state.success && (
          <p className="mb-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        )}
      </div>
      <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
        Title
        <input
          name="title"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Type
        <select
          name="event_type"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="event">Event</option>
          <option value="term_start">Term start</option>
          <option value="term_end">Term end</option>
          <option value="holiday">Holiday</option>
          <option value="exam">Exam</option>
          <option value="pta_meeting">PTA meeting</option>
        </select>
      </label>
      <span />
      <label className="text-sm font-medium text-zinc-700">
        Start date
        <input
          name="start_date"
          type="date"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        End date (optional)
        <input
          name="end_date"
          type="date"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
        Description (optional)
        <textarea
          name="description"
          rows={2}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit"
      >
        {pending ? "Adding…" : "Add event"}
      </button>
    </form>
  );
}
