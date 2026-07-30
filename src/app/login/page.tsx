import Link from "next/link";
import { AuthForms } from "./AuthForms";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          School Manager
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Fees · Attendance · Report cards · Reminders
        </p>
      </div>
      {error === "confirm_failed" && (
        <p className="mb-4 w-full max-w-sm rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          That confirmation link didn&apos;t work — it may have expired. Try signing up again,
          or sign in directly if you already confirmed your email.
        </p>
      )}
      <AuthForms />
      <Link href="/parent/login" className="mt-6 text-xs text-zinc-400 hover:text-zinc-600">
        Parent? Sign in to the parent portal →
      </Link>
    </div>
  );
}
