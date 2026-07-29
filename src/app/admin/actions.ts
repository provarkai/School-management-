"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/current-admin";
import { createClient } from "@/lib/supabase/server";
import type { SchoolStatus } from "@/lib/types";

export async function setSchoolStatus(schoolId: string, status: SchoolStatus) {
  const { authId } = await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("schools").update({ status }).eq("id", schoolId);
  if (error) throw new Error(error.message);

  await supabase.from("platform_admin_logs").insert({
    actor_id: authId,
    action: status === "suspended" ? "school_suspended" : "school_reactivated",
    target_school_id: schoolId,
  });

  revalidatePath("/admin");
}
