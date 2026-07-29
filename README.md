# School Manager — MVP

Fee tracking, attendance, report cards, and SMS/WhatsApp reminders for
Nigerian private schools. Built per the lean MVP spec: Proprietor/Admin and
Teacher roles only (Bursar merged into Admin, Parent portal deferred to
Phase 2).

## Stack

- **Frontend/backend:** Next.js 16 (App Router, Server Actions)
- **Database/auth:** Supabase (Postgres + Auth, row-level security for
  multi-tenant isolation by school)
- **PDF report cards:** `@react-pdf/renderer`
- **SMS/WhatsApp reminders:** [Termii](https://termii.com) (Nigerian-focused;
  runs in a "mock" console-log mode until an API key is configured)
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

## Beyond the MVP spec

A few Phase-2 items from the original spec got pulled forward:

- **Automated weekly fee reminders** — a Vercel Cron job (`vercel.json`,
  `src/app/api/cron/weekly-fee-reminders/route.ts`) sends reminders to every
  owing/partial student across all schools, every Monday. Protect it with a
  `CRON_SECRET` env var (Vercel sends it automatically as a Bearer token once
  the var exists in your project).
- **Bank transfer matching** (`/fees/transfers`) — log a transfer alert
  (amount + narration + date) and the app suggests candidate students by
  name/amount match; confirming records the payment. Manual entry, not a
  bank webhook — a semi-automated stopgap for reconciliation.
- **Parent read-only view** — each student gets an unguessable share link
  (`/p/[token]`, no login) showing fee balance, attendance, and results.
  Copy it from a student's detail page. This is a link-sharing stand-in for
  a full parent portal/account system, which is still out of scope.
- **Class position/ranking** — computed at report-card render time from
  `results`, shown on the score-entry page and both PDF routes.
- **CSV export** — "Export CSV" on the Fees and Attendance History pages,
  respecting whatever filters are active.
- **AI Assistant** (`/assistant`) — a tool-using chat, routed through
  [OpenRouter](https://openrouter.ai) to a Claude model (`src/lib/ai/`),
  that answers questions about students, fees, attendance, and results by
  querying the database through the signed-in user's own RLS-scoped access
  (a teacher's assistant can't see fee data a teacher can't see, because
  the query returns nothing — not because the assistant special-cases the
  role). Needs `OPENROUTER_API_KEY`; runs in a mock/explain-yourself mode
  without it. Model defaults to `anthropic/claude-haiku-4.5`, overridable
  via `OPENROUTER_MODEL`.

## What's still out of scope

Full parent-facing accounts/portal (only the read-only share link above
exists), timetabling, multi-campus management, fully-automated bank
reconciliation (matching is suggested, not automatic), native mobile app.

## Project structure

```
supabase/migrations/   SQL schema, RLS policies, triggers, views
supabase/seed.sql      Demo data for local development
src/lib/supabase/      Browser/server/proxy Supabase clients
src/lib/termii.ts      SMS/WhatsApp reminder sending
src/lib/pdf/           Report card PDF template (@react-pdf/renderer)
src/app/(app)/         Authenticated app screens (dashboard, students,
                        classes, fees, attendance, report-cards, reminders,
                        staff) sharing a role-aware nav layout
src/app/login/         Sign in / sign up
src/app/onboarding/     First-run "create your school" flow
```
