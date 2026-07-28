import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export default async function ReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { profile } = await requireUser();
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  let classesQuery = supabase.from("classes").select("id, name").order("name");
  if (profile.role === "teacher") {
    classesQuery = classesQuery.eq("teacher_id", profile.id);
  }
  const { data: classes } = await classesQuery;
  const selectedClassId = classParam || classes?.[0]?.id;

  const { data: students } = selectedClassId
    ? await supabase
        .from("students")
        .select("id, full_name")
        .eq("class_id", selectedClassId)
        .eq("status", "active")
        .order("full_name")
    : { data: [] };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Report cards</h1>
        {selectedClassId && (
          <a
            href={`/report-cards/pdf/class/${selectedClassId}`}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Generate PDFs for whole class
          </a>
        )}
      </div>

      {(classes ?? []).length > 1 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {(classes ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/report-cards?class=${c.id}`}
              className={`rounded-full px-3 py-1 ${
                selectedClassId === c.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Student</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(students ?? []).map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium text-zinc-900">{s.full_name}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-4">
                    <Link
                      href={`/report-cards/${s.id}`}
                      className="font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      Enter scores
                    </Link>
                    <a
                      href={`/report-cards/pdf/${s.id}`}
                      className="font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      Download PDF
                    </a>
                  </div>
                </td>
              </tr>
            ))}
            {(students ?? []).length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-zinc-400">
                  No students in this class.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
