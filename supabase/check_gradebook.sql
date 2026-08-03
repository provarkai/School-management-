-- Reports what actually landed from migrations 0048 and 0050.
--
-- Those two are long scripts whose `create policy` statements are not
-- guarded, so a re-run after a mid-script failure aborts near the top and
-- leaves the later parts — including the seed data — unapplied. The tables
-- exist, so a table-existence audit says "true", while the school still has
-- no grade bands, components or traits.
--
-- This looks at each part separately. Run it and send me the output.

select 'assessment_components rows' as item, count(*)::text as value from public.assessment_components
union all
select 'grade_bands rows', count(*)::text from public.grade_bands
union all
select 'report_card_traits rows', count(*)::text from public.report_card_traits
union all
select 'schools', count(*)::text from public.schools
union all
select 'result_component_scores table',
       (to_regclass('public.result_component_scores') is not null)::text
union all
select 'student_subjects table',
       (to_regclass('public.student_subjects') is not null)::text
union all
select 'results.subject_id column',
       exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='results'
                 and column_name='subject_id')::text
union all
select 'students.admission_number column',
       exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='students'
                 and column_name='admission_number')::text
union all
select 'students.genotype column',
       exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='students'
                 and column_name='genotype')::text
union all
select 'results CA check relaxed (no 40 ceiling)',
       (not exists (select 1 from pg_constraint
                    where conname = 'results_ca_score_check'
                      and pg_get_constraintdef(oid) like '%40%'))::text
union all
select 'set_result_grade is security definer',
       coalesce((select p.prosecdef from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname='public' and p.proname='set_result_grade'), false)::text
union all
select 'policy: result_component_scores_all_scoped',
       exists (select 1 from pg_policies where schemaname='public'
               and tablename='result_component_scores')::text
union all
select 'policy: student_subjects',
       exists (select 1 from pg_policies where schemaname='public'
               and tablename='student_subjects')::text
union all
select 'policy: student_trait_ratings',
       exists (select 1 from pg_policies where schemaname='public'
               and tablename='student_trait_ratings')::text;
