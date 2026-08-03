import Link from "next/link";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { TableSearch } from "@/components/TableSearch";

export default async function TransferCertificatesPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, admission_number, class_id, withdrawn_at, withdrawal_reason")
    .eq("school_id", profile.school_id ?? "")
    .eq("status", "withdrawn")
    .order("withdrawn_at", { ascending: false });

  const classIds = Array.from(
    new Set((students ?? []).map((s) => s.class_id).filter((id): id is string => !!id))
  );
  const { data: classes } =
    classIds.length > 0
      ? await supabase.from("classes").select("id, name").in("id", classIds)
      : { data: [] };
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Transfer Certificates</h1>
        <p className="text-sm text-zinc-500">
          Every withdrawn student. To withdraw a student, open their profile and use
          &ldquo;Withdraw student / issue transfer certificate&rdquo;.
        </p>
      </div>

      <div data-search-scope className="space-y-3">
        <TableSearch placeholder="Search withdrawn students…" />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Student</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Last class</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Date left</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Reason</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(students ?? []).map((s) => (
                <tr
                  key={s.id}
                  data-search-row={`${s.full_name} ${s.admission_number ?? ""}`}
                >
                  <td className="px-4 py-2 font-medium text-zinc-900">
                    <Link href={`/students/${s.id}`} className="hover:underline">
                      {s.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {s.class_id ? classNameById.get(s.class_id) ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{s.withdrawn_at ?? "—"}</td>
                  <td className="px-4 py-2 text-zinc-500">{s.withdrawal_reason ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`/students/${s.id}/transfer-certificate`}
                      className="font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      Download →
                    </a>
                  </td>
                </tr>
              ))}
              {(students ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                    No students have been withdrawn yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
