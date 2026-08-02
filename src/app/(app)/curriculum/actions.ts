"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor, requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface TopicFormState {
  error?: string;
}

export async function addTopic(
  _prevState: TopicFormState,
  formData: FormData
): Promise<TopicFormState> {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const subject = String(formData.get("subject") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!subject) return { error: "Choose a subject." };
  if (!title) return { error: "Enter a topic title." };

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: existing } = await supabase
    .from("syllabus_topics")
    .select("position")
    .eq("school_id", profile.school_id ?? "")
    .eq("subject", subject)
    .eq("session", session)
    .eq("term", term)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("syllabus_topics").insert({
    school_id: profile.school_id,
    subject,
    session,
    term,
    position: (existing?.position ?? -1) + 1,
    title,
    description,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/curriculum");
  return {};
}

export async function deleteTopic(topicId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("syllabus_topics").delete().eq("id", topicId);
  if (error) throw new Error(error.message);
  revalidatePath("/curriculum");
}

export async function setTopicProgress(
  classId: string,
  topicId: string,
  status: "not_started" | "in_progress" | "completed"
) {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("class_topic_progress").upsert(
    {
      school_id: profile.school_id,
      class_id: classId,
      topic_id: topicId,
      status,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "class_id,topic_id" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/curriculum");
}
