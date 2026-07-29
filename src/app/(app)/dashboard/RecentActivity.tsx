import { createClient } from "@/lib/supabase/server";
import { getRecentSchoolActivity } from "@/lib/activity";

export async function RecentActivity({ schoolId }: { schoolId: string }) {
  const supabase = await createClient();
  const events = await getRecentSchoolActivity(supabase, schoolId);

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Recent activity
      </h2>
      {events.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          Nothing recorded yet.
        </p>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <ul className="divide-y divide-zinc-100">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="text-zinc-900">{event.description}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {new Date(event.timestamp).toLocaleString("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
