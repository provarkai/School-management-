-- Per-user (not per-school, unlike quick_links) dashboard widget
-- visibility + order for the manager dashboard. Null means "use the
-- default full set in default order".
alter table public.app_users add column if not exists dashboard_widgets text[];
