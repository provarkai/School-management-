"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { getVisibleGroups, isActive } from "./navConfig";

export function GroupTabs({ role, isManager }: { role: Role; isManager: boolean }) {
  const pathname = usePathname();

  const visibleGroups = getVisibleGroups(role, isManager);
  const group = visibleGroups.find((g) => g.items.some((item) => isActive(pathname, item.href)));
  if (!group) return null;

  const items = group.items;
  if (items.length < 2) return null;

  return (
    <div className="mb-4 -mt-1 border-b border-zinc-200 sm:-mt-2">
      <nav className="flex flex-wrap gap-x-1 gap-y-2 overflow-x-auto" aria-label={`${group.label} tabs`}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
