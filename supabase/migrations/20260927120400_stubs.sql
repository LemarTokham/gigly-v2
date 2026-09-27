-- ---------------------------------------------------------------------------
-- Stubs: a back-camera photo and a selfie taken during a gig. No caption, no
-- rating, no words.
--
-- Three files per stub, all in the private `stubs` bucket under
-- {user_id}/{gig_id}/: the back photo, the selfie, and a small thumbnail the
-- phone makes at upload so walls and the calendar never download two
-- full-size photos per tile.
-- ---------------------------------------------------------------------------
create type public.stub_audience as enum ('friends', 'wall');

create table public.stubs (
  id         uuid                 primary key default gen_random_uuid(),
  user_id    uuid                 not null references public.profiles (id) on delete cascade,
  gig_id     uuid                 not null references public.gigs (id) on delete cascade,
  back_path  text                 not null,
  front_path text                 not null,
  thumb_path text                 not null,
  -- Who is in the selfie: 0 just me, 1 me +1, 2 the group. Display only.
  people     smallint             not null check (people between 0 and 2),
  audience   public.stub_audience not null,
  created_at timestamptz          not null default now(),
  unique (user_id, gig_id),
  -- A stub can only point at photos in its owner's folder for that gig, so
  -- nobody can post someone else's picture as their own.
  constraint stubs_paths_are_own check (
        back_path  ~ ('^' || user_id::text || '/' || gig_id::text || '/[a-z0-9_-]+\.jpg$')
    and front_path ~ ('^' || user_id::text || '/' || gig_id::text || '/[a-z0-9_-]+\.jpg$')
    and thumb_path ~ ('^' || user_id::text || '/' || gig_id::text || '/[a-z0-9_-]+\.jpg$')
    and back_path <> front_path and back_path <> thumb_path and front_path <> thumb_path
  )
);

-- The friends feed (a person's stubs, newest first) and the gig wall.
create index stubs_user_recent on public.stubs (user_id, created_at desc);
create index stubs_gig_recent  on public.stubs (gig_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Everything posting needs, in one place, for the insert policy and for the
-- apps to decide whether to show the camera. The same test guards uploads to
-- the bucket, so photos cannot arrive outside the window either.
-- ---------------------------------------------------------------------------
create function public.can_post_stub(p_gig_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.username is not null)
    and exists (select 1 from public.attending a where a.user_id = auth.uid() and a.gig_id = p_gig_id)
    and not exists (select 1 from public.stubs s where s.user_id = auth.uid() and s.gig_id = p_gig_id)
    and public.stub_window_open(p_gig_id);
$$;

revoke execute on function public.can_post_stub(uuid) from public, anon;
grant execute on function public.can_post_stub(uuid) to authenticated;

alter table public.stubs enable row level security;

-- Yours, your friends', and anything on a wall. A block hides stubs both
-- ways, friends or not.
create policy stubs_read on public.stubs
  for select using (
    (
      user_id = (select auth.uid())
      or audience = 'wall'
      or public.are_friends((select auth.uid()), user_id)
    )
    and not public.is_blocked_between((select auth.uid()), user_id)
  );

create policy stubs_post on public.stubs
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_post_stub(gig_id));

create policy stubs_delete_own on public.stubs
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- No update, ever: a stub is what it was when posted. id and created_at are
-- not insertable, so the posting time is the server's and not the phone's.
revoke all on public.stubs from anon, authenticated;
grant select on public.stubs to anon, authenticated;
grant insert (user_id, gig_id, back_path, front_path, thumb_path, people, audience)
  on public.stubs to authenticated;
grant delete on public.stubs to authenticated;

-- ---------------------------------------------------------------------------
-- Friends see each other's "I'm going": the avatars on gig cards and the
-- Going to list on a profile. Added alongside the existing own-rows policy.
-- ---------------------------------------------------------------------------
create policy attending_friends_read on public.attending
  for select to authenticated
  using (public.are_friends((select auth.uid()), user_id));

-- ---------------------------------------------------------------------------
-- The three numbers on a profile. Counts only, never rows, so a locked
-- profile can show "12 stubs" without showing which gigs.
-- ---------------------------------------------------------------------------
create function public.profile_counts(p_user_id uuid)
returns table (stubs integer, going integer, friends integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.stubs s where s.user_id = p_user_id),
    (select count(*)::integer
       from public.attending a
       join public.gigs g on g.id = a.gig_id
      where a.user_id = p_user_id and g.status = 'live' and g.starts_at > now()),
    (select count(*)::integer
       from public.friendships f
      where p_user_id in (f.requester_id, f.addressee_id) and f.status = 'accepted')
  where not public.is_blocked_between(auth.uid(), p_user_id);
$$;

revoke execute on function public.profile_counts(uuid) from public, anon;
grant execute on function public.profile_counts(uuid) to authenticated;
