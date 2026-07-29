export function BarChart({
  points,
  formatValue,
  height = 80,
}: {
  points: { label: string; value: number | null }[];
  formatValue: (value: number) => string;
  height?: number;
}) {
  const maxValue = Math.max(1, ...points.map((p) => p.value ?? 0));

  return (
    <div className="flex items-end gap-2 overflow-x-auto">
      {points.map((p) => (
        <div key={p.label} className="flex min-w-[3rem] flex-1 flex-col items-center gap-1">
          <span className="text-xs font-medium text-zinc-700">
            {p.value === null ? "—" : formatValue(p.value)}
          </span>
          <div
            className="w-full rounded-t bg-zinc-800"
            style={{ height: `${p.value === null ? 2 : Math.max(4, (p.value / maxValue) * height)}px` }}
          />
          <span className="whitespace-nowrap text-[10px] text-zinc-400">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
