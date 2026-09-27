-- ---------------------------------------------------------------------------
-- Hyping needs a username.
--
-- Signing in alone is a weak barrier to rigging the chart: a magic link takes
-- any email address, so a fresh account costs nothing. Picking a username adds
-- a step per account and ties every hype to a findable @handle. It also means
-- the web's first sign-in and the app's land in the same place: nobody backs a
-- show until they have picked who they are.
--
--   GY026  pick a username first   (same code the friend functions use)
-- ---------------------------------------------------------------------------
create or replace function public.cast_hype(p_gig_id uuid)
returns public.hypes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_used integer;
  v_row  public.hypes;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if (select username from public.profiles where id = v_user) is null then
    raise exception 'pick a username first' using errcode = 'GY026';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  if exists (select 1 from public.hypes where user_id = v_user and gig_id = p_gig_id) then
    raise exception 'already backing this show' using errcode = 'GY002';
  end if;

  select count(*) into v_used
  from public.hypes
  where user_id = v_user and created_at >= public.hype_week_start();

  if v_used >= 3 then
    raise exception 'no hypes left this week' using errcode = 'GY001';
  end if;

  insert into public.hypes (user_id, gig_id) values (v_user, p_gig_id)
  returning * into v_row;
  return v_row;
end;
$$;
