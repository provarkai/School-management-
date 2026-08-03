-- 0062 gave a plain staff member a grantable "fees" module, and widened the
-- fee_types / fee_records / fee_payments policies to match. It stopped one
-- table short: every screen that permission unlocks (/fees, /debtors,
-- /fees/transfers, /fees/student/[id], the invoice + receipt PDFs, the CSV
-- export) reads public.students to put a name against a balance, and
-- students_select_scoped still admits only a proprietor/delegated admin or
-- the teacher of that student's own class.
--
-- The result was a silent one: RLS returns zero rows rather than an error,
-- so a bursar granted "fees" saw the fee table render with every name and
-- parent phone blank, and a debtors list they could not act on. Widen the
-- same way 0062 did — an extra permissive policy, OR'd with the existing
-- ones, so nothing already allowed is narrowed.
--
-- Read-only on purpose: recording a payment is a fee_payments insert, and
-- creating or editing a student stays manager-only, so the "fees" grant
-- still cannot mint or alter a student record.
--
-- Deliberately not extended to the 'expenses' or 'admissions' grants —
-- neither of those screens reads students at all.

create policy "students_select_permission_fees" on public.students
  for select using (
    school_id = public.current_school_id() and public.has_permission('fees')
  );

-- The two lookup tables these screens join against for display (classes,
-- campuses) are already readable school-wide by any signed-in staff member
-- (classes_select_same_school / campuses_select_same_school), so they need
-- no widening here.

-- The transfer-matching screen (/fees/transfers) reads and writes
-- bank_transfer_alerts under the same "fees" grant; its own policy predates
-- staff_permissions and is still proprietor-only.
create policy "bank_transfer_alerts_permission_fees" on public.bank_transfer_alerts
  for all using (school_id = public.current_school_id() and public.has_permission('fees'))
  with check (school_id = public.current_school_id() and public.has_permission('fees'));

-- payment_intents backs the "generate a payment link" action on the fee
-- screens. Writes go through the service-role client, so only select needs
-- widening.
create policy "payment_intents_select_permission_fees" on public.payment_intents
  for select using (
    school_id = public.current_school_id() and public.has_permission('fees')
  );
