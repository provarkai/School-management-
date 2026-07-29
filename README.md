# School Manager — MVP

Fee tracking, attendance, report cards, and SMS/WhatsApp reminders for
Nigerian private schools. Built per the lean MVP spec: Proprietor/Admin and
Teacher roles only (Bursar merged into Admin). Most of Phase 2 — a full
parent portal, online payments, multi-campus management, and timetabling —
has since been pulled forward too (see "Beyond the MVP spec" below).

## Stack

- **Frontend/backend:** Next.js 16 (App Router, Server Actions)
- **Database/auth:** Supabase (Postgres + Auth, row-level security for
  multi-tenant isolation by school)
- **PDF report cards:** `@react-pdf/renderer`
- **SMS/WhatsApp reminders:** [Termii](https://termii.com) (Nigerian-focused;
  runs in a "mock" console-log mode until an API key is configured)
- **Online payments:** [Paystack](https://paystack.com) checkout + webhook
  (runs in a mock instant-success mode until a secret key is configured)
- **Hosting:** Vercel (app) + Supabase (backend)

## Getting started

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the migrations** in `supabase/migrations/` in order, either via the
   Supabase SQL editor (paste each file's contents) or the Supabase CLI:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
3. **Copy `.env.example` to `.env.local`** and fill in your project's URL,
   anon key, and service role key (Project Settings → API). The service role
   key is only used server-side, to create teacher auth accounts.
4. **Install dependencies and run the dev server:**
   ```bash
   npm install
   npm run dev
   ```
5. **Sign up** at `/login` with your own email — this creates your staff
   account. You'll land on `/onboarding`, where creating a school makes you
   its proprietor/admin.
6. **(Optional) Seed demo data:** run `supabase/seed.sql` in the SQL editor
   for a demo school/classes/students, then follow the comment at the bottom
   of that file to link your signed-up account to it instead of creating a
   new school.

## How the roles work

- **Proprietor/Admin** — full access: dashboard, students, classes, fees,
  attendance history, report cards, reminders, staff management.
- **Teacher** — scoped to their own class(es) only: mark attendance, enter
  CA/exam scores, view their students. No fee access (bursar duties are
  folded into the proprietor role for this MVP, per the spec).

A proprietor adds teachers from **Staff** — this creates a real Supabase Auth
account for them (via the service role key) with a generated temporary
password, and assigns them to a class from **Classes**.

## Enabling real SMS/WhatsApp sending

Reminders run in mock mode (logged to the server console) until you set:

```
TERMII_API_KEY=...
TERMII_SENDER_ID=...
```

in your environment. See `src/lib/termii.ts` — it's a thin wrapper around the
Termii SMS API; swap in the WhatsApp Business API endpoint there if/when you
want WhatsApp delivery specifically rather than Termii's generic channel.

## Enabling real online payments

Payment links (parent portal "Pay now" and staff-generated links) run in
mock mode — clicking "pay" immediately simulates a successful charge, so the
whole flow is testable end-to-end without a real payment provider. To accept
real payments:

1. Create a [Paystack](https://paystack.com) account and grab your secret key.
2. Set `PAYSTACK_SECRET_KEY=...` in your environment.
3. In the Paystack dashboard, add `https://<your-domain>/api/paystack/webhook`
   as a webhook endpoint, subscribed to the `charge.success` event — this is
   what actually reconciles a payment against the right fee record;
   `/pay/callback` (the page a payer lands on after checkout) also verifies
   the transaction as a fast-path, but the webhook is the source of truth if
   the payer closes their browser before that redirect completes.

## Beyond the MVP spec

Most of Phase 2 from the original spec has been pulled forward:

- **Automated weekly fee reminders** — a Vercel Cron job (`vercel.json`,
  `src/app/api/cron/weekly-fee-reminders/route.ts`) sends reminders to every
  owing/partial student across all schools, every Monday. Protect it with a
  `CRON_SECRET` env var (Vercel sends it automatically as a Bearer token once
  the var exists in your project).
- **Bank transfer matching** (`/fees/transfers`) — log a transfer alert
  (amount + narration + date) and the app suggests candidate students by
  name/amount match; confirming records the payment. Manual entry, not a
  bank webhook — a semi-automated stopgap for reconciliation.
- **Online fee payments (Paystack)** — parents pay their child's balance
  online (a "Pay now" button in the parent portal, or a payment link a
  proprietor generates and sends any way they like — including embedded in
  the SMS/WhatsApp reminder). A Paystack webhook (`/api/paystack/webhook`)
  auto-reconciles the charge against the right fee record the moment it
  succeeds, no manual entry needed. Runs in mock mode (simulated instant
  success) until `PAYSTACK_SECRET_KEY` is set — see `src/lib/paystack.ts`.
- **Full parent portal** — real parent accounts (`/parent/login`), separate
  from staff logins, auto-linked to their children by matching login email
  against a `students.parent_email` set from the student's detail page. Each
  child gets a dashboard with fees (+ Pay now), attendance, and results. The
  original read-only share link (`/p/[token]`, no login) still exists
  alongside it for schools that don't want parents creating accounts.
- **Multi-campus/branch management** (`/campuses`) — proprietors can define
  campuses and assign classes/teachers to one; dashboard, students, and
  classes views gain a campus filter. Schools with no campuses defined see
  no change.
- **Timetabling** (`/timetable`) — proprietors set up the school's daily
  period structure once, then build a per-class weekly subject+teacher grid
  with automatic double-booking detection for teachers. Each class gets a
  print-friendly page and a public read-only share link (`/t/[token]`).
- **Class position/ranking** — computed at report-card render time from
  `results`, shown on the score-entry page and both PDF routes.
- **CSV export** — "Export CSV" on the Fees and Attendance History pages,
  respecting whatever filters are active.
- **AI Assistant** (`/assistant`, embedded on the dashboard) — a tool-using
  chat, routed through [OpenRouter](https://openrouter.ai) to a Claude model
  (`src/lib/ai/`), that answers questions about students, fees, attendance,
  and results by querying the database through the signed-in user's own
  RLS-scoped access (a teacher's assistant can't see fee data a teacher
  can't see, because the query returns nothing — not because the assistant
  special-cases the role). Needs `OPENROUTER_API_KEY`; runs in a
  mock/explain-yourself mode without it. Model defaults to
  `anthropic/claude-haiku-4.5`, overridable via `OPENROUTER_MODEL`.

## What's still out of scope

Fully-automated bank statement reconciliation (transfer matching above is
suggested, not automatic — that needs a Nigerian account-aggregation service
like Mono or Okra, which requires business KYC credentials this project
doesn't have), and a native mobile app.

## Project structure

```
supabase/migrations/   SQL schema, RLS policies, triggers, views
supabase/seed.sql      Demo data for local development
src/lib/supabase/      Browser/server/proxy Supabase clients
src/lib/termii.ts      SMS/WhatsApp reminder sending
src/lib/paystack.ts    Paystack checkout/verify/webhook-signature wrapper
src/lib/payments.ts    Shared payment-intent create + idempotent reconcile
src/lib/pdf/           Report card PDF template (@react-pdf/renderer)
src/app/(app)/         Authenticated staff app screens (dashboard, students,
                        classes, campuses, fees, attendance, report-cards,
                        timetable, reminders, staff) sharing a role-aware
                        nav layout
src/app/login/         Staff sign in / sign up
src/app/parent/        Parent portal (separate login, dashboard, per-child view)
src/app/onboarding/    First-run "create your school" flow
src/app/p/[token]/     Public read-only student share link
src/app/t/[token]/     Public read-only class timetable share link
src/app/pay/callback/  Post-checkout landing page (payment verification)
```
