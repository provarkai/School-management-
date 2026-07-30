import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getExportDataset } from "@/lib/schoolExport";

export async function POST(request: Request) {
  const { profile } = await requireProprietor();
  const formData = await request.formData();

  const password = String(formData.get("password") ?? "");
  const keys = formData.getAll("datasets").map(String);

  const errorRedirect = (message: string) => {
    const url = new URL("/profile", request.url);
    url.searchParams.set("export_error", message);
    return NextResponse.redirect(url, 303);
  };

  if (!password) {
    return errorRedirect("Enter your password to export.");
  }
  if (keys.length === 0) {
    return errorRedirect("Choose at least one dataset to export.");
  }
  if (!profile.email) {
    return errorRedirect("Your account has no email on file — cannot verify password.");
  }

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });
  if (authError) {
    return errorRedirect("Incorrect password.");
  }

  const datasets = keys.map(getExportDataset).filter((d) => d !== undefined);
  if (datasets.length === 0) {
    return errorRedirect("Choose at least one dataset to export.");
  }

  const workbook = new ExcelJS.Workbook();
  for (const dataset of datasets) {
    const rows = await dataset.fetch(supabase, profile.school_id ?? "");
    const sheet = workbook.addWorksheet(dataset.label.slice(0, 31));
    sheet.columns = dataset.columns.map((c) => ({ header: c.label, key: c.key, width: 20 }));
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="school_export.xlsx"`,
    },
  });
}
