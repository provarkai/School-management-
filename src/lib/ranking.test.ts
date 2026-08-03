import test from "node:test";
import assert from "node:assert/strict";
import { computeClassRanking } from "./ranking.ts";

/**
 * A stand-in for the Supabase query builder covering only the shape
 * computeClassRanking uses: `.from(table).select(...)` followed by a chain
 * of filters, awaited for `{ data }`. Enough to pin the ranking maths down
 * without a database.
 */
function fakeSupabase(tables: {
  students: { id: string }[];
  results: { student_id: string; total: number }[];
}) {
  const build = (rows: unknown[]) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      then: (resolve: (value: { data: unknown[] }) => unknown) => resolve({ data: rows }),
    };
    return chain;
  };

  return {
    from: (table: string) => build(table === "students" ? tables.students : tables.results),
  } as unknown as Parameters<typeof computeClassRanking>[0];
}

test("ranks students by average across all their subjects", async () => {
  const ranking = await computeClassRanking(
    fakeSupabase({
      students: [{ id: "a" }, { id: "b" }, { id: "c" }],
      results: [
        { student_id: "a", total: 80 },
        { student_id: "a", total: 60 }, // avg 70
        { student_id: "b", total: 90 }, // avg 90
        { student_id: "c", total: 50 },
        { student_id: "c", total: 50 }, // avg 50
      ],
    }),
    "class-1",
    "2025/2026",
    "1"
  );

  assert.deepEqual(ranking.get("b"), { position: 1, outOf: 3 });
  assert.deepEqual(ranking.get("a"), { position: 2, outOf: 3 });
  assert.deepEqual(ranking.get("c"), { position: 3, outOf: 3 });
});

test("students with the same average share a position", async () => {
  const ranking = await computeClassRanking(
    fakeSupabase({
      students: [{ id: "a" }, { id: "b" }, { id: "c" }],
      results: [
        { student_id: "a", total: 75 },
        { student_id: "b", total: 75 },
        { student_id: "c", total: 40 },
      ],
    }),
    "class-1",
    "2025/2026",
    "1"
  );

  assert.equal(ranking.get("a")?.position, 1);
  assert.equal(ranking.get("b")?.position, 1);
  // Standard competition ranking: the tie consumes both 1st and 2nd.
  assert.equal(ranking.get("c")?.position, 3);
});

test("students with no scores are left out of the ranking entirely", async () => {
  const ranking = await computeClassRanking(
    fakeSupabase({
      students: [{ id: "a" }, { id: "unscored" }],
      results: [{ student_id: "a", total: 65 }],
    }),
    "class-1",
    "2025/2026",
    "1"
  );

  assert.equal(ranking.has("unscored"), false);
  // ...and they don't inflate the "out of" printed on everyone else's card.
  assert.deepEqual(ranking.get("a"), { position: 1, outOf: 1 });
});

test("an empty class produces an empty ranking rather than throwing", async () => {
  const ranking = await computeClassRanking(
    fakeSupabase({ students: [], results: [] }),
    "class-1",
    "2025/2026",
    "1"
  );
  assert.equal(ranking.size, 0);
});
