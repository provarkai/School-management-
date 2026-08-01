import Link from "next/link";
import { ParentAuthForms } from "./ParentAuthForms";

export default function ParentLoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Parent Portal</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Track your child&apos;s fees, attendance and results
        </p>
      </div>
      <p className="mb-4 w-full max-w-sm rounded-md bg-zinc-100 px-3 py-2 text-center text-sm text-zinc-600">
        This is for parents/guardians tracking a child&apos;s school account. School staff
        (proprietors, teachers, admin)?{" "}
        <Link href="/login" className="font-medium text-zinc-900 hover:underline">
          Go to the staff login →
        </Link>
      </p>
      <ParentAuthForms />
    </div>
  );
}
