import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ReportCardDocument } from "@/lib/pdf/ReportCardDocument";
import { computeClassRanking } from "@/lib/ranking";
import { proprietorTitle } from "@/lib/format";
import type { Term } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const { school } = await requireUser();
  const supabase = await createClient();

  const { data: proprietor } = school
    ? await supabase
        .from("app_users")
        .select("gender")
        .eq("school_id", school.id)
        .eq("role", "proprietor")
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: student } = await supabase
    .from("students")
    .select("full_name, class_id")
    .eq("id", studentId)
    .single();

  if (!student || !school) {
    return new Response("Student not found", { status: 404 });
  }

  const { data: klass } = student.class_id
    ? await supabase.from("classes").select("name").eq("id", student.class_id).single()
    : { data: null };

  const term = school.current_term as Term;

  const { data: results } = await supabase
    .from("results")
    .select("subject, ca_score, exam_score, total, grade")
    .eq("student_id", studentId)
    .eq("session", school.current_session)
    .eq("term", term)
    .order("subject");

  const ranking = student.class_id
    ? (await computeClassRanking(supabase, student.class_id, school.current_session, term)).get(studentId) ?? null
    : null;

  const { data: remarks } = await supabase
    .from("report_remarks")
    .select("teacher_remark, principal_remark")
    .eq("student_id", studentId)
    .eq("session", school.current_session)
    .eq("term", term)
    .maybeSingle();

  const buffer = await renderToBuffer(
    ReportCardDocument({
      school: {
        name: school.name,
        address: school.address,
        phone: school.phone,
        logo_url: school.logo_url,
        current_session: school.current_session,
        proprietorLabel: proprietorTitle(proprietor?.gender ?? null),
      },
      student: { full_name: student.full_name, className: klass?.name ?? "—" },
      term,
      results: (results ?? []).map((r) => ({
        subject: r.subject,
        ca_score: Number(r.ca_score),
        exam_score: Number(r.exam_score),
        total: Number(r.total),
        grade: r.grade,
      })),
      ranking,
      remarks: remarks
        ? { teacher: remarks.teacher_remark, principal: remarks.principal_remark }
        : null,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${student.full_name.replace(/\s+/g, "_")}_report_card.pdf"`,
    },
  });
}
