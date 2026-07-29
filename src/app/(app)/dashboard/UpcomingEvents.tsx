import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CALENDAR_EVENT_TYPE_LABELS, type CalendarEventType } from "@/lib/types";

export async function UpcomingEvents({ schoolId }: { schoolId: string }) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: events } = await supabase
    .from("academic_calendar_events")
    .select("id, title, event_type, start_date, end_date")
    .eq("school_id", schoolId)
    .gte("start_date", today)
    .order("start_date")
    .limit(5);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Upcoming events
        </h2>
        <Link href="/calendar" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
          View calendar →
        </Link>
      </div>
      {(events ?? []).length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No upcoming events.
        </p>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <ul className="divide-y divide-zinc-100">
            {(events ?? []).map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{event.title}</p>
                  <p className="text-xs text-zinc-400">
                    {CALENDAR_EVENT_TYPE_LABELS[event.event_type as CalendarEventType]}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-400">
                  {event.start_date}
                  {event.end_date && event.end_date !== event.start_date ? ` – ${event.end_date}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
