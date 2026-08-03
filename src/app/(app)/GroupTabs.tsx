"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role, StaffPermission } from "@/lib/types";
import { getVisibleGroups, isActive, GROUP_STYLES } from "./navConfig";

export function GroupTabs({
  role,
  isManager,
  permissions = new Set(),
}: {
  role: Role;
  isManager: boolean;
  permissions?: ReadonlySet<StaffPermission>;
}) {
  const pathname = usePathname();

  const visibleGroups = getVisibleGroups(role, isManager, permissions);
  const group = visibleGroups.find((g) => g.items.some((item) => isActive(pathname, item.href)));
  if (!group) return null;

  const items = group.items;
  if (items.length < 2) return null;

  const style = GROUP_STYLES[group.id];

  return (
    <div className="mb-4 -mt-1 border-b border-zinc-200 print:hidden sm:-mt-2">
      <nav className="flex flex-wrap gap-x-1 gap-y-2 overflow-x-auto" aria-label={`${group.label} tabs`}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-semibold transition ${
                active
                  ? `${style.tabActive} ${style.tabActiveBg}`
                  : `border-transparent text-zinc-500 ${style.tabHover}`
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
