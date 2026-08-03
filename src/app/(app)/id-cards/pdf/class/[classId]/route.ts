import { renderToBuffer } from "@react-pdf/renderer";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { IdCardSheetDocument, type IdCardData } from "@/lib/pdf/IdCardDocument";
import type { Term } from "@/lib/types";
import { safeFilename } from "@/lib/csv";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const { school } = await requireProprietor();
  const supabase = await createClient();

  const { data: klass } = await supabase.from("classes").select("name").eq("id", classId).single();
  if (!klass || !school) {
    return new Response("Class not found", { status: 404 });
  }

  const { data: students } = await supabase
    .from("students")
    .select(
      "full_name, admission_number, photo_url, blood_group, genotype, date_of_birth, access_token"
    )
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name");

  if (!students || students.length === 0) {
    return new Response("No active students in this class", { status: 404 });
  }

  const cards: IdCardData[] = students.map((s) => ({
    fullName: s.full_name,
    className: klass.name,
    admissionNumber: s.admission_number,
    photoUrl: s.photo_url,
    bloodGroup: s.blood_group,
    genotype: s.genotype,
    dateOfBirth: s.date_of_birth,
    verificationCode: s.access_token.slice(0, 8).toUpperCase(),
  }));

  const buffer = await renderToBuffer(
    IdCardSheetDocument({
      students: cards,
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
      "Content-Disposition": `inline; filename="${safeFilename(`id-cards-${klass.name}.pdf`)}"`,
    },
  });
}
