"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["proprietor", "teacher"] },
  { href: "/students", label: "Students", roles: ["proprietor", "teacher"] },
  { href: "/campuses", label: "Campuses", roles: ["proprietor"] },
  { href: "/classes", label: "Classes", roles: ["proprietor"] },
  { href: "/fees", label: "Fees", roles: ["proprietor"] },
  { href: "/attendance", label: "Attendance", roles: ["proprietor", "teacher"] },
  { href: "/report-cards", label: "Report cards", roles: ["proprietor", "teacher"] },
  { href: "/timetable", label: "Timetable", roles: ["proprietor", "teacher"] },
  { href: "/subjects", label: "Subjects", roles: ["proprietor"] },
  { href: "/reminders", label: "Reminders", roles: ["proprietor"] },
  { href: "/assistant", label: "AI Assistant", roles: ["proprietor", "teacher"] },
  { href: "/staff", label: "Staff", roles: ["proprietor"] },
];

export function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const current = items.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <nav>
      {/* Mobile: a dropdown to jump between pages */}
      <select
        aria-label="Go to page"
        value={current?.href ?? ""}
        onChange={(e) => router.push(e.target.value)}
        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 md:hidden"
      >
        {!current && <option value="">Menu</option>}
        {items.map((item) => (
          <option key={item.href} value={item.href}>
            {item.label}
          </option>
        ))}
      </select>

      {/* Desktop: full vertical sidebar list */}
      <div className="hidden md:flex md:flex-col md:gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
