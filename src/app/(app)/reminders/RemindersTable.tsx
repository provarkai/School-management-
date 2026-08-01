"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { sendBulkReminders, type BulkReminderResult } from "./actions";
import { naira } from "@/lib/format";

interface OwingStudent {
  id: string;
  full_name: string;
  className: string;
  parent_phone: string | null;
  balance: number;
}

export function RemindersTable({ students }: { students: OwingStudent[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(students.map((s) => s.id)));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkReminderResult | null>(null);
  const [query, setQuery] = useState("");

  const filtered = query
    ? students.filter((s) =>
        `${s.full_name} ${s.className}`.toLowerCase().includes(query.trim().toLowerCase())
      )
    : students;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === students.length ? new Set() : new Set(students.map((s) => s.id))));
  }

  function handleSend() {
    setResult(null);
    startTransition(async () => {
      const res = await sendBulkReminders(Array.from(selected));
      setResult(res);
    });
  }

  return (
    <div className="space-y-4">
      {result && (
        <div className="rounded-md bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          <p>
            Sent {result.sent} reminder(s){result.mocked ? " (mock mode — set TERMII_API_KEY to send for real)" : ""}.
            {result.skippedNoPhone > 0 && ` ${result.skippedNoPhone} skipped (no phone on file).`}
          </p>
          {result.failed.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-red-700">
              {result.failed.map((f) => (
                <li key={f.studentName}>
                  {f.studentName}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <input
        type="search"
        placeholder="Search owing students…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-xs rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === students.length && students.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Student</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Class</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Parent phone</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                </td>
                <td className="px-4 py-2 font-medium text-zinc-900">
                  <Link href={`/students/${s.id}`} className="hover:underline">
                    {s.full_name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-500">{s.className}</td>
                <td className="px-4 py-2 text-zinc-500">{s.parent_phone ?? "—"}</td>
                <td className="px-4 py-2 text-right font-medium text-red-600">
                  {naira(s.balance)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                  {students.length === 0 ? "No students are currently owing." : "No matches."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        disabled={pending || selected.size === 0}
        onClick={handleSend}
        className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : `Send reminder to ${selected.size} parent(s)`}
      </button>
    </div>
  );
}
