"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { sendReminderMessage } from "@/lib/termii";

export interface BroadcastState {
  error?: string;
  success?: string;
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
      .select("parent_phone")
      .eq("school_id", profile.school_id ?? "")
      .eq("status", "active")
      .not("parent_phone", "is", null);
    if (classId) query = query.eq("class_id", classId);
    const { data: students } = await query;

    for (const s of students ?? []) {
      if (!s.parent_phone) continue;
      const result = await sendReminderMessage(s.parent_phone, message);
      if (result.mocked) mocked = true;
      if (result.ok) sentCount++;
    }
    audienceParts.push(classId ? "one class's parents" : "all parents");
  }

  if (sendToStaff) {
    const { data: staff } = await supabase
      .from("app_users")
      .select("phone")
      .eq("school_id", profile.school_id ?? "")
      .in("role", ["teacher", "staff"])
      .not("phone", "is", null);

    for (const s of staff ?? []) {
      if (!s.phone) continue;
      const result = await sendReminderMessage(s.phone, message);
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
