-- ---------------------------------------------------------------------------
-- Submitting a gig.
--
-- A submission is three writes: find or create the artist, create the gig,
-- link them. Doing that from the client would need an insert policy on
-- `artists` for every signed-in user, and would leave an orphaned artist
-- behind whenever the second or third write failed. One security definer
-- function keeps it atomic and keeps `artists` admin-only for direct writes.
--
-- status and submitted_by are set here, never taken from the caller, so a
-- crafted request cannot submit something already approved or under someone
-- else's name.
--
--   GY010  not signed in
--   GY011  the submission is not valid (message says why)
--   GY012  too many submissions still awaiting review
-- ---------------------------------------------------------------------------

-- Who says they are submitting. Not proof of anything, but it tells the
-- approval queue whether to expect a link, and a promoter submitting their own
-- listing is worth less scrutiny than a stranger submitting someone else's.
alter table public.gigs
  add column submitted_as text
  check (submitted_as is null or submitted_as in ('artist', 'venue', 'fan'));

-- Slugs collide the second time a band plays the same room on the same night,
-- which is rare but not impossible for a matinee and an evening show.
create function public.unique_gig_slug(p_base text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_slug text := p_base;
  v_n    integer := 1;
begin
  while exists (select 1 from public.gigs g where g.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := p_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

create function public.unique_artist_slug(p_base text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_slug text := p_base;
  v_n    integer := 1;
begin
  while exists (select 1 from public.artists a where a.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := p_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

create function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(p_text), '[''’]', '', 'g'),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

create function public.submit_gig(
  p_artist_name text,
  p_venue_id    uuid,
  p_starts_at   timestamptz,
  p_price_pence integer,
  p_ticket_url  text default null,
  p_submitted_as text default null
)
returns public.gigs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_name    text := nullif(btrim(p_artist_name), '');
  v_artist  uuid;
  v_venue   public.venues;
  v_pending integer;
  v_slug    text;
  v_gig     public.gigs;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = 'GY010';
  end if;

  if v_name is null then
    raise exception 'Add the artist''s name.' using errcode = 'GY011';
  end if;
  if length(v_name) > 80 then
    raise exception 'That name is too long.' using errcode = 'GY011';
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'That date has already passed.' using errcode = 'GY011';
  end if;
  if p_starts_at > now() + interval '1 year' then
    raise exception 'That is too far ahead to list.' using errcode = 'GY011';
  end if;
  if p_price_pence is null or p_price_pence < 0 or p_price_pence > 20000 then
    raise exception 'Check the price.' using errcode = 'GY011';
  end if;
  if p_submitted_as is not null and p_submitted_as not in ('artist','venue','fan') then
    raise exception 'Say who you are.' using errcode = 'GY011';
  end if;
  -- A stranger listing someone else's gig has to give us something to check.
  if p_submitted_as = 'fan' and nullif(btrim(coalesce(p_ticket_url,'')),'') is null then
    raise exception 'Add a link so we can check the gig is real.' using errcode = 'GY011';
  end if;

  select * into v_venue from public.venues where id = p_venue_id;
  if not found then
    raise exception 'Pick a venue from the list.' using errcode = 'GY011';
  end if;

  -- Nothing here can reach the chart before a human approves it, so this is
  -- about keeping the review queue usable rather than protecting the ranking.
  select count(*) into v_pending
  from public.gigs
  where submitted_by = v_user and status = 'pending';

  if v_pending >= 10 then
    raise exception 'You have 10 gigs waiting to be checked already.'
      using errcode = 'GY012';
  end if;

  -- Match an existing artist by name before making a new one, so a band does
  -- not end up with two pages because of capitalisation.
  select a.id into v_artist
  from public.artists a
  where lower(a.name) = lower(v_name)
  limit 1;

  if v_artist is null then
    insert into public.artists (name, slug, genre, genre_group, from_area, bio, art_seed, art_palette, art_band)
    values (
      v_name,
      public.unique_artist_slug(public.slugify(v_name)),
      'New on Gigly',
      'Indie',
      'Liverpool',
      'This page is waiting to be claimed.',
      (abs(hashtext(v_name)) % 9999) + 1,
      abs(hashtext(v_name)) % 6,
      array['guitar','mic','drums']::text[]
    )
    returning id into v_artist;
  end if;

  v_slug := public.unique_gig_slug(
    public.slugify(v_name) || '-at-' || v_venue.slug || '-' ||
    to_char(p_starts_at at time zone 'Europe/London', 'YYYY-MM-DD')
  );

  insert into public.gigs (slug, venue_id, starts_at, price_pence, ticket_url,
                           status, submitted_by, submitted_as)
  values (v_slug, p_venue_id, p_starts_at, p_price_pence,
          nullif(btrim(coalesce(p_ticket_url, '')), ''), 'pending', v_user, p_submitted_as)
  returning * into v_gig;

  insert into public.gig_artists (gig_id, artist_id, position)
  values (v_gig.id, v_artist, 0);

  return v_gig;
end;
$$;

grant execute on function public.submit_gig(text, uuid, timestamptz, integer, text, text) to authenticated;
grant execute on function public.slugify(text) to authenticated, anon;
