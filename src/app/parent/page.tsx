import Link from "next/link";
import { requireParent } from "@/lib/current-parent";

export default async function ParentDashboardPage() {
  const { parent, children } = await requireParent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Welcome, {parent.name}</h1>
        <p className="text-sm text-zinc-500">
          {children.length === 0
            ? "No children linked to your account yet."
            : `${children.length} child${children.length === 1 ? "" : "ren"} linked to your account`}
        </p>
      </div>

      {children.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">
          <p>
            We couldn&apos;t find a student whose parent contact email matches the email you
            signed up with. If your child&apos;s school has your email on file, try signing out
            and back in — otherwise, contact the school office to have it added.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {children.map((child) => (
            <Link
              key={child.id}
              href={`/parent/${child.id}`}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {child.schoolName}
              </p>
              <p className="mt-1 text-lg font-bold text-zinc-900">{child.full_name}</p>
              <p className="text-sm text-zinc-500">{child.className ?? "No class assigned"}</p>
              <p className="mt-3 text-sm font-medium text-zinc-600">View fees, attendance &amp; results →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
