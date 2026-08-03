-- Parent–child linking used to trust an unverified field: link_my_children()
-- (0010_parent_portal.sql) links any parent whose LOGIN EMAIL matches
-- students.parent_email, with no approval step and no way for the school to
-- see it happen. Anyone can self-register at /parent/login, so whoever
-- controls the mailbox typed into that field — including a typo landing on
-- a real address — gets that child's fees, attendance, results and
-- messaging thread.
--
-- Replaces it with an invitation: the proprietor generates a one-time link
-- from the student's page and sends it however they like (SMS, WhatsApp,
-- printed). Whoever holds that specific link can attach their account to
-- that specific child — the trust is "you have this token", not "you typed
-- a matching email". Redeeming is logged into activity_logs so the school
-- can see who gained access to which child and when.
--
-- link_my_children() is left in place (harmless, and something may still
-- call it directly) but the app no longer calls it on every parent sign-in
-- — see requireParent() in src/lib/current-parent.ts. Existing links made
-- by the old auto-match are untouched; only how *new* links are made
-- changes here.

create table if not exists public.parent_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  token text not null unique,
  created_by uuid references public.app_users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  redeemed_at timestamptz,
  redeemed_by uuid references public.parents (id) on delete set null
);

create index if not exists parent_invitations_student_id_idx on public.parent_invitations (student_id);
create index if not exists parent_invitations_school_id_idx on public.parent_invitations (school_id);

alter table public.parent_invitations enable row level security;

-- Management (generate, list, revoke) is staff-only, same school. There is
-- deliberately no policy granting a parent or an anonymous visitor direct
-- table access — the public invite-landing page reads a token's status via
-- the service-role client (same pattern as /p/[token] and /check-result),
-- and redemption goes through the RPC below.
create policy "parent_invitations_select_proprietor" on public.parent_invitations
  for select using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

create policy "parent_invitations_insert_proprietor" on public.parent_invitations
  for insert with check (
    school_id = public.current_school_id()
    and public.current_role() = 'proprietor'
    and exists (select 1 from public.students s where s.id = student_id and s.school_id = parent_invitations.school_id)
  );

create policy "parent_invitations_delete_proprietor" on public.parent_invitations
  for delete using (school_id = public.current_school_id() and public.current_role() = 'proprietor');

-- Consistent with 0064_enforce_school_suspension.sql: a suspended school
-- can't generate or manage invitations either.
drop policy if exists "parent_invitations_active_school_only" on public.parent_invitations;
create policy "parent_invitations_active_school_only" on public.parent_invitations
  as restrictive for all
  using (public.school_is_active(school_id));

-- Redeeming needs to work for a parent who has zero standing access yet
-- (that's the whole point), so it's a security-definer RPC rather than a
-- client-side update: it validates the token itself instead of relying on
-- RLS to have already granted the caller anything.
create or replace function public.redeem_parent_invitation(target_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  parent_name text;
  student_name text;
begin
  select * into inv from public.parent_invitations where token = target_token for update;

  if inv.id is null then
    raise exception 'This invitation link is not valid.';
  end if;
  if inv.redeemed_at is not null then
    raise exception 'This invitation link has already been used.';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invitation link has expired — ask the school for a new one.';
  end if;
  if not public.school_is_active(inv.school_id) then
    raise exception 'This school''s account is currently suspended.';
  end if;

  insert into public.parent_students (parent_id, student_id)
  values (auth.uid(), inv.student_id)
  on conflict (parent_id, student_id) do nothing;

  update public.parent_invitations
  set redeemed_at = now(), redeemed_by = auth.uid()
  where id = inv.id;

  select name into parent_name from public.parents where id = auth.uid();
  select full_name into student_name from public.students where id = inv.student_id;

  insert into public.activity_logs (school_id, actor_id, actor_name, actor_role, action, summary)
  values (
    inv.school_id,
    auth.uid(),
    coalesce(parent_name, 'A parent'),
    'parent',
    'parent_invitation_redeemed',
    format('%s linked to %s via an invitation link.', coalesce(parent_name, 'A parent'), coalesce(student_name, 'a student'))
  );

  return inv.student_id;
end;
$$;

grant execute on function public.redeem_parent_invitation(text) to authenticated;
