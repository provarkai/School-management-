import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export default async function IdCardsPage() {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", profile.school_id ?? "")
    .order("name");

  const { data: students } = await supabase
    .from("students")
    .select("id, class_id")
    .eq("school_id", profile.school_id ?? "")
    .eq("status", "active");

  const countByClass = new Map<string, number>();
  for (const s of students ?? []) {
    if (!s.class_id) continue;
    countByClass.set(s.class_id, (countByClass.get(s.class_id) ?? 0) + 1);
  }

  const rows = (classes ?? []).filter((c) => (countByClass.get(c.id) ?? 0) > 0);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">ID Cards</h1>
        <p className="text-sm text-zinc-500">
          {school?.current_session} · {school?.current_term
            ? `Term ${school.current_term}`
            : ""}{" "}
          — a printable sheet of CR80-size cards per class. Cut along each card&rsquo;s border
          and laminate. To reprint a single card, use the &ldquo;ID card&rdquo; link on that
          student&rsquo;s profile.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Class</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Students</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-medium text-zinc-900">{c.name}</td>
                <td className="px-4 py-2 text-zinc-500">{countByClass.get(c.id)}</td>
                <td className="px-4 py-2 text-right">
                  <a
                    href={`/id-cards/pdf/class/${c.id}`}
                    className="font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    Download PDF →
                  </a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-zinc-400">
                  No active students with a class assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
