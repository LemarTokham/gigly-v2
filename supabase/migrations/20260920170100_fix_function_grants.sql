-- Fixes no-op revokes in three earlier migrations.
--
-- Postgres grants EXECUTE on every new function to PUBLIC by default, and
-- Supabase additionally grants to anon and authenticated. Revoking from those
-- two roles individually — which 20260920120500 and 20260920170000 both did —
-- leaves the PUBLIC grant untouched, so they can still call the function
-- through it. The same shape of mistake as the profiles column grants:
-- a revoke that names roles under a broader grant changes nothing.
--
-- cast_hype and submit_gig were never actually exposed, because both check
-- auth.uid() and refuse without a session. But the grant was the second lock,
-- and it was not closed.

-- Imports have no person attached, so nothing that reaches a request handler
-- should be able to call this at all.
revoke execute on function
  public.import_gig(text, text, text, text, timestamptz, integer, text, text[])
  from public, anon, authenticated;
grant execute on function
  public.import_gig(text, text, text, text, timestamptz, integer, text, text[])
  to service_role;

-- Signed-in actions: authenticated only, never anonymous.
revoke execute on function public.cast_hype(uuid)            from public, anon;
revoke execute on function public.take_back_hype(uuid)       from public, anon;
revoke execute on function public.hypes_remaining()          from public, anon;
revoke execute on function public.submit_gig(text, uuid, timestamptz, integer, text, text)
  from public, anon;

grant execute on function public.cast_hype(uuid)      to authenticated;
grant execute on function public.take_back_hype(uuid) to authenticated;
grant execute on function public.hypes_remaining()    to authenticated;
grant execute on function public.submit_gig(text, uuid, timestamptz, integer, text, text)
  to authenticated;
