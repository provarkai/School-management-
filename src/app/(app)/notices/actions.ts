"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { sendAndLogMessage } from "@/lib/messageLog";
import type { NoticeAudience } from "@/lib/types";
import { draftText, type DraftResult } from "@/lib/ai/draft";

export interface NoticeFormState {
  error?: string;
  success?: string;
}

/** Drafts a notice body from its title — the proprietor edits it before
 * posting, nothing is saved from here. */
export async function draftNoticeBody(title: string): Promise<DraftResult> {
  await requireProprietor();
  if (!title.trim()) return { error: "Enter a title first." };

  const system =
    "You draft short staff notices for a Nigerian school's internal notice board. Write 1-3 sentences, clear and professional, no greeting or sign-off.";

  return draftText(system, `Draft a notice body for the title: "${title.trim()}"`);
}

export async function createNotice(
  _prevState: NoticeFormState,
  formData: FormData
): Promise<NoticeFormState> {
  const { profile } = await requireProprietor();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "all") as NoticeAudience;
  const alsoSms = formData.get("also_sms") === "on";

  if (!title || !body) {
    return { error: "Title and message are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("staff_notices").insert({
    school_id: profile.school_id,
    title,
    body,
    audience,
    created_by: profile.id,
  });

  if (error) {
    return { error: error.message };
  }

  let smsNote = "";
  if (alsoSms) {
    const targetRoles = audience === "teachers" ? ["teacher"] : audience === "staff" ? ["staff"] : ["teacher", "staff"];
    const { data: recipients } = await supabase
      .from("app_users")
      .select("id, name, phone")
      .not("phone", "is", null)
      .neq("id", profile.id)
      .in("role", targetRoles);
    let sent = 0;
    for (const r of recipients ?? []) {
      if (!r.phone) continue;
      const result = await sendAndLogMessage(
        supabase,
        {
          schoolId: profile.school_id ?? "",
          purpose: "staff_notice",
          recipientName: r.name,
          staffId: r.id,
          sentBy: profile.id,
        },
        r.phone,
        `${title}: ${body}`
      );
      if (result.ok) sent++;
    }
    smsNote = ` SMS sent to ${sent} staff member(s).`;
  }

  revalidatePath("/notices");
  return { success: `Notice posted.${smsNote}` };
}

export async function deleteNotice(noticeId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("staff_notices").delete().eq("id", noticeId);
  if (error) throw new Error(error.message);
  revalidatePath("/notices");
}
