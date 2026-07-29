import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { BulkReportCardDocument, type ReportCardData } from "@/lib/pdf/ReportCardDocument";
import { computeClassRanking } from "@/lib/ranking";
import type { Term } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const { school } = await requireUser();
  const supabase = await createClient();

  const { data: klass } = await supabase
    .from("classes")
    .select("name")
    .eq("id", classId)
    .single();

  if (!klass || !school) {
    return new Response("Class not found", { status: 404 });
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name");

  const term = school.current_term as Term;
  const ranking = await computeClassRanking(supabase, classId, school.current_session, term);

  const cards: ReportCardData[] = await Promise.all(
    (students ?? []).map(async (student) => {
      const { data: results } = await supabase
        .from("results")
        .select("subject, ca_score, exam_score, total, grade")
        .eq("student_id", student.id)
        .eq("session", school.current_session)
        .eq("term", term)
        .order("subject");

      return {
        school: {
          name: school.name,
          address: school.address,
          current_session: school.current_session,
        },
        student: { full_name: student.full_name, className: klass.name },
        term,
        results: (results ?? []).map((r) => ({
          subject: r.subject,
          ca_score: Number(r.ca_score),
          exam_score: Number(r.exam_score),
          total: Number(r.total),
          grade: r.grade,
        })),
        ranking: ranking.get(student.id) ?? null,
      };
    })
  );

  const buffer = await renderToBuffer(BulkReportCardDocument({ cards }));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${klass.name.replace(/\s+/g, "_")}_report_cards.pdf"`,
    },
  });
}
