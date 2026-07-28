import { requireProprietor } from "@/lib/current-user";
import { ImportForm } from "./ImportForm";

export default async function ImportStudentsPage() {
  await requireProprietor();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Bulk import students</h1>
      <p className="max-w-xl text-sm text-zinc-500">
        Upload a CSV exported from your existing student register. Classes must already
        exist — matching is by class name (case-insensitive).
      </p>
      <ImportForm />
    </div>
  );
}
