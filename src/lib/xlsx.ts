import ExcelJS from "exceljs";
import { safeFilename } from "./csv";

export interface XlsxSchoolInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
}

/** Prepends a school name/address/phone letterhead above the header row —
 * shared by both the single-sheet and multi-sheet workbook builders so
 * every downloaded sheet is self-identifying. */
export function addLetterhead(sheet: ExcelJS.Worksheet, school: XlsxSchoolInfo | undefined, columnCount: number): void {
  if (!school) return;
  const nameRow = sheet.addRow([school.name]);
  nameRow.font = { bold: true, size: 13 };
  sheet.mergeCells(nameRow.number, 1, nameRow.number, Math.max(columnCount, 1));
  if (school.address) {
    sheet.addRow([school.address]);
  }
  if (school.phone) {
    sheet.addRow([`Tel: ${school.phone}`]);
  }
  sheet.addRow([]);
}

export async function toXlsxBuffer(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  school?: XlsxSchoolInfo
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.columns = columns.map(() => ({ width: 20 }));

  addLetterhead(sheet, school, columns.length);
  const headerRow = sheet.addRow(columns.map((c) => c.label));
  headerRow.font = { bold: true };
  for (const row of rows) sheet.addRow(columns.map((c) => row[c.key]));

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function xlsxResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFilename(filename)}"`,
    },
  });
}

export function jsonResponse(
  rows: Record<string, unknown>[],
  filename: string,
  school?: XlsxSchoolInfo
): Response {
  const body = school ? { school, rows } : rows;
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(filename)}"`,
    },
  });
}
