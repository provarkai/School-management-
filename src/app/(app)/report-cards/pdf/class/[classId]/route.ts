import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { BulkReportCardDocument, type ReportCardData } from "@/lib/pdf/ReportCardDocument";
import { getReportCardExtras } from "@/lib/reportCardData";
import { computeClassRanking } from "@/lib/ranking";
import { proprietorTitle } from "@/lib/format";
import type { Term } from "@/lib/types";
import { safeFilename } from "@/lib/csv";

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

  const { data: proprietor } = await supabase
    .from("app_users")
    .select("gender")
    .eq("school_id", school.id)
    .eq("role", "proprietor")
    .limit(1)
    .maybeSingle();
  const proprietorLabel = proprietorTitle(proprietor?.gender ?? null);

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, admission_number")
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name");

  const term = school.current_term as Term;
  const ranking = await computeClassRanking(supabase, classId, school.current_session, term);

  const cards: ReportCardData[] = await Promise.all(
    (students ?? []).map(async (student) => {
      const [extras, { data: remarks }] = await Promise.all([
        getReportCardExtras(
          supabase,
          school.id,
          student.id,
          classId,
          school.current_session,
          term
        ),
        supabase
          .from("report_remarks")
          .select("teacher_remark, principal_remark")
          .eq("student_id", student.id)
          .eq("session", school.current_session)
          .eq("term", term)
          .maybeSingle(),
      ]);

      return {
        school: {
          name: school.name,
          address: school.address,
          phone: school.phone,
          logo_url: school.logo_url,
          current_session: school.current_session,
          proprietorLabel,
        },
        student: {
          full_name: student.full_name,
          className: klass.name,
          admissionNumber: student.admission_number,
        },
        term,
        extras,
        ranking: ranking.get(student.id) ?? null,
        remarks: remarks
          ? { teacher: remarks.teacher_remark, principal: remarks.principal_remark }
          : null,
      };
    })
  );

  const buffer = await renderToBuffer(BulkReportCardDocument({ cards }));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(`${klass.name}_report_cards.pdf`)}"`,
    },
  });
}
