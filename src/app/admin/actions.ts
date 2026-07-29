"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/current-admin";
import { createClient } from "@/lib/supabase/server";
import type { SchoolStatus } from "@/lib/types";

export async function setSchoolStatus(schoolId: string, status: SchoolStatus) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("schools").update({ status }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
