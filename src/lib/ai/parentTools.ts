import type { createClient } from "@/lib/supabase/server";
import type { CurrentParent, ParentChild } from "@/lib/current-parent";
import type { OpenRouterTool } from "@/lib/ai/client";
import { naira } from "@/lib/format";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Same shape as src/lib/ai/tools.ts (the staff assistant's tool set), but
 * scoped to a parent's own linked children. Executors run against the
 * signed-in parent's own RLS-scoped Supabase client — a parent naturally
 * can't see another family's data because the query itself returns
 * nothing, not because of app-layer filtering. As a second layer, every
 * tool here resolves "which child" only against `parent.children` (already
 * loaded by requireParent() from the real parent_students link) — never
 * against a raw student_id the model might pass in.
 */
export const PARENT_ASSISTANT_TOOLS: OpenRouterTool[] = [
  {
    type: "function",
    function: {
      name: "get_child_summary",
      description:
        "Get an overview for one (or all, if not specified) of your children: current fee balance, this term's attendance rate, and latest average score. Use for broad 'how is my child doing' questions.",
      parameters: {
        type: "object",
        properties: {
          child_name: { type: "string", description: "Full or partial name — omit to cover every child" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_child_attendance",
      description: "Get attendance history (present/absent/late counts) over the last N days for one or all children.",
      parameters: {
        type: "object",
        properties: {
          child_name: { type: "string", description: "Full or partial name — omit to cover every child" },
          days: { type: "integer", description: "How many days back to look (default 30)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_child_fees",
      description: "Get the current term's fee breakdown by fee type (amount, paid, balance) for one or all children.",
      parameters: {
        type: "object",
        properties: {
          child_name: { type: "string", description: "Full or partial name — omit to cover every child" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_child_results",
      description: "Get this term's subject scores and grades for one or all children.",
      parameters: {
        type: "object",
        properties: {
          child_name: { type: "string", description: "Full or partial name — omit to cover every child" },
        },
        required: [],
      },
    },
  },
];

function resolveChildren(children: ParentChild[], childName: unknown): ParentChild[] {
  const name = typeof childName === "string" ? childName.trim().toLowerCase() : "";
  if (!name) return children;
  return children.filter((c) => c.full_name.toLowerCase().includes(name));
}

async function currentPeriodBySchool(
  supabase: SupabaseClient,
  schoolIds: string[]
): Promise<Map<string, { session: string; term: string }>> {
  if (schoolIds.length === 0) return new Map();
  const { data } = await supabase
    .from("schools")
    .select("id, current_session, current_term")
    .in("id", schoolIds);
  return new Map((data ?? []).map((s) => [s.id, { session: s.current_session, term: s.current_term }]));
}

export async function runParentAssistantTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseClient,
  parent: CurrentParent
): Promise<string> {
  const targets = resolveChildren(parent.children, input.child_name);
  if (targets.length === 0) {
    return JSON.stringify({ error: `No child found matching "${String(input.child_name)}".` });
  }

  switch (name) {
    case "get_child_summary": {
      const periodBySchool = await currentPeriodBySchool(
        supabase,
        Array.from(new Set(targets.map((c) => c.school_id)))
      );

      const summaries = await Promise.all(
        targets.map(async (child) => {
          const period = periodBySchool.get(child.school_id);
          const [{ data: fees }, { data: results }, { data: attendance }] = await Promise.all([
            period
              ? supabase
                  .from("fee_summary")
                  .select("balance")
                  .eq("student_id", child.id)
                  .eq("session", period.session)
                  .eq("term", period.term)
              : Promise.resolve({ data: [] }),
            period
              ? supabase
                  .from("results")
                  .select("total")
                  .eq("student_id", child.id)
                  .eq("session", period.session)
                  .eq("term", period.term)
              : Promise.resolve({ data: [] }),
            supabase
              .from("attendance")
              .select("status")
              .eq("student_id", child.id)
              .gte("date", new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
          ]);

          const balance = (fees ?? []).reduce((sum, f) => sum + Number(f.balance), 0);
          const scores = (results ?? []).map((r) => Number(r.total));
          const average = scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : null;
          const present = (attendance ?? []).filter((a) => a.status === "present").length;
          const marked = attendance?.length ?? 0;

          return {
            name: child.full_name,
            class: child.className,
            fee_balance: naira(balance),
            average_score_this_term: average !== null ? `${average.toFixed(1)}%` : "no scores recorded yet",
            attendance_last_30_days: marked ? `${present}/${marked} present` : "not marked yet",
          };
        })
      );

      return JSON.stringify({ children: summaries });
    }

    case "get_child_attendance": {
      const days = typeof input.days === "number" && input.days > 0 ? Math.min(input.days, 90) : 30;
      const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

      const results = await Promise.all(
        targets.map(async (child) => {
          const { data: rows } = await supabase
            .from("attendance")
            .select("status")
            .eq("student_id", child.id)
            .gte("date", since);
          const counts = { present: 0, absent: 0, late: 0 };
          for (const r of rows ?? []) counts[r.status as "present" | "absent" | "late"]++;
          return { name: child.full_name, period_days: days, ...counts };
        })
      );

      return JSON.stringify({ children: results });
    }

    case "get_child_fees": {
      const periodBySchool = await currentPeriodBySchool(
        supabase,
        Array.from(new Set(targets.map((c) => c.school_id)))
      );

      const results = await Promise.all(
        targets.map(async (child) => {
          const period = periodBySchool.get(child.school_id);
          if (!period) return { name: child.full_name, fee_types: [] };
          const { data: fees } = await supabase
            .from("fee_summary")
            .select("fee_type_name, amount_expected, amount_paid, balance")
            .eq("student_id", child.id)
            .eq("session", period.session)
            .eq("term", period.term);

          return {
            name: child.full_name,
            session: period.session,
            term: period.term,
            fee_types: (fees ?? []).map((f) => ({
              type: f.fee_type_name,
              expected: naira(Number(f.amount_expected)),
              paid: naira(Number(f.amount_paid)),
              balance: naira(Number(f.balance)),
            })),
          };
        })
      );

      return JSON.stringify({ children: results });
    }

    case "get_child_results": {
      const periodBySchool = await currentPeriodBySchool(
        supabase,
        Array.from(new Set(targets.map((c) => c.school_id)))
      );

      const results = await Promise.all(
        targets.map(async (child) => {
          const period = periodBySchool.get(child.school_id);
          if (!period) return { name: child.full_name, subjects: [] };
          const { data: scores } = await supabase
            .from("results")
            .select("subject, total, grade")
            .eq("student_id", child.id)
            .eq("session", period.session)
            .eq("term", period.term)
            .order("subject");

          return {
            name: child.full_name,
            session: period.session,
            term: period.term,
            subjects: (scores ?? []).map((s) => ({ subject: s.subject, total: Number(s.total), grade: s.grade })),
          };
        })
      );

      return JSON.stringify({ children: results });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
