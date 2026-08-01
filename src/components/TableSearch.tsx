"use client";

/**
 * Drop-in quick filter for any list/table. Wrap the search box and the rows
 * in a shared `data-search-scope` container, and tag each row with
 * `data-search-row="<searchable text>"`. Pure DOM show/hide — no need to
 * lift server-rendered rows into client state.
 */
export function TableSearch({ placeholder = "Search…" }: { placeholder?: string }) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      onChange={(e) => {
        const query = e.currentTarget.value.trim().toLowerCase();
        const scope = e.currentTarget.closest("[data-search-scope]");
        if (!scope) return;
        scope.querySelectorAll<HTMLElement>("[data-search-row]").forEach((row) => {
          const text = (row.getAttribute("data-search-row") ?? "").toLowerCase();
          row.style.display = !query || text.includes(query) ? "" : "none";
        });
      }}
      className="w-full max-w-xs rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
    />
  );
}
