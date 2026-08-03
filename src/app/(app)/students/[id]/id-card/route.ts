import { renderToBuffer } from "@react-pdf/renderer";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { IdCardSheetDocument, type IdCardData } from "@/lib/pdf/IdCardDocument";
import type { Term } from "@/lib/types";

/** Single-card reprint — a lost or damaged card doesn't need the whole
 * class run again. Renders through the same sheet document as one card on
 * an otherwise-empty page, so a reprint looks identical to the original. */
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
      "full_name, class_id, admission_number, photo_url, blood_group, genotype, date_of_birth, access_token"
    )
    .eq("id", id)
    .eq("school_id", profile.school_id ?? "")
    .single();

  if (!student || !school) {
    return new Response("Student not found", { status: 404 });
  }

  const { data: klass } = student.class_id
    ? await supabase.from("classes").select("name").eq("id", student.class_id).single()
    : { data: null };

  const card: IdCardData = {
    fullName: student.full_name,
    className: klass?.name ?? "—",
    admissionNumber: student.admission_number,
    photoUrl: student.photo_url,
    bloodGroup: student.blood_group,
    genotype: student.genotype,
    dateOfBirth: student.date_of_birth,
    verificationCode: student.access_token.slice(0, 8).toUpperCase(),
  };

  const buffer = await renderToBuffer(
    IdCardSheetDocument({
      students: [card],
      school: {
        name: school.name,
        address: school.address,
        phone: school.phone,
        logo_url: school.logo_url,
      },
      session: school.current_session,
      term: school.current_term as Term,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="id-card-${student.full_name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
