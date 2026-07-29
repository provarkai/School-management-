import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { Chat } from "../assistant/Chat";
import { CampusFilter } from "../CampusFilter";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const { profile, school } = await requireUser();
  const { campus: campusFilter } = await searchParams;
  const supabase = await createClient();

  if (profile.role === "teacher") {
    const { data: myClasses } = await supabase
      .from("classes")
      .select("id, name")
      .eq("teacher_id", profile.id);

    const classIds = (myClasses ?? []).map((c) => c.id);
    const { count: studentCount } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .in("class_id", classIds.length ? classIds : ["00000000-0000-0000-0000-000000000000"]);

    const today = new Date().toISOString().slice(0, 10);
    const { data: todaysAttendance } = await supabase
      .from("attendance")
      .select("status")
      .eq("date", today)
      .in("class_id", classIds.length ? classIds : ["00000000-0000-0000-0000-000000000000"]);

    const present = (todaysAttendance ?? []).filter((a) => a.status === "present").length;
    const marked = todaysAttendance?.length ?? 0;

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Welcome, {profile.name}</h1>
          <p className="text-sm text-zinc-500">
            {(myClasses ?? []).map((c) => c.name).join(", ") || "No class assigned yet"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard label="My students" value={String(studentCount ?? 0)} />
          <SummaryCard
            label="Attendance marked today"
            value={marked ? `${present}/${marked} present` : "Not marked yet"}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <QuickLink href="/attendance" label="Mark today's attendance" />
          <QuickLink href="/report-cards" label="Enter scores" />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              AI Assistant
            </h2>
            <Link href="/assistant" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Open full screen →
            </Link>
          </div>
          <Chat heightClassName="h-[420px]" />
        </div>
      </div>
    );
  }

  const { data: campuses } = await supabase
    .from("campuses")
    .select("id, name")
    .eq("school_id", profile.school_id ?? "")
    .order("name");

  let campusClassIds: string[] | null = null;
  let campusStudentIds: string[] | null = null;
  if (campusFilter) {
    const { data: campusClasses } = await supabase
      .from("classes")
      .select("id")
      .eq("campus_id", campusFilter);
    campusClassIds = (campusClasses ?? []).map((c) => c.id);

    const { data: campusStudents } = await supabase
      .from("students")
      .select("id")
      .in("class_id", campusClassIds.length ? campusClassIds : ["00000000-0000-0000-0000-000000000000"]);
    campusStudentIds = (campusStudents ?? []).map((s) => s.id);
  }

  const [{ count: studentCount }, feeRows, todaysAttendance] = await Promise.all([
    (() => {
      let query = supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      if (campusClassIds) query = query.in("class_id", campusClassIds.length ? campusClassIds : ["00000000-0000-0000-0000-000000000000"]);
      return query;
    })(),
    (() => {
      let query = supabase
        .from("fee_summary")
        .select("amount_expected, amount_paid")
        .eq("session", school?.current_session ?? "")
        .eq("term", school?.current_term ?? "1");
      if (campusStudentIds) query = query.in("student_id", campusStudentIds.length ? campusStudentIds : ["00000000-0000-0000-0000-000000000000"]);
      return query;
    })(),
    (() => {
      let query = supabase
        .from("attendance")
        .select("status")
        .eq("date", new Date().toISOString().slice(0, 10));
      if (campusClassIds) query = query.in("class_id", campusClassIds.length ? campusClassIds : ["00000000-0000-0000-0000-000000000000"]);
      return query;
    })(),
  ]);

  const expected = (feeRows.data ?? []).reduce((sum, r) => sum + Number(r.amount_expected), 0);
  const collected = (feeRows.data ?? []).reduce((sum, r) => sum + Number(r.amount_paid), 0);
  const owingCount = (feeRows.data ?? []).filter(
    (r) => Number(r.amount_paid) < Number(r.amount_expected)
  ).length;

  const present = (todaysAttendance.data ?? []).filter((a) => a.status === "present").length;
  const marked = todaysAttendance.data?.length ?? 0;
  const attendanceRate = marked ? Math.round((present / marked) * 100) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            {school?.current_session} · {school ? `Term ${school.current_term}` : ""}
          </p>
        </div>
        {(campuses ?? []).length > 0 && (
          <CampusFilter campuses={campuses ?? []} current={campusFilter ?? ""} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total students" value={String(studentCount ?? 0)} />
        <SummaryCard
          label="Fees collected this term"
          value={`${naira(collected)} / ${naira(expected)}`}
        />
        <SummaryCard
          label="Attendance rate today"
          value={attendanceRate === null ? "Not marked yet" : `${attendanceRate}%`}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Quick links
        </h2>
        <div className="flex flex-wrap gap-3">
          <QuickLink href="/fees?status=owing" label={`View owing students (${owingCount})`} />
          <QuickLink href="/reminders" label="Send bulk reminder" />
          <QuickLink href="/report-cards" label="Generate report cards" />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            AI Assistant
          </h2>
          <Link href="/assistant" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            Open full screen →
          </Link>
        </div>
        <Chat heightClassName="h-[420px]" />
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
    >
      {label}
    </Link>
  );
}
