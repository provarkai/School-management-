export function ExportLinks({ baseUrl, params = {} }: { baseUrl: string; params?: Record<string, string> }) {
  const formats: { format: string; label: string }[] = [
    { format: "csv", label: "CSV" },
    { format: "xlsx", label: "Excel" },
    { format: "json", label: "JSON" },
  ];

  return (
    <div className="inline-flex divide-x divide-zinc-300 overflow-hidden rounded-md border border-zinc-300 bg-white shadow-sm">
      {formats.map(({ format, label }) => (
        <a
          key={format}
          href={`${baseUrl}?${new URLSearchParams({ ...params, format }).toString()}`}
          className="px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {label}
        </a>
      ))}
    </div>
  );
}
