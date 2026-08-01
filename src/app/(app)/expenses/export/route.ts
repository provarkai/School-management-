import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { parseExportFormat, exportRows } from "@/lib/export";
import { fetchExpensesExportRows, EXPENSES_EXPORT_COLUMNS } from "@/lib/expensesExport";

export async function GET(request: Request) {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const categoryFilter = searchParams.get("category");
  const campusFilter = searchParams.get("campus");

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const rows = await fetchExpensesExportRows(supabase, profile.school_id ?? "", session, term, {
    categoryFilter,
    campusFilter,
  });

  const format = parseExportFormat(searchParams);
  return exportRows(
    format,
    rows,
    EXPENSES_EXPORT_COLUMNS,
    `expenses-${session.replace("/", "-")}-term${term}`,
    school
      ? { name: school.name, address: school.address, phone: school.phone }
      : undefined
  );
}
