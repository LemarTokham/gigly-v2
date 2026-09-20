-- Google's Places terms allow storing a place_id indefinitely, but not the
-- content behind it — coordinates, ratings and reviews must not be cached
-- beyond 30 days. So only the id is stored here, and reviews are fetched live
-- when someone opens a venue.
--
-- lat/lng are filled from OpenStreetMap instead, whose licence permits keeping
-- them. That also means the map draws from our own rows with no Places call on
-- page load: a request is only spent when a venue is actually opened.
alter table public.venues
  add column google_place_id text;

comment on column public.venues.google_place_id is
  'Google Places id. Safe to store; the content behind it is not, so reviews are fetched live and never written here.';

comment on column public.venues.lat is
  'From OpenStreetMap, not Google — their licence permits storing coordinates.';
