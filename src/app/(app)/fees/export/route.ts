import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { parseExportFormat, exportRows } from "@/lib/export";
import { fetchFeesExportRows, FEES_EXPORT_COLUMNS } from "@/lib/feesExport";

export async function GET(request: Request) {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const classFilter = searchParams.get("class");
  const statusFilter = searchParams.get("status");
  const typeParam = searchParams.get("type");

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: feeTypes } = await supabase
    .from("fee_types")
    .select("id")
    .eq("school_id", profile.school_id ?? "");
  const typeFilter = typeParam === "all" ? null : typeParam || feeTypes?.[0]?.id || null;

  const rows = await fetchFeesExportRows(supabase, profile.school_id ?? "", session, term, {
    classFilter,
    statusFilter,
    typeFilter,
  });

  const format = parseExportFormat(searchParams);
  return exportRows(
    format,
    rows,
    FEES_EXPORT_COLUMNS,
    `fees-${session.replace("/", "-")}-term${term}`,
    school
      ? { name: school.name, address: school.address, phone: school.phone }
      : undefined
  );
}
