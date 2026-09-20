-- Skiddle's id for each venue, so the importer can ask for one room's gigs
-- rather than everything within a radius of the city centre.
alter table public.venues
  add column skiddle_id integer;

comment on column public.venues.skiddle_id is
  'Venue id on Skiddle. Mapped once by scripts/venues-skiddle.mjs.';

-- Seeded gigs are marked so they can be cleared locally without touching
-- anything imported or submitted. The seed never runs against the hosted
-- project — db push applies migrations only — so this is purely so a
-- developer can look at real listings without invented ones mixed in.
comment on column public.gigs.source is
  'submission for the form, seed for the invented sample data, otherwise the importer adapter name.';
