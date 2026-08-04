-- Revoke stale security-definer RPC grants, and close the default
-- PUBLIC-execute gap on the ones the app actually uses.
--
-- Two findings from a security audit of the RPC surface:
--
-- 1. link_my_children() is still grantable. Migration 0067 replaced
--    email-match parent linking with proprietor-issued invitations and
--    stopped the app calling this function, but 0010's
--    `grant execute ... to authenticated` was never revoked. The app no
--    longer calls it, but any signed-in parent can still invoke
--    `supabase.rpc('link_my_children')` directly against the PostgREST
--    API and self-link to every student whose students.parent_email
--    matches their login email — re-opening the exact hole 0067 closed,
--    with no approval step and no activity_logs entry. The function is
--    dead code (the only reference to it outside this file is the
--    comment in 0067), so it is dropped outright rather than merely
--    un-granted.
--
-- 2. Every function in this database inherited Postgres' default PUBLIC
--    EXECUTE. None of the sixty-six prior migrations ever ran
--    `revoke ... from public`, so the explicit "to authenticated"
--    grants were not the boundary they looked like: the anon role could
--    execute the same security-definer functions directly. This
--    migration revokes PUBLIC on the app-facing security-definer RPCs
--    (their explicit authenticated grants are unaffected), and gives
--    next_admission_number() the explicit authenticated grant it has
--    been quietly relying on the PUBLIC default for.
--
-- Deliberately NOT touched:
--   - RLS helper functions (current_school_id, current_role, is_owner,
--     is_linked_parent, class_has_linked_parent, school_has_linked_parent,
--     can_access_student, hostel/bus helpers, school_is_active and the
--     exam/thread variants, has_permission). They return context about
--     the caller themselves (a school id, a role, a boolean), leak
--     nothing another caller doesn't already know, and are invoked from
--     RLS policy expressions — where revoking PUBLIC could surprise a
--     policy evaluation path. The security-definer ones are read-only
--     and set search_path = public, so leaving the default grant on
--     them is not a privilege issue.
--   - Trigger functions (handle_new_auth_user, set_updated_at,
--     set_result_grade, protect_school_admin_flag,
--     bump_thread_on_new_post): invoked by triggers as the table owner,
--     not by clients; a PUBLIC grant on them grants nothing usable.
--   - The platform_* functions: they self-gate with
--     `where public.is_platform_admin()` inside the function body, so a
--     non-admin caller gets zero rows even before the grant change.

-- ---------------------------------------------------------------------------
-- 1. link_my_children() — superseded by 0067 invitations; remove entirely.
-- ---------------------------------------------------------------------------

revoke execute on function public.link_my_children() from authenticated;
revoke execute on function public.link_my_children() from public;
drop function if exists public.link_my_children();

-- ---------------------------------------------------------------------------
-- 2. App-facing security-definer RPCs: close the PUBLIC (anon) path while
--    keeping the explicit authenticated grants the app relies on.
-- ---------------------------------------------------------------------------

-- Note: bootstrap_school(text, text) was dropped in 0028 (recreated as
-- 0028/0048/0050/0056's 3-arg overload); only the live 3-arg form is revoked.
revoke execute on function public.bootstrap_school(text, text, text) from public;
-- is_platform_admin() is referenced by RLS policy expressions on
-- public.schools (schools_select_platform_admin /
-- schools_update_status_platform_admin, 0027) and
-- public.platform_admin_logs (0032). Policy expressions run as the
-- querying role, so revoking PUBLIC execute here would break every
-- anon (and non-granted) query against those tables with
-- "permission denied for function is_platform_admin" — a regression the
-- RLS integration suite caught. It is SECURITY DEFINER and returns a
-- single boolean about the caller, so PUBLIC execute leaks nothing;
-- it must stay callable by anyone a policy might run as.
-- (Explicit grants below keep the intent documented.)
grant execute on function public.is_platform_admin() to anon, authenticated;
revoke execute on function public.platform_school_stats() from public;
revoke execute on function public.platform_totals() from public;
revoke execute on function public.mark_thread_read_parent(uuid) from public;
revoke execute on function public.increment_assistant_usage() from public;
revoke execute on function public.redeem_parent_invitation(text) from public;

-- ---------------------------------------------------------------------------
-- 3. next_admission_number() — called via RPC from the app, but it only
--    worked because of the default PUBLIC execute. Make the intent
--    explicit: authenticated callers only.
-- ---------------------------------------------------------------------------

grant execute on function public.next_admission_number(uuid) to authenticated;
revoke execute on function public.next_admission_number(uuid) from public;
