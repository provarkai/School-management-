-- Lets a school withhold online results from parents with an outstanding
-- balance — long-standing practice in Nigerian schools, and the reason
-- result-checker access is usually sold rather than given away.
--
-- Deliberately scoped to parent-facing surfaces only (the shared student
-- link and the parent portal). Staff-side pages and the printed report
-- card are untouched: the proprietor decides whether to hand a card over,
-- and blocking their own print tool would help nobody.

alter table public.schools
  add column if not exists withhold_results_when_owing boolean not null default false;
