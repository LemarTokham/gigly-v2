-- ---------------------------------------------------------------------------
-- Blocking. Comes first because nearly every rule after it has an exception
-- for a blocked pair: profiles, friendships, stubs and reactions all go
-- invisible in both directions.
--
-- The App Store requires this of any app with user-generated content
-- (guideline 1.2), alongside reporting, which arrives with stubs.
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid        not null references public.profiles (id) on delete cascade,
  blocked_id uuid        not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked on public.blocks (blocked_id);

comment on table public.blocks is
  'Either direction hides the pair from each other everywhere. Blocking also ends any friendship.';

-- SECURITY DEFINER so policies on other tables can ask without the asker
-- being able to read the blocks table: the blocked person never learns who
-- blocked them, only that they can no longer see them.
create function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from public;
grant execute on function public.is_blocked_between(uuid, uuid) to anon, authenticated;

alter table public.blocks enable row level security;

-- Your own blocks only. Nobody can see who has blocked them.
create policy blocks_own on public.blocks
  for all to authenticated
  using (blocker_id = (select auth.uid()))
  with check (blocker_id = (select auth.uid()));

revoke all on public.blocks from anon;
revoke update on public.blocks from authenticated;
