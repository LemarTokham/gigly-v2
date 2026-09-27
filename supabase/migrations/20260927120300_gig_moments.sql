-- ---------------------------------------------------------------------------
-- Each gig's one shared "moment": a random time during the likely headline
-- set, when everyone going gets the same nudge to take their stub.
--
-- Picked by trigger whenever a gig becomes live or its time moves, rather
-- than once: import_gig() rewrites starts_at when a listing changes, and a
-- moment picked for the old time would fire at the wrong gig. Once the push
-- has gone (notified_at is set) the moment is history and never moves.
--
-- gigs.starts_at is doors: the importer builds it from Skiddle's door time and
-- the submit form labels it Doors.
-- ---------------------------------------------------------------------------
create table public.gig_moments (
  gig_id      uuid        primary key references public.gigs (id) on delete cascade,
  fires_at    timestamptz not null,
  notified_at timestamptz
);

-- The push job's query in step H: due and not yet sent.
create index gig_moments_due on public.gig_moments (fires_at) where notified_at is null;

comment on table public.gig_moments is
  'Hidden until it fires, so nobody can plan around the moment. Stubs can be posted from fires_at until doors + 6 hours.';

create function public.pick_gig_moment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'live' then
    -- Doors + 60 to doors + 150 minutes, both ends included.
    insert into public.gig_moments (gig_id, fires_at)
    values (new.id, new.starts_at + make_interval(mins => 60 + floor(random() * 91)::integer))
    on conflict (gig_id) do update
      set fires_at = excluded.fires_at
      where public.gig_moments.notified_at is null;
  else
    delete from public.gig_moments where gig_id = new.id and notified_at is null;
  end if;
  return new;
end;
$$;

revoke execute on function public.pick_gig_moment() from public, anon, authenticated;

create trigger gigs_pick_moment_insert
  after insert on public.gigs
  for each row execute function public.pick_gig_moment();

-- WHEN, not just "update of": import_gig() sets starts_at on every re-import
-- even when it has not changed, and that must not re-roll the moment.
create trigger gigs_pick_moment_update
  after update of status, starts_at on public.gigs
  for each row
  when (old.status is distinct from new.status or old.starts_at is distinct from new.starts_at)
  execute function public.pick_gig_moment();

-- Gigs already live and not yet over get their moment now.
insert into public.gig_moments (gig_id, fires_at)
select g.id, g.starts_at + make_interval(mins => 60 + floor(random() * 91)::integer)
from public.gigs g
where g.status = 'live' and g.starts_at > now() - interval '6 hours'
on conflict (gig_id) do nothing;

alter table public.gig_moments enable row level security;

create policy gig_moments_read_once_fired on public.gig_moments
  for select using (fires_at <= now());

revoke all on public.gig_moments from anon, authenticated;
grant select on public.gig_moments to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The posting window: from the moment until six hours after doors. Reads the
-- moment with owner's rights, since before it fires nobody else can.
-- ---------------------------------------------------------------------------
create function public.stub_window_open(p_gig_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gig_moments m
    join public.gigs g on g.id = m.gig_id
    where m.gig_id = p_gig_id
      and g.status = 'live'
      and now() >= m.fires_at
      and now() <  g.starts_at + interval '6 hours'
  );
$$;

revoke execute on function public.stub_window_open(uuid) from public;
grant execute on function public.stub_window_open(uuid) to anon, authenticated;
