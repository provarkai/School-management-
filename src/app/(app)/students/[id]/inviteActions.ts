"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/siteUrl";

export interface InviteFormState {
  error?: string;
  url?: string;
}

export async function createParentInvitation(
  studentId: string,
  _prevState: InviteFormState
): Promise<InviteFormState> {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const token = randomBytes(24).toString("base64url");

  const { error } = await supabase.from("parent_invitations").insert({
    school_id: profile.school_id,
    student_id: studentId,
    token,
    created_by: profile.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/students/${studentId}`);
  return { url: `${await siteOrigin()}/parent/invite/${token}` };
}

export async function revokeParentInvitation(studentId: string, invitationId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("parent_invitations").delete().eq("id", invitationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${studentId}`);
}
