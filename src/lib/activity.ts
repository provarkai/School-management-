import type { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ActivityEvent {
  id: string;
  description: string;
  timestamp: string;
}

/**
 * A merged, timestamped feed of recent school activity — synthesized from
 * existing tables' own created_at columns rather than a dedicated logging
 * table, so there's no separate write path that could fall out of sync with
 * what actually happened.
 */
export async function getRecentSchoolActivity(
  supabase: SupabaseClient,
  schoolId: string,
  limit = 20
): Promise<ActivityEvent[]> {
  const [{ data: payments }, { data: newStudents }, { data: newStaff }, { data: incidents }, { data: notices }] =
    await Promise.all([
      supabase
        .from("fee_payments")
        .select("id, amount, created_at, fee_records(students(full_name)), app_users(name)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("students")
        .select("id, full_name, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("app_users")
        .select("id, name, role, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("behavior_incidents")
        .select("id, category, description, created_at, students(full_name)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("staff_notices")
        .select("id, title, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const events: ActivityEvent[] = [];

  for (const p of payments ?? []) {
    const studentName =
      (p.fee_records as unknown as { students: { full_name: string } | null } | null)?.students
        ?.full_name ?? "a student";
    const recordedBy = (p.app_users as unknown as { name: string } | null)?.name;
    events.push({
      id: `payment-${p.id}`,
      description: `${naira(Number(p.amount))} payment recorded for ${studentName}${
        recordedBy ? ` by ${recordedBy}` : ""
      }`,
      timestamp: p.created_at,
    });
  }

  for (const s of newStudents ?? []) {
    events.push({
      id: `student-${s.id}`,
      description: `${s.full_name} registered as a new student`,
      timestamp: s.created_at,
    });
  }

  for (const s of newStaff ?? []) {
    events.push({
      id: `staff-${s.id}`,
      description: `${s.name} added as ${s.role}`,
      timestamp: s.created_at,
    });
  }

  for (const i of incidents ?? []) {
    const studentName = (i.students as unknown as { full_name: string } | null)?.full_name ?? "a student";
    const description = i.description.length > 60 ? `${i.description.slice(0, 60)}…` : i.description;
    events.push({
      id: `incident-${i.id}`,
      description: `${i.category === "merit" ? "Merit" : "Demerit"} logged for ${studentName}: ${description}`,
      timestamp: i.created_at,
    });
  }

  for (const n of notices ?? []) {
    events.push({
      id: `notice-${n.id}`,
      description: `Notice posted: ${n.title}`,
      timestamp: n.created_at,
    });
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}
