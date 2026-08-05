"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getSubjectRoster } from "@/lib/subjectRoster";
import { extractJsonFromImage } from "@/lib/ai/vision";
import { matchRosterName } from "@/lib/nameMatch";

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

export interface ScanScoresResult {
  values?: Record<string, string>;
  matchedCount?: number;
  unmatchedNames?: string[];
  unmatchedColumns?: string[];
  error?: string;
}

interface ScannedScoreEntry {
  name: string;
  scores: Record<string, unknown>;
}

/**
 * Reads a photo of a handwritten or printed mark sheet and prefills the
 * grid — the teacher still reviews every cell and hits "Save all scores"
 * themselves, nothing here writes to `results`. Names only ever resolve
 * against this class/subject's real roster (matchRosterName), and column
 * headers only ever resolve against this school's real assessment
 * components — a value that can't be pinned to both a real student and a
 * real component is dropped, never guessed into place.
 */
export async function scanScoresFromImage(
  imageDataUrl: string,
  classId: string,
  subjectId: string
): Promise<ScanScoresResult> {
  const { profile, school } = await requireUser();
  const supabase = await createClient();

  const schoolId = profile.school_id ?? "";
  const session = school?.current_session ?? "";

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

  const roster = students.map((s) => s.full_name).join(", ");
  const componentList = components.map((c) => `"${c.name}" (max ${Number(c.max_score)})`).join(", ");
  const system = `You read a photo of a handwritten or printed mark sheet for the subject "${subject.name}". The class roster is: ${roster}. The score columns on the sheet correspond to these assessment components: ${componentList}. Match each column header you see (they may be abbreviated) to the closest component name from that list. Return ONLY JSON in this shape: {"entries":[{"name":"...","scores":{"<component name from the list above>":<number>, ...}}]}. Skip any score that's illegible or a column you can't confidently match, rather than guessing.`;

  const result = await extractJsonFromImage<{ entries: ScannedScoreEntry[] }>(system, imageDataUrl);
  if (result.error) return { error: result.error };

  const entries = result.data?.entries ?? [];
  if (entries.length === 0) {
    return { error: "Couldn't find any names on that photo — try a clearer shot." };
  }

  const componentByName = new Map(components.map((c) => [c.name.trim().toLowerCase(), c]));

  const values: Record<string, string> = {};
  const unmatchedNames: string[] = [];
  const unmatchedColumns = new Set<string>();
  let matchedCount = 0;

  for (const entry of entries) {
    if (!entry?.name || typeof entry.scores !== "object" || !entry.scores) continue;
    const student = matchRosterName(students, entry.name);
    if (!student) {
      unmatchedNames.push(entry.name);
      continue;
    }

    let studentHasAny = false;
    for (const [colName, rawScore] of Object.entries(entry.scores)) {
      const component = componentByName.get(String(colName).trim().toLowerCase());
      if (!component) {
        unmatchedColumns.add(colName);
        continue;
      }
      const score = Number(rawScore);
      if (!Number.isFinite(score) || score < 0 || score > Number(component.max_score)) continue;
      values[`${student.id}_${component.id}`] = String(score);
      studentHasAny = true;
    }
    if (studentHasAny) matchedCount++;
  }

  if (matchedCount === 0) {
    return {
      error: "Couldn't match any names or scores on that photo to this class.",
      unmatchedNames: unmatchedNames.length ? unmatchedNames : undefined,
      unmatchedColumns: unmatchedColumns.size ? Array.from(unmatchedColumns) : undefined,
    };
  }

  return {
    values,
    matchedCount,
    unmatchedNames: unmatchedNames.length ? unmatchedNames : undefined,
    unmatchedColumns: unmatchedColumns.size ? Array.from(unmatchedColumns) : undefined,
  };
}
