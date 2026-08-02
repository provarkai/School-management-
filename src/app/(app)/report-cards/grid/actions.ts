"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getSubjectRoster } from "@/lib/subjectRoster";

export interface GridSaveState {
  error?: string;
  success?: string;
}

/**
 * Saves a whole class's scores for one subject in a single submit — the
 * thing that replaces ~240 individual form posts per teacher per term.
 *
 * Writes both the component breakdown and the ca_score/exam_score sums
 * `results` has always carried, because every downstream reader (report
 * card PDFs, ranking, analytics, exports) still reads those two
 * columns.
 */
export async function saveClassScores(
  classId: string,
  subjectId: string,
  _prevState: GridSaveState,
  formData: FormData
): Promise<GridSaveState> {
  const { profile, school } = await requireUser();
  const supabase = await createClient();

  const schoolId = profile.school_id ?? "";
  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  if (!session) return { error: "Set the school's current session first." };

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("id", subjectId)
    .eq("school_id", schoolId)
    .single();

  if (!subject) return { error: "Subject not found." };

  const { data: components } = await supabase
    .from("assessment_components")
    .select("id, name, kind, max_score")
    .eq("school_id", schoolId)
    .order("position");

  if (!components || components.length === 0) {
    return { error: "No assessment components configured — set them up under Grading first." };
  }

  const { students } = await getSubjectRoster(supabase, schoolId, classId, subjectId, session);
  if (students.length === 0) return { error: "No students take this subject." };

  // Parse and validate before writing anything, so a single bad cell can't
  // leave the class half-saved.
  const perStudent: {
    studentId: string;
    caTotal: number;
    examTotal: number;
    scores: { componentId: string; score: number }[];
  }[] = [];

  for (const student of students) {
    const scores: { componentId: string; score: number }[] = [];
    let caTotal = 0;
    let examTotal = 0;

    for (const c of components) {
      const raw = String(formData.get(`score_${student.id}_${c.id}`) ?? "").trim();
      // Blank means "not entered", which is not the same as a zero — those
      // students are skipped entirely so the entry-status count stays honest.
      if (raw === "") continue;

      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        return { error: `${student.full_name} — ${c.name}: enter a number of 0 or more.` };
      }
      if (value > Number(c.max_score)) {
        return {
          error: `${student.full_name} — ${c.name}: ${value} is above the maximum of ${Number(
            c.max_score
          )}.`,
        };
      }

      scores.push({ componentId: c.id, score: value });
      if (c.kind === "ca") caTotal += value;
      else examTotal += value;
    }

    if (scores.length > 0) {
      perStudent.push({ studentId: student.id, caTotal, examTotal, scores });
    }
  }

  if (perStudent.length === 0) {
    return { error: "Nothing entered yet." };
  }

  const { data: savedResults, error: resultsError } = await supabase
    .from("results")
    .upsert(
      perStudent.map((p) => ({
        school_id: schoolId,
        student_id: p.studentId,
        subject: subject.name,
        subject_id: subject.id,
        session,
        term,
        ca_score: p.caTotal,
        exam_score: p.examTotal,
      })),
      { onConflict: "student_id,subject,session,term" }
    )
    .select("id, student_id");

  if (resultsError) return { error: resultsError.message };

  const resultIdByStudent = new Map((savedResults ?? []).map((r) => [r.student_id, r.id]));

  const componentRows = perStudent.flatMap((p) => {
    const resultId = resultIdByStudent.get(p.studentId);
    if (!resultId) return [];
    return p.scores.map((s) => ({
      school_id: schoolId,
      result_id: resultId,
      component_id: s.componentId,
      score: s.score,
    }));
  });

  if (componentRows.length > 0) {
    const { error: componentError } = await supabase
      .from("result_component_scores")
      .upsert(componentRows, { onConflict: "result_id,component_id" });

    if (componentError) return { error: componentError.message };
  }

  revalidatePath("/report-cards");
  revalidatePath("/report-cards/grid");

  return {
    success: `Saved ${perStudent.length} student${perStudent.length === 1 ? "" : "s"} for ${
      subject.name
    }.`,
  };
}
