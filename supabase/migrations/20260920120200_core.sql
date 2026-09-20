create table public.venues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  area       text not null,
  capacity   integer check (capacity is null or capacity > 0),
  -- real coordinates, for distance and any future real map
  lat        double precision check (lat is null or lat between -90 and 90),
  lng        double precision check (lng is null or lng between -180 and 180),
  -- position on the prototype's stylised hand-drawn map (600x470 viewBox).
  -- Deliberately separate from lat/lng: that map is not geographic.
  map_x      numeric(6,2),
  map_y      numeric(6,2),
  created_at timestamptz not null default now()
);

create table public.artists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  genre       text not null,                 -- displayed: "Dream pop"
  genre_group public.genre_group not null,   -- filtered on: Indie
  from_area   text,
  bio         text,
  photo_url   text,
  clip_url    text,                          -- the 20s clip in the discover deck
  links       jsonb not null default '{}'::jsonb,
  claimed_by  uuid references public.profiles (id) on delete set null,

  -- Deterministic poster art, ported from the prototype's SVG generator.
  -- Stored so a given artist renders identically everywhere, including in
  -- Open Graph images, until they upload a real photo_url.
  art_seed    integer  not null default 7,
  art_palette smallint not null default 0 check (art_palette between 0 and 5),
  art_band    text[]   not null default '{guitar,mic,drums}'
              check (art_band <@ array['guitar','mic','synth','bass','drums']::text[]),

  created_at  timestamptz not null default now()
);

create table public.gigs (
  id           uuid primary key default gen_random_uuid(),
  -- own slug rather than the prototype's headliner-name URL, which collides
  -- the second time a band plays
  slug         text not null unique,
  venue_id     uuid not null references public.venues (id) on delete restrict,
  starts_at    timestamptz not null,
  price_pence  integer not null default 0 check (price_pence >= 0),
  ticket_url   text,
  status       public.gig_status not null default 'pending',
  submitted_by uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.gig_artists (
  gig_id    uuid     not null references public.gigs (id) on delete cascade,
  artist_id uuid     not null references public.artists (id) on delete cascade,
  position  smallint not null default 0 check (position >= 0),
  primary key (gig_id, artist_id)
);

-- position 0 is the headliner; exactly one per gig
create unique index gig_artists_one_headliner
  on public.gig_artists (gig_id) where position = 0;

-- the hot listing query: live gigs in date order
create index gigs_live_starts_at on public.gigs (starts_at) where status = 'live';
create index gigs_venue          on public.gigs (venue_id);
create index gigs_submitted_by   on public.gigs (submitted_by) where status = 'pending';
create index gig_artists_artist  on public.gig_artists (artist_id);
create index artists_genre_group on public.artists (genre_group);
