-- Monitoring item #3: message delivery failures. message_logs already
-- records a status of 'sent' | 'failed' | 'mocked' per recipient (0058), but
-- it's manager-scoped (proprietor of that school only) — a platform admin
-- currently has no way to see that, say, a school's Termii credentials
-- expired and every reminder for the last two days has been failing.
-- Same pattern as platform_stuck_payments(): a security-definer RPC that
-- reads across every school without adding a platform-admin select policy
-- to message_logs itself.
create or replace function public.platform_message_failures(hours_back integer default 24)
returns table (
  id uuid,
  school_id uuid,
  school_name text,
  purpose text,
  recipient_name text,
  recipient_phone text,
  error text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    ml.id,
    ml.school_id,
    s.name,
    ml.purpose,
    ml.recipient_name,
    ml.recipient_phone,
    ml.error,
    ml.created_at
  from public.message_logs ml
  join public.schools s on s.id = ml.school_id
  where ml.status = 'failed'
    and ml.created_at > now() - make_interval(hours => hours_back)
    and public.is_platform_admin()
  order by ml.created_at desc;
$$;

grant execute on function public.platform_message_failures(integer) to authenticated;
