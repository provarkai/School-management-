-- The AI Assistant has no rate limiting: every message is a paid
-- OpenRouter call, any signed-in teacher/staff member can loop it, and the
-- client supplies the full history array with no length cap, so a single
-- request can be made arbitrarily expensive. The history cap is enforced
-- in askAssistant() itself (src/app/(app)/assistant/actions.ts); this adds
-- the per-user daily message count.
--
-- No RLS policy is granted on this table at all — the app never reads or
-- writes it directly, only through increment_assistant_usage() below, the
-- same "narrow security-definer RPC instead of a broad grant" pattern used
-- for mark_thread_read_parent. That means a direct API call has no way to
-- reset or inflate another user's count.
create table if not exists public.assistant_usage (
  staff_id uuid not null references public.app_users (id) on delete cascade,
  usage_date date not null default current_date,
  message_count integer not null default 0,
  primary key (staff_id, usage_date)
);

alter table public.assistant_usage enable row level security;

create or replace function public.increment_assistant_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  result_count integer;
begin
  insert into public.assistant_usage (staff_id, usage_date, message_count)
  values (auth.uid(), current_date, 1)
  on conflict (staff_id, usage_date)
  do update set message_count = assistant_usage.message_count + 1
  returning message_count into result_count;

  return result_count;
end;
$$;

grant execute on function public.increment_assistant_usage() to authenticated;
