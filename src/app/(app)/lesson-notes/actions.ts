"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { Term } from "@/lib/types";

export interface LessonNoteFormState {
  error?: string;
  success?: string;
}

export async function createLessonNote(
  _prevState: LessonNoteFormState,
  formData: FormData
): Promise<LessonNoteFormState> {
  const { profile, school } = await requireUser();
  const supabase = await createClient();

  const classId = String(formData.get("class_id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const topic = String(formData.get("topic") ?? "").trim();
  const lessonDate = String(formData.get("lesson_date") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim() || null;
  const filePath = String(formData.get("file_path") ?? "").trim() || null;
  const fileName = String(formData.get("file_name") ?? "").trim() || null;
  // Submitting straight away is the common case — a teacher writing this
  // up after the fact — but "save as draft" stays available for one still
  // being drafted.
  const asDraft = formData.get("as_draft") === "on";

  if (!classId) return { error: "Choose a class." };
  if (!subject) return { error: "Enter a subject." };
  if (!topic) return { error: "Enter a topic." };
  if (!lessonDate) return { error: "Enter the lesson date." };
  if (!content && !filePath) return { error: "Write the note or attach a file." };

  const { error } = await supabase.from("lesson_notes").insert({
    school_id: profile.school_id,
    class_id: classId,
    subject,
    topic,
    session: school?.current_session ?? "",
    term: (school?.current_term ?? "1") as Term,
    lesson_date: lessonDate,
    content,
    file_path: filePath,
    file_name: fileName,
    status: asDraft ? "draft" : "submitted",
    submitted_at: asDraft ? null : new Date().toISOString(),
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/lesson-notes");
  return { success: asDraft ? "Saved as draft." : "Submitted for review." };
}

/** Submits a draft (or a note sent back for revision) for review. Only
 * touches the author's own note, and only while it's in a state that can
 * still be submitted — an already-approved note doesn't need resubmitting. */
export async function submitLessonNote(noteId: string): Promise<void> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lesson_notes")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("created_by", profile.id)
    .eq("school_id", profile.school_id ?? "")
    .in("status", ["draft", "needs_revision"]);

  if (error) throw new Error(error.message);
  revalidatePath("/lesson-notes");
}

export async function deleteLessonNote(noteId: string, filePath: string | null): Promise<void> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  if (filePath) {
    await supabase.storage.from("lesson-notes").remove([filePath]);
  }

  const { error } = await supabase
    .from("lesson_notes")
    .delete()
    .eq("id", noteId)
    .eq("created_by", profile.id)
    .eq("school_id", profile.school_id ?? "")
    .eq("status", "draft");

  if (error) throw new Error(error.message);
  revalidatePath("/lesson-notes");
}

export async function reviewLessonNote(
  noteId: string,
  decision: "approved" | "needs_revision",
  formData: FormData
): Promise<void> {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const reviewNote = String(formData.get("review_note") ?? "").trim() || null;

  const { error } = await supabase
    .from("lesson_notes")
    .update({
      status: decision,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote,
    })
    .eq("id", noteId)
    .eq("school_id", profile.school_id ?? "")
    .eq("status", "submitted");

  if (error) throw new Error(error.message);
  revalidatePath("/lesson-notes");
}
