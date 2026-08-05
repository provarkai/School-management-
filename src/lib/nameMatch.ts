/**
 * Matches a name read off a scanned photo (handwriting noise, OCR slips,
 * possible word-order flips) against a class roster. Used by the "scan
 * attendance/marks" AI-photo actions — the model only ever gets to point at
 * a real roster row via this matcher, never write a name straight through
 * to a save. Returns null on no match or an ambiguous tie, rather than
 * guessing.
 */
export function matchRosterName<T extends { full_name: string }>(
  roster: T[],
  raw: string
): T | null {
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

  const target = tokenize(raw);
  if (target.length === 0) return null;

  let best: T | null = null;
  let bestScore = 0;
  let tied = false;

  for (const candidate of roster) {
    const tokens = tokenize(candidate.full_name);
    const overlap = target.filter((t) => tokens.includes(t)).length;
    if (overlap === 0) continue;

    // A single shared token ("John" alone) isn't enough to confidently pick
    // one student out of a class full of Johns — require most of the
    // shorter name's tokens to line up once there's more than one to check.
    const shorterLen = Math.min(target.length, tokens.length);
    const required = shorterLen > 1 ? Math.ceil(shorterLen / 2) : 1;
    if (overlap < required) continue;

    if (overlap > bestScore) {
      bestScore = overlap;
      best = candidate;
      tied = false;
    } else if (overlap === bestScore) {
      tied = true;
    }
  }

  return tied ? null : best;
}
