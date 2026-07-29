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
      <aside className="flex shrink-0 flex-col justify-between border-b border-zinc-200 bg-white px-3 py-3 sm:px-4 sm:py-4 md:h-screen md:w-56 md:border-b-0 md:border-r">
        <div>
          <div className="mb-3 flex items-start justify-between gap-3 px-1 md:mb-6 md:block">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-zinc-900">
                {school?.name ?? "School Manager"}
              </p>
              {school && (
                <p className="truncate text-xs text-zinc-400">
                  {school.current_session} · {TERM_LABELS[school.current_term]}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right md:hidden">
              <p className="truncate text-xs font-medium text-zinc-700">{profile.name}</p>
              <p className="text-[11px] capitalize text-zinc-400">{profile.role}</p>
            </div>
          </div>
          <NavLinks role={profile.role} />
        </div>
        <div className="mt-3 hidden border-t border-zinc-100 pt-4 md:block">
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
        <form action={signOut} className="mt-2 md:hidden">
          <button
            type="submit"
            className="w-full rounded-md border border-zinc-200 px-3 py-1.5 text-left text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8">{children}</main>
    </div>
  );
}
