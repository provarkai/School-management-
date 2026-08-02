-- GPA is a tertiary-education concept. Primary and secondary schools —
-- which is what this product serves — report a percentage and a letter
-- grade, so the points-per-grade column added alongside grade_bands in
-- 0048 has no consumer and is dropped rather than left as a field that
-- looks configurable but changes nothing.
--
-- The letter grades themselves stay: set_result_grade() still resolves
-- them from grade_bands.min_score, untouched by this.

alter table public.grade_bands drop column if exists points;
