import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { BroadcastForm } from "./BroadcastForm";

export default async function BroadcastsPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const [{ data: classes }, { data: history }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("broadcasts")
      .select("id, message, audience, recipient_count, created_at, app_users(name)")
      .eq("school_id", profile.school_id ?? "")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Broadcasts</h1>
        <p className="text-sm text-zinc-500">
          One-off alerts beyond fee reminders — school closures, PTA meetings, events — to
          parents and/or staff at once.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <BroadcastForm classes={classes ?? []} />
      </section>

      {history && history.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Recent broadcasts
          </h2>
          <div className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            {history.map((b) => (
              <div key={b.id} className="p-4">
                <p className="text-sm text-zinc-900">{b.message}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {b.audience} · {b.recipient_count} recipient{b.recipient_count === 1 ? "" : "s"} ·{" "}
                  {new Date(b.created_at).toLocaleString()} ·{" "}
                  {(b.app_users as unknown as { name: string } | null)?.name ?? "—"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
