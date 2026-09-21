-- What a feed actually called the event, and what genre it said.
--
-- source_title matters for review: two thirds of Skiddle's live events carry
-- no parsed artist list, so the artist name has to be read out of a title like
-- "Big Condo Records Presents EMZz - Thin Single Launch Party". Keeping the
-- original lets the approval queue show what was parsed and what it came from,
-- so a bad guess is obvious instead of becoming a junk artist page.
alter table public.gigs
  add column source_title text;

comment on column public.gigs.source_title is
  'The event name as the source gave it, when that differs from the artist we parsed out.';

-- Replaced to take the genre a feed reports, and the original title.
drop function if exists public.import_gig(text, text, text, text, timestamptz, integer, text, text[]);

create function public.import_gig(
  p_source      text,
  p_source_ref  text,
  p_artist_name text,
  p_venue_slug  text,
  p_starts_at   timestamptz,
  p_price_pence integer default null,
  p_ticket_url  text default null,
  p_support     text[] default '{}',
  p_genre       text default null,
  p_genre_group public.genre_group default null,
  p_source_title text default null
)
returns table (gig_id uuid, gig_slug text, outcome public.import_outcome)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue   public.venues;
  v_artist  uuid;
  v_new     boolean := false;
  v_name    text := nullif(btrim(p_artist_name), '');
  v_existing public.gigs;
  v_slug    text;
  v_gig     public.gigs;
  v_support text;
  v_pos     integer := 1;
  v_support_id uuid;
begin
  if p_source is null or p_source = 'submission' then
    raise exception 'imports need their own source name' using errcode = 'GY020';
  end if;
  if v_name is null then
    raise exception 'an imported gig needs an artist name' using errcode = 'GY020';
  end if;
  if p_starts_at is null then
    raise exception 'an imported gig needs a start time' using errcode = 'GY020';
  end if;

  select * into v_venue from public.venues where slug = p_venue_slug;
  if not found then
    raise exception 'unknown venue %', p_venue_slug using errcode = 'GY021';
  end if;

  select a.id into v_artist from public.artists a where lower(a.name) = lower(v_name) limit 1;
  if v_artist is null then
    v_new := true;
    insert into public.artists (name, slug, genre, genre_group, from_area, bio, art_seed, art_palette, art_band)
    values (v_name, public.unique_artist_slug(public.slugify(v_name)),
            coalesce(nullif(btrim(coalesce(p_genre, '')), ''), 'New on Gigly'),
            coalesce(p_genre_group, 'Indie'),
            'Liverpool', 'This page is waiting to be claimed.',
            (abs(hashtext(v_name)) % 9999) + 1, abs(hashtext(v_name)) % 6,
            array['guitar','mic','drums']::text[])
    returning id into v_artist;
  end if;

  -- An artist that already has a page keeps whatever genre it has: a feed's
  -- guess should not overwrite something a person set, or a claimed page.
  if not v_new and p_genre_group is not null then
    update public.artists
       set genre       = case when genre = 'New on Gigly' then coalesce(p_genre, genre) else genre end,
           genre_group = case when genre = 'New on Gigly' then p_genre_group else genre_group end
     where id = v_artist and genre = 'New on Gigly';
  end if;

  select * into v_existing
  from public.gigs g
  where g.source = p_source and g.source_ref = p_source_ref;

  if found then
    update public.gigs
       set starts_at    = p_starts_at,
           price_pence  = coalesce(p_price_pence, price_pence),
           ticket_url   = coalesce(p_ticket_url, ticket_url),
           source_title = coalesce(p_source_title, source_title),
           imported_at  = now()
     where id = v_existing.id
     returning * into v_gig;

    return query select v_gig.id, v_gig.slug, 'updated'::public.import_outcome;
    return;
  end if;

  select g.* into v_existing
  from public.gigs g
  join public.gig_artists ga on ga.gig_id = g.id and ga.position = 0
  where g.venue_id = v_venue.id
    and ga.artist_id = v_artist
    and g.starts_at between p_starts_at - interval '90 minutes'
                        and p_starts_at + interval '90 minutes'
  limit 1;

  if found then
    return query select v_existing.id, v_existing.slug, 'duplicate'::public.import_outcome;
    return;
  end if;

  v_slug := public.unique_gig_slug(
    public.slugify(v_name) || '-at-' || v_venue.slug || '-' ||
    to_char(p_starts_at at time zone 'Europe/London', 'YYYY-MM-DD')
  );

  insert into public.gigs (slug, venue_id, starts_at, price_pence, ticket_url,
                           status, source, source_ref, source_title, imported_at)
  values (v_slug, v_venue.id, p_starts_at, coalesce(p_price_pence, 0),
          nullif(btrim(coalesce(p_ticket_url, '')), ''),
          'pending', p_source, p_source_ref,
          nullif(btrim(coalesce(p_source_title, '')), ''), now())
  returning * into v_gig;

  insert into public.gig_artists (gig_id, artist_id, position)
  values (v_gig.id, v_artist, 0);

  foreach v_support in array coalesce(p_support, '{}') loop
    if nullif(btrim(v_support), '') is null then continue; end if;

    select a.id into v_support_id from public.artists a
    where lower(a.name) = lower(btrim(v_support)) limit 1;

    if v_support_id is null then
      insert into public.artists (name, slug, genre, genre_group, from_area, bio, art_seed, art_palette, art_band)
      values (btrim(v_support), public.unique_artist_slug(public.slugify(btrim(v_support))),
              'New on Gigly', coalesce(p_genre_group, 'Indie'), 'Liverpool',
              'This page is waiting to be claimed.',
              (abs(hashtext(v_support)) % 9999) + 1, abs(hashtext(v_support)) % 6,
              array['guitar','mic','drums']::text[])
      returning id into v_support_id;
    end if;

    insert into public.gig_artists (gig_id, artist_id, position)
    values (v_gig.id, v_support_id, v_pos)
    on conflict do nothing;
    v_pos := v_pos + 1;
  end loop;

  return query select v_gig.id, v_gig.slug, 'created'::public.import_outcome;
end;
$$;

revoke execute on function public.import_gig(text, text, text, text, timestamptz, integer, text, text[], text, public.genre_group, text)
  from public, anon, authenticated;
grant execute on function public.import_gig(text, text, text, text, timestamptz, integer, text, text[], text, public.genre_group, text)
  to service_role;
