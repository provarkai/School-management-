export interface DashboardWidgetOption {
  key: string;
  label: string;
}

export const DASHBOARD_WIDGET_CATALOG: DashboardWidgetOption[] = [
  { key: "summary_cards", label: "Summary cards (students, fees, attendance)" },
  { key: "quick_links", label: "Quick links" },
  { key: "upcoming_events", label: "Upcoming events" },
  { key: "ai_assistant", label: "AI Assistant" },
  { key: "recent_activity", label: "Recent activity" },
];

export const DEFAULT_DASHBOARD_WIDGETS = DASHBOARD_WIDGET_CATALOG.map((w) => w.key);
