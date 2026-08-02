import type { createClient } from "@/lib/supabase/server";
import type { Term } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface FeeGateResult {
  withheld: boolean;
  balance: number;
}

/**
 * Whether a student's results should be hidden from their parents because
 * of an unpaid balance.
 *
 * Only ever called from parent-facing surfaces — the shared student link
 * and the parent portal. Staff pages and the printed report card are
 * deliberately not gated: the proprietor decides what to hand over, and
 * blocking their own tools would just be an obstacle to work around.
 */
export async function checkFeeGate(
  supabase: SupabaseClient,
  schoolId: string,
  studentId: string,
  session: string,
  term: Term,
  withholdEnabled: boolean
): Promise<FeeGateResult> {
  if (!withholdEnabled) return { withheld: false, balance: 0 };

  const { data } = await supabase
    .from("fee_summary")
    .select("balance")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("session", session)
    .eq("term", term);

  const balance = (data ?? []).reduce((sum, r) => sum + Number(r.balance), 0);

  // A school with no fee record for the term hasn't billed anyone yet;
  // that isn't a debt, so results stay visible.
  return { withheld: balance > 0, balance };
}
