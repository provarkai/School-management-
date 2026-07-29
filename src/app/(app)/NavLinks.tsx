"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  /** Literal roles that always see this item, regardless of manager status. */
  roles?: Role[];
  /** Visible to the proprietor and any staff delegated admin rights. */
  managerOnly?: boolean;
  /** Visible to the literal proprietor only — never a delegated admin
   * (payroll/salary data). */
  literalProprietorOnly?: boolean;
  /** Visible to every signed-in role, no filtering. */
  alwaysVisible?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const PINNED_TOP: NavItem[] = [{ href: "/dashboard", label: "Dashboard", alwaysVisible: true }];

// Everything else (17 pages) folds into exactly 6 related groups, so the
// sidebar shows Dashboard + 6 tab-style sections instead of 19 flat links.
const GROUPS: NavGroup[] = [
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/assistant", label: "AI Assistant", roles: ["teacher"], managerOnly: true },
      { href: "/analytics", label: "Analytics", managerOnly: true },
      { href: "/reports", label: "Reports", managerOnly: true },
    ],
  },
  {
    id: "students",
    label: "Students",
    items: [
      { href: "/students", label: "Students", roles: ["teacher"], managerOnly: true },
      { href: "/attendance", label: "Attendance", roles: ["teacher"], managerOnly: true },
      { href: "/assignments", label: "Assignments", roles: ["teacher"], managerOnly: true },
      { href: "/report-cards", label: "Report cards", roles: ["teacher"], managerOnly: true },
    ],
  },
  {
    id: "academics",
    label: "Academics",
    items: [
      { href: "/timetable", label: "Timetable", roles: ["teacher"], managerOnly: true },
      { href: "/subjects", label: "Subjects", managerOnly: true },
      { href: "/calendar", label: "Calendar", roles: ["teacher", "staff"], managerOnly: true },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { href: "/fees", label: "Fees", managerOnly: true },
      { href: "/payroll", label: "Payroll", literalProprietorOnly: true },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    items: [
      { href: "/reminders", label: "Reminders", managerOnly: true },
      { href: "/notices", label: "Notices", alwaysVisible: true },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { href: "/campuses", label: "Campuses", managerOnly: true },
      { href: "/classes", label: "Classes", managerOnly: true },
      { href: "/staff", label: "Staff", managerOnly: true },
    ],
  },
];

const PINNED_BOTTOM: NavItem[] = [{ href: "/profile", label: "My Profile", alwaysVisible: true }];

function isVisible(item: NavItem, role: Role, isManager: boolean): boolean {
  if (item.alwaysVisible) return true;
  if (item.literalProprietorOnly) return role === "proprietor";
  if (item.managerOnly && isManager) return true;
  return item.roles?.includes(role) ?? false;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

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
