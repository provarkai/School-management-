// Primary and secondary schools report a termly average percentage, not a
// tertiary-style grade point average. Every subject total is already out of
// 100 (CA 40 + exam 60), so the mean of the totals is the average percentage.
// Letter grades (A–F) still come from set_result_grade() in Postgres
// (0002_functions.sql) and are shown per subject on the report card.
export function computeAverage(results: { total: number }[]): number | null {
  if (results.length === 0) return null;
  const sum = results.reduce((acc, r) => acc + Number(r.total), 0);
  return sum / results.length;
}
