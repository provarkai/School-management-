import { requireUser } from "@/lib/current-user";
import { AvatarUploader } from "@/components/AvatarUploader";
import {
  EditProfileForm,
  ChangePasswordForm,
  SchoolProfileForm,
  AcademicSessionForm,
} from "./ProfileForms";
import { SchoolLogoUploader } from "./SchoolLogoUploader";
import { saveProfilePhoto, saveSchoolLogo } from "./actions";
import { proprietorTitle } from "@/lib/format";

const ROLE_LABELS: Record<string, string> = {
  teacher: "Teacher",
  staff: "Non-teaching staff",
};

export default async function SettingsPage() {
  const { authId, profile, school, isManager } = await requireUser();
  const roleLabel =
    profile.role === "proprietor"
      ? proprietorTitle(profile.gender)
      : `${ROLE_LABELS[profile.role] ?? profile.role}${profile.is_school_admin ? " · Admin" : ""}`;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500">
          {roleLabel}
          {profile.role === "teacher" && profile.subject ? ` · ${profile.subject}` : ""}
          {profile.role === "staff" && profile.job_title ? ` · ${profile.job_title}` : ""}
        </p>
      </div>

      {isManager && school && (
        <div className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            School profile
          </h2>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">Logo</h3>
            <SchoolLogoUploader
              schoolId={school.id}
              schoolName={school.name}
              initialUrl={school.logo_url}
              onSave={saveSchoolLogo}
            />
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">Details</h3>
            <SchoolProfileForm name={school.name} address={school.address} phone={school.phone} />
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">Academic session</h3>
            <p className="mb-3 text-sm text-zinc-500">
              This drives every &quot;current term&quot; view across the app — fees, attendance,
              and results all default to whatever is set here.
            </p>
            <AcademicSessionForm session={school.current_session} term={school.current_term} />
          </section>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {profile.role === "proprietor" ? roleLabel : "Your profile"}
        </h2>

        {profile.role !== "proprietor" && (
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">Photo</h3>
            <AvatarUploader
              userId={authId}
              name={profile.name}
              initialUrl={profile.photo_url}
              onSave={saveProfilePhoto}
            />
          </section>
        )}

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Details</h3>
          <p className="mb-4 text-sm text-zinc-500">
            Email: <span className="text-zinc-700">{profile.email}</span> (contact the school
            proprietor to change your email, subject, job title, or campus)
          </p>
          <EditProfileForm name={profile.name} phone={profile.phone} />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Change password</h3>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
