export const PROSPECT_STATUSES = [
  "inquiry",
  "contacted",
  "test_scheduled",
  "tested",
  "offered",
  "waitlisted",
  "enrolled",
  "rejected",
  "withdrawn",
] as const;

export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  inquiry: "Inquiry",
  contacted: "Contacted",
  test_scheduled: "Test scheduled",
  tested: "Tested",
  offered: "Offered a place",
  waitlisted: "Waitlisted",
  enrolled: "Enrolled",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const STATUS_STYLES: Record<ProspectStatus, string> = {
  inquiry: "bg-zinc-100 text-zinc-600",
  contacted: "bg-sky-100 text-sky-700",
  test_scheduled: "bg-indigo-100 text-indigo-700",
  tested: "bg-purple-100 text-purple-700",
  offered: "bg-amber-100 text-amber-700",
  waitlisted: "bg-orange-100 text-orange-700",
  enrolled: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-zinc-200 text-zinc-500",
};
