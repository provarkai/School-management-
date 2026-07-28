import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export default async function AttendanceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; from?: string; to?: string }>;
}) {
  await requireProprietor();
  const { class: classParam, from, to } = await searchParams;
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const fromDate = from || today;
  const toDate = to || today;

  const { data: classes } = await supabase.from("classes").select("id, name").order("name");
  const selectedClassId = classParam || classes?.[0]?.id;

  let rows: { date: string; status: string; student_id: string }[] = [];
  let studentNameById = new Map<string, string>();

  if (selectedClassId) {
    const [{ data: attendance }, { data: students }] = await Promise.all([
      supabase
        .from("attendance")
        .select("date, status, student_id")
        .eq("class_id", selectedClassId)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: false }),
      supabase.from("students").select("id, full_name").eq("class_id", selectedClassId),
    ]);
    rows = attendance ?? [];
    studentNameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));
  }

  const byDate = new Map<string, { present: number; absent: number; late: number }>();
  for (const r of rows) {
    const bucket = byDate.get(r.date) ?? { present: 0, absent: 0, late: 0 };
    bucket[r.status as "present" | "absent" | "late"]++;
    byDate.set(r.date, bucket);
  }
  const dailySummaries = Array.from(byDate.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Attendance history</h1>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm font-medium text-zinc-700">
          Class
          <select
            name="class"
            defaultValue={selectedClassId}
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          >
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          From
          <input
            type="date"
            name="from"
            defaultValue={fromDate}
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          To
          <input
            type="date"
            name="to"
            defaultValue={toDate}
            max={today}
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Date</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Present</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Late</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Absent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {dailySummaries.map(([date, s]) => (
              <tr key={date}>
                <td className="px-4 py-2 font-medium text-zinc-900">{date}</td>
                <td className="px-4 py-2 text-right text-emerald-600">{s.present}</td>
                <td className="px-4 py-2 text-right text-amber-600">{s.late}</td>
                <td className="px-4 py-2 text-right text-red-600">{s.absent}</td>
              </tr>
            ))}
            {dailySummaries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                  No attendance recorded in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <details className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm">
          <summary className="cursor-pointer font-medium text-zinc-700">
            Per-student detail
          </summary>
          <div className="mt-3 overflow-hidden rounded-md border border-zinc-100">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Student</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r, i) => (
                  <tr key={`${r.student_id}-${r.date}-${i}`}>
                    <td className="px-3 py-1.5 text-zinc-500">{r.date}</td>
                    <td className="px-3 py-1.5 text-zinc-900">
                      {studentNameById.get(r.student_id) ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 capitalize text-zinc-500">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
