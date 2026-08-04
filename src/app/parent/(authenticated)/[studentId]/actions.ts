"use server";

import { redirect } from "next/navigation";
import { requireParent } from "@/lib/current-parent";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createPaymentIntent } from "@/lib/payments";
import { siteOrigin } from "@/lib/siteUrl";

export interface PayFeesState {
  error?: string;
}

export async function payFees(
  studentId: string,
  _prevState: PayFeesState,
  _formData: FormData
): Promise<PayFeesState> {
  const { authId, parent, children } = await requireParent();

  const child = children.find((c) => c.id === studentId);
  if (!child) {
    return { error: "This student isn't linked to your account." };
  }

  const supabase = await createClient();

  const { data: school } = await supabase
    .from("schools")
    .select("current_session, current_term")
    .eq("id", child.school_id)
    .single();

  // One "Pay now" for the whole term's fees — Tuition, Transport, Hostel,
  // etc. are line items on the school's one bill for this child, not
  // separate things a parent should have to pay one at a time.
  const { data: fees } = await supabase
    .from("fee_summary")
    .select("fee_record_id, balance")
    .eq("student_id", studentId)
    .eq("session", school?.current_session ?? "")
    .eq("term", school?.current_term ?? "1");

  const owing = (fees ?? []).filter((f) => Number(f.balance) > 0);
  const balance = owing.reduce((sum, f) => sum + Number(f.balance), 0);
  if (owing.length === 0 || balance <= 0) {
    return { error: "There's no outstanding balance to pay." };
  }

  const callbackUrl = `${await siteOrigin()}/pay/callback?student=${studentId}`;

  const admin = createAdminClient();
  const result = await createPaymentIntent(admin, {
    schoolId: child.school_id,
    feeRecordId: owing[0].fee_record_id,
    studentId,
    amountNaira: balance,
    email: parent.email ?? `${authId}@parent.local`,
    callbackUrl,
    initiatedBy: null,
    coversAllFeeTypes: true,
  });

  if (!result.ok || !result.authorizationUrl) {
    return { error: result.error ?? "Could not start payment. Try again shortly." };
  }

  redirect(result.authorizationUrl);
}
