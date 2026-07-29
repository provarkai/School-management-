import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { CALENDAR_EVENT_TYPE_LABELS, type CalendarEventType } from "@/lib/types";
import { CalendarEventForm } from "./CalendarEventForm";
import { DeleteCalendarEventButton } from "./DeleteCalendarEventButton";

const TYPE_STYLE: Record<CalendarEventType, string> = {
  term_start: "bg-emerald-100 text-emerald-800",
  term_end: "bg-zinc-100 text-zinc-700",
  holiday: "bg-sky-100 text-sky-800",
  exam: "bg-red-100 text-red-700",
  pta_meeting: "bg-amber-100 text-amber-800",
  event: "bg-violet-100 text-violet-800",
};

export default async function CalendarPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const { data: events } = await supabase
    .from("academic_calendar_events")
    .select("id, title, description, event_type, start_date, end_date")
    .eq("school_id", profile.school_id ?? "")
    .order("start_date");

  const upcoming = (events ?? []).filter((e) => (e.end_date ?? e.start_date) >= today);
  const past = (events ?? []).filter((e) => (e.end_date ?? e.start_date) < today).reverse();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Academic calendar</h1>
        <p className="text-sm text-zinc-500">
          Term dates, holidays, exams and meetings for the whole school.
        </p>
      </div>

      {profile.role === "proprietor" && <CalendarEventForm />}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Upcoming</h2>
        <EventList
          events={upcoming}
          emptyMessage="No upcoming events."
          canDelete={profile.role === "proprietor"}
        />
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Past</h2>
          <EventList events={past} emptyMessage="" canDelete={profile.role === "proprietor"} />
        </section>
      )}
    </div>
  );
}

function EventList({
  events,
  emptyMessage,
  canDelete,
}: {
  events: {
    id: string;
    title: string;
    description: string | null;
    event_type: CalendarEventType;
    start_date: string;
    end_date: string | null;
  }[];
  emptyMessage: string;
  canDelete: boolean;
}) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <ul className="divide-y divide-zinc-100">
        {events.map((event) => (
          <li key={event.id} className="flex items-start justify-between gap-3 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[event.event_type]}`}>
                  {CALENDAR_EVENT_TYPE_LABELS[event.event_type]}
                </span>
                <span className="text-xs text-zinc-400">
                  {event.start_date}
                  {event.end_date && event.end_date !== event.start_date ? ` – ${event.end_date}` : ""}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-zinc-900">{event.title}</p>
              {event.description && <p className="mt-1 text-xs text-zinc-500">{event.description}</p>}
            </div>
            {canDelete && <DeleteCalendarEventButton eventId={event.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
