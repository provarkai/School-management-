/** Bounds a Supabase network call (auth or otherwise) so a slow/hanging
 * response can't leave the request — and the browser waiting on it —
 * hanging indefinitely. On timeout, resolves to the same {data, error}
 * shape the call would have returned (using the given fallback for data,
 * since that shape differs per call — e.g. getUser()'s data is always
 * {user: ...}, never null itself), so every call site can keep
 * destructuring normally instead of type-narrowing a union each time.
 *
 * Kept dependency-free (no server/client imports) so it's safe to use from
 * the Edge-runtime proxy as well as ordinary server code. */
export function withAuthTimeout<T extends { data: unknown; error: unknown }>(
  promise: PromiseLike<T>,
  ms: number,
  fallbackData: T["data"]
): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) =>
      setTimeout(() => resolve({ data: fallbackData, error: new Error("timed out") } as T), ms)
    ),
  ]);
}
