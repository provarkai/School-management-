import { requireParent } from "@/lib/current-parent";
import { EditParentProfileForm, ChangeParentPasswordForm } from "./ProfileForms";

export default async function ParentProfilePage() {
  const { parent } = await requireParent();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">My Profile</h1>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Details</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Email: <span className="text-zinc-700">{parent.email}</span>
        </p>
        <EditParentProfileForm name={parent.name} phone={parent.phone} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Change password</h2>
        <ChangeParentPasswordForm />
      </section>
    </div>
  );
}
