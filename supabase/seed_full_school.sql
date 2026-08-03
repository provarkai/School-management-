-- ============================================================================
-- Full demo school seed: "Bright Horizons Academy"
--
-- Creates a brand-new school with real Supabase Auth logins for every
-- staff member and a representative set of parents, then populates every
-- table that a school actually in session would have data in: classes,
-- subjects, students (admission numbers via the real next_admission_number()
-- function), fees + payments, attendance, results (with CA/exam components
-- and grades), report card traits, timetable, hostel + transport, payroll,
-- expenses, admissions pipeline, staff ops (leave/lesson notes), messaging,
-- exams, curriculum progress, result-checker PINs, and a couple of activity
-- log / audit entries.
--
-- Demo password for every seeded login (staff and parent alike): Demo1234!
--
-- Not seeded, on purpose:
--   - student_documents / lesson note & message-log file attachments — these
--     need a real file in Supabase Storage; a fabricated file_path would
--     show a broken "download" link in the UI, which is worse than empty.
--   - platform_admins / platform_admin_logs — platform-level, not part of
--     any one school.
--   - assistant_usage — only meaningful once someone actually uses the chat.
--
-- Safe to run once against a fresh-ish project. It does NOT check for an
-- existing "Bright Horizons Academy" — running it twice creates a second
-- school and a full set of duplicate logins (the emails are unique, so a
-- second run will fail on the auth.users email uniqueness constraint before
-- anything duplicates silently).
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Scratch tables to carry generated ids between steps of this script.
-- ----------------------------------------------------------------------------
create temp table tmp_school (id uuid);
create temp table tmp_people (label text primary key, auth_id uuid);
create temp table tmp_classes (label text primary key, id uuid, teacher_id uuid);
create temp table tmp_campuses (label text primary key, id uuid);
create temp table tmp_subjects (label text primary key, id uuid);
create temp table tmp_students (label text primary key, id uuid, class_label text);
create temp table tmp_fee_types (label text primary key, id uuid);
create temp table tmp_period_slots (pos int primary key, id uuid);
create temp table tmp_hostels (label text primary key, id uuid);
create temp table tmp_hostel_rooms (label text primary key, id uuid, hostel_label text);
create temp table tmp_bus_routes (label text primary key, id uuid);
create temp table tmp_bus_stops (label text primary key, id uuid, route_label text);
create temp table tmp_expense_categories (label text primary key, id uuid);
create temp table tmp_deduction_types (label text primary key, id uuid);
create temp table tmp_components (label text primary key, id uuid, kind text, max_score numeric);
create temp table tmp_traits (label text primary key, id uuid);

-- ----------------------------------------------------------------------------
-- Helper: create one Supabase Auth user (+ identity) and return its id.
-- Session-scoped (pg_temp), so it vanishes with this script.
-- ----------------------------------------------------------------------------
create function pg_temp.seed_user(p_email text, p_name text, p_extra jsonb default '{}'::jsonb)
returns uuid
language plpgsql
as $fn$
declare
  new_id uuid := gen_random_uuid();
  meta jsonb := jsonb_build_object('name', p_name) || p_extra;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    p_email, crypt('Demo1234!', gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, meta,
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_id, jsonb_build_object('sub', new_id::text, 'email', p_email),
    'email', new_id::text, now(), now(), now()
  );

  return new_id;
end;
$fn$;

-- ============================================================================
-- 1. The school itself, mirroring what bootstrap_school() sets up for a
--    brand-new school (assessment components, grade bands, report card
--    traits) since there's no authenticated session here to call that RPC.
-- ============================================================================
with new_school as (
  insert into public.schools (
    name, address, phone, current_session, current_term, admission_prefix,
    withhold_results_when_owing
  ) values (
    'Bright Horizons Academy', '14 Ogunlana Drive, Surulere, Lagos', '+2348023456789',
    '2025/2026', '2', 'BHA', false
  )
  returning id
)
insert into tmp_school select id from new_school;

insert into public.assessment_components (school_id, name, kind, max_score, position)
select (select id from tmp_school), c.name, c.kind, c.max_score, c.position
from (values ('CA1', 'ca', 20::numeric, 0), ('CA2', 'ca', 20::numeric, 1), ('Exam', 'exam', 60::numeric, 2))
  as c(name, kind, max_score, position);

insert into tmp_components (label, id, kind, max_score)
select name, id, kind, max_score from public.assessment_components where school_id = (select id from tmp_school);

insert into public.grade_bands (school_id, letter, min_score)
select (select id from tmp_school), g.letter, g.min_score
from (values ('A', 70::numeric), ('B', 60::numeric), ('C', 50::numeric), ('D', 45::numeric), ('E', 40::numeric), ('F', 0::numeric))
  as g(letter, min_score);

insert into public.report_card_traits (school_id, name, domain, position)
select (select id from tmp_school), t.name, t.domain, t.position
from (values
  ('Punctuality', 'affective', 0), ('Neatness', 'affective', 1), ('Honesty', 'affective', 2),
  ('Politeness', 'affective', 3), ('Cooperation', 'affective', 4),
  ('Handwriting', 'psychomotor', 5), ('Sports', 'psychomotor', 6), ('Musical Skills', 'psychomotor', 7)
) as t(name, domain, position);

insert into tmp_traits (label, id) select name, id from public.report_card_traits where school_id = (select id from tmp_school);

-- ============================================================================
-- 2. People — one auth account per staff member and per linked parent.
-- ============================================================================
insert into tmp_people (label, auth_id) values
  ('proprietor', pg_temp.seed_user('proprietor@brighthorizons.test', 'Folake Adeyemi')),
  ('teacher.nursery1', pg_temp.seed_user('teacher.nursery1@brighthorizons.test', 'Chioma Nwankwo')),
  ('teacher.primary1', pg_temp.seed_user('teacher.primary1@brighthorizons.test', 'Emeka Obi')),
  ('teacher.primary5', pg_temp.seed_user('teacher.primary5@brighthorizons.test', 'Ngozi Eze')),
  ('teacher.jss1', pg_temp.seed_user('teacher.jss1@brighthorizons.test', 'Tunde Bakare')),
  ('teacher.jss3', pg_temp.seed_user('teacher.jss3@brighthorizons.test', 'Aisha Bello')),
  ('teacher.sss2', pg_temp.seed_user('teacher.sss2@brighthorizons.test', 'Ikechukwu Chukwu')),
  ('staff.bursar', pg_temp.seed_user('bursar@brighthorizons.test', 'Segun Adewale')),
  ('staff.admissions', pg_temp.seed_user('admissions@brighthorizons.test', 'Blessing Udo')),
  ('staff.viceprincipal', pg_temp.seed_user('viceprincipal@brighthorizons.test', 'Grace Okonkwo')),
  ('staff.matron', pg_temp.seed_user('matron@brighthorizons.test', 'Patience Nwosu')),
  ('parent.eze', pg_temp.seed_user('parent.eze@brighthorizons.test', 'Chidinma Eze', '{"account_type":"parent","phone":"+2348011110001"}'::jsonb)),
  ('parent.nwosu', pg_temp.seed_user('parent.nwosu@brighthorizons.test', 'Uche Nwosu', '{"account_type":"parent","phone":"+2348011110002"}'::jsonb)),
  ('parent.yusuf', pg_temp.seed_user('parent.yusuf@brighthorizons.test', 'Fatima Yusuf', '{"account_type":"parent","phone":"+2348011110003"}'::jsonb)),
  ('parent.okafor', pg_temp.seed_user('parent.okafor@brighthorizons.test', 'Emmanuel Okafor', '{"account_type":"parent","phone":"+2348011110004"}'::jsonb)),
  ('parent.adebayo', pg_temp.seed_user('parent.adebayo@brighthorizons.test', 'Grace Adebayo', '{"account_type":"parent","phone":"+2348011110005"}'::jsonb)),
  ('parent.nnamdi', pg_temp.seed_user('parent.nnamdi@brighthorizons.test', 'Kelechi Nnamdi', '{"account_type":"parent","phone":"+2348011110006"}'::jsonb)),
  ('parent.suleiman', pg_temp.seed_user('parent.suleiman@brighthorizons.test', 'Amina Suleiman', '{"account_type":"parent","phone":"+2348011110007"}'::jsonb));

-- Promote the proprietor and attach every staff member to the school.
update public.app_users set school_id = (select id from tmp_school), role = 'proprietor', gender = 'female'
where id = (select auth_id from tmp_people where label = 'proprietor');

update public.app_users set school_id = (select id from tmp_school), role = 'teacher', phone = '+2348012220001', gender = 'female'
where id = (select auth_id from tmp_people where label = 'teacher.nursery1');
update public.app_users set school_id = (select id from tmp_school), role = 'teacher', phone = '+2348012220002', gender = 'male'
where id = (select auth_id from tmp_people where label = 'teacher.primary1');
update public.app_users set school_id = (select id from tmp_school), role = 'teacher', phone = '+2348012220003', gender = 'female'
where id = (select auth_id from tmp_people where label = 'teacher.primary5');
update public.app_users set school_id = (select id from tmp_school), role = 'teacher', phone = '+2348012220004', gender = 'male', subject = 'Mathematics'
where id = (select auth_id from tmp_people where label = 'teacher.jss1');
update public.app_users set school_id = (select id from tmp_school), role = 'teacher', phone = '+2348012220005', gender = 'female', subject = 'English Language'
where id = (select auth_id from tmp_people where label = 'teacher.jss3');
update public.app_users set school_id = (select id from tmp_school), role = 'teacher', phone = '+2348012220006', gender = 'male', subject = 'Biology'
where id = (select auth_id from tmp_people where label = 'teacher.sss2');

update public.app_users set school_id = (select id from tmp_school), role = 'staff', phone = '+2348012230001', gender = 'male', job_title = 'Bursar'
where id = (select auth_id from tmp_people where label = 'staff.bursar');
update public.app_users set school_id = (select id from tmp_school), role = 'staff', phone = '+2348012230002', gender = 'female', job_title = 'Admissions Officer'
where id = (select auth_id from tmp_people where label = 'staff.admissions');
-- protect_school_admin_flag() (0030_school_admin.sql) requires auth.uid()
-- to resolve to a proprietor before allowing an is_school_admin change —
-- there's no authenticated session running this script, so it's disabled
-- for just this one update and re-enabled immediately after.
alter table public.app_users disable trigger protect_school_admin_flag;
update public.app_users set school_id = (select id from tmp_school), role = 'staff', phone = '+2348012230003', gender = 'female', job_title = 'Vice Principal', is_school_admin = true
where id = (select auth_id from tmp_people where label = 'staff.viceprincipal');
alter table public.app_users enable trigger protect_school_admin_flag;
update public.app_users set school_id = (select id from tmp_school), role = 'staff', phone = '+2348012230004', gender = 'female', job_title = 'Hostel Matron'
where id = (select auth_id from tmp_people where label = 'staff.matron');

-- Bursar gets the "fees" module without full admin; admissions officer gets "admissions".
insert into public.staff_permissions (school_id, staff_id, permission, granted_by)
values
  ((select id from tmp_school), (select auth_id from tmp_people where label = 'staff.bursar'), 'fees',
   (select auth_id from tmp_people where label = 'proprietor')),
  ((select id from tmp_school), (select auth_id from tmp_people where label = 'staff.admissions'), 'admissions',
   (select auth_id from tmp_people where label = 'proprietor'));

-- ============================================================================
-- 3. Campuses, classes, subjects
-- ============================================================================
insert into public.campuses (school_id, name, address)
values
  ((select id from tmp_school), 'Main Campus', '14 Ogunlana Drive, Surulere, Lagos'),
  ((select id from tmp_school), 'Annex Campus', '9 Bode Thomas Street, Surulere, Lagos');
insert into tmp_campuses (label, id) select name, id from public.campuses where school_id = (select id from tmp_school);

insert into public.classes (school_id, name, teacher_id, session, term, campus_id)
values
  ((select id from tmp_school), 'Nursery 1', (select auth_id from tmp_people where label = 'teacher.nursery1'), '2025/2026', '2', (select id from tmp_campuses where label = 'Main Campus')),
  ((select id from tmp_school), 'Primary 1', (select auth_id from tmp_people where label = 'teacher.primary1'), '2025/2026', '2', (select id from tmp_campuses where label = 'Main Campus')),
  ((select id from tmp_school), 'Primary 5', (select auth_id from tmp_people where label = 'teacher.primary5'), '2025/2026', '2', (select id from tmp_campuses where label = 'Main Campus')),
  ((select id from tmp_school), 'JSS 1', (select auth_id from tmp_people where label = 'teacher.jss1'), '2025/2026', '2', (select id from tmp_campuses where label = 'Annex Campus')),
  ((select id from tmp_school), 'JSS 3', (select auth_id from tmp_people where label = 'teacher.jss3'), '2025/2026', '2', (select id from tmp_campuses where label = 'Annex Campus')),
  ((select id from tmp_school), 'SSS 2', (select auth_id from tmp_people where label = 'teacher.sss2'), '2025/2026', '2', (select id from tmp_campuses where label = 'Annex Campus'));
insert into tmp_classes (label, id, teacher_id) select name, id, teacher_id from public.classes where school_id = (select id from tmp_school);

insert into public.subjects (school_id, name)
select (select id from tmp_school), n from unnest(array[
  'Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Civic Education',
  'Christian Religious Studies', 'Physical & Health Education', 'Computer Studies',
  'Biology', 'Chemistry', 'Physics', 'Economics'
]) as n;
insert into tmp_subjects (label, id) select name, id from public.subjects where school_id = (select id from tmp_school);

-- Per-class subject list, used for both the timetable and results below.
create temp table tmp_class_subjects (class_label text, subject_label text);
insert into tmp_class_subjects values
  ('Nursery 1', 'Mathematics'), ('Nursery 1', 'English Language'), ('Nursery 1', 'Basic Science'), ('Nursery 1', 'Physical & Health Education'),
  ('Primary 1', 'Mathematics'), ('Primary 1', 'English Language'), ('Primary 1', 'Basic Science'), ('Primary 1', 'Social Studies'), ('Primary 1', 'Christian Religious Studies'),
  ('Primary 5', 'Mathematics'), ('Primary 5', 'English Language'), ('Primary 5', 'Basic Science'), ('Primary 5', 'Social Studies'), ('Primary 5', 'Civic Education'), ('Primary 5', 'Computer Studies'),
  ('JSS 1', 'Mathematics'), ('JSS 1', 'English Language'), ('JSS 1', 'Basic Science'), ('JSS 1', 'Social Studies'), ('JSS 1', 'Civic Education'), ('JSS 1', 'Computer Studies'), ('JSS 1', 'Christian Religious Studies'),
  ('JSS 3', 'Mathematics'), ('JSS 3', 'English Language'), ('JSS 3', 'Basic Science'), ('JSS 3', 'Social Studies'), ('JSS 3', 'Civic Education'), ('JSS 3', 'Computer Studies'), ('JSS 3', 'Christian Religious Studies'),
  ('SSS 2', 'Mathematics'), ('SSS 2', 'English Language'), ('SSS 2', 'Biology'), ('SSS 2', 'Chemistry'), ('SSS 2', 'Physics'), ('SSS 2', 'Economics'), ('SSS 2', 'Computer Studies');

-- ============================================================================
-- 4. Fee types, hostel, transport, expense categories, deduction types
--    (all school-wide setup, needed before students/fees/payroll below)
-- ============================================================================
insert into public.fee_types (school_id, name)
select (select id from tmp_school), n from unnest(array['Tuition', 'Feeding', 'Books & Materials', 'Transport', 'Hostel']) as n;
insert into tmp_fee_types (label, id) select name, id from public.fee_types where school_id = (select id from tmp_school);

insert into public.hostels (school_id, name, address, warden_id)
values ((select id from tmp_school), 'Unity Hostel', 'Main Campus, Block C', (select auth_id from tmp_people where label = 'staff.matron'));
insert into tmp_hostels (label, id) select name, id from public.hostels where school_id = (select id from tmp_school);

insert into public.hostel_rooms (school_id, hostel_id, name, capacity)
select (select id from tmp_school), (select id from tmp_hostels where label = 'Unity Hostel'), r.name, r.capacity
from (values ('Room 1', 4), ('Room 2', 4), ('Room 3', 4)) as r(name, capacity);
insert into tmp_hostel_rooms (label, id, hostel_label)
select name, id, 'Unity Hostel' from public.hostel_rooms where school_id = (select id from tmp_school);

insert into public.bus_routes (school_id, name, driver_name, driver_phone, vehicle_info)
values
  ((select id from tmp_school), 'Route A — Surulere/Yaba', 'Mr. Bala Ahmed', '+2348033330001', 'Toyota Hiace, LND-234-KJA'),
  ((select id from tmp_school), 'Route B — Ikeja/Ogba', 'Mr. Peter Nnamani', '+2348033330002', 'Toyota Hiace, LND-567-KJA');
insert into tmp_bus_routes (label, id) select name, id from public.bus_routes where school_id = (select id from tmp_school);

insert into public.bus_stops (school_id, route_id, name, pickup_time, drop_time)
select (select id from tmp_school), (select id from tmp_bus_routes where label = 'Route A — Surulere/Yaba'), s.name, s.pickup, s.drop
from (values ('Adeniran Ogunsanya', '6:30am', '3:30pm'), ('Yaba Bus Stop', '6:50am', '3:50pm')) as s(name, pickup, drop);
insert into public.bus_stops (school_id, route_id, name, pickup_time, drop_time)
select (select id from tmp_school), (select id from tmp_bus_routes where label = 'Route B — Ikeja/Ogba'), s.name, s.pickup, s.drop
from (values ('Allen Avenue', '6:20am', '3:20pm'), ('Ogba Roundabout', '6:45am', '3:45pm')) as s(name, pickup, drop);
insert into tmp_bus_stops (label, id, route_label)
select bs.name, bs.id, br.name from public.bus_stops bs join public.bus_routes br on br.id = bs.route_id where bs.school_id = (select id from tmp_school);

insert into public.expense_categories (school_id, name, termly_budget)
select (select id from tmp_school), c.name, c.budget
from (values ('Utilities', 250000::numeric), ('Maintenance', 400000::numeric), ('Stationery & Supplies', 150000::numeric), ('Staff Welfare', 200000::numeric))
  as c(name, budget);
insert into tmp_expense_categories (label, id) select name, id from public.expense_categories where school_id = (select id from tmp_school);

insert into public.deduction_types (school_id, name)
select (select id from tmp_school), n from unnest(array['PAYE Tax', 'Pension', 'NHF', 'Loan Repayment'])as n;
insert into tmp_deduction_types (label, id) select name, id from public.deduction_types where school_id = (select id from tmp_school);

-- ============================================================================
-- 5. Period slots + timetable (Mon–Fri, 6 teaching periods + a mid-morning
--    break, shared across the school)
-- ============================================================================
insert into public.period_slots (school_id, position, label, start_time, end_time, is_break)
select (select id from tmp_school), p.pos, p.label, p.start_time, p.end_time, p.is_break
from (values
  (1, 'Period 1', '08:00'::time, '08:40'::time, false),
  (2, 'Period 2', '08:40'::time, '09:20'::time, false),
  (3, 'Period 3', '09:20'::time, '10:00'::time, false),
  (4, 'Break', '10:00'::time, '10:20'::time, true),
  (5, 'Period 4', '10:20'::time, '11:00'::time, false),
  (6, 'Period 5', '11:00'::time, '11:40'::time, false),
  (7, 'Period 6', '11:40'::time, '12:20'::time, false)
) as p(pos, label, start_time, end_time, is_break);
insert into tmp_period_slots (pos, id) select "position", id from public.period_slots where school_id = (select id from tmp_school);

-- One subject per non-break period per weekday per class, cycling through
-- that class's own subject list so every registered subject shows up on
-- the timetable at least once during the week. Sequential 0-based indexes
-- (not the raw period `pos`, which skips 4 for the break, and not a
-- non-deterministic row_number() picked per join) so the cycling math
-- below is exact.
create temp table tmp_teaching_periods as
select id, row_number() over (order by pos) - 1 as idx
from tmp_period_slots
where pos <> 4;

create temp table tmp_class_subject_idx as
select
  class_label, subject_label,
  row_number() over (partition by class_label order by subject_label) - 1 as idx,
  count(*) over (partition by class_label) as subject_count
from tmp_class_subjects;

insert into public.timetable_entries (school_id, class_id, period_slot_id, day_of_week, subject_id, teacher_id)
select
  (select id from tmp_school),
  c.id,
  tp.id,
  d.dow,
  sub.id,
  c.teacher_id
from tmp_classes c
cross join tmp_teaching_periods tp
cross join (select generate_series(1, 5) as dow) d
join tmp_class_subject_idx csi
  on csi.class_label = c.label
  and csi.idx = (tp.idx + (d.dow - 1) * 6) % csi.subject_count
join tmp_subjects sub on sub.label = csi.subject_label
on conflict (class_id, period_slot_id, day_of_week) do nothing;

-- ============================================================================
-- 6. Academic calendar, staff notices, leave requests, lesson notes
-- ============================================================================
insert into public.academic_calendar_events (school_id, title, description, event_type, start_date, end_date, created_by)
values
  ((select id from tmp_school), 'Second Term Resumption', 'All students resume for the second term.', 'term_start', date '2026-01-12', null, (select auth_id from tmp_people where label = 'proprietor')),
  ((select id from tmp_school), 'PTA Meeting', 'General meeting for all parents in the school hall.', 'pta_meeting', current_date + 10, null, (select auth_id from tmp_people where label = 'proprietor')),
  ((select id from tmp_school), 'Mid-term Break', null, 'holiday', current_date + 20, current_date + 24, (select auth_id from tmp_people where label = 'proprietor')),
  ((select id from tmp_school), 'Second Term Examination', 'Examinations begin for all classes.', 'exam', current_date + 45, current_date + 52, (select auth_id from tmp_people where label = 'proprietor')),
  ((select id from tmp_school), 'Inter-house Sports', 'Annual sports competition.', 'event', current_date + 60, null, (select auth_id from tmp_people where label = 'proprietor')),
  ((select id from tmp_school), 'Second Term Ends', null, 'term_end', current_date + 65, null, (select auth_id from tmp_people where label = 'proprietor'));

insert into public.staff_notices (school_id, title, body, audience, created_by)
values
  ((select id from tmp_school), 'Staff Meeting Friday', 'All staff are to attend the general staff meeting this Friday by 2pm in the staff room.', 'all', (select auth_id from tmp_people where label = 'proprietor')),
  ((select id from tmp_school), 'Report Card Deadline', 'All class teachers should submit report card scores by the end of next week.', 'teachers', (select auth_id from tmp_people where label = 'proprietor'));

insert into public.leave_requests (school_id, staff_id, leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at, review_note)
values
  ((select id from tmp_school), (select auth_id from tmp_people where label = 'teacher.primary1'), 'sick', current_date - 5, current_date - 3, 'Down with malaria.', 'approved', (select auth_id from tmp_people where label = 'proprietor'), now() - interval '4 days', 'Get well soon.'),
  ((select id from tmp_school), (select auth_id from tmp_people where label = 'teacher.jss3'), 'annual', current_date + 15, current_date + 20, 'Family travel.', 'pending', null, null, null);

insert into public.lesson_notes (school_id, class_id, subject, topic, session, term, lesson_date, content, status, created_by, submitted_at)
values
  ((select id from tmp_school), (select id from tmp_classes where label = 'JSS 1'), 'Mathematics', 'Simple Equations', '2025/2026', '2', current_date + 2,
   'Introduce simple linear equations, solve for x with worked examples, assign practice problems.', 'submitted',
   (select auth_id from tmp_people where label = 'teacher.jss1'), now() - interval '1 day'),
  ((select id from tmp_school), (select id from tmp_classes where label = 'SSS 2'), 'Biology', 'Cell Structure', '2025/2026', '2', current_date + 3,
   'Structure and function of plant and animal cells, diagrams, comparison table.', 'approved',
   (select auth_id from tmp_people where label = 'teacher.sss2'), now() - interval '3 days');
update public.lesson_notes set reviewed_by = (select auth_id from tmp_people where label = 'proprietor'), reviewed_at = now() - interval '2 days'
where status = 'approved' and school_id = (select id from tmp_school);

-- ============================================================================
-- 7. Students — most senior class first, so admission numbers ascend with
--    seniority (matching the school's own convention). next_admission_number()
--    is the same atomic function the app itself uses.
-- ============================================================================
create temp table tmp_student_seed (
  class_label text, full_name text, gender text, dob date,
  parent_name text, parent_phone text, parent_email text, linked_parent_label text
);

insert into tmp_student_seed values
  -- SSS 2
  ('SSS 2', 'Emeka Okafor Jr', 'male', '2009-04-11', 'Emmanuel Okafor', '+2348011110004', 'parent.okafor@brighthorizons.test', 'parent.okafor'),
  ('SSS 2', 'Temitope Adebayo', 'female', '2009-08-02', 'Grace Adebayo', '+2348011110005', 'parent.adebayo@brighthorizons.test', 'parent.adebayo'),
  ('SSS 2', 'Abdullahi Yusuf', 'male', '2009-01-23', 'Mr. Yusuf Abdullahi Sr', '+2348022220001', null, null),
  ('SSS 2', 'Grace Effiong', 'female', '2009-06-17', 'Mrs. Ime Effiong', '+2348022220002', null, null),
  ('SSS 2', 'Chibuike Nwosu', 'male', '2009-11-30', 'Mr. Emeka Nwosu', '+2348022220003', null, null),
  ('SSS 2', 'Halimat Bello', 'female', '2009-03-05', 'Alhaji Bello Sani', '+2348022220004', null, null),
  ('SSS 2', 'Victor Ekpo', 'male', '2009-09-14', 'Mr. Sunday Ekpo', '+2348022220005', null, null),
  ('SSS 2', 'Blessing Adeleke', 'female', '2009-12-08', 'Mrs. Kemi Adeleke', '+2348022220006', null, null),
  -- JSS 3
  ('JSS 3', 'Chiamaka Okafor', 'female', '2012-02-19', 'Emmanuel Okafor', '+2348011110004', 'parent.okafor@brighthorizons.test', 'parent.okafor'),
  ('JSS 3', 'Femi Adekunle', 'male', '2012-05-27', 'Mr. Adekunle Bayo', '+2348022220007', null, null),
  ('JSS 3', 'Rahama Sani', 'female', '2012-07-09', 'Alhaji Sani Ahmed', '+2348022220008', null, null),
  ('JSS 3', 'Christopher Eze', 'male', '2012-10-02', 'Mr. Ferdinand Eze', '+2348022220009', null, null),
  ('JSS 3', 'Blessing Okoro', 'female', '2012-01-14', 'Mrs. Nkechi Okoro', '+2348022220010', null, null),
  ('JSS 3', 'Hassan Musa', 'male', '2012-08-21', 'Alhaji Musa Garba', '+2348022220011', null, null),
  ('JSS 3', 'Ifeoma Nwachukwu', 'female', '2012-03-30', 'Mrs. Chidinma Nwachukwu', '+2348022220012', null, null),
  ('JSS 3', 'Daniel Umeh', 'male', '2012-06-06', 'Mr. Paul Umeh', '+2348022220013', null, null),
  -- JSS 1
  ('JSS 1', 'Adaobi Eze', 'female', '2014-04-25', 'Chidinma Eze', '+2348011110001', 'parent.eze@brighthorizons.test', 'parent.eze'),
  ('JSS 1', 'Ogechi Nnamdi', 'female', '2014-09-12', 'Kelechi Nnamdi', '+2348011110006', 'parent.nnamdi@brighthorizons.test', 'parent.nnamdi'),
  ('JSS 1', 'Tobi Ogundele', 'male', '2014-02-08', 'Mr. Sola Ogundele', '+2348022220014', null, null),
  ('JSS 1', 'Maryam Abdullahi', 'female', '2014-11-19', 'Malama Zara Abdullahi', '+2348022220015', null, null),
  ('JSS 1', 'Chinedu Okeke', 'male', '2014-07-03', 'Mr. Ikenna Okeke', '+2348022220016', null, null),
  ('JSS 1', 'Esther Bassey', 'female', '2014-05-16', 'Mrs. Comfort Bassey', '+2348022220017', null, null),
  ('JSS 1', 'Yakubu Ibrahim', 'male', '2014-12-01', 'Mallam Ibrahim Musa', '+2348022220018', null, null),
  ('JSS 1', 'Onyinye Okafor', 'female', '2014-08-28', 'Mrs. Adaeze Okafor', '+2348022220019', null, null),
  -- Primary 5
  ('Primary 5', 'Chukwuemeka Eze', 'male', '2016-03-02', 'Chidinma Eze', '+2348011110001', 'parent.eze@brighthorizons.test', 'parent.eze'),
  ('Primary 5', 'Amaka Ibrahim', 'female', '2016-06-21', 'Mrs. Halima Ibrahim', '+2348022220020', null, null),
  ('Primary 5', 'John Peter', 'male', '2016-01-09', 'Mr. Peter John Sr', '+2348022220021', null, null),
  ('Primary 5', 'Ngozi Adeyemi', 'female', '2016-09-27', 'Mrs. Bukola Adeyemi', '+2348022220022', null, null),
  ('Primary 5', 'Suleiman Garba', 'male', '2016-04-14', 'Alhaji Garba Bello', '+2348022220023', null, null),
  ('Primary 5', 'Blessing Nnaji', 'female', '2016-11-05', 'Mrs. Adaugo Nnaji', '+2348022220024', null, null),
  ('Primary 5', 'Kingsley Obi', 'male', '2016-07-18', 'Mr. Chukwudi Obi', '+2348022220025', null, null),
  ('Primary 5', 'Aisha Lawal', 'female', '2016-02-23', 'Alhaja Lawal Fatima', '+2348022220026', null, null),
  -- Primary 1
  ('Primary 1', 'Ibrahim Yusuf', 'male', '2019-05-11', 'Fatima Yusuf', '+2348011110003', 'parent.yusuf@brighthorizons.test', 'parent.yusuf'),
  ('Primary 1', 'Musa Suleiman', 'male', '2019-08-04', 'Amina Suleiman', '+2348011110007', null, null),
  ('Primary 1', 'Comfort Eze', 'female', '2019-03-16', 'Mrs. Adaeze Eze', '+2348022220027', null, null),
  ('Primary 1', 'David Nwachukwu', 'male', '2019-10-29', 'Mr. Emeka Nwachukwu', '+2348022220028', null, null),
  ('Primary 1', 'Halima Bello', 'female', '2019-01-07', 'Alhaji Bello Musa', '+2348022220029', null, null),
  ('Primary 1', 'Victor Udoh', 'male', '2019-06-22', 'Mr. Sunday Udoh', '+2348022220030', null, null),
  ('Primary 1', 'Rita Okonkwo', 'female', '2019-09-13', 'Mrs. Ijeoma Okonkwo', '+2348022220031', null, null),
  ('Primary 1', 'Emmanuel Danjuma', 'male', '2019-12-19', 'Mr. Danjuma Yakubu', '+2348022220032', null, null),
  -- Nursery 1
  ('Nursery 1', 'Zainab Nwosu', 'female', '2022-04-06', 'Uche Nwosu', '+2348011110002', 'parent.nwosu@brighthorizons.test', 'parent.nwosu'),
  ('Nursery 1', 'Daniel Okoro', 'male', '2022-07-15', 'Mr. Chukwuma Okoro', '+2348022220033', null, null),
  ('Nursery 1', 'Precious Etim', 'female', '2022-02-28', 'Mrs. Idara Etim', '+2348022220034', null, null),
  ('Nursery 1', 'Aliyu Mohammed', 'male', '2022-09-09', 'Alhaji Mohammed Sani', '+2348022220035', null, null),
  ('Nursery 1', 'Blessing Chukwu', 'female', '2022-05-20', 'Mrs. Ogechi Chukwu', '+2348022220036', null, null),
  ('Nursery 1', 'Samuel Ojo', 'male', '2022-11-11', 'Mr. Femi Ojo', '+2348022220037', null, null),
  ('Nursery 1', 'Faith Anyanwu', 'female', '2022-03-03', 'Mrs. Nkiru Anyanwu', '+2348022220038', null, null);

do $$
declare
  r record;
  new_student_id uuid;
  admission_no text;
begin
  for r in select * from tmp_student_seed loop
    admission_no := public.next_admission_number((select id from tmp_school));
    insert into public.students (
      school_id, full_name, class_id, date_of_birth, gender,
      parent_name, parent_phone, parent_email, admission_number, admission_date, status
    ) values (
      (select id from tmp_school), r.full_name, (select id from tmp_classes where label = r.class_label),
      r.dob, r.gender, r.parent_name, r.parent_phone, r.parent_email, admission_no,
      date '2025-09-01', 'active'
    ) returning id into new_student_id;

    insert into tmp_students (label, id, class_label) values (r.full_name, new_student_id, r.class_label);
  end loop;
end $$;

-- Link the parents who have real portal accounts.
insert into public.parent_students (parent_id, student_id)
select (select auth_id from tmp_people where label = s.linked_parent_label), st.id
from tmp_student_seed s
join tmp_students st on st.label = s.full_name
where s.linked_parent_label is not null;

-- One redeemed invitation (Chidinma Eze, already linked above) and one
-- still-pending invitation (Amina Suleiman, not linked yet — she'll need to
-- open the link and accept it), so both states show up in the UI.
insert into public.parent_invitations (school_id, student_id, token, created_by, redeemed_at, redeemed_by)
values (
  (select id from tmp_school),
  (select id from tmp_students where label = 'Chukwuemeka Eze'),
  encode(gen_random_bytes(24), 'base64'),
  (select auth_id from tmp_people where label = 'proprietor'),
  now() - interval '20 days',
  (select auth_id from tmp_people where label = 'parent.eze')
);
insert into public.parent_invitations (school_id, student_id, token, created_by)
values (
  (select id from tmp_school),
  (select id from tmp_students where label = 'Musa Suleiman'),
  encode(gen_random_bytes(24), 'base64'),
  (select auth_id from tmp_people where label = 'proprietor')
);

insert into public.activity_logs (school_id, actor_id, actor_name, actor_role, action, summary)
values (
  (select id from tmp_school),
  (select auth_id from tmp_people where label = 'parent.eze'),
  'Chidinma Eze', 'parent', 'parent_invitation_redeemed',
  'Chidinma Eze linked to Chukwuemeka Eze via an invitation link.'
);

-- Assign hostel rooms (SSS 2 + JSS 3 boarders) and bus stops (a handful
-- across the junior classes) to a subset of students.
update public.students set hostel_room_id = (select id from tmp_hostel_rooms where label = 'Room 1')
where id in (select id from tmp_students where label in ('Abdullahi Yusuf', 'Chibuike Nwosu', 'Victor Ekpo'));
update public.students set hostel_room_id = (select id from tmp_hostel_rooms where label = 'Room 2')
where id in (select id from tmp_students where label in ('Grace Effiong', 'Halimat Bello', 'Blessing Adeleke'));
update public.students set hostel_room_id = (select id from tmp_hostel_rooms where label = 'Room 3')
where id in (select id from tmp_students where label in ('Femi Adekunle', 'Christopher Eze'));

update public.students set bus_stop_id = (select id from tmp_bus_stops where label = 'Adeniran Ogunsanya')
where id in (select id from tmp_students where label in ('Ibrahim Yusuf', 'Comfort Eze', 'Zainab Nwosu'));
update public.students set bus_stop_id = (select id from tmp_bus_stops where label = 'Allen Avenue')
where id in (select id from tmp_students where label in ('Chukwuemeka Eze', 'Adaobi Eze', 'Tobi Ogundele'));

-- Two withdrawn students for realism (transfer certificate / withdrawn-list demo).
update public.students
set status = 'withdrawn', withdrawn_at = current_date - 30, withdrawal_reason = 'Relocated with family to another city.', conduct_remark = 'Well-behaved, good academic standing.'
where id = (select id from tmp_students where label = 'Emmanuel Danjuma');
update public.students
set status = 'withdrawn', withdrawn_at = current_date - 60, withdrawal_reason = 'Transferred to a school closer to new residence.', conduct_remark = 'Respectful and diligent.'
where id = (select id from tmp_students where label = 'Daniel Okoro');

-- Custom fields, applied to every student.
insert into public.student_field_definitions (school_id, label, field_type, position)
values
  ((select id from tmp_school), 'State of Origin', 'text', 0),
  ((select id from tmp_school), 'Religion', 'select', 1);
update public.student_field_definitions set options = array['Christianity', 'Islam', 'Other']
where label = 'Religion' and school_id = (select id from tmp_school);

insert into public.student_field_values (school_id, student_id, field_definition_id, value)
select (select id from tmp_school), st.id,
  (select id from public.student_field_definitions where label = 'State of Origin' and school_id = (select id from tmp_school)),
  (array['Lagos', 'Anambra', 'Kano', 'Rivers', 'Ogun', 'Enugu', 'Kaduna'])[1 + (row_number() over (order by st.id))::int % 7]
from tmp_students st;

-- ============================================================================
-- 8. Subject registration (secondary classes) — student_subjects
-- ============================================================================
insert into public.student_subjects (school_id, student_id, subject_id, session)
select (select id from tmp_school), st.id, sub.id, '2025/2026'
from tmp_students st
join tmp_class_subjects cs on cs.class_label = st.class_label
join tmp_subjects sub on sub.label = cs.subject_label
where st.class_label in ('JSS 1', 'JSS 3', 'SSS 2');

-- ============================================================================
-- 9. Fees: records + payments
-- ============================================================================
create temp table tmp_class_fee_amount (class_label text, fee_label text, amount numeric);
insert into tmp_class_fee_amount values
  ('Nursery 1', 'Tuition', 60000), ('Nursery 1', 'Feeding', 15000), ('Nursery 1', 'Books & Materials', 10000),
  ('Primary 1', 'Tuition', 75000), ('Primary 1', 'Feeding', 18000), ('Primary 1', 'Books & Materials', 12000),
  ('Primary 5', 'Tuition', 75000), ('Primary 5', 'Feeding', 18000), ('Primary 5', 'Books & Materials', 12000),
  ('JSS 1', 'Tuition', 95000), ('JSS 1', 'Feeding', 20000), ('JSS 1', 'Books & Materials', 15000),
  ('JSS 3', 'Tuition', 95000), ('JSS 3', 'Feeding', 20000), ('JSS 3', 'Books & Materials', 15000),
  ('SSS 2', 'Tuition', 120000), ('SSS 2', 'Feeding', 22000), ('SSS 2', 'Books & Materials', 18000);

insert into public.fee_records (school_id, student_id, fee_type_id, session, term, amount_expected)
select (select id from tmp_school), st.id, ft.id, '2025/2026', '2', cfa.amount
from tmp_students st
join tmp_class_fee_amount cfa on cfa.class_label = st.class_label
join tmp_fee_types ft on ft.label = cfa.fee_label
where st.label not in ('Emmanuel Danjuma', 'Daniel Okoro'); -- skip the two withdrawn students

insert into public.fee_records (school_id, student_id, fee_type_id, session, term, amount_expected)
select (select id from tmp_school), s.id, (select id from tmp_fee_types where label = 'Transport'), '2025/2026', '2', 20000
from public.students s where s.bus_stop_id is not null and s.school_id = (select id from tmp_school);

insert into public.fee_records (school_id, student_id, fee_type_id, session, term, amount_expected)
select (select id from tmp_school), s.id, (select id from tmp_fee_types where label = 'Hostel'), '2025/2026', '2', 60000
from public.students s where s.hostel_room_id is not null and s.school_id = (select id from tmp_school);

-- Payments: roughly a third paid in full, a third partial, a third owing —
-- driven by each fee_record's own id so it's stable and varied, not random.
insert into public.fee_payments (school_id, fee_record_id, amount, payment_date, method, recorded_by)
select
  (select id from tmp_school), fr.id,
  case (abs(hashtext(fr.id::text)) % 3)
    when 0 then fr.amount_expected
    when 1 then round(fr.amount_expected * 0.5, -2)
  end,
  current_date - (abs(hashtext(fr.id::text)) % 20),
  case when abs(hashtext(fr.id::text)) % 2 = 0 then 'transfer' else 'cash' end,
  (select auth_id from tmp_people where label = 'staff.bursar')
from public.fee_records fr
where fr.school_id = (select id from tmp_school)
  and (abs(hashtext(fr.id::text)) % 3) in (0, 1);

-- ============================================================================
-- 10. Attendance — last 15 weekdays, students + staff
-- ============================================================================
create temp table tmp_school_days as
select d::date as day
from generate_series(current_date - 25, current_date, interval '1 day') d
where extract(isodow from d) < 6
order by day desc
limit 15;

insert into public.attendance (school_id, student_id, class_id, date, status, marked_by)
select
  (select id from tmp_school), st.id, (select id from tmp_classes where label = st.class_label), sd.day,
  case (abs(hashtext(st.id::text || sd.day::text)) % 20)
    when 0 then 'absent' when 1 then 'late' else 'present'
  end,
  (select teacher_id from public.classes where id = (select id from tmp_classes where label = st.class_label))
from tmp_students st
cross join tmp_school_days sd
join public.students s on s.id = st.id and s.status = 'active'
on conflict (student_id, date) do nothing;

insert into public.staff_attendance (school_id, staff_id, date, status, marked_by)
select
  (select id from tmp_school), p.auth_id, sd.day,
  case (abs(hashtext(p.auth_id::text || sd.day::text)) % 25)
    when 0 then 'absent' when 1 then 'late' else 'present'
  end,
  (select auth_id from tmp_people where label = 'proprietor')
from tmp_people p
cross join tmp_school_days sd
where p.label like 'teacher.%' or p.label like 'staff.%'
on conflict (staff_id, date) do nothing;

-- ============================================================================
-- 11. Results — current term, per class subject list, with CA/exam
--     component scores and a computed grade.
-- ============================================================================
do $$
declare
  r record;
  ca1 numeric; ca2 numeric; examscore numeric; total numeric; letter text;
  new_result_id uuid;
begin
  for r in
    select st.id as student_id, st.label as student_label, cs.subject_label
    from tmp_students st
    join public.students s on s.id = st.id and s.status = 'active'
    join tmp_class_subjects cs on cs.class_label = st.class_label
  loop
    -- Deterministic-but-varied scores from a hash of student+subject.
    ca1 := 10 + (abs(hashtext(r.student_id::text || r.subject_label || 'ca1')) % 11);       -- 10-20
    ca2 := 10 + (abs(hashtext(r.student_id::text || r.subject_label || 'ca2')) % 11);        -- 10-20
    examscore := 30 + (abs(hashtext(r.student_id::text || r.subject_label || 'exam')) % 31); -- 30-60
    total := ca1 + ca2 + examscore;
    letter := case
      when total >= 70 then 'A' when total >= 60 then 'B' when total >= 50 then 'C'
      when total >= 45 then 'D' when total >= 40 then 'E' else 'F'
    end;

    insert into public.results (school_id, student_id, subject, subject_id, session, term, ca_score, exam_score, grade)
    values (
      (select id from tmp_school), r.student_id, r.subject_label,
      (select id from tmp_subjects where label = r.subject_label),
      '2025/2026', '2', ca1 + ca2, examscore, letter
    )
    returning id into new_result_id;

    insert into public.result_component_scores (school_id, result_id, component_id, score)
    values
      ((select id from tmp_school), new_result_id, (select id from tmp_components where label = 'CA1'), ca1),
      ((select id from tmp_school), new_result_id, (select id from tmp_components where label = 'CA2'), ca2),
      ((select id from tmp_school), new_result_id, (select id from tmp_components where label = 'Exam'), examscore);
  end loop;
end $$;

-- Report card remarks + trait ratings for every active student.
insert into public.report_remarks (school_id, student_id, session, term, teacher_remark, principal_remark)
select (select id from tmp_school), st.id, '2025/2026', '2',
  'A dedicated learner who participates actively in class.',
  'Keep up the good work.'
from tmp_students st join public.students s on s.id = st.id and s.status = 'active';

insert into public.student_trait_ratings (school_id, student_id, trait_id, session, term, rating, updated_by)
select
  (select id from tmp_school), st.id, t.id, '2025/2026', '2',
  3 + (abs(hashtext(st.id::text || t.id::text)) % 3), -- 3-5
  (select teacher_id from public.classes where id = (select id from tmp_classes where label = st.class_label))
from tmp_students st
join public.students s on s.id = st.id and s.status = 'active'
cross join tmp_traits t;

-- ============================================================================
-- 12. Behavior incidents, assignments, learning resources
-- ============================================================================
insert into public.behavior_incidents (school_id, student_id, incident_date, category, severity, description, action_taken, recorded_by)
values
  ((select id from tmp_school), (select id from tmp_students where label = 'Tobi Ogundele'), current_date - 4, 'demerit', 'minor', 'Talking during assembly.', 'Verbal warning given.', (select auth_id from tmp_people where label = 'teacher.jss1')),
  ((select id from tmp_school), (select id from tmp_students where label = 'Onyinye Okafor'), current_date - 7, 'merit', 'minor', 'Helped a classmate understand a difficult topic.', 'Commended in class.', (select auth_id from tmp_people where label = 'teacher.jss1')),
  ((select id from tmp_school), (select id from tmp_students where label = 'Chibuike Nwosu'), current_date - 12, 'demerit', 'major', 'Skipped afternoon prep without permission.', 'Parents invited for a meeting.', (select auth_id from tmp_people where label = 'teacher.sss2'));

insert into public.assignments (school_id, class_id, subject, title, description, due_date, created_by)
values
  ((select id from tmp_school), (select id from tmp_classes where label = 'JSS 1'), 'Mathematics', 'Simple Equations Worksheet', 'Solve questions 1-20 in the workbook.', current_date + 5, (select auth_id from tmp_people where label = 'teacher.jss1')),
  ((select id from tmp_school), (select id from tmp_classes where label = 'SSS 2'), 'Biology', 'Cell Structure Essay', 'Write a 2-page essay comparing plant and animal cells.', current_date + 7, (select auth_id from tmp_people where label = 'teacher.sss2')),
  ((select id from tmp_school), (select id from tmp_classes where label = 'Primary 5'), 'English Language', 'Comprehension Passage', 'Read the passage and answer the questions that follow.', current_date + 4, (select auth_id from tmp_people where label = 'teacher.primary5'));

insert into public.learning_resources (school_id, class_id, subject, title, description, external_url, created_by)
values
  ((select id from tmp_school), (select id from tmp_classes where label = 'SSS 2'), 'Chemistry', 'Periodic Table Explainer', 'A short video explaining periodic trends.', 'https://www.youtube.com/watch?v=0RRVV4Diomg', (select auth_id from tmp_people where label = 'teacher.sss2')),
  ((select id from tmp_school), (select id from tmp_classes where label = 'JSS 1'), 'Mathematics', 'Equations Practice Sheet', 'Extra practice questions on simple equations.', 'https://example.com/resources/equations-practice', (select auth_id from tmp_people where label = 'teacher.jss1'));

-- ============================================================================
-- 13. Curriculum: syllabus topics + class progress
-- ============================================================================
insert into public.syllabus_topics (school_id, subject, session, term, position, title, created_by)
select (select id from tmp_school), t.subject, '2025/2026', '2', t.position, t.title, (select auth_id from tmp_people where label = 'proprietor')
from (values
  ('Mathematics', 0, 'Simple Equations'), ('Mathematics', 1, 'Fractions & Decimals'), ('Mathematics', 2, 'Word Problems'),
  ('Biology', 0, 'Cell Structure'), ('Biology', 1, 'Classification of Living Things'), ('Biology', 2, 'Nutrition')
) as t(subject, position, title);

insert into public.class_topic_progress (school_id, class_id, topic_id, status, updated_by)
select
  (select id from tmp_school), c.id, st.id,
  case when st.position = 0 then 'completed' when st.position = 1 then 'in_progress' else 'not_started' end,
  c.teacher_id
from public.syllabus_topics st
join tmp_classes c on (c.label = 'JSS 1' and st.subject = 'Mathematics') or (c.label = 'SSS 2' and st.subject = 'Biology')
where st.school_id = (select id from tmp_school);

-- ============================================================================
-- 14. Exams (online) — one published exam with questions and a couple of
--     completed attempts
-- ============================================================================
insert into public.exams (school_id, class_id, subject, title, session, term, duration_minutes, status, created_by)
values (
  (select id from tmp_school), (select id from tmp_classes where label = 'SSS 2'), 'Chemistry',
  'Chemistry Mid-term CBT', '2025/2026', '2', 30, 'published', (select auth_id from tmp_people where label = 'teacher.sss2')
);

insert into public.exam_questions (exam_id, position, question_text, options, correct_option, points)
select
  (select id from public.exams where school_id = (select id from tmp_school) limit 1),
  q.position, q.question_text, q.options::jsonb, q.correct_option, 10
from (values
  (0, 'What is the chemical symbol for Sodium?', '["Na", "So", "S", "N"]', 0),
  (1, 'Which of these is a noble gas?', '["Oxygen", "Neon", "Nitrogen", "Hydrogen"]', 1),
  (2, 'What is the pH of a neutral solution?', '["0", "14", "7", "1"]', 2)
) as q(position, question_text, options, correct_option);

insert into public.exam_attempts (exam_id, student_id, started_at, submitted_at, score, max_score)
select
  (select id from public.exams where school_id = (select id from tmp_school) limit 1),
  st.id, now() - interval '2 days', now() - interval '2 days' + interval '25 minutes', 20, 30
from tmp_students st where st.label in ('Temitope Adebayo', 'Grace Effiong');

-- ============================================================================
-- 15. Result checker credentials — one batch of PINs for SSS 2
-- ============================================================================
insert into public.result_checker_batches (school_id, session, term, quantity, price, note, created_by)
values ((select id from tmp_school), '2025/2026', '2', 8, 500, 'SSS 2 second term result checker cards', (select auth_id from tmp_people where label = 'proprietor'));

insert into public.result_checker_pins (school_id, batch_id, serial, pin, session, term)
select
  (select id from tmp_school),
  (select id from public.result_checker_batches where school_id = (select id from tmp_school) limit 1),
  'BHA-' || lpad(rn::text, 4, '0'),
  lpad((1000000000 + (abs(hashtext(st.id::text)) % 8999999999))::text, 10, '0'),
  '2025/2026', '2'
from (select id, row_number() over () as rn from tmp_students where class_label = 'SSS 2') st;

-- ============================================================================
-- 16. Admissions pipeline (prospects, not yet enrolled students)
-- ============================================================================
insert into public.admission_prospects (school_id, campus_id, session, full_name, date_of_birth, desired_class, parent_name, parent_phone, parent_email, status, entrance_test_score, notes, created_by)
values
  ((select id from tmp_school), (select id from tmp_campuses where label = 'Main Campus'), '2025/2026', 'Miracle Johnson', '2019-04-01', 'Primary 1', 'Mrs. Ada Johnson', '+2348044440001', 'ada.johnson@example.test', 'tested', 68, 'Good performance in entrance test.', (select auth_id from tmp_people where label = 'staff.admissions')),
  ((select id from tmp_school), (select id from tmp_campuses where label = 'Annex Campus'), '2025/2026', 'Success Ibe', '2014-08-14', 'JSS 1', 'Mr. Chibuzo Ibe', '+2348044440002', 'chibuzo.ibe@example.test', 'inquiry', null, 'Walked in to inquire about JSS 1 admission.', (select auth_id from tmp_people where label = 'staff.admissions')),
  ((select id from tmp_school), (select id from tmp_campuses where label = 'Main Campus'), '2025/2026', 'Divine Etuk', '2022-01-20', 'Nursery 1', 'Mrs. Uduak Etuk', '+2348044440003', 'uduak.etuk@example.test', 'offered', 72, 'Offered admission, awaiting acceptance fee.', (select auth_id from tmp_people where label = 'staff.admissions'));

-- ============================================================================
-- 17. Payroll: salaries + one paid run + deductions
-- ============================================================================
insert into public.staff_salaries (school_id, staff_id, monthly_salary)
select (select id from tmp_school), p.auth_id, sal.amount
from tmp_people p
join (values
  ('teacher.nursery1', 90000::numeric), ('teacher.primary1', 90000::numeric), ('teacher.primary5', 95000::numeric),
  ('teacher.jss1', 100000::numeric), ('teacher.jss3', 100000::numeric), ('teacher.sss2', 110000::numeric),
  ('staff.bursar', 120000::numeric), ('staff.admissions', 85000::numeric), ('staff.viceprincipal', 150000::numeric), ('staff.matron', 75000::numeric)
) as sal(label, amount) on sal.label = p.label;

insert into public.payroll_runs (school_id, period, status, created_by, paid_at)
values ((select id from tmp_school), '2026-01', 'paid', (select auth_id from tmp_people where label = 'proprietor'), now() - interval '5 days');

insert into public.payroll_entries (school_id, payroll_run_id, staff_id, base_salary, deductions, deduction_reason)
select
  (select id from tmp_school), (select id from public.payroll_runs where school_id = (select id from tmp_school) limit 1),
  ss.staff_id, ss.monthly_salary, round(ss.monthly_salary * 0.075, -2), 'PAYE Tax + Pension'
from public.staff_salaries ss where ss.school_id = (select id from tmp_school);

insert into public.payroll_entry_deductions (school_id, payroll_entry_id, deduction_type_id, amount)
select
  (select id from tmp_school), pe.id, (select id from tmp_deduction_types where label = 'PAYE Tax'), round(pe.base_salary * 0.05, -2)
from public.payroll_entries pe
join public.payroll_runs pr on pr.id = pe.payroll_run_id and pr.school_id = (select id from tmp_school);
insert into public.payroll_entry_deductions (school_id, payroll_entry_id, deduction_type_id, amount)
select
  (select id from tmp_school), pe.id, (select id from tmp_deduction_types where label = 'Pension'), round(pe.base_salary * 0.025, -2)
from public.payroll_entries pe
join public.payroll_runs pr on pr.id = pe.payroll_run_id and pr.school_id = (select id from tmp_school);

-- ============================================================================
-- 18. Expenses
-- ============================================================================
insert into public.expenses (school_id, category_id, campus_id, session, term, amount, expense_date, vendor, description, recorded_by)
values
  ((select id from tmp_school), (select id from tmp_expense_categories where label = 'Utilities'), (select id from tmp_campuses where label = 'Main Campus'), '2025/2026', '2', 85000, current_date - 10, 'Ikeja Electric', 'Electricity bill for the term.', (select auth_id from tmp_people where label = 'staff.bursar')),
  ((select id from tmp_school), (select id from tmp_expense_categories where label = 'Maintenance'), (select id from tmp_campuses where label = 'Annex Campus'), '2025/2026', '2', 45000, current_date - 6, 'Femi Plumbing Services', 'Fixed leaking pipes in the annex block.', (select auth_id from tmp_people where label = 'staff.bursar')),
  ((select id from tmp_school), (select id from tmp_expense_categories where label = 'Stationery & Supplies'), null, '2025/2026', '2', 32000, current_date - 3, 'Bookworm Stores', 'Exercise books and chalk for the term.', (select auth_id from tmp_people where label = 'staff.bursar'));

-- ============================================================================
-- 19. Bank transfer alerts, payment intents (Paystack mock)
-- ============================================================================
insert into public.bank_transfer_alerts (school_id, amount, narration, transfer_date, status)
values
  ((select id from tmp_school), 47500, 'TRF FROM CHIDINMA EZE FEES', current_date - 2, 'unmatched'),
  ((select id from tmp_school), 30000, 'TRF FROM FATIMA YUSUF', current_date - 1, 'unmatched');

insert into public.payment_intents (school_id, fee_record_id, student_id, reference, amount, status, initiated_by)
select
  (select id from tmp_school), fr.id, fr.student_id, 'PSK-' || substr(md5(fr.id::text), 1, 12), fr.amount_expected, 'pending',
  (select auth_id from tmp_people where label = 'staff.bursar')
from public.fee_records fr
where fr.school_id = (select id from tmp_school) and fr.student_id = (select id from tmp_students where label = 'Ogechi Nnamdi')
limit 1;

-- ============================================================================
-- 20. Messaging: a parent-initiated thread with a staff reply
-- ============================================================================
insert into public.message_threads (school_id, student_id, parent_id, recipient_kind, teacher_id, status, last_message_at)
values (
  (select id from tmp_school),
  (select id from tmp_students where label = 'Ogechi Nnamdi'),
  (select auth_id from tmp_people where label = 'parent.nnamdi'),
  'teacher', (select auth_id from tmp_people where label = 'teacher.jss1'), 'open', now() - interval '1 hour'
);

insert into public.message_thread_posts (thread_id, sender_kind, sender_parent_id, body, created_at)
values (
  (select id from public.message_threads where school_id = (select id from tmp_school) limit 1),
  'parent', (select auth_id from tmp_people where label = 'parent.nnamdi'),
  'Good day, please how is Ogechi doing in Mathematics this term?', now() - interval '2 hours'
);
insert into public.message_thread_posts (thread_id, sender_kind, sender_staff_id, body, created_at)
values (
  (select id from public.message_threads where school_id = (select id from tmp_school) limit 1),
  'staff', (select auth_id from tmp_people where label = 'teacher.jss1'),
  'Good day ma. Ogechi is doing well, she scored well in the last CA. Keep encouraging her at home.', now() - interval '1 hour'
);

-- ============================================================================
-- 21. Broadcasts + message delivery logs (mocked — no Termii key in a demo)
-- ============================================================================
insert into public.broadcasts (school_id, message, audience, recipient_count, sent_by)
values ((select id from tmp_school), 'Reminder: PTA meeting this Saturday by 10am in the school hall.', 'all_parents', 47, (select auth_id from tmp_people where label = 'proprietor'));

insert into public.message_logs (school_id, purpose, recipient_phone, recipient_name, student_id, message, status, sent_by)
select
  (select id from tmp_school), 'fee_reminder', s.parent_phone, s.parent_name, s.id,
  format('Dear parent, this is a reminder that fees for %s are outstanding for the 2025/2026 second term. Please make payment at your earliest convenience. Thank you.', s.full_name),
  'mocked', (select auth_id from tmp_people where label = 'staff.bursar')
from public.students s
where s.school_id = (select id from tmp_school) and s.status = 'active'
limit 10;

commit;

-- ============================================================================
-- Sign in as any seeded account with the password Demo1234! — e.g.
--   proprietor@brighthorizons.test   (proprietor)
--   viceprincipal@brighthorizons.test (delegated admin)
--   teacher.jss1@brighthorizons.test  (class teacher)
--   bursar@brighthorizons.test        (fees permission only)
--   parent.eze@brighthorizons.test    (parent, /parent/login)
-- ============================================================================
