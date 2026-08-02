import Link from "next/link";

const FEATURE_COLORS = [
  { bg: "bg-indigo-100", text: "text-indigo-600" },
  { bg: "bg-emerald-100", text: "text-emerald-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-rose-100", text: "text-rose-600" },
  { bg: "bg-sky-100", text: "text-sky-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-teal-100", text: "text-teal-600" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-600" },
  { bg: "bg-orange-100", text: "text-orange-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
  { bg: "bg-lime-100", text: "text-lime-700" },
  { bg: "bg-pink-100", text: "text-pink-600" },
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-green-100", text: "text-green-600" },
  { bg: "bg-purple-100", text: "text-purple-600" },
];

const FEATURES: { title: string; description: string; mark: string }[] = [
  {
    mark: "💰",
    title: "Fees & scholarships",
    description:
      "Multiple fee types per term, class-wide bulk pricing, discounts/scholarships, and a full payment history per student.",
  },
  {
    mark: "💳",
    title: "Online payments",
    description:
      "Parents pay a balance online via Paystack — a link you send or a Pay Now button in the parent portal, reconciled automatically.",
  },
  {
    mark: "💬",
    title: "SMS & WhatsApp reminders",
    description: "Automated weekly balance reminders and one-off announcements, sent straight to parents' phones.",
  },
  {
    mark: "🤖",
    title: "AI Assistant",
    description:
      "Ask questions about your students, fees, attendance and results in plain language, answered from your own records.",
  },
  {
    mark: "✅",
    title: "Attendance",
    description: "Mark daily attendance per class in seconds, with full history and exportable reports.",
  },
  {
    mark: "🎓",
    title: "Report cards & results",
    description:
      "CA/exam score entry, auto-computed grades, termly averages and class ranking, and printable PDF report cards.",
  },
  {
    mark: "👪",
    title: "Parent portal",
    description:
      "A dedicated login for parents to see fees, attendance, results, assignments, and upcoming events for each child.",
  },
  {
    mark: "🕒",
    title: "Timetabling",
    description: "Build each class's weekly period grid with automatic double-booking detection for teachers.",
  },
  {
    mark: "🧾",
    title: "Payroll",
    description: "Set staff salaries, run monthly payroll with per-staff deductions, and keep a paid history.",
  },
  {
    mark: "📋",
    title: "Behavior records",
    description: "Log merit and demerit incidents per student, with severity and action taken.",
  },
  {
    mark: "📅",
    title: "Academic calendar",
    description: "Term dates, holidays, exams, and PTA meetings — visible to staff and parents alike.",
  },
  {
    mark: "📄",
    title: "Document management",
    description: "Securely upload and store birth certificates, medical records, and other student documents.",
  },
  {
    mark: "📝",
    title: "Assignments & homework",
    description: "Teachers post class assignments with due dates; parents see what's due for their child.",
  },
  {
    mark: "📊",
    title: "Analytics & reports",
    description: "Trends across every term on record, plus a report builder to export exactly the data you need.",
  },
  {
    mark: "🏫",
    title: "Multi-campus support",
    description: "Run several campuses under one account, each with its own classes, staff, and filtered views.",
  },
];

// TODO: illustrative placeholder numbers — replace with a real live count
// (e.g. a query against the schools table) before this goes in front of
// real prospective schools.
const STATS = [
  { value: "50+", label: "Schools onboard" },
  { value: "12,000+", label: "Students tracked" },
  { value: "₦180M+", label: "Fees processed" },
  { value: "99.9%", label: "Uptime" },
];

const STEPS = [
  {
    color: "bg-indigo-600",
    title: "Sign up",
    description: "Create your account and set up your school in a couple of minutes.",
  },
  {
    color: "bg-emerald-600",
    title: "Add students & staff",
    description: "Bulk-import your student roster, add classes, and invite teachers and staff.",
  },
  {
    color: "bg-amber-500",
    title: "Run your school",
    description: "Track fees, attendance, and results — and keep parents in the loop automatically.",
  },
];

export function LandingPage() {
  return (
    <div className="flex-1">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white">
              S
            </span>
            <span className="text-lg font-bold tracking-tight text-zinc-900">School Manager</span>
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/parent/login"
              className="hidden text-sm font-medium text-zinc-500 hover:text-zinc-900 sm:inline"
            >
              Parent sign in
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-violet-500"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 py-24 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15),_transparent_60%)]" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Everything your school needs to run smoothly
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-indigo-100">
            Fees, attendance, report cards, payroll, and parent communication, with SMS/WhatsApp
            reminders and online payments built in.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-md transition hover:bg-indigo-50"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white py-10">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 sm:grid-cols-4 sm:px-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="bg-gradient-to-br from-indigo-600 to-fuchsia-600 bg-clip-text text-3xl font-bold text-transparent">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Everything, in one place
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const color = FEATURE_COLORS[i % FEATURE_COLORS.length];
              return (
                <div
                  key={f.title}
                  className="rounded-xl border border-zinc-200 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${color.bg}`}
                  >
                    {f.mark}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-zinc-900">{f.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-zinc-50 to-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Up and running in three steps
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="text-center">
                <div
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${step.color}`}
                >
                  {i + 1}
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-900">{step.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">Ready to get started?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-indigo-100">
          Create your school&apos;s account and start tracking fees, attendance, and results today.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-md transition hover:bg-indigo-50"
          >
            Get started
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white py-8 text-center text-xs text-zinc-400">
        <p>School Manager</p>
        <Link href="/privacy" className="mt-1 inline-block underline hover:text-zinc-600">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
