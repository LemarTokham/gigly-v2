-- Genre buckets behind the chip filters on the what's-on page.
-- The prototype's GROUPS array minus "All", which is a UI state, not a value.
-- Artists also carry a free-text `genre` for display: "Dream pop" and
-- "Shoegaze" both display as themselves but filter under Indie.
create type public.genre_group as enum (
  'Indie', 'Punk', 'Jazz', 'Electronic', 'Folk', 'Soul', 'Hip hop'
);

create type public.gig_status as enum ('pending', 'live', 'rejected');
