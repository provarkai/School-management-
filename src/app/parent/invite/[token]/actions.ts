"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AcceptInviteState {
  error?: string;
}

export async function acceptInvitation(
  token: string,
  _prevState: AcceptInviteState
): Promise<AcceptInviteState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_parent_invitation", { target_token: token });

  if (error) {
    return { error: error.message };
  }

  redirect("/parent");
}
