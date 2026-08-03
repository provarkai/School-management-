-- School suspension was enforced only in the app layer: requireUser()
-- redirects a suspended school's staff to /account-suspended, but no RLS
-- policy ever consulted schools.status. Since NEXT_PUBLIC_SUPABASE_ANON_KEY
-- is public by definition, a suspended school's own staff could call the
-- Supabase REST API directly with their own JWT and read (or write)
-- everything RLS still allowed — the suspension never reached the
-- database. If suspension is the lever for non-payment or abuse, it needs
-- to hold there.
--
-- Approach: one restrictive policy per tenant-scoped table, gated on
-- school_is_active(school_id). A restrictive policy is AND'd against
-- whatever the table's existing permissive policies already allow, rather
-- than replacing them — so for every school that is not suspended (the
-- default and near-universal case; schools.status defaults to 'active'),
-- this changes nothing. It only starts refusing rows once a school's
-- status flips to 'suspended', regardless of which permissive policy
-- (proprietor, class teacher, a granted staff_permission, a linked parent)
-- would otherwise have allowed the row. It applies to every command — for
-- all, not just select — so a suspended school is fully locked, not just
-- read-only.
--
-- Deliberately NOT applied to:
--   - schools itself: requireUser() has to be able to read this row to
--     detect the suspension and redirect to /account-suspended in the
--     first place; gating it here would break that detection, not enforce
--     it. Reactivation is already its own platform-admin-only policy.
--   - app_users: requireUser() reads the caller's own profile before it
--     has any chance to check school status. Blocking that read here would
--     bounce a suspended user to a bare /login with no explanation instead
--     of the friendly /account-suspended page — same end state (blocked),
--     worse UX, for a table that carries no data more sensitive than a
--     name/role/photo already visible to the whole school anyway.
--   - platform_admins / platform_admin_logs: platform-level oversight
--     data. A platform admin needs to see a school's suspension history
--     *especially* once it is suspended, not lose visibility into it.
--   - parents / parent_students: not school-scoped rows themselves (a
--     parent can link to children across schools). The tenant data they
--     read through — students, fee_records, results, message_threads,
--     etc. — is gated directly, so a suspended school's data disappears
--     for its linked parents too, without needing a rule on these two
--     tables specifically.

create or replace function public.school_is_active(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.schools
    where id = target_school_id and status = 'active'
  );
$$;

-- Four tables don't carry their own school_id and have to resolve it
-- through a parent row instead. Each helper is security definer so the
-- lookup isn't itself subject to the parent table's RLS (which would
-- otherwise make the check depend on whether the caller can already see
-- the parent row, for reasons unrelated to suspension).
create or replace function public.exam_school_is_active(target_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.school_is_active(school_id) from public.exams where id = target_exam_id),
    false
  );
$$;

create or replace function public.exam_attempt_school_is_active(target_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.exam_school_is_active(exam_id) from public.exam_attempts where id = target_attempt_id),
    false
  );
$$;

create or replace function public.thread_school_is_active(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.school_is_active(school_id) from public.message_threads where id = target_thread_id),
    false
  );
$$;

drop policy if exists "exam_questions_active_school_only" on public.exam_questions;
create policy "exam_questions_active_school_only" on public.exam_questions
  as restrictive for all
  using (public.exam_school_is_active(exam_id));

drop policy if exists "exam_attempts_active_school_only" on public.exam_attempts;
create policy "exam_attempts_active_school_only" on public.exam_attempts
  as restrictive for all
  using (public.exam_school_is_active(exam_id));

drop policy if exists "exam_answers_active_school_only" on public.exam_answers;
create policy "exam_answers_active_school_only" on public.exam_answers
  as restrictive for all
  using (public.exam_attempt_school_is_active(attempt_id));

drop policy if exists "message_thread_posts_active_school_only" on public.message_thread_posts;
create policy "message_thread_posts_active_school_only" on public.message_thread_posts
  as restrictive for all
  using (public.thread_school_is_active(thread_id));

-- Every other tenant-scoped table carries its own school_id column
-- directly, so the same one-line policy applies to each.
drop policy if exists "academic_calendar_events_active_school_only" on public.academic_calendar_events;
create policy "academic_calendar_events_active_school_only" on public.academic_calendar_events
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "activity_logs_active_school_only" on public.activity_logs;
create policy "activity_logs_active_school_only" on public.activity_logs
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "admission_prospects_active_school_only" on public.admission_prospects;
create policy "admission_prospects_active_school_only" on public.admission_prospects
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "assessment_components_active_school_only" on public.assessment_components;
create policy "assessment_components_active_school_only" on public.assessment_components
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "assignments_active_school_only" on public.assignments;
create policy "assignments_active_school_only" on public.assignments
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "attendance_active_school_only" on public.attendance;
create policy "attendance_active_school_only" on public.attendance
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "bank_transfer_alerts_active_school_only" on public.bank_transfer_alerts;
create policy "bank_transfer_alerts_active_school_only" on public.bank_transfer_alerts
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "behavior_incidents_active_school_only" on public.behavior_incidents;
create policy "behavior_incidents_active_school_only" on public.behavior_incidents
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "broadcasts_active_school_only" on public.broadcasts;
create policy "broadcasts_active_school_only" on public.broadcasts
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "bus_routes_active_school_only" on public.bus_routes;
create policy "bus_routes_active_school_only" on public.bus_routes
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "bus_stops_active_school_only" on public.bus_stops;
create policy "bus_stops_active_school_only" on public.bus_stops
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "campuses_active_school_only" on public.campuses;
create policy "campuses_active_school_only" on public.campuses
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "class_topic_progress_active_school_only" on public.class_topic_progress;
create policy "class_topic_progress_active_school_only" on public.class_topic_progress
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "classes_active_school_only" on public.classes;
create policy "classes_active_school_only" on public.classes
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "deduction_types_active_school_only" on public.deduction_types;
create policy "deduction_types_active_school_only" on public.deduction_types
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "exams_active_school_only" on public.exams;
create policy "exams_active_school_only" on public.exams
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "expense_categories_active_school_only" on public.expense_categories;
create policy "expense_categories_active_school_only" on public.expense_categories
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "expenses_active_school_only" on public.expenses;
create policy "expenses_active_school_only" on public.expenses
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "fee_payments_active_school_only" on public.fee_payments;
create policy "fee_payments_active_school_only" on public.fee_payments
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "fee_records_active_school_only" on public.fee_records;
create policy "fee_records_active_school_only" on public.fee_records
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "fee_types_active_school_only" on public.fee_types;
create policy "fee_types_active_school_only" on public.fee_types
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "grade_bands_active_school_only" on public.grade_bands;
create policy "grade_bands_active_school_only" on public.grade_bands
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "hostel_rooms_active_school_only" on public.hostel_rooms;
create policy "hostel_rooms_active_school_only" on public.hostel_rooms
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "hostels_active_school_only" on public.hostels;
create policy "hostels_active_school_only" on public.hostels
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "learning_resources_active_school_only" on public.learning_resources;
create policy "learning_resources_active_school_only" on public.learning_resources
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "leave_requests_active_school_only" on public.leave_requests;
create policy "leave_requests_active_school_only" on public.leave_requests
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "lesson_notes_active_school_only" on public.lesson_notes;
create policy "lesson_notes_active_school_only" on public.lesson_notes
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "message_logs_active_school_only" on public.message_logs;
create policy "message_logs_active_school_only" on public.message_logs
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "message_threads_active_school_only" on public.message_threads;
create policy "message_threads_active_school_only" on public.message_threads
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "payment_intents_active_school_only" on public.payment_intents;
create policy "payment_intents_active_school_only" on public.payment_intents
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "payroll_entries_active_school_only" on public.payroll_entries;
create policy "payroll_entries_active_school_only" on public.payroll_entries
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "payroll_entry_deductions_active_school_only" on public.payroll_entry_deductions;
create policy "payroll_entry_deductions_active_school_only" on public.payroll_entry_deductions
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "payroll_runs_active_school_only" on public.payroll_runs;
create policy "payroll_runs_active_school_only" on public.payroll_runs
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "period_slots_active_school_only" on public.period_slots;
create policy "period_slots_active_school_only" on public.period_slots
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "report_card_traits_active_school_only" on public.report_card_traits;
create policy "report_card_traits_active_school_only" on public.report_card_traits
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "report_remarks_active_school_only" on public.report_remarks;
create policy "report_remarks_active_school_only" on public.report_remarks
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "result_checker_batches_active_school_only" on public.result_checker_batches;
create policy "result_checker_batches_active_school_only" on public.result_checker_batches
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "result_checker_pins_active_school_only" on public.result_checker_pins;
create policy "result_checker_pins_active_school_only" on public.result_checker_pins
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "result_component_scores_active_school_only" on public.result_component_scores;
create policy "result_component_scores_active_school_only" on public.result_component_scores
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "results_active_school_only" on public.results;
create policy "results_active_school_only" on public.results
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "staff_attendance_active_school_only" on public.staff_attendance;
create policy "staff_attendance_active_school_only" on public.staff_attendance
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "staff_notices_active_school_only" on public.staff_notices;
create policy "staff_notices_active_school_only" on public.staff_notices
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "staff_permissions_active_school_only" on public.staff_permissions;
create policy "staff_permissions_active_school_only" on public.staff_permissions
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "staff_salaries_active_school_only" on public.staff_salaries;
create policy "staff_salaries_active_school_only" on public.staff_salaries
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "student_documents_active_school_only" on public.student_documents;
create policy "student_documents_active_school_only" on public.student_documents
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "student_field_definitions_active_school_only" on public.student_field_definitions;
create policy "student_field_definitions_active_school_only" on public.student_field_definitions
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "student_field_values_active_school_only" on public.student_field_values;
create policy "student_field_values_active_school_only" on public.student_field_values
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "student_promotions_active_school_only" on public.student_promotions;
create policy "student_promotions_active_school_only" on public.student_promotions
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "student_subjects_active_school_only" on public.student_subjects;
create policy "student_subjects_active_school_only" on public.student_subjects
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "student_trait_ratings_active_school_only" on public.student_trait_ratings;
create policy "student_trait_ratings_active_school_only" on public.student_trait_ratings
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "students_active_school_only" on public.students;
create policy "students_active_school_only" on public.students
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "subjects_active_school_only" on public.subjects;
create policy "subjects_active_school_only" on public.subjects
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "syllabus_topics_active_school_only" on public.syllabus_topics;
create policy "syllabus_topics_active_school_only" on public.syllabus_topics
  as restrictive for all
  using (public.school_is_active(school_id));

drop policy if exists "timetable_entries_active_school_only" on public.timetable_entries;
create policy "timetable_entries_active_school_only" on public.timetable_entries
  as restrictive for all
  using (public.school_is_active(school_id));
