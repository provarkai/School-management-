# QA & security review — School Manager

Review of the app at commit `5bfc92f`, covering the Next.js 16 app layer, the
62 Supabase migrations behind it, and the external surfaces (cron jobs,
Paystack webhook, public share links, result-checker).

Findings are ordered by severity. Each says whether it was **fixed in this
branch** or is **left open** with a recommendation.

> For the living privilege model — roles, the 0030/0043 delegated-admin
> contract, the escalation-fix chain (0065–0078), and the platform-only
> levers — see [SECURITY.md](./SECURITY.md).

---

## Summary

The security architecture is better than most apps this size. Two decisions
in particular are load-bearing and were made correctly:

- **RLS is the real boundary, not the app layer.** Nearly every read goes
  through the signed-in user's own anon-key client, so a teacher cannot see
  another class's students even if a page forgets to filter. The
  service-role client is used in only 8 files, each a place where RLS
  genuinely cannot apply (public share links, the webhook, cron, staff
  account creation).
- **Views are `security_invoker = true`.** `fee_summary` would otherwise
  have been a cross-tenant read of every school's fee data — the single
  most common way a Supabase app leaks.

Every one of the ~180 server actions has an authorisation guard; the twelve
without one are the intentionally public ones (sign-in, sign-up, the
tokenised exam submission). That is a good result for a codebase with no
tests enforcing it.

What follows is what the review found underneath that.

---

## Critical

### 1. Both cron endpoints authenticate anyone when `CRON_SECRET` is unset — **fixed**

`src/app/api/cron/{weekly-fee-reminders,backup-schools}/route.ts`

```ts
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }
```

When `CRON_SECRET` is not set, the template literal interpolates `undefined`
into the string, so the expected header becomes the literal
`Bearer undefined` — which anyone can send.

This is not a theoretical state. `CRON_SECRET` is blank in `.env.example`,
Vercel does not create it for you, and the README describes it as something
to "protect it with". A deployment that skipped that step exposes:

- `/api/cron/weekly-fee-reminders` — sends an SMS to **every owing parent in
  every school on the platform**. Billable, un-undoable, and repeatable in a
  loop.
- `/api/cron/backup-schools` — writes a complete dump of **every school**
  (all 50 tables) to object storage on demand.

**Fixed:** extracted `isAuthorizedCronRequest()` into `src/lib/cronAuth.ts`,
which fails closed when the secret is missing and compares with
`timingSafeEqual`. Covered by `src/lib/cronAuth.test.ts`, including the
`Bearer undefined` case specifically.

### 2. Password-reset and confirmation links are built from the `Host` header — **fixed**

`src/app/login/actions.ts`

```ts
const host = (await headers()).get("host") ?? "localhost:3000";
return `${protocol}://${host}`;   // → resetPasswordForEmail redirectTo
```

The `Host` header is set by whoever sends the request. An attacker who POSTs
a password reset for your proprietor's email with `Host: attacker.example`
gets Supabase to mail *that user* a recovery link pointing at the attacker's
domain — and the recovery token travels in the URL.

Supabase's Redirect URL allow-list is the backstop, and it is a real one.
But it is routinely widened to `https://*.vercel.app/**` so preview
deployments keep working, and that wildcard covers every attacker-registered
project on `vercel.app`. This should not be the only thing in the way.

**Fixed:** added `src/lib/siteUrl.ts`, which prefers `APP_URL` /
`NEXT_PUBLIC_APP_URL`, then Vercel's own `VERCEL_PROJECT_PRODUCTION_URL`,
and only falls back to the `Host` header for local development. Applied to
the staff signup/recovery/resend flows, parent signup, and both Paystack
callback URLs. `APP_URL` documented in `.env.example`.

---

## High

### 3. The `fees` staff permission is granted but blocked by RLS — **fixed**

The newest feature (commit `c819e8e`, "delegate one module without full
admin") does not work for its headline use case. Migration `0062` widened
`fee_types`, `fee_records` and `fee_payments` so a bursar granted `fees` can
read and write them, but stopped one table short: `students`.

`students_select_scoped` still admits only a proprietor/delegated admin, or
the teacher of that student's own class. A plain staff member with the
`fees` grant is neither. So on `/fees` and `/debtors` the balances load and
**every student name and parent phone renders blank** — RLS returns zero
rows rather than an error, so nothing surfaces as broken.

Two more tables have the same gap: `bank_transfer_alerts` (the
`/fees/transfers` matching screen, still proprietor-only from migration
`0006`) and `payment_intents`.

The app layer has a matching inconsistency. `/fees` uses
`requirePermission("fees")`, but everything you would actually *do* from it
was still `requireProprietor()`:

| Route | Was | Consequence for a bursar |
|---|---|---|
| `/fees/student/[id]` | `requireProprietor` | **Cannot record a payment at all** — this is the page with the form |
| `/fees/export`, `/fees/pdf` | `requireProprietor` | Export bounces to `/dashboard` |
| `/fees/invoice/[studentId]` | `requireProprietor` | No invoice |
| `/fees/receipt/[paymentId]` | `requireProprietor` | No receipt after taking money |
| `/expenses/export`, `/expenses/pdf` | `requireProprietor` | Same, for the `expenses` grant |

**Fixed:** migration `0063_staff_permission_student_reads.sql` adds
permissive `has_permission('fees')` policies for `students` (select only —
creating or editing a student stays manager-only), `bank_transfer_alerts`
and `payment_intents`. The seven routes above now use `requirePermission`.
`classes` and `campuses` needed no change; they are already readable
school-wide by any staff member.

### 4. CSV exports carry spreadsheet formula injection — **fixed**

`src/lib/csv.ts`

`escapeCsvField` handled quoting but not formulas. A cell beginning `=`,
`+`, `-` or `@` is executed by Excel, LibreOffice and Google Sheets when the
file is opened — and CSV quoting does not prevent it, because the quotes are
stripped first.

The untrusted text reaching these exports is exactly the free-text fields:
student names, parent names, expense vendor and description. The student and
staff **CSV importers** make this a remote path — an attacker who gets a
prepared roster imported plants a payload that fires on the proprietor's
machine when they next export fees.

**Fixed:** fields starting with a formula character are tab-prefixed, the
standard defusal (spreadsheet reads it as text; the visible value is
unchanged). Covered in `src/lib/csv.test.ts`.

### 5. Report-card class positions were decided by row order on ties — **fixed**

`src/lib/ranking.ts` ranked by array index, so two students with an
identical average were printed as 1st and 2nd, determined by nothing but the
order Postgres happened to return the rows — and not stably, between one
render of the PDF and the next.

**Fixed:** equal averages now share a position, with the next student taking
the place the tie reaches (1, 2, 2, 4). Covered in `src/lib/ranking.test.ts`.

---

## Medium

### 6. Mock payment mode marks fees paid for free — **fixed**

Without `PAYSTACK_SECRET_KEY`, `verifyTransaction()` returned success
unconditionally and "Pay now" bounced the parent straight to
`/pay/callback`, which recorded a full payment. Correct for testing; silent
and expensive for a school that went live and never set the key. Nothing in
the parent-facing UI distinguishes the two — the parent sees "Payment
successful".

**Fixed:** `isMockPaymentBlocked()` refuses to create *or* confirm a
simulated payment when `VERCEL_ENV`/`NODE_ENV` is production, unless
`ALLOW_MOCK_PAYMENTS=1` is set for a deliberate demo deployment.

### 7. Reconciliation credited the requested amount, not the settled one — **fixed**

`markPaymentIntentSuccess()` inserted `intent.amount` — what the app asked
Paystack to charge — regardless of what Paystack said was actually
collected. A short settlement would mark a fee cleared that was never paid
in full.

**Fixed:** the webhook passes `event.data.amount` (kobo → naira, trustworthy
because the HMAC signature is verified first) and the callback passes its
verified amount; the intent amount remains the fallback.

### 8. Download filenames were interpolated unescaped into `Content-Disposition` — **fixed**

Thirteen routes built the header from a class name, a student's full name,
or `from`/`to` values taken straight off the query string:

```ts
"Content-Disposition": `inline; filename="${student.full_name}_report_card.pdf"`
```

Student and class names are staff-entered free text, and can arrive through
the bulk importer. A quote breaks out of the quoted filename.

**Fixed:** added `safeFilename()` and applied it across the CSV, XLSX, JSON
and all eleven PDF routes.

### 9. School suspension is enforced only in the app layer — **fixed**

Fixed in `0064_enforce_school_suspension.sql`: `school_is_active(school_id)`
plus one restrictive policy per tenant-scoped table (~58 of them), AND'd
against the existing permissive policies rather than replacing them. For any
school that isn't suspended — the default — nothing changes; suspending one
now refuses every command, not just reads, at the database level.

`requireUser()` redirects a suspended school's staff to
`/account-suspended` — that's unaffected and still the first line of
defense — but before this fix, no RLS policy consulted `schools.status`,
so a suspended school's own staff could call the Supabase REST API
directly with their own JWT and read (or write) everything RLS still
allowed.

Deliberately excludes `schools` and `app_users` — `requireUser()` has to
read both, in that order, before it can detect the suspension and redirect,
so gating either would break detection instead of enforcing it — and
`platform_admins`/`platform_admin_logs`, since platform oversight needs to
stay visible for a suspended school, not disappear along with it.

The same reasoning applies to two smaller app-layer-only rules, both already
documented as such in the code: proprietors being barred from uploading a
profile photo (migration `0018`), and `convertProspectToStudent` being
manager-only (migration `0062`). The second is in fact backstopped by RLS —
`students` insert requires `current_role() = 'proprietor'` — so only the
photo rule is genuinely unenforced.

### 10. No rate limiting anywhere — **partially fixed**

Supabase Auth rate-limits sign-in itself, but these are the app's own
endpoints and have none:

- `/check-result` — serial + PIN. The keyspace is large (32¹² serials, 10¹⁰
  PINs), so this is not brute-forceable, but it is an unmetered public
  endpoint doing four service-role queries per request. **Still open** —
  needs Vercel WAF rate-limiting rules (dashboard config, not app code).
- `/p/[token]`, `/t/[token]` — same, unmetered public reads. **Still open**,
  same fix.
- `/assistant` — every message is a paid OpenRouter call. Any signed-in
  teacher can loop it. The client also supplies the full `history` array
  with no length cap, so a single request can be made arbitrarily expensive.
  **Fixed**: `history` is capped to the last 20 turns server-side
  (`MAX_HISTORY_TURNS` in `src/app/(app)/assistant/actions.ts`), and a
  per-user daily message count (`assistant_usage` /
  `increment_assistant_usage()`, `0066_assistant_rate_limit.sql`) blocks
  further messages past 200/day with a plain message instead of calling
  OpenRouter.

### 11. Temporary staff passwords never expire and are never rotated — **fixed**

`addStaffMember` / `bulkImportStaff` generate a 12-character password,
display it once, and mark the account `email_confirm: true`. Nothing forced
a change at first sign-in, and the bulk importer returns every credential in
one response — a list that will be pasted into WhatsApp.

**Fixed:** `must_change_password` (`0065_temp_password_rotation.sql`) is set
on every new staff account created either way; `requireUser()` redirects to
`/reset-password` while it's true, and `setNewPassword` clears it once a
real password is set. Existing accounts are untouched — this only applies
going forward, not a retroactive forced reset for staff already using the
app. `inviteUserByEmail` (no plaintext password at all) would be a further
improvement but wasn't made here.

While fixing this, a second, unrelated gap surfaced in the same table:
`app_users_update_proprietor_or_self` (`0003_rls.sql`) had no `WITH CHECK`,
so a plain teacher/staff account calling the API directly could update
their own `role` to `'proprietor'` or flip `is_school_admin` to `true`,
self-granting full manager power — salary was deliberately kept off this
table for exactly this reason (see `0025_payroll.sql`'s comment), but the
underlying hole itself was never closed. Also fixed in
`0065_temp_password_rotation.sql`, the same way `leave_requests` and
`lesson_notes` were: a `WITH CHECK` that leaves the proprietor/admin branch
unrestricted and pins the plain-self-edit branch to the role/admin values
it already had.

### 12. Parent–child linking trusts an unverified email field — **fixed**

`link_my_children()` links a parent account to every student whose
`students.parent_email` matches their login email. Anyone can self-register
at `/parent/login`. So whoever controls the mailbox a proprietor typed into
that field gets the child's fees, attendance, results and messaging thread —
with no approval step, no notification to the school, and no audit entry.

A typo landing on a real address is enough. `students.parent_email` is a
security-critical field that currently looks like a contact detail.

**Fixed:** replaced with an invitation (`parent_invitations`,
`0067_parent_invitations.sql`). The proprietor generates a one-time link
from the student's detail page (`ParentInviteSection.tsx`); redeeming it
(`redeem_parent_invitation()`, `/parent/invite/[token]`) is what creates
the `parent_students` row now, and it's logged into `activity_logs`. The
trust is "you have this specific link", not "you typed a matching email".
`link_my_children()` is no longer called (removed from
`requireParent()`), though the function itself is left in place;
existing links it already made are untouched — only how *new* links are
made changed. `parent_email` on `students` stays as a plain contact field,
just no longer the security boundary.

---

## Low / hardening

### 13. FK ownership is not checked against the caller's school — **fixed**

RLS validates the `school_id` *value the app writes*, not that the rows it
points at belong to that school. `getOrCreateFeeRecord(supabase,
profile.school_id!, studentId, ...)` never confirms `studentId` is in the
caller's school, so a crafted request can create a fee record in school A
against a student in school B. It leaks nothing (the name is unreadable) and
requires a known UUID, so the practical risk is low — but the pattern
recurs across the actions. `setStaffPermission` has the same shape.

**Fixed:** added `src/lib/assertInSchool.ts` and applied it to both named
call sites — `getOrCreateFeeRecord` (checks `studentId` and `feeTypeId`)
and `setStaffPermission` (checks `staffId`).

### 14. Signed-in users can change their password without the old one — **fixed (dashboard)**

`setNewPassword` and `changeOwnParentPassword` require a session but not
proof of the current password, so a borrowed session on a shared machine —
common in a school office — becomes a permanent takeover. Not code — a
Supabase dashboard toggle ("Secure password change", which makes
`updateUser({ password })` require recent reauthentication). Flipped on in
the live project.

### 15. No Content-Security-Policy — **fixed (report-only)**

`next.config.ts` sets a good header set (HSTS, `X-Frame-Options`, `nosniff`,
`Referrer-Policy`, `Permissions-Policy`) but no CSP. There are no
`dangerouslySetInnerHTML` sinks in the codebase, so this is defence in depth
rather than a live hole.

**Fixed:** added a `Content-Security-Policy-Report-Only` header (same
policy the recommendation suggested, with `'unsafe-inline'` on
script-src/style-src since Next's own hydration script and Tailwind need
it without a nonce setup). Report-only means nothing is enforced yet —
next step is wiring an actual `report-uri`/`report-to` and watching it for
a while before flipping to enforced.

### 16. Dependency advisories — **partially fixed**

`npm audit`: 4 high, 2 moderate. All transitive:

- `next@16.2.12` pulls vulnerable `postcss` and `sharp`. Upgrading Next
  past `16.3.0` clears both — **checked again while acting on this review,
  and there is no stable `16.3.0` yet**, only canary/preview builds (latest
  stable is still `16.2.12`). Not bumping to a pre-release in production;
  revisit once `16.3.0` actually ships. `npm audit fix --force` proposes
  `next@9.3.3` and must not be run.
- `exceljs` → `uuid` (moderate, needs an `exceljs` major). Checked: even
  the newest `exceljs@4.4.0` (already installed) still pins `uuid@^8.3.0`,
  so there's no version bump — stable or not — that clears this without
  replacing `exceljs` outright. Left as-is.
- **Fixed:** ran `npm audit fix` (no `--force`) to pick up the one advisory
  that had a real non-breaking fix: transitive `brace-expansion`.

None is reachable from an obvious attack path here.

### 17. `/check-result` distinguishes "wrong PIN" from "unknown admission number" — **open**

The serial/PIN mismatch message is deliberately ambiguous, which is right.
The follow-up check is not: "No student with that admission number was found
at this school" confirms whether a given admission number exists. It takes a
valid card to reach, so the disclosure is small — but admission numbers are
sequential, so one card enumerates the school's roll size.

---

## The largest gap: nothing was tested

Before this branch the repository had **zero tests, no CI, and no
typecheck script**. For ~250 source files handling money, children's
records and SMS spend, that is the finding with the longest tail — every
item above was reachable only by reading, and nothing stops any of them
coming back.

**Done here:** `npm test` on Node's built-in runner with type stripping —
no new dependencies — plus `npm run typecheck` and `npm run check`
(typecheck + lint + test). 25 tests covering the cron auth bypass, CSV
injection and filename escaping, Paystack signature verification and mock
blocking, PIN generation, and the ranking tie logic.

**Still needed, in priority order:**

1. **A CI workflow.** ~~There is no `.github/` at all.~~ **Fixed** —
   `.github/workflows/ci.yml` runs `npm run check` and `npm run build` on
   every push/PR now.
2. **RLS tests.** The highest-value tests this app could have, and the ones
   it most conspicuously lacks: sign in as a teacher, a bursar with each
   grant, a parent, and a second school's proprietor, then assert what each
   can and cannot read. Findings #3 and #9 are both things such a suite
   would have caught immediately. `supabase start` plus a script that runs
   the migrations against a scratch database is enough. **Still open** —
   explicitly deferred: the sandbox this round's fixes were made in has no
   working Docker daemon (nested containers aren't permitted), so
   `supabase start` can't run here. Writing test code that was never
   actually executed against a real database was judged worse than not
   writing it — it can pass by accident and give false confidence. Needs a
   session with a working local Supabase.
3. **An end-to-end pass** over the two money paths — record a payment,
   reconcile a Paystack webhook — with Playwright, which is already
   available in this environment.
4. **A restore drill.** The README is right that "a backup nobody has
   restored is a guess". Nothing currently verifies `restore-school.ts`
   against a real snapshot.

---

## Feature suggestions

Ordered by what the code suggests the app is missing most, not by novelty.

**Worth building next**

- **Fee reconciliation reporting.** Payments land from four paths — cash,
  transfer matching, Paystack webhook, Paystack callback — and there is no
  screen that reconciles them or surfaces a `payment_intents` row stuck at
  `pending`. A failed webhook is currently invisible. This is a day's work
  and it protects the money.
- **Receipt on payment.** `fees/receipt/[paymentId]` exists but is only
  reachable by a staff member navigating to it. A parent paying online gets
  no receipt at all. Email or SMS the link from
  `markPaymentIntentSuccess()`.
- **Audit log coverage for reads.** `activity_log` records writes well. For
  a system holding children's records, the questions that get asked after an
  incident are about reads: who opened this student's documents, who
  exported the whole fee table. Log the export routes at minimum.
- **Offline-tolerant attendance.** The stated market is Nigerian private
  schools; `AttendanceGrid` is a server-action round-trip per save. A
  teacher on a weak connection loses the register. A local-first queue that
  syncs when the connection returns would matter more to a daily user than
  any new module.

**Natural extensions of what exists**

- **Termii delivery receipts.** `message_logs` records what was sent, not
  what arrived. Termii exposes a delivery-status callback; without it "the
  parent never got the reminder" is unanswerable.
- **Fee schedules / instalment plans.** `fee_records` holds one expected
  amount per type per term. Schools routinely agree part-payment plans, and
  right now that is tracked in someone's notebook.
- **Bulk report-card generation as a background job.** The class PDF route
  renders synchronously; at a few hundred students that will meet the
  Vercel function timeout during exactly the week it is used.
- **Parent-facing timetable and calendar.** Both exist for staff and are
  already share-linked publicly; surfacing them in the parent portal is
  mostly wiring.

**Larger bets**

- **WhatsApp as the primary channel**, not an SMS fallback. `termii.ts` is
  already the seam for it, and it is where Nigerian parents actually are.
- **Multi-year academic history.** `AcademicHistory.tsx` exists per student,
  but promotion (`0039`) does not preserve a session snapshot, so
  "show me this child's JSS1 results" gets progressively harder to answer.
- **A school-level dashboard for proprietors with several campuses.**
  Campuses exist as a filter; there is no comparison view, which is the
  reason to run more than one.

---

## What was verified

- `npm run typecheck` — clean
- `npm run lint` — clean (4 pre-existing unused-arg warnings, untouched)
- `npm test` — 25 passing
- `npm run build` — compiles, 100+ routes

Not verified: nothing was run against a live Supabase project, so the
migration in this branch is reviewed but unapplied, and the RLS reasoning
throughout is read from the policies rather than executed. That is precisely
the gap item 2 under "Still needed" describes.
