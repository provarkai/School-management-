"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { sendAndLogMessage } from "@/lib/messageLog";
import { draftText, type DraftResult } from "@/lib/ai/draft";

export interface BroadcastState {
  error?: string;
  success?: string;
}

/** Drafts a broadcast message from a short description of what it's about —
 * the proprietor edits it before sending, nothing is sent from here. */
export async function draftBroadcastMessage(occasion: string): Promise<DraftResult> {
  const { school } = await requireProprietor();
  if (!occasion.trim()) return { error: "Describe what the broadcast is about first." };

  const system = `You draft short, clear broadcast messages sent by SMS/WhatsApp from ${
    school?.name ?? "a school"
  } to parents and/or staff. Write 1-3 sentences, plain and direct, no greeting or sign-off — this is a notification, not a letter.`;

  return draftText(system, `Draft a broadcast message about: ${occasion.trim()}`);
}

export async function sendBroadcast(
  _prevState: BroadcastState,
  formData: FormData
): Promise<BroadcastState> {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const message = String(formData.get("message") ?? "").trim();
  const sendToParents = formData.get("send_to_parents") === "on";
  const classId = String(formData.get("class_id") ?? "").trim() || null;
  const sendToStaff = formData.get("send_to_staff") === "on";

  if (!message) {
    return { error: "Message is required." };
  }
  if (!sendToParents && !sendToStaff) {
    return { error: "Choose at least one audience — parents and/or staff." };
  }

  let sentCount = 0;
  let mocked = false;
  const audienceParts: string[] = [];

  if (sendToParents) {
    let query = supabase
      .from("students")
      .select("id, full_name, parent_name, parent_phone")
      .eq("school_id", profile.school_id ?? "")
      .eq("status", "active")
      .not("parent_phone", "is", null);
    if (classId) query = query.eq("class_id", classId);
    const { data: students } = await query;

    for (const s of students ?? []) {
      if (!s.parent_phone) continue;
      const result = await sendAndLogMessage(
        supabase,
        {
          schoolId: profile.school_id ?? "",
          purpose: "broadcast",
          recipientName: s.parent_name ?? s.full_name,
          studentId: s.id,
          sentBy: profile.id,
        },
        s.parent_phone,
        message
      );
      if (result.mocked) mocked = true;
      if (result.ok) sentCount++;
    }
    audienceParts.push(classId ? "one class's parents" : "all parents");
  }

  if (sendToStaff) {
    const { data: staff } = await supabase
      .from("app_users")
      .select("id, name, phone")
      .eq("school_id", profile.school_id ?? "")
      .in("role", ["teacher", "staff"])
      .not("phone", "is", null);

    for (const s of staff ?? []) {
      if (!s.phone) continue;
      const result = await sendAndLogMessage(
        supabase,
        {
          schoolId: profile.school_id ?? "",
          purpose: "broadcast",
          recipientName: s.name,
          staffId: s.id,
          sentBy: profile.id,
        },
        s.phone,
        message
      );
      if (result.mocked) mocked = true;
      if (result.ok) sentCount++;
    }

    await supabase.from("staff_notices").insert({
      school_id: profile.school_id,
      title: "Broadcast",
      body: message,
      audience: "all",
      created_by: profile.id,
    });

    audienceParts.push("all staff");
  }

  await supabase.from("broadcasts").insert({
    school_id: profile.school_id,
    message,
    audience: audienceParts.join(" + "),
    recipient_count: sentCount,
    sent_by: profile.id,
  });

  revalidatePath("/broadcasts");
  revalidatePath("/notices");

  return {
    success: `Sent to ${sentCount} recipient(s) (${audienceParts.join(" + ")}).${
      mocked ? " (mock mode — set TERMII_API_KEY to send for real)" : ""
    }`,
  };
}
