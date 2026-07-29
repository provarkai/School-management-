import Link from "next/link";

const FEATURES: { title: string; description: string }[] = [
  {
    title: "Fees & scholarships",
    description:
      "Multiple fee types per term, class-wide bulk pricing, discounts/scholarships, and a full payment history per student.",
  },
  {
    title: "Online payments",
    description:
      "Parents pay a balance online via Paystack — a link you send or a Pay Now button in the parent portal, reconciled automatically.",
  },
  {
    title: "SMS & WhatsApp reminders",
    description:
      "Automated weekly balance reminders and one-off announcements, sent straight to parents' phones via Termii.",
  },
  {
    title: "Attendance",
    description: "Mark daily attendance per class in seconds, with full history and exportable reports.",
  },
  {
    title: "Report cards & GPA",
    description:
      "CA/exam score entry, auto-computed grades and class ranking, GPA tracking, and printable PDF report cards.",
  },
  {
    title: "Parent portal",
    description:
      "A dedicated login for parents to see fees, attendance, results, assignments, and upcoming events for each child.",
  },
  {
    title: "Timetabling",
    description: "Build each class's weekly period grid with automatic double-booking detection for teachers.",
  },
  {
    title: "Payroll",
    description: "Set staff salaries, run monthly payroll with per-staff deductions, and keep a paid history.",
  },
  {
    title: "Behavior records",
    description: "Log merit and demerit incidents per student, with severity and action taken.",
  },
  {
    title: "Academic calendar",
    description: "Term dates, holidays, exams, and PTA meetings — visible to staff and parents alike.",
  },
  {
    title: "Document management",
    description: "Securely upload and store birth certificates, medical records, and other student documents.",
  },
  {
    title: "Assignments & homework",
    description: "Teachers post class assignments with due dates; parents see what's due for their child.",
  },
  {
    title: "Analytics & reports",
    description: "Trends across every term on record, plus a report builder to export exactly the data you need.",
  },
  {
    title: "Multi-campus support",
    description: "Run several campuses under one account, each with its own classes, staff, and filtered views.",
  },
  {
    title: "AI Assistant",
    description:
      "Ask questions about your students, fees, attendance and results in plain language — answered only from data you already have access to.",
  },
];

const STEPS = [
  {
    title: "Sign up",
    description: "Create your account and set up your school in a couple of minutes.",
  },
  {
    title: "Add students & staff",
    description: "Bulk-import your student roster, add classes, and invite teachers and staff.",
  },
  {
    title: "Run your school",
    description: "Track fees, attendance, and results — and keep parents in the loop automatically.",
  },
];

export function LandingPage() {
  return (
    <div className="flex-1">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-bold tracking-tight text-zinc-900">School Manager</span>
          <nav className="flex items-center gap-4">
            <Link
              href="/parent/login"
              className="hidden text-sm font-medium text-zinc-500 hover:text-zinc-900 sm:inline"
            >
              Parent sign in
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Everything your school needs to run smoothly
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-500">
          Fees, attendance, report cards, payroll, and parent communication — built for Nigerian
          private schools, with SMS/WhatsApp reminders and Paystack payments out of the box.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-700"
          >
            Get started
          </Link>
          <Link
            href="/parent/login"
            className="rounded-md border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            I&apos;m a parent
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-400">
          Every school&apos;s data is kept completely separate — nothing is shared between schools using
          this platform.
        </p>
      </section>

      <section className="border-y border-zinc-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Everything, in one place
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-zinc-200 p-5">
                <p className="text-sm font-semibold text-zinc-900">{f.title}</p>
                <p className="mt-1 text-sm text-zinc-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Up and running in three steps
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white">
                {i + 1}
              </div>
              <p className="mt-3 text-sm font-semibold text-zinc-900">{step.title}</p>
              <p className="mt-1 text-sm text-zinc-500">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-white py-16 text-center">
        <h2 className="text-2xl font-bold text-zinc-900">Ready to get started?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-500">
          Create your school&apos;s account and start tracking fees, attendance, and results today.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="rounded-md bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-700"
          >
            Get started
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-400">
        School Manager — built for Nigerian schools.
      </footer>
    </div>
  );
}
