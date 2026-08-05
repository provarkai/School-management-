"use client";

import { useState, useTransition } from "react";
import { submitAttendance, scanAttendanceFromImage } from "./actions";
import { PhotoScanButton } from "@/components/PhotoScanButton";
import type { AttendanceStatus } from "@/lib/types";

const OPTIONS: { value: AttendanceStatus; label: string; styles: string }[] = [
  { value: "present", label: "Present", styles: "bg-emerald-600 text-white" },
  { value: "late", label: "Late", styles: "bg-amber-500 text-white" },
  { value: "absent", label: "Absent", styles: "bg-red-600 text-white" },
];

export function AttendanceGrid({
  classId,
  date,
  students,
  existing,
}: {
  classId: string;
  date: string;
  students: { id: string; full_name: string }[];
  existing: Record<string, AttendanceStatus>;
}) {
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(existing);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null
  );
  const [scanNote, setScanNote] = useState<string | null>(null);

  function setAll(status: AttendanceStatus) {
    setMarks(Object.fromEntries(students.map((s) => [s.id, status])));
  }

  async function handleScan(imageDataUrl: string) {
    setMessage(null);
    setScanNote(null);
    const result = await scanAttendanceFromImage(imageDataUrl, classId);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    if (result.marks) setMarks((m) => ({ ...m, ...result.marks }));

    const parts = [
      `Matched ${result.matchedCount ?? 0} student${
        result.matchedCount === 1 ? "" : "s"
      } from the photo — review below before submitting.`,
    ];
    if (result.unmatched?.length) {
      parts.push(`Couldn't match: ${result.unmatched.join(", ")}.`);
    }
    setScanNote(parts.join(" "));
  }

  function handleSubmit() {
    setMessage(null);
    const entries = students
      .filter((s) => marks[s.id])
      .map((s) => ({ studentId: s.id, status: marks[s.id] }));

    startTransition(async () => {
      const result = await submitAttendance(classId, date, entries);
      if (result.error) setMessage({ type: "error", text: result.error });
      else if (result.success) setMessage({ type: "success", text: result.success });
    });
  }

  const markedCount = Object.keys(marks).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">Quick fill:</span>
        <button
          type="button"
          onClick={() => setAll("present")}
          className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
        >
          Mark all present
        </button>
      </div>

      <PhotoScanButton label="Scan attendance sheet" onScan={handleScan} />
      {scanNote && (
        <p className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700">{scanNote}</p>
      )}

      {message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        {students.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-medium text-zinc-900">{s.full_name}</span>
            <div className="flex gap-1.5">
              {OPTIONS.map((opt) => {
                const active = marks[s.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: opt.value }))}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      active ? opt.styles : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {students.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-zinc-400">
            No students in this class.
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={pending || markedCount === 0}
        onClick={handleSubmit}
        className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : `Submit attendance (${markedCount}/${students.length})`}
      </button>
    </div>
  );
}
