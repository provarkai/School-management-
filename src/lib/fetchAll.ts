/**
 * Paged reads for queries that can return more rows than PostgREST will
 * hand over in one response.
 *
 * Supabase caps a single request at 1000 rows by default and returns the
 * first 1000 *without an error* — so a school-wide read of results,
 * attendance or fees silently loses everything past that point, and the
 * averages and totals built on top of it come out quietly wrong. Any
 * query whose row count grows with the size of the school should go
 * through here.
 */

interface PageResponse<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** PostgREST's default cap. Requesting a larger page doesn't raise it. */
export const PAGE_SIZE = 1000;

/** Stops a runaway loop from paging forever if a query never shrinks. */
const MAX_PAGES = 500;

/**
 * Reads every row a query matches, one page at a time.
 *
 * `page` is called with an inclusive row range and must return a fresh
 * query each time — a Supabase builder can only be awaited once. Always
 * give the query a stable `.order(...)` on a unique column: without one
 * Postgres may return rows in a different order per page, so paging would
 * skip some rows and repeat others.
 *
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from("results").select("total").eq("school_id", id).range(from, to)
 *   );
 *
 * On a query error the rows read so far are returned rather than throwing,
 * matching how the callers already treat a failed read as "no data".
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResponse<T>>,
  pageSize: number = PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
    const from = pageIndex * pageSize;
    const { data, error } = await page(from, from + pageSize - 1);

    if (error || !data) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }

  return rows;
}

/**
 * Same, for a query filtered by a list of ids.
 *
 * An `in(...)` filter travels in the URL, so a few hundred uuids can push
 * the request past a proxy's URL length limit. Ids are sent in chunks and
 * each chunk is paged.
 */
export async function fetchAllRowsByIds<T>(
  ids: string[],
  page: (chunk: string[], from: number, to: number) => PromiseLike<PageResponse<T>>,
  chunkSize = 100
): Promise<T[]> {
  const rows: T[] = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    rows.push(...(await fetchAllRows<T>((from, to) => page(chunk, from, to))));
  }

  return rows;
}
