-- Adds yesterday's position to the chart, for the up/down arrows.
--
-- Derived from the hypes table rather than a daily snapshot: yesterday's chart
-- is the same query with the 7 day window shifted back 24 hours. That avoids a
-- cron job and a snapshot table entirely.
--
-- The tradeoff: taking a hype back deletes the row, so a hype cast and
-- withdrawn is absent from the reconstruction and yesterday's position can be
-- slightly off. For a "moved up 2" arrow that is fine. If the arrows ever need
-- to be exact — say they become part of an artist's stats — this wants a real
-- artist_rank_snapshots table written daily instead.
--
-- Artists are ranked among those currently eligible, not those eligible
-- yesterday, so an artist whose gig has since started drops off both sides
-- rather than showing a misleading fall.

create or replace view public.artist_chart
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
  -- The join below reaches back 8 days so yesterday's ranking can be derived
  -- from the same scan. The live count must therefore be filtered back to 7,
  -- or it silently becomes an 8 day count.
  count(h.user_id) filter (
    where h.created_at > now() - interval '7 days'
  )::integer as hype_count,
  row_number() over (
    order by
      count(h.user_id) filter (where h.created_at > now() - interval '7 days') desc,
      a.name asc
  )::integer as position,
  ng.gig_id     as next_gig_id,
  ng.gig_slug   as next_gig_slug,
  ng.starts_at  as next_gig_starts_at,
  ng.venue_name as next_venue_name,
  ng.venue_slug as next_venue_slug,
  -- the same ranking as it stood 24 hours ago
  row_number() over (
    order by
      count(h.user_id) filter (
        where h.created_at > now() - interval '8 days'
          and h.created_at <= now() - interval '1 day'
      ) desc,
      a.name asc
  )::integer as position_yesterday,
  -- an artist with no hypes at all in the earlier window is new to the chart,
  -- which the prototype labels rather than showing a huge jump
  (count(h.user_id) filter (
     where h.created_at > now() - interval '8 days'
       and h.created_at <= now() - interval '1 day'
   ) = 0) as is_new
from public.artists a
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
 and h.created_at > now() - interval '8 days'
group by
  a.id, a.slug, a.name, a.genre, a.genre_group, a.from_area, a.photo_url,
  a.art_seed, a.art_palette, a.art_band,
  ng.gig_id, ng.gig_slug, ng.starts_at, ng.venue_name, ng.venue_slug;
