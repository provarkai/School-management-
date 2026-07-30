"use client";

import { useState } from "react";
import Papa from "papaparse";
import { bulkImportStaff, type StaffImportResult, type StaffImportRow } from "../actions";

export function ImportForm() {
  const [rows, setRows] = useState<StaffImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StaffImportResult | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    Papa.parse<StaffImportRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => setRows(results.data),
    });
  }

  async function handleImport() {
    setBusy(true);
    setResult(null);
    try {
      const res = await bulkImportStaff(rows);
      setResult(res);
      if (res.imported) setRows([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="mx-auto block text-sm text-zinc-600"
        />
        <p className="mt-3 text-xs text-zinc-400">
          Columns: name (required), email (required), phone, role (teacher or staff),
          subject, job_title, campus_name
        </p>
      </div>

      {fileName && rows.length > 0 && (
        <div className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
          Parsed <strong>{rows.length}</strong> row(s) from {fileName}.
        </div>
      )}

      {result?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>
      )}
      {result?.imported !== undefined && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Imported {result.imported} staff member(s).
        </p>
      )}
      {!!result?.credentials?.length && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Name</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Email</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Temp password</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {result.credentials.map((c) => (
                <tr key={c.row}>
                  <td className="px-3 py-2 text-zinc-900">{c.name}</td>
                  <td className="px-3 py-2 text-zinc-500">{c.email}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-zinc-900">{c.tempPassword}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-400">
            Share these securely — each person can change their password after signing in.
          </p>
        </div>
      )}
      {!!result?.skipped?.length && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">Skipped rows:</p>
          <ul className="mt-1 list-inside list-disc">
            {result.skipped.map((s) => (
              <li key={s.row}>
                Row {s.row}: {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        disabled={rows.length === 0 || busy}
        onClick={handleImport}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {busy ? "Importing…" : `Import ${rows.length || ""} staff member(s)`}
      </button>
    </div>
  );
}
