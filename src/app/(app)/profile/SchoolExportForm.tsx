import { EXPORT_DATASETS } from "@/lib/schoolExport";

export function SchoolExportForm({ error }: { error?: string }) {
  return (
    <form action="/profile/export" method="post" className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-sm text-zinc-500">
        Choose what to include — everything downloads as one Excel workbook, one sheet per
        dataset.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {EXPORT_DATASETS.map((dataset) => (
          <label key={dataset.key} className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="datasets"
              value={dataset.key}
              className="rounded border-zinc-300"
            />
            {dataset.label}
          </label>
        ))}
      </div>
      <label className="block max-w-xs text-sm font-medium text-zinc-700">
        Confirm your password
        <input
          name="password"
          type="password"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
      >
        Export selected data
      </button>
    </form>
  );
}
