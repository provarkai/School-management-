"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import { PINNED_TOP, GROUPS, PINNED_BOTTOM, isVisible, isActive, type NavItem } from "./navConfig";

export function NavLinks({ role, isManager }: { role: Role; isManager: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const visibleGroups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => isVisible(item, role, isManager)),
  })).filter((g) => g.items.length > 0);

  const activeGroupId = visibleGroups.find((g) => g.items.some((item) => isActive(pathname, item.href)))?.id ?? null;
  const effectiveOpenGroup = openGroup !== null ? openGroup : activeGroupId;

  const allItems = [
    ...PINNED_TOP,
    ...visibleGroups.flatMap((g) => g.items),
    ...PINNED_BOTTOM,
  ].filter((item) => isVisible(item, role, isManager));
  const current = allItems.find((item) => isActive(pathname, item.href));

  return (
    <nav>
      {/* Mobile: a flat dropdown to jump between pages */}
      <select
        aria-label="Go to page"
        value={current?.href ?? ""}
        onChange={(e) => router.push(e.target.value)}
        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 md:hidden"
      >
        {!current && <option value="">Menu</option>}
        {PINNED_TOP.filter((item) => isVisible(item, role, isManager)).map((item) => (
          <option key={item.href} value={item.href}>
            {item.label}
          </option>
        ))}
        {visibleGroups.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {group.items.map((item) => (
              <option key={item.href} value={item.href}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
        {PINNED_BOTTOM.filter((item) => isVisible(item, role, isManager)).map((item) => (
          <option key={item.href} value={item.href}>
            {item.label}
          </option>
        ))}
      </select>

      {/* Desktop: pinned items + 6 grouped, tab-style collapsible sections */}
      <div className="hidden md:flex md:flex-col md:gap-1">
        {PINNED_TOP.filter((item) => isVisible(item, role, isManager)).map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        {visibleGroups.map((group) => {
          const isOpen = effectiveOpenGroup === group.id;
          return (
            <div key={group.id} className="mt-1">
              <button
                type="button"
                onClick={() => setOpenGroup(isOpen ? "" : group.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition ${
                  isOpen ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-700"
                }`}
              >
                {group.label}
                <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-1 pb-1 pl-2">
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="mt-2 border-t border-zinc-100 pt-2">
          {PINNED_BOTTOM.filter((item) => isVisible(item, role, isManager)).map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      }`}
    >
      {item.label}
    </Link>
  );
}
