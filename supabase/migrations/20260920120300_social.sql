create table public.follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  artist_id  uuid not null references public.artists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table public.attending (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  gig_id     uuid not null references public.gigs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, gig_id)
);

create index follows_artist   on public.follows (artist_id);
create index attending_gig    on public.attending (gig_id);
