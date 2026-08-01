-- The proprietor wants a delegated school admin to have equal operational
-- power, including payroll/salary data — the only distinction left between
-- them is who granted the admin role (still literal-proprietor-only, see
-- protect_school_admin_flag() in 0030_school_admin.sql). Re-point every
-- payroll-related policy from the strict is_owner() check back to
-- current_role(), which already treats a school admin as a proprietor.

drop policy if exists "staff_salaries_proprietor_all" on public.staff_salaries;
create policy "staff_salaries_proprietor_all" on public.staff_salaries
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

drop policy if exists "payroll_runs_proprietor_all" on public.payroll_runs;
create policy "payroll_runs_proprietor_all" on public.payroll_runs
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

drop policy if exists "payroll_entries_proprietor_all" on public.payroll_entries;
create policy "payroll_entries_proprietor_all" on public.payroll_entries
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

drop policy if exists "deduction_types_proprietor_all" on public.deduction_types;
create policy "deduction_types_proprietor_all" on public.deduction_types
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');

drop policy if exists "payroll_entry_deductions_proprietor_all" on public.payroll_entry_deductions;
create policy "payroll_entry_deductions_proprietor_all" on public.payroll_entry_deductions
  for all using (school_id = public.current_school_id() and public.current_role() = 'proprietor')
  with check (school_id = public.current_school_id() and public.current_role() = 'proprietor');
