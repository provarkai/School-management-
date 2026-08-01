import Link from "next/link";
import { requireLiteralProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { SalaryForm } from "./SalaryForm";
import { GeneratePayrollForm } from "./GeneratePayrollForm";
import { DeductionTypesManager } from "./DeductionTypesManager";
import { TableSearch } from "@/components/TableSearch";
import { proprietorTitle } from "@/lib/format";
import type { Gender } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  teacher: "Teacher",
  staff: "Non-teaching staff",
};

function roleLabel(role: string, gender: Gender | null): string {
  return role === "proprietor" ? proprietorTitle(gender) : ROLE_LABELS[role] ?? role;
}

export default async function PayrollPage() {
  const { profile } = await requireLiteralProprietor();
  const supabase = await createClient();

  const [{ data: staff }, { data: salaries }, { data: runs }, { data: deductionTypes }] = await Promise.all([
    supabase
      .from("app_users")
      .select("id, name, role, gender")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("staff_salaries")
      .select("staff_id, monthly_salary")
      .eq("school_id", profile.school_id ?? ""),
    supabase
      .from("payroll_runs")
      .select("id, period, status, paid_at")
      .eq("school_id", profile.school_id ?? "")
      .order("period", { ascending: false }),
    supabase
      .from("deduction_types")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
  ]);

  const salaryByStaffId = new Map((salaries ?? []).map((s) => [s.staff_id, Number(s.monthly_salary)]));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Payroll</h1>
        <p className="text-sm text-zinc-500">Set staff salaries, then generate a monthly payroll run.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Staff salaries</h2>
        <div data-search-scope className="space-y-3">
          <TableSearch placeholder="Search staff…" />
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Name</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Type</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Monthly salary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(staff ?? []).map((person) => (
                <tr
                  key={person.id}
                  data-search-row={`${person.name} ${roleLabel(person.role, person.gender)}`}
                >
                  <td className="px-4 py-2 text-zinc-900">
                    {person.role === "proprietor" ? (
                      person.name
                    ) : (
                      <Link href={`/staff/${person.id}`} className="font-medium hover:underline">
                        {person.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{roleLabel(person.role, person.gender)}</td>
                  <td className="px-4 py-2">
                    <SalaryForm staffId={person.id} currentSalary={salaryByStaffId.get(person.id) ?? 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <DeductionTypesManager deductionTypes={deductionTypes ?? []} />

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Run payroll</h2>
        <GeneratePayrollForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Payroll history</h2>
        {(runs ?? []).length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
            No payroll runs yet.
          </p>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <ul className="divide-y divide-zinc-100">
              {(runs ?? []).map((run) => (
                <li key={run.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{run.period}</p>
                    <p className="text-xs text-zinc-400">
                      {run.status === "paid" ? `Paid ${run.paid_at?.slice(0, 10)}` : "Draft"}
                    </p>
                  </div>
                  <Link
                    href={`/payroll/${run.id}`}
                    className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    View →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
