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
  { href: "/reminders", label: "Reminders", roles: ["proprietor"] },
  { href: "/assistant", label: "AI Assistant", roles: ["proprietor", "teacher"] },
  { href: "/staff", label: "Staff", roles: ["proprietor"] },
];

export function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="flex flex-col gap-1">
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
    </nav>
  );
}
