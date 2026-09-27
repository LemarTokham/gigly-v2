-- ---------------------------------------------------------------------------
-- import_gig for shows rather than artists.
--
-- A listing always has a title and only sometimes names its artists. The
-- title becomes the show's name; artist pages are made only for artists the
-- feed actually names, never guessed from the title. Guessing is what turned
-- "Big Condo Records Presents Aftermath 9" into an artist.
--
-- p_live lets a trusted feed publish without review. Rejected shows stay
-- rejected on re-import; pending ones are published.
--
-- Dedupe across sources matches venue, a start within 90 minutes, and either
-- the same headliner or the same name, so a titled show with no artists can
-- still be recognised.
-- ---------------------------------------------------------------------------
drop function public.import_gig(
  text, text, text, text, timestamptz, integer, text, text[], text,
  public.genre_group, text, text, text, jsonb
);

create function public.import_gig(
  p_source       text,
  p_source_ref   text,
  p_title        text,
  p_venue_slug   text,
  p_starts_at    timestamptz,
  p_artist_name  text default null,
  p_price_pence  integer default null,
  p_ticket_url   text default null,
  p_support      text[] default '{}',
  p_genre        text default null,
  p_genre_group  public.genre_group default null,
  p_image_url    text default null,
  p_artist_photo text default null,
  p_artist_links jsonb default null,
  p_live         boolean default false
)
returns table (gig_id uuid, gig_slug text, outcome public.import_outcome)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue    public.venues;
  v_title    text := nullif(btrim(coalesce(p_title, '')), '');
  v_name     text := nullif(btrim(coalesce(p_artist_name, '')), '');
  v_artist   uuid;
  v_existing public.gigs;
  v_gig      public.gigs;
  v_slug     text;
  v_support  text;
  v_pos      integer := 1;
  v_support_id uuid;
begin
  if p_source is null or p_source = 'submission' then
    raise exception 'imports need their own source name' using errcode = 'GY020';
  end if;
  if v_title is null then
    raise exception 'an imported show needs a title' using errcode = 'GY020';
  end if;
  if p_starts_at is null then
    raise exception 'an imported show needs a start time' using errcode = 'GY020';
  end if;

  select * into v_venue from public.venues where slug = p_venue_slug;
  if not found then
    raise exception 'unknown venue %', p_venue_slug using errcode = 'GY021';
  end if;

  -- The headliner, only if the feed named one. An artist that already has a
  -- page keeps what it has: a feed fills gaps but never overwrites a photo,
  -- genre or link a person or a claimed page already set.
  if v_name is not null then
    select a.id into v_artist from public.artists a where lower(a.name) = lower(v_name) limit 1;
    if v_artist is null then
      insert into public.artists (name, slug, genre, genre_group, from_area, bio,
                                  photo_url, links, art_seed, art_palette, art_band)
      values (v_name, public.unique_artist_slug(public.slugify(v_name)),
              coalesce(nullif(btrim(coalesce(p_genre, '')), ''), 'New on Gigly'),
              coalesce(p_genre_group, 'Indie'),
              'Liverpool', 'This page is waiting to be claimed.',
              nullif(btrim(coalesce(p_artist_photo, '')), ''),
              coalesce(p_artist_links, '{}'::jsonb),
              (abs(hashtext(v_name)) % 9999) + 1, abs(hashtext(v_name)) % 6,
              array['guitar','mic','drums']::text[])
      returning id into v_artist;
    else
      update public.artists
         set photo_url   = coalesce(photo_url, nullif(btrim(coalesce(p_artist_photo, '')), '')),
             links       = case when links = '{}'::jsonb or links is null
                                then coalesce(p_artist_links, links) else links end,
             genre       = case when genre = 'New on Gigly'
                                then coalesce(nullif(btrim(coalesce(p_genre, '')), ''), genre)
                                else genre end,
             genre_group = case when genre = 'New on Gigly'
                                then coalesce(p_genre_group, genre_group) else genre_group end
       where id = v_artist;
    end if;
  end if;

  select * into v_existing
  from public.gigs g
  where g.source = p_source and g.source_ref = p_source_ref;

  if found then
    update public.gigs
       set title       = v_title,
           starts_at   = p_starts_at,
           price_pence = coalesce(p_price_pence, price_pence),
           ticket_url  = coalesce(p_ticket_url, ticket_url),
           image_url   = coalesce(nullif(btrim(coalesce(p_image_url, '')), ''), image_url),
           status      = case when p_live and status = 'pending' then 'live' else status end,
           imported_at = now()
     where id = v_existing.id
     returning * into v_gig;

    -- A listing that has since named its headliner gets it, if it had none.
    if v_artist is not null
       and not exists (select 1 from public.gig_artists ga where ga.gig_id = v_gig.id and ga.position = 0) then
      insert into public.gig_artists (gig_id, artist_id, position) values (v_gig.id, v_artist, 0)
      on conflict do nothing;
    end if;

    return query select v_gig.id, v_gig.slug, 'updated'::public.import_outcome;
    return;
  end if;

  select g.* into v_existing
  from public.gigs g
  left join public.gig_artists ga on ga.gig_id = g.id and ga.position = 0
  left join public.artists a on a.id = ga.artist_id
  where g.venue_id = v_venue.id
    and g.starts_at between p_starts_at - interval '90 minutes'
                        and p_starts_at + interval '90 minutes'
    and (
      (v_artist is not null and ga.artist_id = v_artist)
      or lower(coalesce(g.title, a.name)) = lower(v_title)
    )
  limit 1;

  if found then
    return query select v_existing.id, v_existing.slug, 'duplicate'::public.import_outcome;
    return;
  end if;

  v_slug := public.unique_gig_slug(
    public.slugify(v_title) || '-at-' || v_venue.slug || '-' ||
    to_char(p_starts_at at time zone 'Europe/London', 'YYYY-MM-DD')
  );

  insert into public.gigs (slug, title, venue_id, starts_at, price_pence, ticket_url,
                           status, source, source_ref, image_url, imported_at)
  values (v_slug, v_title, v_venue.id, p_starts_at, coalesce(p_price_pence, 0),
          nullif(btrim(coalesce(p_ticket_url, '')), ''),
          case when p_live then 'live' else 'pending' end::public.gig_status,
          p_source, p_source_ref,
          nullif(btrim(coalesce(p_image_url, '')), ''), now())
  returning * into v_gig;

  if v_artist is not null then
    insert into public.gig_artists (gig_id, artist_id, position) values (v_gig.id, v_artist, 0);

    -- Support acts, only behind a named headliner.
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
  end if;

  return query select v_gig.id, v_gig.slug, 'created'::public.import_outcome;
end;
$$;

-- Imports have no person attached: nothing reachable from a request may call it.
revoke execute on function public.import_gig(
  text, text, text, text, timestamptz, text, integer, text, text[], text,
  public.genre_group, text, text, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.import_gig(
  text, text, text, text, timestamptz, text, integer, text, text[], text,
  public.genre_group, text, text, jsonb, boolean
) to service_role;
