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

export function computeGPA(results: { grade: string | null }[]): number | null {
  const points = results
    .map((r) => (r.grade ? GRADE_POINTS[r.grade] : undefined))
    .filter((p): p is number => p !== undefined);

  if (points.length === 0) return null;
  return points.reduce((sum, p) => sum + p, 0) / points.length;
}
