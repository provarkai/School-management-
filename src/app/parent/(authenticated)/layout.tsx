import Link from "next/link";
import { requireParent } from "@/lib/current-parent";
import { Avatar } from "@/components/Avatar";
import { parentSignOut } from "../actions";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { parent } = await requireParent();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Avatar url={parent.photo_url} name={parent.name} size="sm" />
          <div>
            <p className="text-sm font-bold text-zinc-900">Parent Portal</p>
            <p className="text-xs text-zinc-400">{parent.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/parent/profile"
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            My Profile
          </Link>
          <form action={parentSignOut}>
            <button
              type="submit"
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-3 sm:p-4 md:p-8">{children}</main>
    </div>
  );
}
