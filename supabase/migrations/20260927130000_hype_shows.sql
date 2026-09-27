-- ---------------------------------------------------------------------------
-- Hype moves from artists to shows.
--
-- People care about the show: it has a date, a room and tickets, and it ends.
-- A hype on a show counts until its doors open, which retires the machinery
-- the artist model needed to fake an ending (hypeable only while a gig is
-- coming up, a 7-day decay). The chart becomes the most anticipated shows, and
-- artists are no longer ranked against each other at all.
--
-- The allowance is unchanged: three a week, reset Monday 00:00 Europe/London,
-- one per show, and taking one back returns it.
--
-- Also here, because it is the same change seen from the importer's side:
-- shows get their own title, the artists the importer used to guess from
-- event titles are removed, and imports from Skiddle go live without review.
-- ---------------------------------------------------------------------------

-- ------------------------------------------------------------- show titles --
-- The show's own name, as its listing gives it: "TurnTable's Halloween Party
-- 2026" is a perfectly good show and never was an artist. Empty for gigs
-- people submit; the apps then name a show by its line-up.
alter table public.gigs
  add column title text
    constraint gigs_title_length check (title is null or char_length(btrim(title)) between 1 and 200);

-- Imported shows whose artist was read out of the title keep that title as
-- their name.
update public.gigs set title = source_title where source_title is not null;

-- Those guessed artists go: every link from a titled show, then any artist
-- left with no shows, followers or claim. Artists Skiddle actually named are
-- never linked to a titled show, so they are untouched.
create temporary table guessed_artists on commit drop as
select distinct ga.artist_id
from public.gig_artists ga
join public.gigs g on g.id = ga.gig_id
where g.source_title is not null;

delete from public.gig_artists ga
using public.gigs g
where g.id = ga.gig_id and g.source_title is not null;

delete from public.artists a
using guessed_artists x
where a.id = x.artist_id
  and a.claimed_by is null
  and not exists (select 1 from public.gig_artists ga where ga.artist_id = a.id)
  and not exists (select 1 from public.follows f where f.artist_id = a.id);

-- title supersedes it.
alter table public.gigs drop column source_title;

-- Skiddle is trusted from here on: what was waiting for review goes live.
-- Human submissions still wait.
update public.gigs set status = 'live' where source = 'skiddle' and status = 'pending';

-- ------------------------------------------------------------ the old hype --
drop view public.artist_chart;
drop function public.cast_hype(uuid);
drop function public.take_back_hype(uuid);
drop table public.hypes;               -- takes the eligibility trigger with it
drop function public.hypes_enforce_eligible();
drop function public.artist_is_hypeable(uuid);

-- ------------------------------------------------------------ the new hype --
-- One row per person per show, kept after the show as a record of who backed
-- what. Every row is worth exactly 1.
create table public.hypes (
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  gig_id     uuid        not null references public.gigs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, gig_id)
);

comment on table public.hypes is
  'A hype backs one show and counts until its doors open. Every row is worth exactly 1 point.';

-- the chart: count per show
create index hypes_gig on public.hypes (gig_id, created_at);
-- the allowance: this user's rows since Monday
create index hypes_user_recent on public.hypes (user_id, created_at desc);

-- A show takes hypes while it is live and its doors have not opened. A
-- pending show cannot, so a submission cannot climb the chart unreviewed.
create function public.gig_is_hypeable(p_gig_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gigs g
    where g.id = p_gig_id and g.status = 'live' and g.starts_at > now()
  );
$$;

-- In the database, not only in cast_hype, so it holds for every write path
-- including the service role and the seed script.
create function public.hypes_enforce_hypeable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.gig_is_hypeable(new.gig_id) then
    raise exception 'show is not taking hypes' using errcode = 'GY003';
  end if;
  return new;
end;
$$;

create trigger hypes_hypeable
  before insert or update of gig_id on public.hypes
  for each row execute function public.hypes_enforce_hypeable();

-- ---------------------------------------------------------------------------
-- Writes go through these two functions only, for the same reason as before:
-- the weekly allowance needs the advisory lock, which a policy cannot take.
--
-- Error codes:
--   28000  not signed in
--   GY001  no hypes left this week
--   GY002  already backing this show
--   GY003  show is not taking hypes (not live, or doors have opened)
--   GY004  no hype to take back
--   GY005  doors have opened, so that hype is spent
-- ---------------------------------------------------------------------------
create function public.cast_hype(p_gig_id uuid)
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

create function public.take_back_hype(p_gig_id uuid)
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

  -- Once doors open the hype has done its job. Handing it back then would let
  -- someone back three shows that happen early in the week, take all three
  -- back afterwards, and back three more: six shows on a three-hype week.
  if exists (select 1 from public.gigs where id = p_gig_id and starts_at <= now()) then
    raise exception 'doors have opened, so that hype is spent' using errcode = 'GY005';
  end if;

  -- Deleting the row is what returns it to the allowance, which is a count of
  -- surviving rows cast since Monday rather than a stored counter.
  delete from public.hypes where user_id = v_user and gig_id = p_gig_id;
  if not found then
    raise exception 'no hype to take back' using errcode = 'GY004';
  end if;
end;
$$;

-- hypes_remaining() and hype_week_start() carry over unchanged: they only ever
-- counted rows since Monday. Recreated so its body is checked against the new
-- table rather than trusted.
create or replace function public.hypes_remaining()
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

alter table public.hypes enable row level security;

-- Own rows only: the raw table maps a person to the shows they back. Public
-- numbers come from gig_chart, which carries no user ids.
create policy hypes_select_own on public.hypes
  for select using (user_id = (select auth.uid()) or public.is_admin());

revoke all on public.hypes from anon, authenticated;
grant select on public.hypes to authenticated;

revoke execute on function public.cast_hype(uuid)             from public, anon;
revoke execute on function public.take_back_hype(uuid)        from public, anon;
revoke execute on function public.hypes_enforce_hypeable()    from public, anon, authenticated;
revoke execute on function public.gig_is_hypeable(uuid)       from public;
grant execute on function public.cast_hype(uuid)       to authenticated;
grant execute on function public.take_back_hype(uuid)  to authenticated;
grant execute on function public.gig_is_hypeable(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The chart: every live show whose doors have not opened, with its hype.
--
-- Ranking is left to the reader. The chart is filtered to tonight, this week,
-- this month or everything, and a show's place only means something within
-- the filter: No. 1 tonight is not No. 1 overall. hype_count_yesterday is
-- the same count without the last 24 hours, which ranks the same shows as
-- they stood a day ago for the up and down arrows. A hype cast and taken back
-- leaves no trace, so yesterday can be slightly off; fine for an arrow.
--
-- Owner's rights so it can count past the own-rows policy on hypes. It
-- exposes counts, never a user id.
-- ---------------------------------------------------------------------------
create view public.gig_chart
with (security_invoker = false)
as
select
  g.id,
  g.slug,
  coalesce(g.title, h.name) as name,
  g.starts_at,
  g.price_pence,
  g.image_url,
  v.name  as venue_name,
  v.slug  as venue_slug,
  v.area  as venue_area,
  h.id    as headliner_id,
  h.slug  as headliner_slug,
  h.photo_url as headliner_photo_url,
  h.art_seed    as headliner_art_seed,
  h.art_palette as headliner_art_palette,
  h.art_band    as headliner_art_band,
  c.hype_count,
  c.hype_count_yesterday
from public.gigs g
join public.venues v on v.id = g.venue_id
left join lateral (
  select a.id, a.slug, a.name, a.photo_url, a.art_seed, a.art_palette, a.art_band
  from public.gig_artists ga
  join public.artists a on a.id = ga.artist_id
  where ga.gig_id = g.id and ga.position = 0
) h on true
cross join lateral (
  select
    count(*)::integer as hype_count,
    (count(*) filter (where x.created_at <= now() - interval '1 day'))::integer as hype_count_yesterday
  from public.hypes x
  where x.gig_id = g.id
) c
where g.status = 'live'
  and g.starts_at > now();

revoke all on public.gig_chart from anon, authenticated;
grant select on public.gig_chart to anon, authenticated;
