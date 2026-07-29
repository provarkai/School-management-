import type { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/current-user";
import type { OpenRouterTool } from "@/lib/ai/client";
import { naira } from "@/lib/format";
import { feeReminderTemplate } from "@/lib/termii";
import { TERM_LABELS, type Term } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Tool executors run against the signed-in user's own RLS-scoped Supabase
 * client — a teacher's assistant naturally can't see fee data a teacher
 * isn't allowed to see, because the query itself returns nothing, not
 * because we special-cased the role here.
 */
export const ASSISTANT_TOOLS: OpenRouterTool[] = [
  {
    type: "function",
    function: {
      name: "get_school_summary",
      description:
        "Get overall school stats for the current term: total active students, fees expected vs collected, and today's attendance rate. Use this for broad questions like 'how are we doing this term'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "find_students",
      description:
        "Search for students by name and/or class, optionally filtered by fee status. Returns each match's class and (for proprietors) fee balance.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full or partial student name" },
          class_name: { type: "string", description: "Class name, e.g. JSS1 or SSS2" },
          fee_status: {
            type: "string",
            enum: ["owing", "partial", "paid"],
            description: "Filter by this term's fee status",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_attendance_summary",
      description:
        "Get attendance stats (present/absent/late counts) over the last N days, optionally for one class. Use for questions about attendance trends or chronic absentees.",
      parameters: {
        type: "object",
        properties: {
          class_name: { type: "string", description: "Class name, e.g. JSS1" },
          days: { type: "integer", description: "How many days back to look (default 7)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_reminder_message",
      description:
        "Draft (but do not send) the templated fee reminder message for one student, based on their current balance. Use when the user asks you to write or preview a reminder.",
      parameters: {
        type: "object",
        properties: {
          student_name: { type: "string", description: "Full or partial student name" },
        },
        required: ["student_name"],
      },
    },
  },
];

export async function runAssistantTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseClient,
  user: CurrentUser
): Promise<string> {
  const session = user.school?.current_session ?? "";
  const term = (user.school?.current_term ?? "1") as Term;

  switch (name) {
    case "get_school_summary": {
      const [{ count: studentCount }, feeRows, attendanceRows] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase
          .from("fee_summary")
          .select("amount_expected, amount_paid")
          .eq("session", session)
          .eq("term", term),
        supabase
          .from("attendance")
          .select("status")
          .eq("date", new Date().toISOString().slice(0, 10)),
      ]);

      const expected = (feeRows.data ?? []).reduce((s, r) => s + Number(r.amount_expected), 0);
      const collected = (feeRows.data ?? []).reduce((s, r) => s + Number(r.amount_paid), 0);
      const present = (attendanceRows.data ?? []).filter((a) => a.status === "present").length;
      const marked = attendanceRows.data?.length ?? 0;

      return JSON.stringify({
        total_active_students: studentCount ?? 0,
        session,
        term,
        fees_expected: expected ? naira(expected) : "no fee records set",
        fees_collected: naira(collected),
        attendance_today: marked ? `${present}/${marked} present` : "not marked yet",
      });
    }

    case "find_students": {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      const className = typeof input.class_name === "string" ? input.class_name.trim() : "";
      const feeStatus = typeof input.fee_status === "string" ? input.fee_status : "";

      let classId: string | null = null;
      if (className) {
        const { data: klass } = await supabase
          .from("classes")
          .select("id")
          .ilike("name", className)
          .maybeSingle();
        if (!klass) return JSON.stringify({ students: [], note: `No class named "${className}" found.` });
        classId = klass.id;
      }

      let query = supabase
        .from("students")
        .select("id, full_name, class_id")
        .eq("status", "active")
        .limit(20);
      if (name) query = query.ilike("full_name", `%${name}%`);
      if (classId) query = query.eq("class_id", classId);

      const { data: students } = await query;
      if (!students || students.length === 0) return JSON.stringify({ students: [] });

      const { data: classes } = await supabase.from("classes").select("id, name");
      const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

      const { data: fees } = await supabase
        .from("fee_summary")
        .select("student_id, balance, amount_paid")
        .in("student_id", students.map((s) => s.id))
        .eq("session", session)
        .eq("term", term);

      const balanceByStudent = new Map<string, number>();
      const paidByStudent = new Map<string, number>();
      for (const f of fees ?? []) {
        balanceByStudent.set(f.student_id, (balanceByStudent.get(f.student_id) ?? 0) + Number(f.balance));
        paidByStudent.set(f.student_id, (paidByStudent.get(f.student_id) ?? 0) + Number(f.amount_paid));
      }

      let results = students.map((s) => {
        const hasFeeRecord = balanceByStudent.has(s.id);
        const balance = balanceByStudent.get(s.id) ?? 0;
        const paid = paidByStudent.get(s.id) ?? 0;
        const status = !hasFeeRecord ? null : balance <= 0 ? "paid" : paid > 0 ? "partial" : "owing";
        return {
          name: s.full_name,
          class: s.class_id ? classNameById.get(s.class_id) ?? null : null,
          fee_status: status ?? "not visible or not set",
          fee_balance: hasFeeRecord ? naira(balance) : null,
        };
      });

      if (feeStatus) results = results.filter((r) => r.fee_status === feeStatus);

      return JSON.stringify({ students: results });
    }

    case "get_attendance_summary": {
      const className = typeof input.class_name === "string" ? input.class_name.trim() : "";
      const days = typeof input.days === "number" && input.days > 0 ? Math.min(input.days, 60) : 7;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().slice(0, 10);

      let classId: string | null = null;
      if (className) {
        const { data: klass } = await supabase
          .from("classes")
          .select("id")
          .ilike("name", className)
          .maybeSingle();
        if (!klass) return JSON.stringify({ note: `No class named "${className}" found.` });
        classId = klass.id;
      }

      let query = supabase.from("attendance").select("status, student_id, class_id").gte("date", sinceStr);
      if (classId) query = query.eq("class_id", classId);
      const { data: rows } = await query;

      const counts = { present: 0, absent: 0, late: 0 };
      const absencesByStudent = new Map<string, number>();
      for (const r of rows ?? []) {
        counts[r.status as "present" | "absent" | "late"]++;
        if (r.status === "absent") {
          absencesByStudent.set(r.student_id, (absencesByStudent.get(r.student_id) ?? 0) + 1);
        }
      }

      let chronicAbsentees: { name: string; absences: number }[] = [];
      const frequentAbsentIds = Array.from(absencesByStudent.entries())
        .filter(([, n]) => n >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      if (frequentAbsentIds.length > 0) {
        const { data: students } = await supabase
          .from("students")
          .select("id, full_name")
          .in("id", frequentAbsentIds.map(([id]) => id));
        const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));
        chronicAbsentees = frequentAbsentIds.map(([id, n]) => ({
          name: nameById.get(id) ?? "Unknown",
          absences: n,
        }));
      }

      return JSON.stringify({ period_days: days, ...counts, students_with_3plus_absences: chronicAbsentees });
    }

    case "draft_reminder_message": {
      const name = typeof input.student_name === "string" ? input.student_name.trim() : "";
      if (!name) return JSON.stringify({ error: "student_name is required" });

      const { data: student } = await supabase
        .from("students")
        .select("id, full_name, parent_name")
        .ilike("full_name", `%${name}%`)
        .maybeSingle();
      if (!student) return JSON.stringify({ error: `No student found matching "${name}".` });

      const { data: fees } = await supabase
        .from("fee_summary")
        .select("balance")
        .eq("student_id", student.id)
        .eq("session", session)
        .eq("term", term);

      const balance = (fees ?? []).reduce((sum, f) => sum + Number(f.balance), 0);
      if (balance <= 0) {
        return JSON.stringify({ note: `${student.full_name} has no outstanding balance this term.` });
      }

      const message = feeReminderTemplate({
        parentName: student.parent_name || "Parent",
        studentName: student.full_name,
        balance: naira(balance),
        termLabel: TERM_LABELS[term],
        schoolName: user.school?.name ?? "the school",
      });

      return JSON.stringify({ draft: message });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
