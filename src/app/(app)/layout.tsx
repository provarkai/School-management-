import { requireUser } from "@/lib/current-user";
import { NavLinks } from "./NavLinks";
import { signOut } from "./actions";
import { TERM_LABELS } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, school } = await requireUser();

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col justify-between border-b border-zinc-200 bg-white px-4 py-4 md:h-screen md:w-56 md:border-b-0 md:border-r">
        <div>
          <div className="mb-6 px-1">
            <p className="truncate text-sm font-bold text-zinc-900">
              {school?.name ?? "School Manager"}
            </p>
            {school && (
              <p className="text-xs text-zinc-400">
                {school.current_session} · {TERM_LABELS[school.current_term]}
              </p>
            )}
          </div>
          <NavLinks role={profile.role} />
        </div>
        <div className="mt-6 border-t border-zinc-100 pt-4">
          <p className="truncate px-1 text-sm text-zinc-700">{profile.name}</p>
          <p className="px-1 text-xs capitalize text-zinc-400">{profile.role}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
    </div>
  );
}
