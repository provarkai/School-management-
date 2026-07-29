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
      <ParentAuthForms />
      <Link href="/login" className="mt-6 text-xs text-zinc-400 hover:text-zinc-600">
        School staff? Sign in here →
      </Link>
    </div>
  );
}
