import type { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/current-user";
import type { OpenRouterTool } from "@/lib/ai/client";
import { naira } from "@/lib/format";
import { feeReminderTemplate } from "@/lib/termii";
import { TERM_LABELS, type Term } from "@/lib/types";
import { getFinancialTrend, getAcademicTrend, getAttendanceTrend } from "@/lib/analytics";

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
  {
    type: "function",
    function: {
      name: "prioritize_debtors",
      description:
        "Rank students who owe fees this term by urgency — balance size combined with how long it's been outstanding — so you know who to follow up with first. Use for 'who should I chase first' or 'prioritized list of debtors' questions.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max number of students to return (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_termly_report",
      description:
        "Generate a narrative summary of the school's fee collection, academic performance and attendance trends, comparing the current period to the previous one. Use for 'give me a report' or 'how are we trending' questions that need more than a single snapshot.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "find_at_risk_students",
      description:
        "Find students showing multiple warning signs at once — rising absences, repeated or severe behavior incidents, and/or a fee balance — so problems surface before they become a withdrawal. Optionally scoped to one class. Use for 'who's at risk' or 'who needs intervention' questions.",
      parameters: {
        type: "object",
        properties: {
          class_name: { type: "string", description: "Class name, e.g. JSS1 — omit to check the whole school" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "class_attention_summary",
      description:
        "For one class, summarize attendance rate and which students most need attention right now — combining attendance, behavior, and (for managers) fees. If the caller is a teacher and no class is given, defaults to their own class. Use for 'how is my class doing' questions.",
      parameters: {
        type: "object",
        properties: {
          class_name: { type: "string", description: "Class name, e.g. JSS1 — a teacher may omit this to mean their own class" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reminder_timing_insights",
      description:
        "Analyze past fee reminders to see how often they're followed by a payment within a week, broken down by the day of the week they were sent. Use for questions about whether reminders are working or when the best time to send them is.",
      parameters: { type: "object", properties: {}, required: [] },
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

    case "prioritize_debtors": {
      const limit = typeof input.limit === "number" && input.limit > 0 ? Math.min(input.limit, 30) : 10;

      const { data: owingRows } = await supabase
        .from("fee_summary")
        .select("fee_record_id, student_id, balance, status")
        .eq("session", session)
        .eq("term", term)
        .gt("balance", 0);

      if (!owingRows || owingRows.length === 0) {
        return JSON.stringify({ debtors: [], note: "No students are currently owing fees this term." });
      }

      const { data: feeRecords } = await supabase
        .from("fee_records")
        .select("id, created_at")
        .in("id", owingRows.map((r) => r.fee_record_id));
      const createdAtByRecord = new Map((feeRecords ?? []).map((r) => [r.id, r.created_at]));

      const byStudent = new Map<string, { balance: number; oldestCreatedAt: string; status: string }>();
      for (const row of owingRows) {
        const createdAt = createdAtByRecord.get(row.fee_record_id) ?? new Date().toISOString();
        const existing = byStudent.get(row.student_id);
        if (existing) {
          existing.balance += Number(row.balance);
          if (new Date(createdAt) < new Date(existing.oldestCreatedAt)) existing.oldestCreatedAt = createdAt;
          if (row.status === "owing") existing.status = "owing";
        } else {
          byStudent.set(row.student_id, { balance: Number(row.balance), oldestCreatedAt: createdAt, status: row.status });
        }
      }

      const { data: students } = await supabase
        .from("students")
        .select("id, full_name, class_id, parent_name, parent_phone")
        .in("id", Array.from(byStudent.keys()));
      const { data: classes } = await supabase.from("classes").select("id, name");
      const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

      const now = Date.now();
      const ranked = (students ?? [])
        .map((s) => {
          const info = byStudent.get(s.id)!;
          const daysOverdue = Math.max(0, Math.floor((now - new Date(info.oldestCreatedAt).getTime()) / 86_400_000));
          const urgencyScore = info.balance / 1000 + daysOverdue * 5;
          return { s, info, daysOverdue, urgencyScore };
        })
        .sort((a, b) => b.urgencyScore - a.urgencyScore)
        .slice(0, limit)
        .map(({ s, info, daysOverdue }) => ({
          name: s.full_name,
          class: s.class_id ? classNameById.get(s.class_id) ?? null : null,
          balance: naira(info.balance),
          days_overdue: daysOverdue,
          status: info.status,
          parent_name: s.parent_name,
          parent_phone: s.parent_phone,
        }));

      return JSON.stringify({ debtors: ranked, ranked_by: "balance size and days overdue, most urgent first" });
    }

    case "generate_termly_report": {
      const schoolId = user.profile.school_id ?? "";
      const [financial, academic, attendanceTrend] = await Promise.all([
        getFinancialTrend(supabase, schoolId),
        getAcademicTrend(supabase, schoolId),
        getAttendanceTrend(supabase, schoolId, 6),
      ]);

      const latestFinancial = financial[financial.length - 1] ?? null;
      const priorFinancial = financial[financial.length - 2] ?? null;
      const latestAcademic = academic[academic.length - 1] ?? null;
      const priorAcademic = academic[academic.length - 2] ?? null;

      const result: Record<string, unknown> = {
        session,
        term: TERM_LABELS[term],
        fees: latestFinancial
          ? {
              expected: naira(latestFinancial.expected),
              collected: naira(latestFinancial.collected),
              collection_rate: latestFinancial.expected
                ? `${Math.round((latestFinancial.collected / latestFinancial.expected) * 100)}%`
                : "n/a",
              prior_period_collected: priorFinancial ? naira(priorFinancial.collected) : null,
            }
          : "no fee data yet",
        academics: latestAcademic
          ? {
              average_score: latestAcademic.averageScore.toFixed(1),
              prior_period_average: priorAcademic ? priorAcademic.averageScore.toFixed(1) : null,
            }
          : "no results recorded yet",
        attendance_last_6_months: attendanceTrend.map((p) => ({ month: p.label, rate: p.rate })),
      };

      if (!user.isManager) {
        result.note = "Full financial breakdown is only available to managers — showing what's visible to you.";
      }

      return JSON.stringify(result);
    }

    case "find_at_risk_students": {
      const className = typeof input.class_name === "string" ? input.class_name.trim() : "";
      let classId: string | null = null;
      if (className) {
        const { data: klass } = await supabase.from("classes").select("id").ilike("name", className).maybeSingle();
        if (!klass) return JSON.stringify({ note: `No class named "${className}" found.` });
        classId = klass.id;
      }

      let studentQuery = supabase.from("students").select("id, full_name, class_id").eq("status", "active");
      if (classId) studentQuery = studentQuery.eq("class_id", classId);
      const { data: students } = await studentQuery;
      if (!students || students.length === 0) return JSON.stringify({ at_risk_students: [] });

      const studentIds = students.map((s) => s.id);
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);
      const since60 = new Date();
      since60.setDate(since60.getDate() - 60);

      const [{ data: attendanceRows }, { data: behaviorRows }, { data: feeRows }] = await Promise.all([
        supabase
          .from("attendance")
          .select("student_id, status")
          .in("student_id", studentIds)
          .gte("date", since30.toISOString().slice(0, 10)),
        supabase
          .from("behavior_incidents")
          .select("student_id, severity")
          .in("student_id", studentIds)
          .gte("incident_date", since60.toISOString().slice(0, 10)),
        supabase
          .from("fee_summary")
          .select("student_id, balance")
          .eq("session", session)
          .eq("term", term)
          .in("student_id", studentIds),
      ]);

      const absencesByStudent = new Map<string, number>();
      for (const r of attendanceRows ?? []) {
        if (r.status === "absent") absencesByStudent.set(r.student_id, (absencesByStudent.get(r.student_id) ?? 0) + 1);
      }
      const behaviorByStudent = new Map<string, { count: number; severe: number }>();
      for (const r of behaviorRows ?? []) {
        const entry = behaviorByStudent.get(r.student_id) ?? { count: 0, severe: 0 };
        entry.count++;
        if (r.severity === "major" || r.severity === "severe") entry.severe++;
        behaviorByStudent.set(r.student_id, entry);
      }
      const balanceByStudent = new Map<string, number>();
      for (const r of feeRows ?? []) {
        balanceByStudent.set(r.student_id, (balanceByStudent.get(r.student_id) ?? 0) + Number(r.balance));
      }

      const classIds = Array.from(new Set(students.map((s) => s.class_id).filter((id): id is string => !!id)));
      const { data: classRows } = classIds.length
        ? await supabase.from("classes").select("id, name").in("id", classIds)
        : { data: [] };
      const classNameById = new Map((classRows ?? []).map((c) => [c.id, c.name]));

      const atRisk = students
        .map((s) => {
          const absences = absencesByStudent.get(s.id) ?? 0;
          const behavior = behaviorByStudent.get(s.id) ?? { count: 0, severe: 0 };
          const balance = balanceByStudent.get(s.id) ?? 0;
          const attendanceFlag = absences >= 3;
          const behaviorFlag = behavior.severe > 0 || behavior.count >= 2;
          const feeFlag = balance > 0;
          const flagCount = [attendanceFlag, behaviorFlag, feeFlag].filter(Boolean).length;
          if (flagCount < 2 && behavior.severe === 0) return null;

          const signals: string[] = [];
          if (attendanceFlag) signals.push(`${absences} absences in the last 30 days`);
          if (behaviorFlag) {
            signals.push(
              `${behavior.count} behavior incident(s) in the last 60 days${behavior.severe ? `, ${behavior.severe} major/severe` : ""}`
            );
          }
          if (feeFlag) signals.push(`owing ${naira(balance)} this term`);

          return {
            name: s.full_name,
            class: s.class_id ? classNameById.get(s.class_id) ?? null : null,
            signals,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      return JSON.stringify({
        at_risk_students: atRisk,
        criteria:
          "at least two of: 3+ absences in the last 30 days, repeated or severe behavior incidents in the last 60 days, an outstanding fee balance this term",
      });
    }

    case "class_attention_summary": {
      const className = typeof input.class_name === "string" ? input.class_name.trim() : "";
      let classId: string | null = null;
      let resolvedClassName = className;

      if (className) {
        const { data: klass } = await supabase.from("classes").select("id, name").ilike("name", className).maybeSingle();
        if (!klass) return JSON.stringify({ note: `No class named "${className}" found.` });
        classId = klass.id;
        resolvedClassName = klass.name;
      } else if (user.profile.role === "teacher") {
        const { data: klass } = await supabase.from("classes").select("id, name").eq("teacher_id", user.authId).maybeSingle();
        if (!klass) return JSON.stringify({ note: "You are not assigned as the teacher of any class." });
        classId = klass.id;
        resolvedClassName = klass.name;
      }

      if (!classId) return JSON.stringify({ note: "Specify a class name." });

      const { data: students } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("class_id", classId)
        .eq("status", "active");
      if (!students || students.length === 0) {
        return JSON.stringify({ class: resolvedClassName, students_needing_attention: [], note: "No active students in this class." });
      }

      const studentIds = students.map((s) => s.id);
      const since14 = new Date();
      since14.setDate(since14.getDate() - 14);
      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);

      const [{ data: attendanceRows }, { data: behaviorRows }, feeRows] = await Promise.all([
        supabase
          .from("attendance")
          .select("student_id, status")
          .eq("class_id", classId)
          .gte("date", since14.toISOString().slice(0, 10)),
        supabase
          .from("behavior_incidents")
          .select("student_id, severity")
          .in("student_id", studentIds)
          .gte("incident_date", since30.toISOString().slice(0, 10)),
        user.isManager
          ? supabase
              .from("fee_summary")
              .select("student_id, balance")
              .eq("session", session)
              .eq("term", term)
              .in("student_id", studentIds)
              .then((r) => r.data ?? [])
          : Promise.resolve([] as { student_id: string; balance: number }[]),
      ]);

      let presentCount = 0;
      let totalMarks = 0;
      const absencesByStudent = new Map<string, number>();
      for (const r of attendanceRows ?? []) {
        totalMarks++;
        if (r.status === "present") presentCount++;
        if (r.status === "absent") absencesByStudent.set(r.student_id, (absencesByStudent.get(r.student_id) ?? 0) + 1);
      }
      const behaviorByStudent = new Map<string, number>();
      for (const r of behaviorRows ?? []) {
        behaviorByStudent.set(r.student_id, (behaviorByStudent.get(r.student_id) ?? 0) + 1);
      }
      const balanceByStudent = new Map<string, number>();
      for (const r of feeRows) {
        balanceByStudent.set(r.student_id, (balanceByStudent.get(r.student_id) ?? 0) + Number(r.balance));
      }

      const flagged = students
        .map((s) => {
          const absences = absencesByStudent.get(s.id) ?? 0;
          const incidents = behaviorByStudent.get(s.id) ?? 0;
          const balance = balanceByStudent.get(s.id) ?? 0;
          const notes: string[] = [];
          if (absences >= 2) notes.push(`${absences} absences in the last 2 weeks`);
          if (incidents > 0) notes.push(`${incidents} behavior incident(s) in the last month`);
          if (balance > 0) notes.push(`owing ${naira(balance)}`);
          return notes.length > 0 ? { name: s.full_name, notes } : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      return JSON.stringify({
        class: resolvedClassName,
        class_attendance_rate: totalMarks ? `${Math.round((presentCount / totalMarks) * 100)}%` : "not marked recently",
        students_needing_attention: flagged,
      });
    }

    case "reminder_timing_insights": {
      const { data: reminders } = await supabase
        .from("message_logs")
        .select("student_id, created_at")
        .eq("purpose", "fee_reminder")
        .eq("status", "sent")
        .not("student_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(300);

      if (!reminders || reminders.length === 0) {
        return JSON.stringify({ note: "No fee reminders have been sent yet, or this data isn't visible to you." });
      }

      const studentIds = Array.from(new Set(reminders.map((r) => r.student_id).filter((id): id is string => !!id)));
      const { data: feeRecords } = await supabase.from("fee_records").select("id, student_id").in("student_id", studentIds);
      const recordIdsByStudent = new Map<string, string[]>();
      for (const fr of feeRecords ?? []) {
        const list = recordIdsByStudent.get(fr.student_id) ?? [];
        list.push(fr.id);
        recordIdsByStudent.set(fr.student_id, list);
      }
      const allRecordIds = (feeRecords ?? []).map((fr) => fr.id);
      const { data: payments } = allRecordIds.length
        ? await supabase.from("fee_payments").select("fee_record_id, payment_date").in("fee_record_id", allRecordIds)
        : { data: [] };
      const paymentDatesByRecord = new Map<string, string[]>();
      for (const p of payments ?? []) {
        const list = paymentDatesByRecord.get(p.fee_record_id) ?? [];
        list.push(p.payment_date);
        paymentDatesByRecord.set(p.fee_record_id, list);
      }

      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const responseByDay = new Map<number, { sent: number; responded: number }>();
      let totalResponded = 0;

      for (const reminder of reminders) {
        if (!reminder.student_id) continue;
        const sentDate = new Date(reminder.created_at);
        const dayOfWeek = sentDate.getDay();
        const entry = responseByDay.get(dayOfWeek) ?? { sent: 0, responded: 0 };
        entry.sent++;

        const recordIds = recordIdsByStudent.get(reminder.student_id) ?? [];
        const paidWithinWeek = recordIds.some((id) =>
          (paymentDatesByRecord.get(id) ?? []).some((pd) => {
            const diffDays = (new Date(pd).getTime() - sentDate.getTime()) / 86_400_000;
            return diffDays >= 0 && diffDays <= 7;
          })
        );
        if (paidWithinWeek) {
          entry.responded++;
          totalResponded++;
        }
        responseByDay.set(dayOfWeek, entry);
      }

      const byDay = Array.from(responseByDay.entries())
        .map(([day, { sent, responded }]) => ({
          day: DAY_NAMES[day],
          sent,
          response_rate: sent ? `${Math.round((responded / sent) * 100)}%` : "n/a",
        }))
        .sort((a, b) => b.sent - a.sent);

      return JSON.stringify({
        reminders_analyzed: reminders.length,
        overall_response_rate_within_7_days: `${Math.round((totalResponded / reminders.length) * 100)}%`,
        by_day_sent: byDay,
        note: "\"Responded\" means a payment was recorded for that student within 7 days of the reminder — not necessarily caused by it.",
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
