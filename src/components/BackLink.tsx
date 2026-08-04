import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
      ← {label}
    </Link>
  );
}
