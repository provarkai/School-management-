-- A delegated school admin (is_school_admin = true) could self-grant the
-- literal proprietor role. 0065's WITH CHECK keyed its "proprietor" branch
-- off current_role(), and current_role() deliberately treats a school admin
-- as a proprietor (0030) so they can manage the school day-to-day. That same
-- branch let the admin UPDATE their own row to role = 'proprietor' —
-- silently converting delegated power into literal ownership, which unlocks
-- is_owner() (0043 keeps salary data off current_role() for exactly this
-- reason) and would survive the proprietor revoking their admin status.
--
-- Fix, mirroring 0030's trigger philosophy: the unrestricted branch now
-- requires the LITERAL role (checked on the acting user, not via
-- current_role()). A delegated admin may still manage staff day-to-day —
-- the app's requireProprietor() path edits subject/job_title/campus on
-- staff rows — but only rows whose resulting role is never 'proprietor'.
drop policy if exists "app_users_update_proprietor_or_self" on public.app_users;
create policy "app_users_update_proprietor_or_self" on public.app_users
  for update using (
    school_id = public.current_school_id()
    and (public.current_role() = 'proprietor' or id = auth.uid())
  )
  with check (
    school_id = public.current_school_id()
    and (
      -- Literal proprietor only: full freedom within the school (role
      -- moves, and is_school_admin flips — the 0030 trigger still gates
      -- the flag on top). Note the acting user's LITERAL role here, not
      -- current_role(): that is the whole point of this migration.
      exists (
        select 1 from public.app_users
        where id = auth.uid() and role = 'proprietor'
      )
      -- Delegated school admin: may update staff rows (subject, job_title,
      -- campus, teacher<->staff moves) but the resulting row must never
      -- become a literal proprietor. Closes the 0069 hole where an admin
      -- could write role = 'proprietor' onto their own — or any — row.
      or (
        public.current_role() = 'proprietor'
        and role in ('teacher', 'staff')
      )
      -- Plain teacher/staff self-edit, pinned to the values they already had.
      or (id = auth.uid() and role in ('teacher', 'staff') and is_school_admin = false)
    )
  );
