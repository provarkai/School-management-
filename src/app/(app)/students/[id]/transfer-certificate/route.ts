import { renderToBuffer } from "@react-pdf/renderer";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { TransferCertificateDocument } from "@/lib/pdf/TransferCertificateDocument";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select(
      "full_name, class_id, admission_number, date_of_birth, gender, admission_date, status, withdrawn_at, withdrawal_reason, conduct_remark"
    )
    .eq("id", id)
    .eq("school_id", profile.school_id ?? "")
    .single();

  if (!student || !school) {
    return new Response("Student not found", { status: 404 });
  }

  if (student.status !== "withdrawn" || !student.withdrawn_at) {
    return new Response(
      "This student has not been withdrawn — mark them withdrawn on their profile first.",
      { status: 400 }
    );
  }

  const { data: klass } = student.class_id
    ? await supabase.from("classes").select("name").eq("id", student.class_id).single()
    : { data: null };

  // Deterministic and unique without a counter column, matching how
  // invoice/receipt numbers are already built.
  const certificateNumber = `TC-${student.withdrawn_at.replace(/\D/g, "")}-${id
    .slice(0, 8)
    .toUpperCase()}`;

  const buffer = await renderToBuffer(
    TransferCertificateDocument({
      school: {
        name: school.name,
        address: school.address,
        phone: school.phone,
        logo_url: school.logo_url,
      },
      certificateNumber,
      issuedDate: new Date().toISOString().slice(0, 10),
      student: {
        full_name: student.full_name,
        admissionNumber: student.admission_number,
        dateOfBirth: student.date_of_birth,
        gender: student.gender,
        className: klass?.name ?? "—",
      },
      admissionDate: student.admission_date,
      withdrawnDate: student.withdrawn_at,
      reason: student.withdrawal_reason,
      conductRemark: student.conduct_remark,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${certificateNumber}.pdf"`,
    },
  });
}
