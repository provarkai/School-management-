import { requireUser } from "@/lib/current-user";
import { EditProfileForm, ChangePasswordForm } from "./ProfileForms";

const ROLE_LABELS: Record<string, string> = {
  proprietor: "Proprietor",
  teacher: "Teacher",
  staff: "Non-teaching staff",
};

export default async function ProfilePage() {
  const { profile } = await requireUser();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">My Profile</h1>
        <p className="text-sm text-zinc-500">
          {ROLE_LABELS[profile.role] ?? profile.role}
          {profile.role === "teacher" && profile.subject ? ` · ${profile.subject}` : ""}
          {profile.role === "staff" && profile.job_title ? ` · ${profile.job_title}` : ""}
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Details</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Email: <span className="text-zinc-700">{profile.email}</span> (contact the school
          proprietor to change your email, subject, job title, or campus)
        </p>
        <EditProfileForm name={profile.name} phone={profile.phone} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Change password</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
