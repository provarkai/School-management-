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

## What's deliberately out of scope (Phase 2+)

Parent-facing portal, class position/ranking automation, timetabling,
multi-campus management, automated bank transfer reconciliation, native
mobile app, scheduled/automated weekly reminders (sending today is a manual
trigger from the Reminders page).

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
