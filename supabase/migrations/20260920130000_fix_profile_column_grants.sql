-- Fixes a no-op in 20260920120600_rls.sql.
--
-- That migration did:
--     revoke update (is_admin, id, created_at) on public.profiles from authenticated;
--
-- which does nothing. Supabase grants table-level ALL on new public tables to
-- `authenticated` via default privileges, and a table-level UPDATE grant
-- already covers every column — column-level privileges are additive on top of
-- it, so revoking one column while the table-level grant stands changes
-- nothing. Any signed-in user could set their own is_admin to true and let
-- themselves into the gig approval queue.
--
-- The privilege has to be removed at table level first, then handed back only
-- for the columns a user may actually change.

revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;
