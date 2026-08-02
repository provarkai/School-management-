import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  emoji: string;
  /** Literal roles that always see this item, regardless of manager status. */
  roles?: Role[];
  /** Visible to the proprietor and any staff delegated admin rights. */
  managerOnly?: boolean;
  /** Visible to every signed-in role, no filtering. */
  alwaysVisible?: boolean;
}

export interface GroupStyle {
  emoji: string;
  /** Sidebar leaf "active" pill background + text. */
  activeBg: string;
  activeText: string;
  /** Group header label color while open. */
  openText: string;
  /** In-page tab: active underline + text. */
  tabActive: string;
  /** In-page tab: active background fill, so the selected tab reads clearly
   * against the others instead of relying on color/underline alone. */
  tabActiveBg: string;
  /** In-page tab: hover underline + text. */
  tabHover: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const PINNED_TOP: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", emoji: "🏠", alwaysVisible: true },
];

export const SETTINGS_ITEM: NavItem = { href: "/profile", label: "Settings", emoji: "⚙️", alwaysVisible: true };

export const PINNED_STYLE: GroupStyle = {
  emoji: "🏠",
  activeBg: "bg-sky-600",
  activeText: "text-white",
  openText: "text-sky-600",
  tabActive: "border-sky-600 text-sky-600",
  tabActiveBg: "bg-sky-50",
  tabHover: "hover:border-sky-300 hover:text-sky-600",
};

// Everything else folds into exactly 6 related groups, so the sidebar shows
// Dashboard + 6 tab-style sections instead of one long flat list, and each
// group's own pages show the same set as in-page tabs (GroupTabs). Settings
// lives inside Admin for a manager (it now includes school-wide settings),
// but stays reachable as a pinned bottom item for everyone else, who only
// ever use it for their own profile/password.
export const GROUPS: NavGroup[] = [
  {
    id: "students",
    label: "Students",
    items: [
      { href: "/students", label: "Students", emoji: "🧑‍🎓", roles: ["teacher"], managerOnly: true },
      { href: "/attendance", label: "Attendance", emoji: "✅", roles: ["teacher"], managerOnly: true },
      { href: "/assignments", label: "Assignments", emoji: "📝", roles: ["teacher"], managerOnly: true },
      { href: "/resources", label: "Resources", emoji: "📎", roles: ["teacher"], managerOnly: true },
      { href: "/report-cards", label: "Report cards", emoji: "📄", roles: ["teacher"], managerOnly: true },
    ],
  },
  {
    id: "academics",
    label: "Academics",
    items: [
      { href: "/subjects", label: "Subjects", emoji: "📘", managerOnly: true },
      { href: "/timetable", label: "Timetable", emoji: "🗓️", roles: ["teacher"], managerOnly: true },
      { href: "/classes", label: "Classes", emoji: "🏫", managerOnly: true },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { href: "/assistant", label: "AI Assistant", emoji: "🤖", roles: ["teacher"], managerOnly: true },
      { href: "/analytics", label: "Analytics", emoji: "📈", managerOnly: true },
      { href: "/reports", label: "Reports", emoji: "🧾", managerOnly: true },
    ],
  },
  {
    id: "staff",
    label: "Staff",
    items: [
      { href: "/staff", label: "Staff", emoji: "👥", managerOnly: true },
      { href: "/staff-attendance", label: "Staff Attendance", emoji: "🕒", managerOnly: true },
      { href: "/staff-performance", label: "Staff Performance", emoji: "🧑‍🏫", managerOnly: true },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { href: "/fees", label: "Fees", emoji: "💵", managerOnly: true },
      { href: "/expenses", label: "Expenses", emoji: "🧾", managerOnly: true },
      { href: "/payroll", label: "Payroll", emoji: "💼", managerOnly: true },
    ],
  },
  {
    id: "notifications",
    label: "Notifications",
    items: [
      { href: "/reminders", label: "Reminders", emoji: "📣", managerOnly: true },
      { href: "/broadcasts", label: "Broadcasts", emoji: "📢", managerOnly: true },
      { href: "/notices", label: "Notices", emoji: "📌", alwaysVisible: true },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { href: "/admissions", label: "Admissions", emoji: "🎓", managerOnly: true },
      { href: "/calendar", label: "Calendar", emoji: "📅", roles: ["teacher", "staff"], managerOnly: true },
      { href: "/promotion", label: "Session Promotion", emoji: "🔁", managerOnly: true },
      { href: "/campuses", label: "Campuses", emoji: "🏢", managerOnly: true },
    ],
  },
];

export const GROUP_STYLES: Record<string, GroupStyle> = {
  students: {
    emoji: "🧑‍🎓",
    activeBg: "bg-blue-600",
    activeText: "text-white",
    openText: "text-blue-600",
    tabActive: "border-blue-600 text-blue-700",
    tabActiveBg: "bg-blue-50",
    tabHover: "hover:border-blue-300 hover:text-blue-600",
  },
  academics: {
    emoji: "📚",
    activeBg: "bg-purple-600",
    activeText: "text-white",
    openText: "text-purple-600",
    tabActive: "border-purple-600 text-purple-700",
    tabActiveBg: "bg-purple-50",
    tabHover: "hover:border-purple-300 hover:text-purple-600",
  },
  insights: {
    emoji: "📊",
    activeBg: "bg-indigo-600",
    activeText: "text-white",
    openText: "text-indigo-600",
    tabActive: "border-indigo-600 text-indigo-700",
    tabActiveBg: "bg-indigo-50",
    tabHover: "hover:border-indigo-300 hover:text-indigo-600",
  },
  staff: {
    emoji: "🧑‍💼",
    activeBg: "bg-teal-600",
    activeText: "text-white",
    openText: "text-teal-600",
    tabActive: "border-teal-600 text-teal-700",
    tabActiveBg: "bg-teal-50",
    tabHover: "hover:border-teal-300 hover:text-teal-600",
  },
  finance: {
    emoji: "💰",
    activeBg: "bg-emerald-600",
    activeText: "text-white",
    openText: "text-emerald-600",
    tabActive: "border-emerald-600 text-emerald-700",
    tabActiveBg: "bg-emerald-50",
    tabHover: "hover:border-emerald-300 hover:text-emerald-600",
  },
  notifications: {
    emoji: "🔔",
    activeBg: "bg-amber-500",
    activeText: "text-white",
    openText: "text-amber-600",
    tabActive: "border-amber-500 text-amber-700",
    tabActiveBg: "bg-amber-50",
    tabHover: "hover:border-amber-300 hover:text-amber-600",
  },
  admin: {
    emoji: "🛠️",
    activeBg: "bg-rose-600",
    activeText: "text-white",
    openText: "text-rose-600",
    tabActive: "border-rose-600 text-rose-700",
    tabActiveBg: "bg-rose-50",
    tabHover: "hover:border-rose-300 hover:text-rose-600",
  },
};

export const PINNED_BOTTOM: NavItem[] = [SETTINGS_ITEM];

export function isVisible(item: NavItem, role: Role, isManager: boolean): boolean {
  if (item.alwaysVisible) return true;
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
