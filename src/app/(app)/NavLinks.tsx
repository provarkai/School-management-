"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["proprietor", "teacher"] },
  { href: "/students", label: "Students", roles: ["proprietor", "teacher"] },
  { href: "/classes", label: "Classes", roles: ["proprietor"] },
  { href: "/fees", label: "Fees", roles: ["proprietor"] },
  { href: "/attendance", label: "Attendance", roles: ["proprietor", "teacher"] },
  { href: "/report-cards", label: "Report cards", roles: ["proprietor", "teacher"] },
  { href: "/subjects", label: "Subjects", roles: ["proprietor"] },
  { href: "/reminders", label: "Reminders", roles: ["proprietor"] },
  { href: "/assistant", label: "AI Assistant", roles: ["proprietor", "teacher"] },
  { href: "/staff", label: "Staff", roles: ["proprietor"] },
];

export function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition md:rounded-md md:px-3 md:py-2 ${
              active
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 md:bg-transparent md:hover:bg-zinc-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
