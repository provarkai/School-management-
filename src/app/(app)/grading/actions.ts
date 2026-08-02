"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface GradingFormState {
  error?: string;
  success?: string;
}

export async function addComponent(
  _prevState: GradingFormState,
  formData: FormData
): Promise<GradingFormState> {
  const { profile } = await requireProprietor();

  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const maxScore = Number(formData.get("max_score"));

  if (!name) return { error: "Enter a component name." };
  if (kind !== "ca" && kind !== "exam") return { error: "Choose CA or Exam." };
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    return { error: "Max score must be greater than 0." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("assessment_components")
    .select("position")
    .eq("school_id", profile.school_id ?? "")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("assessment_components").insert({
    school_id: profile.school_id,
    name,
    kind,
    max_score: maxScore,
    position: (existing?.position ?? -1) + 1,
  });

  if (error) {
    if (error.code === "23505") return { error: `"${name}" already exists.` };
    return { error: error.message };
  }

  revalidatePath("/grading");
  return {};
}

export async function deleteComponent(componentId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assessment_components")
    .delete()
    .eq("id", componentId);
  if (error) throw new Error(error.message);
  revalidatePath("/grading");
}

export async function addGradeBand(
  _prevState: GradingFormState,
  formData: FormData
): Promise<GradingFormState> {
  const { profile } = await requireProprietor();

  const letter = String(formData.get("letter") ?? "").trim().toUpperCase();
  const minScore = Number(formData.get("min_score"));

  if (!letter) return { error: "Enter a grade letter." };
  if (!Number.isFinite(minScore) || minScore < 0) {
    return { error: "Minimum score must be 0 or more." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("grade_bands").insert({
    school_id: profile.school_id,
    letter,
    min_score: minScore,
  });

  if (error) {
    if (error.code === "23505") return { error: `Grade "${letter}" already exists.` };
    return { error: error.message };
  }

  revalidatePath("/grading");
  return {};
}

export async function deleteGradeBand(bandId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("grade_bands").delete().eq("id", bandId);
  if (error) throw new Error(error.message);
  revalidatePath("/grading");
}

export async function addTrait(
  _prevState: GradingFormState,
  formData: FormData
): Promise<GradingFormState> {
  const { profile } = await requireProprietor();

  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "");

  if (!name) return { error: "Enter a trait name." };
  if (domain !== "affective" && domain !== "psychomotor") {
    return { error: "Choose affective or psychomotor." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("report_card_traits")
    .select("position")
    .eq("school_id", profile.school_id ?? "")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("report_card_traits").insert({
    school_id: profile.school_id,
    name,
    domain,
    position: (existing?.position ?? -1) + 1,
  });

  if (error) {
    if (error.code === "23505") return { error: `"${name}" already exists.` };
    return { error: error.message };
  }

  revalidatePath("/grading");
  return {};
}

export async function deleteTrait(traitId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("report_card_traits").delete().eq("id", traitId);
  if (error) throw new Error(error.message);
  revalidatePath("/grading");
}
