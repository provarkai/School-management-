"use client";

import { useActionState, useState } from "react";
import { saveClassScores, scanScoresFromImage, type GridSaveState } from "./actions";
import { PhotoScanButton } from "@/components/PhotoScanButton";

const initialState: GridSaveState = {};

export interface GridComponent {
  id: string;
  name: string;
  kind: string;
  max_score: number;
}

export function GradeGrid({
  classId,
  subjectId,
  students,
  components,
  initial,
}: {
  classId: string;
  subjectId: string;
  students: { id: string; full_name: string }[];
  components: GridComponent[];
  /** `${studentId}_${componentId}` -> score already on file */
  initial: Record<string, number>;
}) {
  const action = saveClassScores.bind(null, classId, subjectId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)]))
  );
  const [scanNote, setScanNote] = useState<string | null>(null);

  async function handleScan(imageDataUrl: string) {
    setScanNote(null);
    const result = await scanScoresFromImage(imageDataUrl, classId, subjectId);
    if (result.error) {
      setScanNote(`⚠️ ${result.error}`);
      return;
    }
    if (result.values) setValues((v) => ({ ...v, ...result.values }));

    const parts = [
      `Matched ${result.matchedCount ?? 0} student${
        result.matchedCount === 1 ? "" : "s"
      } from the photo — review the grid below before saving.`,
    ];
    if (result.unmatchedNames?.length) {
      parts.push(`Unmatched names: ${result.unmatchedNames.join(", ")}.`);
    }
    if (result.unmatchedColumns?.length) {
      parts.push(`Unrecognized columns: ${result.unmatchedColumns.join(", ")}.`);
    }
    setScanNote(parts.join(" "));
  }

  const totalOf = (studentId: string) =>
    components.reduce((sum, c) => {
      const raw = values[`${studentId}_${c.id}`];
      const n = raw === undefined || raw === "" ? 0 : Number(raw);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);

  const maxTotal = components.reduce((sum, c) => sum + Number(c.max_score), 0);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <PhotoScanButton label="Scan mark sheet" onScan={handleScan} />
      {scanNote && (
        <p className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700">{scanNote}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-2 text-left font-medium text-zinc-500">
                Student
              </th>
              {components.map((c) => (
                <th key={c.id} className="px-2 py-2 text-center font-medium text-zinc-500">
                  <span className="whitespace-nowrap">{c.name}</span>
                  <span className="block text-[10px] font-normal text-zinc-400">
                    /{Number(c.max_score)}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-zinc-500">
                Total
                <span className="block text-[10px] font-normal text-zinc-400">/{maxTotal}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {students.map((student) => {
              const total = totalOf(student.id);
              const anyEntered = components.some(
                (c) => (values[`${student.id}_${c.id}`] ?? "") !== ""
              );
              return (
                <tr key={student.id}>
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-zinc-900">
                    {student.full_name}
                  </td>
                  {components.map((c) => {
                    const key = `${student.id}_${c.id}`;
                    const value = values[key] ?? "";
                    const over = value !== "" && Number(value) > Number(c.max_score);
                    return (
                      <td key={c.id} className="px-2 py-2 text-center">
                        <input
                          name={`score_${key}`}
                          value={value}
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          inputMode="decimal"
                          className={`w-16 rounded-md border px-2 py-1 text-center text-sm shadow-sm focus:outline-none focus:ring-1 ${
                            over
                              ? "border-red-400 text-red-700 focus:border-red-500 focus:ring-red-500"
                              : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-500"
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      anyEntered ? "text-zinc-900" : "text-zinc-300"
                    }`}
                  >
                    {anyEntered ? total : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save all scores"}
        </button>
        <p className="text-xs text-zinc-400">
          Leave a cell blank if it hasn&rsquo;t been marked yet — blank isn&rsquo;t saved as
          zero.
        </p>
      </div>
    </form>
  );
}
