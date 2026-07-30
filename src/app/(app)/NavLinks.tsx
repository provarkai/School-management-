"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import {
  PINNED_TOP,
  getVisibleGroups,
  getPinnedBottom,
  isVisible,
  isActive,
  GROUP_STYLES,
  PINNED_STYLE,
  type NavItem,
  type GroupStyle,
} from "./navConfig";

export function NavLinks({ role, isManager }: { role: Role; isManager: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const visibleGroups = getVisibleGroups(role, isManager);
  const pinnedBottom = getPinnedBottom(role, isManager);

  const activeGroupId = visibleGroups.find((g) => g.items.some((item) => isActive(pathname, item.href)))?.id ?? null;
  const effectiveOpenGroup = openGroup !== null ? openGroup : activeGroupId;

  const pinnedTop = PINNED_TOP.filter((item) => isVisible(item, role, isManager));
  const allItems = [...pinnedTop, ...visibleGroups.flatMap((g) => g.items), ...pinnedBottom];
  const current = allItems.find((item) => isActive(pathname, item.href));
  const activeGroup = visibleGroups.find((g) => g.id === activeGroupId);
  const selectValue = activeGroup ? activeGroup.items[0].href : current?.href ?? "";

  return (
    <nav>
      {/* Mobile: a flat dropdown of top-level destinations only — a group's
          sub-pages show up as tabs (GroupTabs) once you land on it */}
      <select
        aria-label="Go to page"
        value={selectValue}
        onChange={(e) => router.push(e.target.value)}
        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 md:hidden"
      >
        {!selectValue && <option value="">Menu</option>}
        {pinnedTop.map((item) => (
          <option key={item.href} value={item.href}>
            {item.emoji} {item.label}
          </option>
        ))}
        {visibleGroups.map((group) => (
          <option key={group.id} value={group.items[0].href}>
            {GROUP_STYLES[group.id]?.emoji} {group.label}
          </option>
        ))}
        {pinnedBottom.map((item) => (
          <option key={item.href} value={item.href}>
            {item.emoji} {item.label}
          </option>
        ))}
      </select>

      {/* Desktop: pinned items + 6 grouped, tab-style collapsible sections */}
      <div className="hidden md:flex md:flex-col md:gap-1">
        {pinnedTop.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} style={PINNED_STYLE} />
        ))}

        {visibleGroups.map((group) => {
          const isOpen = effectiveOpenGroup === group.id;
          const style = GROUP_STYLES[group.id];
          return (
            <div key={group.id} className="mt-1">
              <button
                type="button"
                onClick={() => setOpenGroup(isOpen ? "" : group.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition ${
                  isOpen ? style.openText : "text-zinc-400 hover:text-zinc-700"
                }`}
              >
                <span>
                  <span className="mr-1.5">{style.emoji}</span>
                  {group.label}
                </span>
                <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-1 pb-1 pl-2">
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} style={style} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {pinnedBottom.length > 0 && (
          <div className="mt-2 border-t border-zinc-100 pt-2">
            {pinnedBottom.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} style={PINNED_STYLE} />
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function NavLink({ item, active, style }: { item: NavItem; active: boolean; style: GroupStyle }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? `${style.activeBg} ${style.activeText}` : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      }`}
    >
      <span>{item.emoji}</span>
      {item.label}
    </Link>
  );
}
