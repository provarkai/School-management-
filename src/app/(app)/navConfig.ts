import type { Role } from "@/lib/types";

export interface NavItem {
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

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const PINNED_TOP: NavItem[] = [{ href: "/dashboard", label: "Dashboard", alwaysVisible: true }];

export const SETTINGS_ITEM: NavItem = { href: "/profile", label: "Settings", alwaysVisible: true };

// Everything else folds into exactly 6 related groups, so the sidebar shows
// Dashboard + 6 tab-style sections instead of one long flat list, and each
// group's own pages show the same set as in-page tabs (GroupTabs). Settings
// lives inside Admin for a manager (it now includes school-wide settings),
// but stays reachable as a pinned bottom item for everyone else, who only
// ever use it for their own profile/password.
export const GROUPS: NavGroup[] = [
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
      { href: "/subjects", label: "Subjects", managerOnly: true },
      { href: "/timetable", label: "Timetable", roles: ["teacher"], managerOnly: true },
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
      { href: "/staff", label: "Staff", managerOnly: true },
      { href: "/classes", label: "Classes", managerOnly: true },
      { href: "/campuses", label: "Campuses", managerOnly: true },
    ],
  },
];

export const PINNED_BOTTOM: NavItem[] = [SETTINGS_ITEM];

export function isVisible(item: NavItem, role: Role, isManager: boolean): boolean {
  if (item.alwaysVisible) return true;
  if (item.literalProprietorOnly) return role === "proprietor";
  if (item.managerOnly && isManager) return true;
  return item.roles?.includes(role) ?? false;
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Visible groups for this user, with Settings folded into Admin for a
 * manager instead of staying a separate pinned item. */
export function getVisibleGroups(role: Role, isManager: boolean): NavGroup[] {
  return GROUPS.map((g) => {
    let items = g.items.filter((item) => isVisible(item, role, isManager));
    if (g.id === "admin" && isManager) {
      items = [...items, SETTINGS_ITEM];
    }
    return { ...g, items };
  }).filter((g) => g.items.length > 0);
}

/** Pinned-bottom items for this user — empty for a manager, since Settings
 * shows inside the Admin group instead. */
export function getPinnedBottom(role: Role, isManager: boolean): NavItem[] {
  if (isManager) return [];
  return PINNED_BOTTOM.filter((item) => isVisible(item, role, isManager));
}
