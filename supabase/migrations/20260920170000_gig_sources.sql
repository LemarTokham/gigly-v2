-- ---------------------------------------------------------------------------
-- Where a gig came from.
--
-- 'submission' is a person using the form. Anything else is an importer, named
-- after its adapter: 'skiddle', 'scrape:future-yard', and so on. source_ref is
-- whatever that source calls the event, and is what makes a re-run update a
-- gig instead of duplicating it.
--
-- Imports land as pending like everything else. An importer is not more
-- trusted than a person — a bad feed would otherwise put unchecked gigs on the
-- chart, which is exactly what the approval queue exists to prevent.
-- ---------------------------------------------------------------------------

alter table public.gigs
  add column source     text not null default 'submission',
  add column source_ref text,
  add column imported_at timestamptz;

-- Re-running an import must not create a second copy.
create unique index gigs_source_ref
  on public.gigs (source, source_ref)
  where source_ref is not null;

create index gigs_source on public.gigs (source) where source <> 'submission';

comment on column public.gigs.source is
  'submission for the form, otherwise the importer adapter name.';
comment on column public.gigs.source_ref is
  'The id this gig has at its source. Unique per source, and how a re-import updates rather than duplicates.';

-- ---------------------------------------------------------------------------
-- import_gig: upsert one gig from a feed.
--
-- Service role only. Importers run as scripts, not as a signed-in user, so
-- there is no auth.uid() here — which is also why it is not granted to
-- authenticated: it is the one path that can write a gig without a person
-- attached to it.
--
-- Returns the gig, plus what happened, so the runner can report honestly
-- instead of claiming to have imported things it skipped.
-- ---------------------------------------------------------------------------
create type public.import_outcome as enum ('created', 'updated', 'duplicate');

create function public.import_gig(
  p_source      text,
  p_source_ref  text,
  p_artist_name text,
  p_venue_slug  text,
  p_starts_at   timestamptz,
  p_price_pence integer default null,
  p_ticket_url  text default null,
  p_support     text[] default '{}'
)
returns table (gig_id uuid, gig_slug text, outcome public.import_outcome)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue   public.venues;
  v_artist  uuid;
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

  -- find or create the headliner, matching on name so an import does not
  -- fork an artist that already has a page
  select a.id into v_artist from public.artists a where lower(a.name) = lower(v_name) limit 1;
  if v_artist is null then
    insert into public.artists (name, slug, genre, genre_group, from_area, bio, art_seed, art_palette, art_band)
    values (v_name, public.unique_artist_slug(public.slugify(v_name)), 'New on Gigly', 'Indie',
            'Liverpool', 'This page is waiting to be claimed.',
            (abs(hashtext(v_name)) % 9999) + 1, abs(hashtext(v_name)) % 6,
            array['guitar','mic','drums']::text[])
    returning id into v_artist;
  end if;

  -- 1. same gig from the same source, seen before
  select * into v_existing
  from public.gigs g
  where g.source = p_source and g.source_ref = p_source_ref;

  if found then
    update public.gigs
       set starts_at   = p_starts_at,
           price_pence = coalesce(p_price_pence, price_pence),
           ticket_url  = coalesce(p_ticket_url, ticket_url),
           imported_at = now()
     where id = v_existing.id
     returning * into v_gig;

    return query select v_gig.id, v_gig.slug, 'updated'::public.import_outcome;
    return;
  end if;

  -- 2. the same gig already here from somewhere else — a person submitted it,
  --    or another feed carries it. Same venue, same headliner, within 90
  --    minutes counts as the same night rather than a second show.
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
                           status, source, source_ref, imported_at)
  values (v_slug, v_venue.id, p_starts_at, coalesce(p_price_pence, 0),
          nullif(btrim(coalesce(p_ticket_url, '')), ''),
          'pending', p_source, p_source_ref, now())
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
              'New on Gigly', 'Indie', 'Liverpool', 'This page is waiting to be claimed.',
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

-- Deliberately not granted to authenticated: this is the only path that can
-- create a gig with nobody attached to it.
revoke execute on function public.import_gig(text, text, text, text, timestamptz, integer, text, text[])
  from anon, authenticated;
