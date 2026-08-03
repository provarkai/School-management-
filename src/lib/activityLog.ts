import type { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Records one line in the school's audit log. Best-effort: a logging
 * failure never surfaces to the caller or blocks the action it's
 * describing — the same convention as sendAndLogMessage for message_logs.
 */
export async function logActivity(
  supabase: SupabaseClient,
  actor: Pick<AppUser, "school_id" | "id" | "name" | "role">,
  action: string,
  summary: string
): Promise<void> {
  if (!actor.school_id) return;

  await supabase.from("activity_logs").insert({
    school_id: actor.school_id,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action,
    summary,
  });
}
