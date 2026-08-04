-- Finishes closing the admin-escalation family opened by 0069:
--
-- 1. Demoting the owner (UPDATE). 0069's WITH CHECK stopped a delegated
--    admin from writing role='proprietor' onto any row, but RLS policy
--    expressions cannot compare the old row to the new one (WITH CHECK only
--    sees NEW), so an admin could still set the proprietor's own role to
--    'staff' — a destructive takeover step. OLD-vs-NEW checks require a
--    trigger, so this is a 0030-style guard: only the literal proprietor
--    may change any row's role to or from 'proprietor'.
--
-- 2. Puppet rows (INSERT/DELETE). The 0003 INSERT and DELETE policies also
--    keyed off current_role(), which treats a delegated admin as a
--    proprietor — so an admin could delete any school member (including
--    the owner) or insert a new row with role='proprietor'. Both policies
--    are now pinned to the literal role. The app's own staff create/delete
--    go through the service-role admin client, so no app flow is affected.
create or replace function public.protect_proprietor_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and (new.role = 'proprietor' or old.role = 'proprietor')
  then
    -- bootstrap_school (0005/0028/0048) legitimately promotes a brand-new,
    -- school-less user to proprietor in one step; its UPDATE is exactly the
    -- old.school_id IS NULL -> new.school_id IS NOT NULL transition. That
    -- exemption is safe: an unlinked row has no data access, and 0069's
    -- WITH CHECK blocks any direct-API attempt to change role on a row
    -- whose school_id would not match current_school_id().
    if old.school_id is not null or new.school_id is null then
      -- System contexts (SQL editor, seed scripts, the service-role admin
      -- client) carry no JWT, so auth.uid() is null; the anon role cannot
      -- reach this trigger (no app_users policy). Only signed-in users who
      -- are not the literal proprietor are blocked here.
      if auth.uid() is not null
         and not exists (
           select 1 from public.app_users where id = auth.uid() and role = 'proprietor'
         )
      then
        raise exception 'Only the proprietor can change the proprietor role';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_proprietor_role on public.app_users;
create trigger protect_proprietor_role
  before update on public.app_users
  for each row execute function public.protect_proprietor_role();

drop policy if exists "app_users_write_proprietor" on public.app_users;
create policy "app_users_write_proprietor" on public.app_users
  for insert with check (
    school_id = public.current_school_id()
    and exists (
      select 1 from public.app_users where id = auth.uid() and role = 'proprietor'
    )
  );

drop policy if exists "app_users_delete_proprietor" on public.app_users;
create policy "app_users_delete_proprietor" on public.app_users
  for delete using (
    school_id = public.current_school_id()
    and exists (
      select 1 from public.app_users where id = auth.uid() and role = 'proprietor'
    )
  );
