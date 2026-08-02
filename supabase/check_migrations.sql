-- Reports which migrations this database already has.
--
-- Each row checks one distinctive object that migration creates. Run it in
-- the Supabase SQL editor and read down the "applied" column: the first
-- `false` is where to resume, and every migration from there on must be run
-- in order.
--
-- Migrations with no row here (0003 RLS, 0004 views, 0029 hardening, 0031
-- storage, 0043 payroll RLS, 0049 drop-points) only change policies, views
-- or columns on objects the neighbouring migrations create, so they follow
-- their neighbours rather than being detectable on their own.

with checks(seq, migration, applied) as (
  values
    ('0001', 'schema',                to_regclass('public.schools')                 is not null),
    ('0002', 'functions',             to_regproc('public.current_school_id')        is not null),
    ('0005', 'auth trigger',          to_regproc('public.handle_new_auth_user')     is not null),
    ('0006', 'bank transfer alerts',  to_regclass('public.bank_transfer_alerts')    is not null),
    ('0007', 'student access token',  to_regclass('public.students')                is not null
                                      and exists (select 1 from information_schema.columns
                                                  where table_schema='public' and table_name='students'
                                                    and column_name='access_token')),
    ('0008', 'subjects',              to_regclass('public.subjects')                is not null),
    ('0010', 'parent portal',         to_regclass('public.parents')                 is not null),
    ('0011', 'campuses',              to_regclass('public.campuses')                is not null),
    ('0012', 'timetable',             to_regclass('public.period_slots')            is not null),
    ('0013', 'paystack',              to_regclass('public.payment_intents')         is not null),
    ('0014', 'rls recursion fix',     to_regproc('public.class_has_linked_parent')  is not null),
    ('0016', 'staff notices',         to_regclass('public.staff_notices')           is not null),
    ('0017', 'fee types',             to_regclass('public.fee_types')               is not null),
    ('0020', 'scholarships',          exists (select 1 from information_schema.columns
                                              where table_schema='public' and table_name='fee_records'
                                                and column_name='discount_amount')),
    ('0021', 'behavior incidents',    to_regclass('public.behavior_incidents')      is not null),
    ('0022', 'academic calendar',     to_regclass('public.academic_calendar_events') is not null),
    ('0023', 'custom fields',         to_regclass('public.student_field_definitions') is not null),
    ('0024', 'student documents',     to_regproc('public.can_access_student')       is not null),
    ('0025', 'payroll',               to_regclass('public.staff_salaries')          is not null),
    ('0026', 'assignments',           to_regclass('public.assignments')             is not null),
    ('0027', 'platform admin',        to_regclass('public.platform_admins')         is not null),
    ('0028', 'proprietor gender',     exists (select 1 from information_schema.columns
                                              where table_schema='public' and table_name='app_users'
                                                and column_name='gender')),
    ('0030', 'school admin',          exists (select 1 from information_schema.columns
                                              where table_schema='public' and table_name='app_users'
                                                and column_name='is_school_admin')),
    ('0032', 'platform admin logs',   to_regclass('public.platform_admin_logs')     is not null),
    ('0033', 'school phone',          exists (select 1 from information_schema.columns
                                              where table_schema='public' and table_name='schools'
                                                and column_name='phone')),
    ('0034', 'quick links',           exists (select 1 from information_schema.columns
                                              where table_schema='public' and table_name='schools'
                                                and column_name='quick_links')),
    ('0035', 'report remarks',        to_regclass('public.report_remarks')          is not null),
    ('0036', 'expenses',              to_regclass('public.expense_categories')      is not null),
    ('0037', 'payroll deductions',    to_regclass('public.deduction_types')         is not null),
    ('0038', 'admissions',            to_regclass('public.admission_prospects')     is not null),
    ('0040', 'staff attendance',      to_regclass('public.staff_attendance')        is not null),
    ('0041', 'broadcasts',            to_regclass('public.broadcasts')              is not null),
    ('0042', 'student photos',        exists (select 1 from information_schema.columns
                                              where table_schema='public' and table_name='students'
                                                and column_name='photo_url')),
    ('0044', 'learning resources',    to_regclass('public.learning_resources')      is not null),
    ('0045', 'exams',                 to_regclass('public.exams')                   is not null),
    ('0046', 'curriculum',            to_regclass('public.syllabus_topics')         is not null),
    ('0047', 'dashboard widgets',     exists (select 1 from information_schema.columns
                                              where table_schema='public' and table_name='app_users'
                                                and column_name='dashboard_widgets')),
    ('0048', 'gradebook foundation',  to_regclass('public.assessment_components')   is not null),
    ('0050', 'report card traits',    to_regclass('public.report_card_traits')      is not null),
    ('0051', 'withhold results',      exists (select 1 from information_schema.columns
                                              where table_schema='public' and table_name='schools'
                                                and column_name='withhold_results_when_owing')),
    ('0052', 'promotion criteria',    to_regclass('public.student_promotions')      is not null)
)
select seq, migration, applied
from checks
order by seq;
