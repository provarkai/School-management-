import Link from "next/link";
import { fetchAllRows } from "@/lib/fetchAll";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { Chat } from "../assistant/Chat";
import { CampusFilter } from "../CampusFilter";
import { UpcomingEvents } from "./UpcomingEvents";
import { RecentActivity } from "./RecentActivity";
import { DEFAULT_QUICK_LINKS, getQuickLinkOption } from "@/lib/quickLinks";
import { DEFAULT_DASHBOARD_WIDGETS } from "@/lib/dashboardWidgets";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string }>;
}) {
  const { profile, school, isManager } = await requireUser();
  const { campus: campusFilter } = await searchParams;
  const supabase = await createClient();

  if (profile.role === "teacher" && !isManager) {
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

        <UpcomingEvents schoolId={profile.school_id ?? ""} />

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

  if (profile.role === "staff" && !isManager) {
    const { data: notices } = await supabase
      .from("staff_notices")
      .select("id, title, body, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Welcome, {profile.name}</h1>
          <p className="text-sm text-zinc-500">{profile.job_title ?? "Staff"}</p>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Latest notices
            </h2>
            <Link href="/notices" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {(notices ?? []).map((n) => (
              <div key={n.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="font-semibold text-zinc-900">{n.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{n.body}</p>
              </div>
            ))}
            {(notices ?? []).length === 0 && (
              <p className="text-sm text-zinc-400">No notices yet.</p>
            )}
          </div>
        </div>

        <UpcomingEvents schoolId={profile.school_id ?? ""} />
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
    // Both of these carry one row per student (per fee type, in the fee
    // case), so they outgrow a single request well before the school
    // outgrows the app — and a short read would quietly understate the
    // term's collections on the front page.
    fetchAllRows<{ amount_expected: number; amount_paid: number }>((from, to) => {
      let query = supabase
        .from("fee_summary")
        .select("amount_expected, amount_paid")
        .eq("session", school?.current_session ?? "")
        .eq("term", school?.current_term ?? "1");
      if (campusStudentIds) query = query.in("student_id", campusStudentIds.length ? campusStudentIds : ["00000000-0000-0000-0000-000000000000"]);
      return query.order("fee_record_id").range(from, to);
    }),
    fetchAllRows<{ status: string }>((from, to) => {
      let query = supabase
        .from("attendance")
        .select("status")
        .eq("date", new Date().toISOString().slice(0, 10));
      if (campusClassIds) query = query.in("class_id", campusClassIds.length ? campusClassIds : ["00000000-0000-0000-0000-000000000000"]);
      return query.order("id").range(from, to);
    }),
  ]);

  const expected = feeRows.reduce((sum, r) => sum + Number(r.amount_expected), 0);
  const collected = feeRows.reduce((sum, r) => sum + Number(r.amount_paid), 0);
  const owingCount = feeRows.filter(
    (r) => Number(r.amount_paid) < Number(r.amount_expected)
  ).length;

  const present = todaysAttendance.filter((a) => a.status === "present").length;
  const marked = todaysAttendance.length;
  const attendanceRate = marked ? Math.round((present / marked) * 100) : null;

  const widgets: Record<string, React.ReactNode> = {
    summary_cards: (
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
    ),
    quick_links: (
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Quick links
        </h2>
        <div className="flex flex-wrap gap-3">
          {(school?.quick_links?.length ? school.quick_links : DEFAULT_QUICK_LINKS).map((key) => {
            const option = getQuickLinkOption(key);
            if (!option) return null;
            const label = key === "fees_owing" ? `View owing students (${owingCount})` : option.label;
            return <QuickLink key={key} href={option.href} label={label} />;
          })}
        </div>
      </div>
    ),
    upcoming_events: <UpcomingEvents schoolId={profile.school_id ?? ""} />,
    ai_assistant: (
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
    ),
    recent_activity: <RecentActivity schoolId={profile.school_id ?? ""} />,
  };

  const widgetOrder =
    profile.dashboard_widgets && profile.dashboard_widgets.length > 0
      ? profile.dashboard_widgets
      : DEFAULT_DASHBOARD_WIDGETS;

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

      {widgetOrder.map((key) => <div key={key}>{widgets[key]}</div>)}
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
