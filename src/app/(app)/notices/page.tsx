import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { NewNoticeForm } from "./NewNoticeForm";
import { DeleteNoticeButton } from "./DeleteNoticeButton";

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All staff",
  teachers: "Teachers",
  staff: "Non-teaching staff",
};

export default async function NoticesPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const relevantAudiences =
    profile.role === "proprietor"
      ? ["all", "teachers", "staff"]
      : profile.role === "teacher"
        ? ["all", "teachers"]
        : ["all", "staff"];

  const { data: notices } = await supabase
    .from("staff_notices")
    .select("id, title, body, audience, created_at")
    .in("audience", relevantAudiences)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Notices</h1>
        <p className="text-sm text-zinc-500">Announcements from the school office to staff.</p>
      </div>

      {profile.role === "proprietor" && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Post a notice</h2>
          <NewNoticeForm />
        </section>
      )}

      <div className="space-y-3">
        {(notices ?? []).map((n) => (
          <div key={n.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-zinc-900">{n.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{n.body}</p>
                <p className="mt-2 text-xs text-zinc-400">
                  {AUDIENCE_LABELS[n.audience] ?? n.audience} ·{" "}
                  {new Date(n.created_at).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              {profile.role === "proprietor" && <DeleteNoticeButton noticeId={n.id} />}
            </div>
          </div>
        ))}
        {(notices ?? []).length === 0 && (
          <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
            No notices yet.
          </p>
        )}
      </div>
    </div>
  );
}
