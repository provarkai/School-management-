"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role, StaffPermission } from "@/lib/types";
import { getVisibleGroups, isActive, GROUP_STYLES } from "./navConfig";

export function GroupTabs({
  role,
  isManager,
  permissions = new Set(),
  facilitiesEnabled = true,
}: {
  role: Role;
  isManager: boolean;
  permissions?: ReadonlySet<StaffPermission>;
  facilitiesEnabled?: boolean;
}) {
  const pathname = usePathname();

  const visibleGroups = getVisibleGroups(role, isManager, permissions, facilitiesEnabled);
  const group = visibleGroups.find((g) => g.items.some((item) => isActive(pathname, item.href)));
  if (!group) return null;

  const items = group.items;
  if (items.length < 2) return null;

  const style = GROUP_STYLES[group.id];

  return (
    <div className={`mb-4 -mt-1 rounded-lg p-1 print:hidden sm:-mt-2 ${style.tabActiveBg}`}>
      <nav className="flex flex-wrap items-center gap-1 overflow-x-auto" aria-label={`${group.label} tabs`}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-semibold transition ${
                active ? `bg-white shadow-sm ${style.tabActive}` : `text-zinc-500 hover:bg-black/5 ${style.tabHover}`
              }`}
            >
              <span>{item.emoji}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
