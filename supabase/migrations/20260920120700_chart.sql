-- ---------------------------------------------------------------------------
-- The chart: every artist with an upcoming live gig, ranked by hypes cast in
-- the last 7 days. There is no weekly reset of artist scores — a hype simply
-- ages out of the window 7 days after it was cast.
--
-- These views run with the owner's rights (security_invoker = false, the
-- default) so they can aggregate `hypes` past its own-rows-only RLS. That is
-- deliberate and safe: they expose counts, never a user_id. Supabase's linter
-- flags this pattern generically; it is the intended design here.
--
-- Scale note: this counts the window live on every read. Fine at Liverpool
-- size. Past roughly a million hype rows, swap to a materialised view with a
-- periodic refresh, or a counter table maintained by trigger.
-- ---------------------------------------------------------------------------
create view public.artist_chart
with (security_invoker = false)
as
select
  a.id,
  a.slug,
  a.name,
  a.genre,
  a.genre_group,
  a.from_area,
  a.photo_url,
  a.art_seed,
  a.art_palette,
  a.art_band,
  count(h.user_id)::integer as hype_count,
  row_number() over (
    order by count(h.user_id) desc, a.name asc
  )::integer as position,
  ng.gig_id     as next_gig_id,
  ng.gig_slug   as next_gig_slug,
  ng.starts_at  as next_gig_starts_at,
  ng.venue_name as next_venue_name,
  ng.venue_slug as next_venue_slug
from public.artists a
-- soonest upcoming live gig; also the eligibility test, since no row here
-- means no upcoming live gig and therefore no place on the chart
join lateral (
  select g.id as gig_id, g.slug as gig_slug, g.starts_at,
         v.name as venue_name, v.slug as venue_slug
  from public.gig_artists ga
  join public.gigs   g on g.id = ga.gig_id
  join public.venues v on v.id = g.venue_id
  where ga.artist_id = a.id
    and g.status = 'live'
    and g.starts_at > now()
  order by g.starts_at
  limit 1
) ng on true
left join public.hypes h
  on h.artist_id = a.id
 and h.created_at > now() - interval '7 days'
group by
  a.id, a.slug, a.name, a.genre, a.genre_group, a.from_area, a.photo_url,
  a.art_seed, a.art_palette, a.art_band,
  ng.gig_id, ng.gig_slug, ng.starts_at, ng.venue_name, ng.venue_slug;

-- Follower counts, aggregated so no follower identity leaks.
create view public.artist_stats
with (security_invoker = false)
as
select a.id as artist_id,
       count(f.user_id)::integer as follower_count
from public.artists a
left join public.follows f on f.artist_id = a.id
group by a.id;

-- "I'm going" counts per gig.
create view public.gig_stats
with (security_invoker = false)
as
select g.id as gig_id,
       count(t.user_id)::integer as attending_count
from public.gigs g
left join public.attending t on t.gig_id = g.id
group by g.id;

grant select on public.artist_chart to anon, authenticated;
grant select on public.artist_stats to anon, authenticated;
grant select on public.gig_stats    to anon, authenticated;
