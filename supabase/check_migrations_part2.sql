-- The migrations the first audit couldn't see.
--
-- These change policies, constraints, buckets or columns on objects other
-- migrations create, so "does this table exist" says nothing about them.
-- They're checked here by their actual effect instead. Every one of them
-- matters: skipping 0043 leaves a delegated admin locked out of payroll,
-- skipping 0039 makes session promotion fail on graduating classes, and
-- skipping 0031 stops school logos uploading.

with checks(seq, migration, applied) as (
  values
    ('0004', 'fee_summary view',
      to_regclass('public.fee_summary') is not null),

    ('0009', 'teacher subject',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='app_users' and column_name='subject')),

    ('0015', 'staff roles',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='app_users' and column_name='job_title')),

    ('0018', 'profile photos',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='app_users' and column_name='photo_url')),

    ('0019', 'friday period flag',
      exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='period_slots'
                and column_name='applies_on_friday')),

    -- Storage bucket limits, set at the bucket rather than in app code.
    ('0029', 'security hardening',
      exists (select 1 from storage.buckets
              where id = 'avatars' and file_size_limit is not null)),

    -- The policy that lets a manager upload their school's logo.
    ('0031', 'school logo storage',
      exists (select 1 from pg_policies
              where schemaname='storage' and tablename='objects'
                and policyname='school_logo_insert')),

    -- Session promotion needs 'graduated' to be a legal student status.
    ('0039', 'session promotion',
      exists (select 1 from pg_constraint
              where conname = 'students_status_check'
                and pg_get_constraintdef(oid) like '%graduated%')),

    -- Payroll RLS must test current_role() (which counts a delegated
    -- admin) rather than is_owner() (which doesn't).
    ('0043', 'admin equal power',
      exists (select 1 from pg_policies
              where schemaname='public' and tablename='payroll_entries'
                and policyname='payroll_entries_proprietor_all'
                and coalesce(qual, '') like '%current_role%')),

    -- 0049 removed the GPA points column again; applied means it's gone.
    ('0049', 'drop grade points',
      to_regclass('public.grade_bands') is not null
      and not exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='grade_bands'
                        and column_name='points'))
)
select seq, migration, applied
from checks
order by seq;
