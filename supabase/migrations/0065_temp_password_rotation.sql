-- Temporary staff passwords (addStaffMember / bulkImportStaff) never
-- expired and were never forced to change: a 12-character password is
-- generated, shown once, and the account is marked email_confirm: true.
-- Nothing made a first sign-in change it, and the bulk importer returns
-- every credential in one response — a list that gets pasted into
-- WhatsApp. New accounts now carry a flag that forces a change before
-- they can reach anything else. Existing accounts are left alone
-- (default false) — this is a going-forward fix, not a retroactive
-- forced reset for staff who are already using the app.
alter table public.app_users add column if not exists must_change_password boolean not null default false;

-- While reviewing this, a second, unrelated gap surfaced in the same
-- table: app_users_update_proprietor_or_self (0003_rls.sql) is a
-- USING-only policy with no WITH CHECK, so a plain teacher/staff account
-- calling the API directly — not through this app's own UI, which never
-- offers the fields — could update their OWN row's `role` to
-- 'proprietor' or flip `is_school_admin` to true, self-granting full
-- manager power. (Salary was deliberately kept off this table for
-- exactly this reason — see 0025_payroll.sql's comment — but the
-- underlying hole was never closed.) Fixed the same way leave_requests
-- and lesson_notes were: a WITH CHECK that leaves the proprietor/admin
-- branch unrestricted (current_role() already treats a delegated admin
-- as 'proprietor', so this doesn't touch their own self-edit) and pins
-- the plain-self-edit branch to the values it already had.
drop policy if exists "app_users_update_proprietor_or_self" on public.app_users;
create policy "app_users_update_proprietor_or_self" on public.app_users
  for update using (
    school_id = public.current_school_id()
    and (public.current_role() = 'proprietor' or id = auth.uid())
  )
  with check (
    school_id = public.current_school_id()
    and (
      public.current_role() = 'proprietor'
      or (id = auth.uid() and role in ('teacher', 'staff') and is_school_admin = false)
    )
  );
