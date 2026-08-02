import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { NewResourceForm } from "./NewResourceForm";
import { DeleteResourceButton } from "./DeleteResourceButton";

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { profile, isManager } = await requireUser();
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  let classesQuery = supabase.from("classes").select("id, name").order("name");
  if (profile.role === "teacher" && !isManager) {
    classesQuery = classesQuery.eq("teacher_id", profile.id);
  }
  const { data: classes } = await classesQuery;

  if (!classes || classes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Learning Resources</h1>
        <p className="text-sm text-zinc-500">
          {profile.role === "teacher" && !isManager
            ? "You have not been assigned a class yet — ask the proprietor to assign you one."
            : "No classes have been created yet."}
        </p>
      </div>
    );
  }

  const selectedClassId = classParam || classes[0].id;

  const [{ data: subjectRows }, { data: resourceRows }] = await Promise.all([
    supabase.from("subjects").select("name").eq("school_id", profile.school_id ?? "").order("name"),
    supabase
      .from("learning_resources")
      .select("id, subject, title, description, file_path, file_name, external_url, created_at")
      .eq("class_id", selectedClassId)
      .order("created_at", { ascending: false }),
  ]);

  const subjects = (subjectRows ?? []).map((s) => s.name);

  const resources = await Promise.all(
    (resourceRows ?? []).map(async (r) => {
      if (!r.file_path) return { ...r, viewUrl: r.external_url };
      const { data: signed } = await supabase.storage
        .from("learning-resources")
        .createSignedUrl(r.file_path, 3600);
      return { ...r, viewUrl: signed?.signedUrl ?? null };
    })
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Learning Resources</h1>
      </div>

      {classes.length > 1 && (
        <form method="get" className="flex items-end gap-3">
          <label className="text-sm font-medium text-zinc-700">
            Class
            <select
              name="class"
              defaultValue={selectedClassId}
              className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Go
          </button>
        </form>
      )}

      <NewResourceForm
        schoolId={profile.school_id ?? ""}
        classes={classes}
        subjects={subjects}
        defaultClassId={selectedClassId}
      />

      {resources.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No resources shared with this class yet.
        </p>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <ul className="divide-y divide-zinc-100">
            {resources.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    {r.subject && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {r.subject}
                      </span>
                    )}
                    <span className="text-xs text-zinc-400">{r.created_at.slice(0, 10)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-zinc-900">{r.title}</p>
                  {r.description && <p className="mt-1 text-xs text-zinc-500">{r.description}</p>}
                  {r.viewUrl && (
                    <a
                      href={r.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      {r.file_name ? `Download ${r.file_name}` : "Open link"} →
                    </a>
                  )}
                </div>
                <DeleteResourceButton resourceId={r.id} filePath={r.file_path} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
