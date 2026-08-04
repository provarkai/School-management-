# Privilege model — School Manager

Living reference for who can read and write what, and why. The database
(`supabase/migrations/`) is the authoritative enforcement point: RLS
policies run as the signed-in user, so a page that forgets to filter cannot
leak. Every behaviour described here is pinned by the RLS integration suite
in `src/lib/rls.test.ts` (72 tests, runs the real migrations against pglite
— a genuine PG16 — and asserts per-role reads **and** writes).

> Point-in-time findings from the original review live in `REVIEW.md`. This
> file is the model itself.

---

## 1. Tenets

1. **RLS is the security boundary, not the app layer.** Nearly every read
   goes through the user's own anon-key client. The service-role client is
   used only where RLS genuinely cannot apply (see §6).
2. **Views are `security_invoker = true`** — otherwise `fee_summary` would
   be a cross-tenant read of every school's fee data.
3. **Delegated power ≠ ownership.** A school admin is given the proprietor's
   *operational* power (`current_role()`), but every transition that changes
   *who owns the school* is literal-role-only, enforced at trigger/policy
   level so it holds even against direct REST calls.
4. **Suspension is a platform lever.** A suspended school is locked at the
   database for *everyone* — including its own proprietor — until a
   platform admin reactivates it.
5. **System contexts are trusted.** SQL editor, seed scripts, and the
   service-role client carry no JWT (`auth.uid()` is null); triggers
   deliberately allow them. The `anon` role can never reach them (no
   policies).

---

## 2. Roles and what they can do

| Role | Established by | Can do |
|---|---|---|
| `anon` (no JWT) | — | Nothing on tenant tables. Public share links / result-checker are their own token-gated flows, not anon table access. |
| Teacher | `app_users.role='teacher'` (0005 provisions rows via auth trigger) | Own class's students/results/attendance only; update+insert marks in own class; **no** delete of results/attendance; self profile (`app_users` self-edit pinned by 0065); no fees/salaries/payroll. |
| Staff | `role='staff'` + optional module grants | Module grants via `staff_permissions` (0062): `fees` → full fee CRUD incl. DELETE (audit trail relies on `activity_logs`), `expenses`, `admissions`. No grants → read-only school lists. |
| Parent | `parents` rows linked to students via invitations (0010/0067) | Own linked children's results/attendance/fee records/payments/messages; nothing else; **select-only**. |
| School admin | `is_school_admin=true` (granted by literal proprietor only, 0030) | `current_role()` treats them as proprietor: **equal operational power across every module, including payroll** (0043, deliberate). Excluded from every ownership transition (see §3/§4). |
| Proprietor | `role='proprietor'` | Full school control, plus the ownership transitions only they can perform (§4). |
| Platform admin | `platform_admins` table (0027) | Cross-school oversight: SELECT on `schools`, the `schools.status` toggle, aggregate-only views (`platform_school_stats`, `platform_totals`) — never raw student/fee rows. Cannot be granted through the app (`platform_admins` has RLS with zero policies). |
| Service role | server-side admin client | Bypasses RLS entirely — the trusted surface (§6). |

---

## 3. The two-layer check model

Operational policies use **`current_role()`** (0030): the *effective* role —
a school admin resolves to `'proprietor'`, so every existing policy grants
them operational power with zero per-table changes.

Ownership decisions use **literal checks** — a subquery or trigger that
reads `role = 'proprietor'` directly:

- `current_role()` — effective role (admin-inclusive). Used by ~40
  operational policies (classes, students, fees, expenses, attendance,
  payroll, hostels, result-checker pins, …).
- `is_owner()` (0030) — strict literal check; **dead code** since 0043
  re-pointed every payroll policy to `current_role()`. Kept only because
  future migrations might need it.
- Literal `exists(… role='proprietor')` — used by the `app_users`
  INSERT/DELETE policies (0077) and the `app_users` UPDATE WITH CHECK's
  unrestricted branch (0076).
- Triggers that read `auth.uid()` against `role='proprietor'` — 0030
  (admin flag), 0077 (role transitions), 0078 (school status).

Rule of thumb for future migrations: **operational data keys on
`current_role()`; anything that changes who owns the school or the platform
levers keys on the literal role.**

---

## 4. Escalation fix chain (0065 → 0078)

The `app_users` UPDATE path was historically the weak spot: a USING-only
policy let a signed-in teacher/staff account self-edit their own row's
`role` and `is_school_admin`. Closed in four steps:

| Migration | Hole it closed | Mechanism |
|---|---|---|
| **0065** | Self-edit WITH CHECK missing — teacher/staff could self-grant `role='proprietor'` or flip `is_school_admin`. | Added `WITH CHECK` pinning plain self-edits to `role in ('teacher','staff') AND is_school_admin = false`. |
| **0075** | Stale/over-granted security-definer RPCs: `link_my_children()` still callable (bypassed invitation flow); every function also carried default PUBLIC execute (anon could call them); `next_admission_number` had no explicit grant. | Revoked/dropped stale RPCs; explicit `authenticated` grants; PUBLIC execute removed from app RPCs — with the required exception of `is_platform_admin()`, which RLS policies reference and therefore must stay executable by `anon`. (The RLS suite caught that regression before it shipped.) |
| **0076** | 0065's WITH CHECK keyed its unrestricted branch off `current_role()` — a **delegated admin** could self-grant literal `role='proprietor'`, unlocking `is_owner()` salary access and outliving revocation. | WITH CHECK's proprietor branch now requires the literal role on the acting user; a delegated admin may still edit staff rows but no resulting row may be `role='proprietor'`. |
| **0077** | Two siblings of the same hole: RLS cannot compare OLD vs NEW rows, so an admin could **demote the owner** (`role='staff'`) — and the INSERT/DELETE policies still keyed on `current_role()`, letting an admin delete any member or insert a `role='proprietor'` puppet. | `protect_proprietor_role` BEFORE trigger: only the literal proprietor may change any row's role to/from `'proprietor'` (with an exemption for `bootstrap_school`'s exact `school_id NULL → set` transition, so onboarding still works). INSERT/DELETE policies pinned to the literal role. |
| **0078** | Audit of all `current_role()` policies found one over-grant: `schools_update_proprietor` (no column restriction) let any manager — admin **or** proprietor — flip `schools.status`, undoing a platform suspension or bricking the school. | `protect_school_status` BEFORE trigger: `status` changes require a platform admin or a system context. The literal proprietor is deliberately **not** exempt (0064's lever is the platform's; the app has no self-suspend UI). |

**Bootstrap exemption (0077), precisely:** `bootstrap_school`
(0005/0028/0048) promotes a brand-new, school-less user to proprietor as a
security-definer function — triggers still fire there, so the trigger
exempts exactly `old.school_id IS NULL → new.school_id IS NOT NULL`. Safe:
an unlinked row has no data access, and the 0076 WITH CHECK blocks any
direct-API attempt on a row whose `school_id` wouldn't match
`current_school_id()`.

---

## 5. The `schools.status` lever (0064 + 0078)

- `schools.status ∈ ('active','suspended')`. Only a **platform admin** (or
  a system context) may change it — 0078 trigger, enforced regardless of
  how the update arrives.
- While suspended, **restrictive `school_is_active()` policies** (0064) are
  AND'd against every tenant table's existing policies: a suspended
  school's data disappears for its proprietor, staff, and linked parents
  alike — the suspension holds at the database, not just the redirect.
- Deliberately *not* gated: `schools` itself (the app must read the row to
  detect the suspension and show `/account-suspended`), `app_users` (the
  caller's own profile), `platform_admins`/`platform_admin_logs` (platform
  oversight must survive), `parents`/`parent_students` (not school-scoped;
  the data they reach is gated directly).

---

## 6. Intentionally trusted surface

**Service-role client** (bypasses RLS) — used only where RLS cannot apply:
staff account creation & bulk import (`staff/actions.ts`),payment-intent
recording (`fees/actions.ts`, Paystack webhook `api/paystack/webhook`), the
result-checker (`check-result/actions.ts`), public token pages (`p/[token]`
exam pages, `t/[token]`, parent invite/portal), cron jobs
(`weekly-fee-reminders`, `backup-schools`), Paystack callback, and
`lib/backup.ts`. Each site is a deliberate trade-off — e.g.
the webhook verifies the Paystack HMAC before trusting anything; cron
requires `isAuthorizedCronRequest()` (constant-time compare).

**Platform admins** — seeded only by direct SQL as the project owner; can
never be granted through the app; see aggregates, not raw data.

**System contexts** (no JWT) — SQL editor, seed scripts, the service-role
client — pass the ownership triggers because `auth.uid()` is null. This is
what lets `supabase/seed.sql` and the migration SQL editor promote a user to
proprietor.

**Documented trade-offs (accepted):**
- Fees-granted staff can **delete** fee records/payments (0062 `for all`);
  the audit trail is `activity_logs`, not immutability.
- Duplicate/overpayment guards on `fee_payments` are **app-layer only**
  (`fees/actions.ts`); there is no DB constraint capping payments at a
  record's balance.
- `is_platform_admin()` must remain PUBLIC-executable — RLS policies on
  `schools`/`platform_admin_logs` reference it and evaluate as the querying
  role (0075).

---

## 7. Enforcement & verification

- **RLS integration suite** — `src/lib/rls.test.ts` + `rlsTestHarness.ts`:
  runs all 78 migrations against pglite with Supabase-compatible shims
  (`auth.uid()` via `request.jwt.claims`, roles, grants), then signs in as
  teacher / fees-bursar / expenses & admissions staff / parent / school
  admin / second-school proprietor / platform admin / anon and asserts
  reads and writes per boundary, including the ownership-transition
  triggers and the suspension lock.
- **Migration audit scripts** — `supabase/check_migrations.sql` /
  `check_migrations_part2.sql`: verify each migration's distinctive effect
  applied in a live project.
- **App-layer guards** — `src/lib/current-user.ts`:
  `requireUser` / `requireProprietor` (proprietor **or** delegated admin) /
  `requireLiteralProprietor` (owner only — grants/revokes admin, the one
  place the app refuses a delegated admin) / `requirePermission`; plus
  `requirePlatformAdmin` and `requireParent`.
- **Change checklist for a new tenant-scoped table:** enable RLS; `SELECT`
  scoped to `current_school_id()` (or a narrower helper like
  `can_access_student`); writes gated by `current_role()` for operational
  data or the literal-role check for ownership data; add the 0064
  restrictive `school_is_active()` policy; cover it in the RLS suite.
