import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { assessStudentsForPromotion, type PromotionCriteria } from "@/lib/promotionCriteria";
import { PromotionForm, type PromotionClass } from "./PromotionForm";
import { PromotionCriteriaForm } from "./PromotionCriteriaForm";

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

  const criteria: PromotionCriteria = {
    minAverage: Number(school?.promotion_min_average ?? 40),
    subjectPassMark: Number(school?.promotion_subject_pass_mark ?? 40),
    maxFailedSubjects: Number(school?.promotion_max_failed_subjects ?? 3),
  };

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, class_id")
    .eq("school_id", profile.school_id ?? "")
    .eq("status", "active")
    .order("full_name");

  const byClass = new Map<string, { id: string; full_name: string }[]>();
  let unassignedCount = 0;
  for (const s of students ?? []) {
    if (!s.class_id) {
      unassignedCount++;
      continue;
    }
    const bucket = byClass.get(s.class_id) ?? [];
    bucket.push({ id: s.id, full_name: s.full_name });
    byClass.set(s.class_id, bucket);
  }

  // Derived from where active students actually sit, not a session/term
  // filter on classes — classes aren't reliably recreated every term, so a
  // student left behind in an older-term class row would otherwise be
  // silently excluded from promotion.
  const classIds = Array.from(byClass.keys());
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", profile.school_id ?? "")
    .in("id", classIds.length > 0 ? classIds : [""])
    .order("name");

  const assessments = await assessStudentsForPromotion(
    supabase,
    profile.school_id ?? "",
    session,
    (students ?? []).filter((s) => s.class_id).map((s) => s.id),
    criteria
  );

  const promotionClasses: PromotionClass[] = (classes ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    students: (byClass.get(c.id) ?? []).map((s) => {
      const a = assessments.get(s.id);
      return {
        id: s.id,
        name: s.full_name,
        average: a?.average ?? null,
        subjectsCounted: a?.subjectsCounted ?? 0,
        subjectsFailed: a?.subjectsFailed ?? 0,
        recommendation: a?.recommendation ?? "promote",
        reason: a?.reason ?? "No results recorded",
      };
    }),
  }));

  const repeatCount = promotionClasses.reduce(
    (n, c) => n + c.students.filter((s) => s.recommendation === "repeat").length,
    0
  );
  const noResultsCount = promotionClasses.reduce(
    (n, c) => n + c.students.filter((s) => s.subjectsCounted === 0).length,
    0
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Session Promotion</h1>
        <p className="text-sm text-zinc-500">
          Currently {session} · Term {term}. At year-end, bulk-move every class into the new
          session in one step instead of re-registering each student.
        </p>
      </div>

      <PromotionCriteriaForm
        minAverage={criteria.minAverage}
        subjectPassMark={criteria.subjectPassMark}
        maxFailedSubjects={criteria.maxFailedSubjects}
      />

      {unassignedCount > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {unassignedCount} active student{unassignedCount === 1 ? " has" : "s have"} no class
          assigned and won&rsquo;t be promoted — assign them a class first if they should move up.
        </p>
      )}

      {noResultsCount > 0 && (
        <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
          {noResultsCount} student{noResultsCount === 1 ? " has" : "s have"} no {session} results
          recorded, so the criteria can&rsquo;t judge them — they default to promotion. Set them
          to repeat by hand if that&rsquo;s wrong.
        </p>
      )}

      {promotionClasses.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No active students are assigned to a class yet.
        </p>
      ) : (
        <PromotionForm
          classes={promotionClasses}
          suggestedSession={suggestNextSession(session)}
          repeatCount={repeatCount}
        />
      )}
    </div>
  );
}
