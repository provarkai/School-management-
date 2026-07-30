import { requireProprietor } from "@/lib/current-user";
import { ImportForm } from "./ImportForm";

export default async function ImportStaffPage() {
  await requireProprietor();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Bulk import staff</h1>
      <p className="max-w-xl text-sm text-zinc-500">
        Upload a CSV to create staff accounts in one go. Campuses (if any) must already
        exist — matching is by campus name (case-insensitive). Each row gets its own
        temporary password to sign in with.
      </p>
      <ImportForm />
    </div>
  );
}
