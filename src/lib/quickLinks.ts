export interface QuickLinkOption {
  key: string;
  label: string;
  href: string;
}

// "fees_owing" gets its label filled in at render time with the live owing
// count, so its catalog label here is just the fallback/picker copy.
export const QUICK_LINK_CATALOG: QuickLinkOption[] = [
  { key: "fees_owing", label: "View owing students", href: "/fees?status=owing" },
  { key: "send_reminder", label: "Send bulk reminder", href: "/reminders" },
  { key: "generate_report_cards", label: "Generate report cards", href: "/report-cards" },
  { key: "register_student", label: "Register new student", href: "/students/new" },
  { key: "mark_attendance", label: "Mark today's attendance", href: "/attendance" },
  { key: "post_notice", label: "Post a notice", href: "/notices" },
  { key: "view_timetable", label: "View timetable", href: "/timetable" },
  { key: "view_analytics", label: "View analytics", href: "/analytics" },
  { key: "manage_staff", label: "Manage staff", href: "/staff" },
  { key: "view_calendar", label: "View academic calendar", href: "/calendar" },
];

export const DEFAULT_QUICK_LINKS = [
  "fees_owing",
  "send_reminder",
  "generate_report_cards",
  "register_student",
];

export const MAX_QUICK_LINKS = 4;

export function getQuickLinkOption(key: string): QuickLinkOption | undefined {
  return QUICK_LINK_CATALOG.find((o) => o.key === key);
}
