const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function EnrollmentStats({
  students,
}: {
  students: { admission_date: string; status: string }[];
}) {
  const now = new Date();
  const months: { key: string; label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      count: 0,
    });
  }
  const countByMonth = new Map(months.map((m) => [m.key, m]));

  for (const s of students) {
    if (!s.admission_date) continue;
    const key = s.admission_date.slice(0, 7);
    const bucket = countByMonth.get(key);
    if (bucket) bucket.count++;
  }

  const withdrawnCount = students.filter((s) => s.status === "withdrawn").length;
  const graduatedCount = students.filter((s) => s.status === "graduated").length;
  const maxCount = Math.max(1, ...months.map((m) => m.count));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Enrollment (last 6 months)</h2>
        <p className="text-xs text-zinc-400">
          {withdrawnCount} withdrawn · {graduatedCount} graduated all-time
        </p>
      </div>
      <div className="flex items-end gap-3">
        {months.map((m) => (
          <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-medium text-zinc-700">{m.count}</span>
            <div
              className="w-full rounded-t bg-zinc-800"
              style={{ height: `${Math.max(4, (m.count / maxCount) * 64)}px` }}
            />
            <span className="text-[10px] text-zinc-400">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
