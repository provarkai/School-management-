import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { PromotionForm, type PromotionClass } from "./PromotionForm";

function suggestNextSession(current: string): string {
  const match = current.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return "";
  const start = Number(match[1]) + 1;
  const end = Number(match[2]) + 1;
  return `${start}/${end}`;
}

export default async function PromotionPage() {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: students } = await supabase
    .from("students")
    .select("id, class_id")
    .eq("school_id", profile.school_id ?? "")
    .eq("status", "active");

  const countByClass = new Map<string, number>();
  let unassignedCount = 0;
  for (const s of students ?? []) {
    if (!s.class_id) {
      unassignedCount++;
      continue;
    }
    countByClass.set(s.class_id, (countByClass.get(s.class_id) ?? 0) + 1);
  }

  // Derived from where active students actually sit, not a session/term
  // filter on classes — classes aren't reliably recreated every term, so a
  // student left behind in an older-term class row would otherwise be
  // silently excluded from promotion.
  const classIds = Array.from(countByClass.keys());
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", profile.school_id ?? "")
    .in("id", classIds.length > 0 ? classIds : [""])
    .order("name");

  const promotionClasses: PromotionClass[] = (classes ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    studentCount: countByClass.get(c.id) ?? 0,
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Session Promotion</h1>
        <p className="text-sm text-zinc-500">
          Currently {session} · Term {term}. At year-end, bulk-move every class into the new
          session in one step instead of re-registering each student.
        </p>
      </div>

      {unassignedCount > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {unassignedCount} active student{unassignedCount === 1 ? " has" : "s have"} no class
          assigned and won&rsquo;t be promoted — assign them a class first if they should move up.
        </p>
      )}

      {promotionClasses.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No active students are assigned to a class yet.
        </p>
      ) : (
        <PromotionForm classes={promotionClasses} suggestedSession={suggestNextSession(session)} />
      )}
    </div>
  );
}
