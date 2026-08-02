// Standard 5-point WAEC-style grade scale, derived from the letter grade
// set_result_grade() already computes in Postgres (0001_functions.sql):
// A (>=70), B (>=60), C (>=50), D (>=45), E (>=40), F (else).
export const GRADE_POINTS: Record<string, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
  F: 0,
};

/**
 * `pointsByLetter` lets a school with configured grade_bands supply its own
 * scale (a 4.0 scale, or letters outside A–F). Omitting it keeps the fixed
 * 5-point scale, so every existing caller is unaffected.
 */
export function computeGPA(
  results: { grade: string | null }[],
  pointsByLetter: Record<string, number> = GRADE_POINTS
): number | null {
  const points = results
    .map((r) => (r.grade ? pointsByLetter[r.grade] : undefined))
    .filter((p): p is number => p !== undefined);

  if (points.length === 0) return null;
  return points.reduce((sum, p) => sum + p, 0) / points.length;
}
