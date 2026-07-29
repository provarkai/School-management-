import { requirePlatformAdmin } from "@/lib/current-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <p className="text-sm font-bold text-zinc-900">Platform Admin</p>
      </header>
      <main className="flex-1 p-4 sm:p-8">{children}</main>
    </div>
  );
}
