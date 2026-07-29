-- Demo/dev seed data. Safe to re-run (uses fixed ids).
-- After running this, sign up a user through the app's /login page (Supabase Auth
-- "Sign up"), then run the snippet at the bottom of this file to link that user to
-- the demo school as the proprietor.

insert into public.schools (id, name, address, current_session, current_term)
values (
  '00000000-0000-0000-0000-000000000001',
  'Bright Future Academy',
  '12 Adeola Street, Lagos',
  '2025/2026',
  '2'
)
on conflict (id) do nothing;

insert into public.classes (id, school_id, name, session, term)
values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'JSS1A', '2025/2026', '2'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'JSS2A', '2025/2026', '2')
on conflict (id) do nothing;

insert into public.students (id, school_id, full_name, class_id, date_of_birth, parent_name, parent_phone, admission_date)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Chidinma Okafor', '00000000-0000-0000-0000-000000000011', '2012-03-14', 'Mrs. Okafor', '+2348012345001', '2023-09-01'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Tunde Bakare', '00000000-0000-0000-0000-000000000011', '2012-07-02', 'Mr. Bakare', '+2348012345002', '2023-09-01'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Amaka Nwosu', '00000000-0000-0000-0000-000000000012', '2011-11-20', 'Mrs. Nwosu', '+2348012345003', '2022-09-01')
on conflict (id) do nothing;

insert into public.fee_types (id, school_id, name)
values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'School Fees')
on conflict (id) do nothing;

insert into public.fee_records (school_id, student_id, fee_type_id, session, term, amount_expected)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '2025/2026', '2', 45000),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000201', '2025/2026', '2', 45000),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000201', '2025/2026', '2', 50000)
on conflict (student_id, session, term, fee_type_id) do nothing;

insert into public.fee_payments (school_id, fee_record_id, amount, payment_date, method)
select '00000000-0000-0000-0000-000000000001', id, 45000, current_date - 10, 'transfer'
from public.fee_records where student_id = '00000000-0000-0000-0000-000000000101' and term = '2'
on conflict do nothing;

insert into public.fee_payments (school_id, fee_record_id, amount, payment_date, method)
select '00000000-0000-0000-0000-000000000001', id, 20000, current_date - 5, 'cash'
from public.fee_records where student_id = '00000000-0000-0000-0000-000000000102' and term = '2'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- After signing up through the app with e.g. admin@brightfuture.test, run:
--
-- update public.app_users
-- set school_id = '00000000-0000-0000-0000-000000000001', role = 'proprietor', name = 'School Proprietor'
-- where email = 'admin@brightfuture.test';
--
-- (The handle_new_user trigger — see 0005_auth_trigger.sql — creates the
-- app_users row automatically on signup with role defaulting to 'teacher'
-- and no school_id; this snippet promotes it.)
-- ---------------------------------------------------------------------------
