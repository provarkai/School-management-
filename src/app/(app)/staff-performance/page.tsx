import Link from "next/link";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getStaffPerformance } from "@/lib/staffPerformance";
import { BarChart } from "@/components/BarChart";
import { TableSearch } from "@/components/TableSearch";

const ROLE_LABELS: Record<string, string> = {
  teacher: "Teacher",
  staff: "Non-teaching staff",
};

export default async function StaffPerformancePage() {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { rows, schoolWideDays } = await getStaffPerformance(
    supabase,
    profile.school_id ?? "",
    session,
    term
  );

  const withClasses = rows.filter((r) => r.classesTaught.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Staff Performance</h1>
        <p className="text-sm text-zinc-500">
          {session} · Term {term} — derived from attendance, results, assignments and behavior
          records already on file.
        </p>
      </div>

      {withClasses.length > 0 && schoolWideDays > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">
            Attendance marking rate by class teacher
          </h2>
          <p className="mb-3 text-xs text-zinc-400">
            Share of the {schoolWideDays} school day{schoolWideDays === 1 ? "" : "s"} recorded so
            far this term that each teacher&rsquo;s class register was marked on.
          </p>
          <BarChart
            points={withClasses.map((r) => ({
              label: r.name.split(" ")[0],
              value: Math.round((r.attendanceDaysMarked / schoolWideDays) * 100),
            }))}
            formatValue={(v) => `${v}%`}
          />
        </section>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No teaching or non-teaching staff on record yet.
        </p>
      ) : (
        <div data-search-scope className="space-y-4">
          <TableSearch placeholder="Search staff…" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.staffId}
              data-search-row={`${r.name} ${r.jobTitle ?? ""} ${r.classesTaught.join(" ")}`}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    <Link href={`/staff/${r.staffId}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </p>
                  <p className="text-xs text-zinc-400">
                    {r.jobTitle || ROLE_LABELS[r.role] || r.role}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                  {r.classesTaught.length > 0 ? r.classesTaught.join(", ") : "No class assigned"}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Stat
                  label="Results entered"
                  value={
                    r.totalStudents > 0 ? `${r.studentsWithResults}/${r.totalStudents} students` : "—"
                  }
                />
                <Stat
                  label="Average score"
                  value={r.averageScore !== null ? `${r.averageScore.toFixed(1)}%` : "—"}
                />
                <Stat
                  label="Attendance marked"
                  value={
                    schoolWideDays > 0 && r.classesTaught.length > 0
                      ? `${r.attendanceDaysMarked}/${schoolWideDays} days`
                      : "—"
                  }
                />
                <Stat label="Assignments issued" value={String(r.assignmentsIssued)} />
                <Stat label="Merits recorded" value={String(r.meritsRecorded)} />
                <Stat label="Demerits recorded" value={String(r.demeritsRecorded)} />
              </dl>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
