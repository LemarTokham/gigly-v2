-- ---------------------------------------------------------------------------
-- Mutual friends. One row per pair, whichever way round the request went.
--
-- Every change goes through the functions below, never direct DML, because
-- the rules are about transitions rather than rows: crossing requests become
-- a friendship, a decline is silent and cools off for 30 days, and the person
-- who declined can still change their mind. A policy only sees one row at a
-- time and cannot express any of that.
-- ---------------------------------------------------------------------------
create type public.friendship_status as enum ('pending', 'accepted', 'declined');

create table public.friendships (
  requester_id uuid                     not null references public.profiles (id) on delete cascade,
  addressee_id uuid                     not null references public.profiles (id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz              not null default now(),
  responded_at timestamptz,
  -- Set when the requester withdraws a request that, unknown to them, was
  -- declined. The row has to outlive the withdrawal or the 30-day cool-off
  -- could be skipped by cancelling and re-sending.
  cancelled_at timestamptz,
  primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- The "one row per pair" rule: (a, b) and (b, a) collide here.
create unique index friendships_one_per_pair on public.friendships (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);
create index friendships_addressee on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;
-- No policies, and no privileges either: people read their own links through
-- the friend_links view below, which is what keeps a decline silent.
revoke all on public.friendships from anon, authenticated;

-- Used inside policies on stubs and attending. SECURITY DEFINER because the
-- asker cannot read friendships directly.
create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
      and f.status = 'accepted'
  );
$$;

revoke execute on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to anon, authenticated;

-- Serialises writes for one pair, so two people tapping Add on each other at
-- the same instant end up friends rather than with a unique violation.
create function public.lock_pair(a uuid, b uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended(least(a, b)::text || greatest(a, b)::text, 0));
$$;

revoke execute on function public.lock_pair(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Error codes the apps branch on:
--   28000  not signed in
--   GY020  you cannot add yourself
--   GY021  no such person (also what a blocked pair sees, so a block is not
--          revealed)
--   GY022  already friends
--   GY023  too many requests today
--   GY024  no request to answer or cancel
--   GY025  not friends
--   GY026  pick a username first
-- ---------------------------------------------------------------------------

-- Returns 'sent' or 'friends', whichever the pair now is from the caller's
-- side. A request the other person silently declined also returns 'sent'.
create function public.send_friend_request(p_to uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := auth.uid();
  v_row    public.friendships;
  v_exists boolean;
  v_today  integer;
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_to = v_me then
    raise exception 'cannot add yourself' using errcode = 'GY020';
  end if;
  if (select username from public.profiles where id = v_me) is null then
    raise exception 'pick a username first' using errcode = 'GY026';
  end if;
  if not exists (select 1 from public.profiles where id = p_to)
     or public.is_blocked_between(v_me, p_to) then
    raise exception 'no such person' using errcode = 'GY021';
  end if;

  perform public.lock_pair(v_me, p_to);

  select * into v_row from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(v_me, p_to)
    and greatest(f.requester_id, f.addressee_id) = greatest(v_me, p_to);
  -- Kept in a variable: FOUND is overwritten by every later statement,
  -- including the count(*) below, which always finds a row.
  v_exists := found;

  if v_exists and v_row.status = 'accepted' then
    raise exception 'already friends' using errcode = 'GY022';
  end if;

  -- They asked first (pending), or they asked and I said no (declined).
  -- Either way my adding them now is a yes.
  if v_exists and v_row.addressee_id = v_me then
    update public.friendships
       set status = 'accepted', responded_at = now(), cancelled_at = null
     where requester_id = v_row.requester_id and addressee_id = v_me;
    return 'friends';
  end if;

  if v_exists then
    -- My own earlier request. Still pending: nothing to do.
    if v_row.status = 'pending' then
      return 'sent';
    end if;
    -- Declined. Inside the cool-off the requester is told nothing new: it
    -- still looks sent, and nothing reaches the other person.
    if v_row.responded_at > now() - interval '30 days' then
      update public.friendships set cancelled_at = null
       where requester_id = v_me and addressee_id = p_to;
      return 'sent';
    end if;
  end if;

  select count(*) into v_today
  from public.friendships
  where requester_id = v_me and created_at > now() - interval '1 day';
  if v_today >= 50 then
    raise exception 'too many requests today' using errcode = 'GY023';
  end if;

  if v_exists then
    -- A decline more than 30 days old: ask again.
    update public.friendships
       set status = 'pending', created_at = now(), responded_at = null, cancelled_at = null
     where requester_id = v_me and addressee_id = p_to;
  else
    insert into public.friendships (requester_id, addressee_id) values (v_me, p_to);
  end if;
  return 'sent';
end;
$$;

-- Only the person asked can answer, which is the WHERE clause, not a check
-- that could be skipped.
create function public.respond_to_request(p_from uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  perform public.lock_pair(v_me, p_from);

  update public.friendships
     set status = case when p_accept then 'accepted' else 'declined' end::public.friendship_status,
         responded_at = now()
   where requester_id = p_from and addressee_id = v_me and status = 'pending';

  if not found then
    raise exception 'no request to answer' using errcode = 'GY024';
  end if;
  return case when p_accept then 'friends' else 'declined' end;
end;
$$;

-- The requester withdrawing. A pending request goes; a declined one is only
-- hidden from them, so the cool-off still applies.
create function public.cancel_request(p_to uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  perform public.lock_pair(v_me, p_to);

  delete from public.friendships
   where requester_id = v_me and addressee_id = p_to and status = 'pending';
  if found then
    return;
  end if;

  update public.friendships set cancelled_at = now()
   where requester_id = v_me and addressee_id = p_to
     and status = 'declined' and cancelled_at is null;
  if not found then
    raise exception 'no request to cancel' using errcode = 'GY024';
  end if;
end;
$$;

-- Either friend can end it. The app asks for confirmation first.
create function public.remove_friend(p_other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  perform public.lock_pair(v_me, p_other);

  delete from public.friendships f
   where least(f.requester_id, f.addressee_id) = least(v_me, p_other)
     and greatest(f.requester_id, f.addressee_id) = greatest(v_me, p_other)
     and f.status = 'accepted';
  if not found then
    raise exception 'not friends' using errcode = 'GY025';
  end if;
end;
$$;

revoke execute on function public.send_friend_request(uuid)          from public, anon;
revoke execute on function public.respond_to_request(uuid, boolean)  from public, anon;
revoke execute on function public.cancel_request(uuid)               from public, anon;
revoke execute on function public.remove_friend(uuid)                from public, anon;
grant execute on function public.send_friend_request(uuid)          to authenticated;
grant execute on function public.respond_to_request(uuid, boolean)  to authenticated;
grant execute on function public.cancel_request(uuid)               to authenticated;
grant execute on function public.remove_friend(uuid)                to authenticated;

-- ---------------------------------------------------------------------------
-- Each person's own view of their friendships, one row per other person:
--   friend    accepted
--   incoming  they asked, you have not answered
--   sent      you asked; still says sent after a silent decline
-- A request you declined disappears from your list. Owner's rights, like the
-- chart views, and filtered to the caller; the raw table stays closed.
-- ---------------------------------------------------------------------------
create view public.friend_links
with (security_invoker = false)
as
select
  p.id           as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  case
    when f.status = 'accepted'                  then 'friend'
    when f.requester_id = (select auth.uid())   then 'sent'
    else 'incoming'
  end            as state,
  -- When the link reached its current state, as far as this person may know:
  -- a requester never sees when a decline happened.
  case when f.status = 'accepted' then f.responded_at else f.created_at end as since
from public.friendships f
join public.profiles p
  on p.id = case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
where (select auth.uid()) in (f.requester_id, f.addressee_id)
  and not (f.status = 'declined' and f.addressee_id = (select auth.uid()))
  and not (f.status = 'declined' and f.cancelled_at is not null)
  and not public.is_blocked_between(f.requester_id, f.addressee_id);

revoke all on public.friend_links from anon, public;
grant select on public.friend_links to authenticated;

-- Blocking ends a friendship, and any request either way.
create function public.blocks_end_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships f
   where least(f.requester_id, f.addressee_id) = least(new.blocker_id, new.blocked_id)
     and greatest(f.requester_id, f.addressee_id) = greatest(new.blocker_id, new.blocked_id);
  return new;
end;
$$;

revoke execute on function public.blocks_end_friendship() from public, anon, authenticated;

create trigger blocks_end_friendship
  after insert on public.blocks
  for each row execute function public.blocks_end_friendship();
