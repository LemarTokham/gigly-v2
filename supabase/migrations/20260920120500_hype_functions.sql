-- ---------------------------------------------------------------------------
-- All hype writes go through these two functions. Direct DML is revoked below.
--
-- Why not enforce the 3-a-week allowance in an RLS policy? A policy is a
-- per-row boolean with no serialisation: two concurrent inserts both evaluate
-- "I have used 2 of 3" against the same snapshot and both succeed, handing out
-- a fourth hype. The transaction-scoped advisory lock closes that race.
--
-- Error codes the UI can branch on:
--   28000  not signed in
--   GY001  no hypes left this week
--   GY002  already hyped this artist, still inside the 7 day window
--   GY003  artist has no upcoming live gig   (raised by the eligibility trigger)
--   GY004  no hype to take back
-- ---------------------------------------------------------------------------

create function public.cast_hype(p_artist_id uuid)
returns public.hypes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_existing public.hypes;
  v_used     integer;
  v_row      public.hypes;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  -- Serialise this user's hype writes for the rest of the transaction.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select * into v_existing
  from public.hypes
  where user_id = v_user and artist_id = p_artist_id;

  if found and v_existing.created_at > now() - interval '7 days' then
    raise exception 'already hyped this artist' using errcode = 'GY002';
  end if;

  -- A stale row (older than 7 days) is always older than the week start too,
  -- so it cannot be counted against this week's allowance.
  select count(*) into v_used
  from public.hypes
  where user_id = v_user
    and created_at >= public.hype_week_start();

  if v_used >= 3 then
    raise exception 'no hypes left this week' using errcode = 'GY001';
  end if;

  insert into public.hypes (user_id, artist_id)
  values (v_user, p_artist_id)
  on conflict (user_id, artist_id) do update set created_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create function public.take_back_hype(p_artist_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  delete from public.hypes
  where user_id = v_user and artist_id = p_artist_id;

  -- Deleting the row is what returns the hype to the allowance: the allowance
  -- is a count of surviving rows cast since Monday, not a stored counter.
  if not found then
    raise exception 'no hype to take back' using errcode = 'GY004';
  end if;
end;
$$;

-- How many of this week's three are left. Used by the header pips.
create function public.hypes_remaining()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, 3 - count(*)::integer)
  from public.hypes
  where user_id = auth.uid()
    and created_at >= public.hype_week_start();
$$;

-- Writes are function-only. RLS in the next migration also declines to add
-- insert/update/delete policies, so this is belt and braces.
revoke insert, update, delete on public.hypes from anon, authenticated;

grant execute on function public.cast_hype(uuid)      to authenticated;
grant execute on function public.take_back_hype(uuid) to authenticated;
grant execute on function public.hypes_remaining()    to authenticated;
grant execute on function public.artist_is_hypeable(uuid) to anon, authenticated;
grant execute on function public.hype_week_start(timestamptz) to anon, authenticated;

revoke execute on function public.cast_hype(uuid)      from anon;
revoke execute on function public.take_back_hype(uuid) from anon;
