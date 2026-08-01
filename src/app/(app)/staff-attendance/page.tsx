import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { StaffAttendanceGrid } from "./StaffAttendanceGrid";
import type { AttendanceStatus } from "@/lib/types";

export default async function StaffAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { profile } = await requireProprietor();
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const date = dateParam || today;
  const monthStart = `${date.slice(0, 7)}-01`;

  const [{ data: staff }, { data: existingRows }, { data: monthRows }] = await Promise.all([
    supabase
      .from("app_users")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .in("role", ["teacher", "staff"])
      .order("name"),
    supabase
      .from("staff_attendance")
      .select("staff_id, status")
      .eq("school_id", profile.school_id ?? "")
      .eq("date", date),
    supabase
      .from("staff_attendance")
      .select("staff_id, status")
      .eq("school_id", profile.school_id ?? "")
      .gte("date", monthStart)
      .lte("date", date),
  ]);

  const existing: Record<string, AttendanceStatus> = Object.fromEntries(
    (existingRows ?? []).map((r) => [r.staff_id, r.status as AttendanceStatus])
  );

  const lateByStaff = new Map<string, number>();
  const absentByStaff = new Map<string, number>();
  for (const row of monthRows ?? []) {
    if (row.status === "late") lateByStaff.set(row.staff_id, (lateByStaff.get(row.staff_id) ?? 0) + 1);
    if (row.status === "absent")
      absentByStaff.set(row.staff_id, (absentByStaff.get(row.staff_id) ?? 0) + 1);
  }

  const summary = (staff ?? [])
    .map((s) => ({
      name: s.name,
      late: lateByStaff.get(s.id) ?? 0,
      absent: absentByStaff.get(s.id) ?? 0,
    }))
    .filter((s) => s.late > 0 || s.absent > 0)
    .sort((a, b) => b.late + b.absent - (a.late + a.absent));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Staff Attendance</h1>
        <p className="text-sm text-zinc-500">
          Daily present/late/absent for accountability — separate from payroll. Use the lateness
          count below when deciding a payroll deduction.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm font-medium text-zinc-700">
          Date
          <input
            type="date"
            name="date"
            defaultValue={date}
            max={today}
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Go
        </button>
      </form>

      <StaffAttendanceGrid date={date} staff={staff ?? []} existing={existing} />

      {summary.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {date.slice(0, 7)} lateness &amp; absence
          </h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Staff</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Late</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {summary.map((s) => (
                  <tr key={s.name}>
                    <td className="px-4 py-2 font-medium text-zinc-900">{s.name}</td>
                    <td className="px-4 py-2 text-right text-amber-600">{s.late || "—"}</td>
                    <td className="px-4 py-2 text-right text-red-600">{s.absent || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
