-- One row per (user, artist), ever. A hype scores for 7 days from created_at
-- and then stops counting; re-hyping the same artist after that window is an
-- UPDATE of created_at rather than a second row. That keeps "max one hype per
-- artist per user" true at all times without the table growing unboundedly.
create table public.hypes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  artist_id  uuid not null references public.artists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

comment on table public.hypes is
  'Every row is worth exactly 1 point. No weighting by followers or capacity.';

-- chart: count rows per artist inside the rolling window
create index hypes_artist_recent on public.hypes (artist_id, created_at desc);
-- allowance: count this user''s rows since Monday
create index hypes_user_recent   on public.hypes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Monday 00:00 Europe/London, as an absolute instant.
--
-- Computed in London wall-clock time and converted back, so the reset lands on
-- Monday 00:00 local whether we are in GMT or BST. Doing this in UTC would
-- drift the reset by an hour for half the year.
-- ---------------------------------------------------------------------------
create function public.hype_week_start(p_at timestamptz default now())
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', p_at at time zone 'Europe/London') at time zone 'Europe/London';
$$;

-- ---------------------------------------------------------------------------
-- An artist can be hyped only while they have a live gig still to come.
-- Hyping opens when the gig is listed and closes when it starts. Pending gigs
-- do not count, so an unapproved submission cannot lift anyone up the chart.
-- ---------------------------------------------------------------------------
create function public.artist_is_hypeable(p_artist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gig_artists ga
    join public.gigs g on g.id = ga.gig_id
    where ga.artist_id = p_artist_id
      and g.status = 'live'
      and g.starts_at > now()
  );
$$;

-- Enforced in the database, not just in cast_hype, so it holds for any write
-- path including the service role and the seed script.
create function public.hypes_enforce_eligible()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.artist_is_hypeable(new.artist_id) then
    raise exception 'artist has no upcoming live gig'
      using errcode = 'GY003';
  end if;
  return new;
end;
$$;

create trigger hypes_eligible
  before insert or update of artist_id, created_at on public.hypes
  for each row execute function public.hypes_enforce_eligible();
