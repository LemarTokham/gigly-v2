-- ---------------------------------------------------------------------------
-- Helpers used inside policies.
--
-- Both are SECURITY DEFINER for a specific reason: a policy on `profiles` that
-- calls is_admin() would recurse forever if is_admin() read `profiles` under
-- invoker rights, because that read would re-evaluate the same policy.
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create function public.gig_is_visible(p_gig_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gigs g
    where g.id = p_gig_id
      and (g.status = 'live' or g.submitted_by = auth.uid() or public.is_admin())
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.gig_is_visible(uuid) to anon, authenticated;

alter table public.profiles    enable row level security;
alter table public.venues      enable row level security;
alter table public.artists     enable row level security;
alter table public.gigs        enable row level security;
alter table public.gig_artists enable row level security;
alter table public.hypes       enable row level security;
alter table public.follows     enable row level security;
alter table public.attending   enable row level security;

-- --------------------------------------------------------------- profiles --
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Nobody promotes themselves. Column-level, so even a crafted update fails.
revoke update (is_admin, id, created_at) on public.profiles from authenticated;

-- ------------------------------------------------- venues, artists (read) --
create policy venues_public_read on public.venues
  for select using (true);

create policy artists_public_read on public.artists
  for select using (true);

create policy venues_admin_write on public.venues
  for all using (public.is_admin()) with check (public.is_admin());

create policy artists_admin_write on public.artists
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------- gigs --
-- A pending gig is visible only to whoever submitted it, and to admins.
create policy gigs_read on public.gigs
  for select using (
    status = 'live' or submitted_by = auth.uid() or public.is_admin()
  );

-- Anyone signed in may submit, but only as themselves and only as pending.
-- Nobody self-approves.
create policy gigs_submit on public.gigs
  for insert to authenticated
  with check (submitted_by = auth.uid() and status = 'pending');

create policy gigs_admin_write on public.gigs
  for update using (public.is_admin()) with check (public.is_admin());

create policy gigs_admin_delete on public.gigs
  for delete using (public.is_admin());

-- ------------------------------------------------------------ gig_artists --
create policy gig_artists_read on public.gig_artists
  for select using (public.gig_is_visible(gig_id));

create policy gig_artists_submit on public.gig_artists
  for insert to authenticated
  with check (
    exists (
      select 1 from public.gigs g
      where g.id = gig_id and g.submitted_by = auth.uid() and g.status = 'pending'
    )
  );

create policy gig_artists_admin_write on public.gig_artists
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------ hypes --
-- Read is own-rows-only on purpose: the raw table maps a person to the artists
-- they back. Public counts come from the aggregate views, which expose no
-- user_id. There are deliberately no insert/update/delete policies — writes go
-- through cast_hype()/take_back_hype().
create policy hypes_select_own on public.hypes
  for select using (user_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------ follows, attending --
create policy follows_own on public.follows
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy attending_own on public.attending
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
