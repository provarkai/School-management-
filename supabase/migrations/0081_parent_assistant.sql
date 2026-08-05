-- A parent-facing AI Assistant, mirroring the staff one (0066): its own
-- rate-limit table keyed to parents.id rather than app_users.id, since a
-- parent isn't a row in app_users. Same "narrow security-definer RPC
-- instead of a broad grant" pattern — no RLS policy is granted on this
-- table at all; the app never reads or writes it directly.
create table if not exists public.parent_assistant_usage (
  parent_id uuid not null references public.parents (id) on delete cascade,
  usage_date date not null default current_date,
  message_count integer not null default 0,
  primary key (parent_id, usage_date)
);

alter table public.parent_assistant_usage enable row level security;

create or replace function public.increment_parent_assistant_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  result_count integer;
begin
  insert into public.parent_assistant_usage (parent_id, usage_date, message_count)
  values (auth.uid(), current_date, 1)
  on conflict (parent_id, usage_date)
  do update set message_count = parent_assistant_usage.message_count + 1
  returning message_count into result_count;

  return result_count;
end;
$$;

grant execute on function public.increment_parent_assistant_usage() to authenticated;
