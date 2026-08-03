"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activityLog";
import type { LeaveType } from "@/lib/types";

export interface LeaveFormState {
  error?: string;
  success?: string;
}

const LEAVE_TYPES: LeaveType[] = [
  "annual",
  "sick",
  "maternity",
  "paternity",
  "compassionate",
  "unpaid",
  "other",
];

/** Any signed-in staff member files their own request — staff_id is always
 * the caller, never taken from the form, so there is no way to file leave
 * on someone else's behalf through this action. */
export async function fileLeaveRequest(
  _prevState: LeaveFormState,
  formData: FormData
): Promise<LeaveFormState> {
  const { profile } = await requireUser();

  const leaveType = String(formData.get("leave_type") ?? "") as LeaveType;
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!LEAVE_TYPES.includes(leaveType)) {
    return { error: "Choose a leave type." };
  }
  if (!startDate || !endDate) {
    return { error: "Enter a start and end date." };
  }
  if (endDate < startDate) {
    return { error: "End date can't be before the start date." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").insert({
    school_id: profile.school_id,
    staff_id: profile.id,
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    reason,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/leave");
  return { success: "Leave request filed." };
}

/** Withdraws a request the staff member filed themselves, whether it's
 * still pending or already approved — plans change. A manager reversing
 * an approval they already gave isn't handled here; that's a review
 * action (reject), not a self-service cancel. */
export async function cancelLeaveRequest(requestId: string): Promise<void> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("staff_id", profile.id)
    .eq("school_id", profile.school_id ?? "")
    .in("status", ["pending", "approved"]);

  if (error) throw new Error(error.message);
  revalidatePath("/leave");
}

export async function reviewLeaveRequest(
  requestId: string,
  decision: "approved" | "rejected",
  formData: FormData
): Promise<void> {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const reviewNote = String(formData.get("review_note") ?? "").trim() || null;

  const { data: request } = await supabase
    .from("leave_requests")
    .select("staff_id, leave_type, app_users!leave_requests_staff_id_fkey(name)")
    .eq("id", requestId)
    .single();

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: decision,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote,
    })
    .eq("id", requestId)
    .eq("school_id", profile.school_id ?? "")
    .eq("status", "pending");

  if (error) throw new Error(error.message);

  const staffName = (request?.app_users as unknown as { name: string } | null)?.name ?? "a staff member";
  await logActivity(
    supabase,
    profile,
    "leave_reviewed",
    `${decision === "approved" ? "Approved" : "Rejected"} ${staffName}'s ${request?.leave_type ?? ""} leave request.`
  );

  revalidatePath("/leave");
}
