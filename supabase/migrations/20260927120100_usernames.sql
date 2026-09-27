-- ---------------------------------------------------------------------------
-- @usernames and avatars on the existing profiles table, and profiles
-- becoming readable by everyone so friends can find each other.
--
-- username is nullable on purpose. Google, Apple and magic-link sign-in all
-- create the account before any form is shown, so "pick a username at
-- signup" is a step after the first sign-in, and web users from before this
-- migration have none. The apps gate on it being set.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column username   text,
  add column avatar_url text;

-- Same rules as packages/shared/src/username.ts. The lowercase-only pattern is
-- what makes a plain unique index case-insensitive, so citext is not needed.
alter table public.profiles
  add constraint profiles_username_format check (
    username ~ '^[a-z0-9._]{3,20}$'
    and username !~ '(^\.|\.$|\.\.)'
  );

create unique index profiles_username_key on public.profiles (username);

-- NOT VALID: enforced on every write from now on, without failing the
-- migration over a long Google full_name already stored.
alter table public.profiles
  add constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) <= 60) not valid,
  add constraint profiles_avatar_url_length
    check (avatar_url is null or char_length(avatar_url) <= 500) not valid;

-- ---------------------------------------------------------------------------
-- Names nobody can take. Mirrors RESERVED_USERNAMES in packages/shared, and
-- tests/usernames.test.mts checks every name there is refused here.
-- ---------------------------------------------------------------------------
create function public.username_is_reserved(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_username = any (array[
    'about', 'account', 'admin', 'administrator', 'api', 'app', 'artist',
    'artists', 'auth', 'chart', 'friends', 'gig', 'gigly', 'gigs', 'help',
    'hype', 'invite', 'login', 'logout', 'map', 'me', 'mod', 'moderator',
    'null', 'official', 'root', 'search', 'settings', 'signin', 'signout',
    'signup', 'staff', 'stub', 'stubs', 'submit', 'support', 'team',
    'undefined', 'venue', 'venues', 'www', 'you'
  ]);
$$;

-- A handle someone has just changed away from stays theirs for 30 days.
-- Without this, renaming frees the old @ at once, and anyone watching can
-- take it and be mistaken for the person their friends already know.
create table public.username_holds (
  username   text        primary key,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  held_until timestamptz not null
);

alter table public.username_holds enable row level security;
-- No policies: only set_username() reads or writes it.
revoke all on public.username_holds from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The only way to set or change a username.
--
-- Error codes:
--   28000  not signed in
--   GY010  not a valid username
--   GY011  taken (in use, reserved, or held for someone else)
-- ---------------------------------------------------------------------------
create function public.set_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := lower(regexp_replace(btrim(coalesce(p_username, '')), '^@', ''));
  v_old  text;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if v_name !~ '^[a-z0-9._]{3,20}$' or v_name ~ '(^\.|\.$|\.\.)' then
    raise exception 'not a valid username' using errcode = 'GY010';
  end if;

  -- Reported as taken rather than reserved, so the list is not advertised.
  if public.username_is_reserved(v_name) then
    raise exception 'username taken' using errcode = 'GY011';
  end if;

  select username into v_old from public.profiles where id = v_user for update;
  if v_old = v_name then
    return v_name;
  end if;

  if exists (
    select 1 from public.username_holds h
    where h.username = v_name and h.user_id <> v_user and h.held_until > now()
  ) then
    raise exception 'username taken' using errcode = 'GY011';
  end if;

  begin
    update public.profiles set username = v_name where id = v_user;
  exception when unique_violation then
    raise exception 'username taken' using errcode = 'GY011';
  end;

  -- Taking a name back, or taking one whose hold has lapsed, clears the hold.
  delete from public.username_holds where username = v_name;

  if v_old is not null then
    insert into public.username_holds (username, user_id, held_until)
    values (v_old, v_user, now() + interval '30 days')
    on conflict (username) do update
      set user_id = excluded.user_id, held_until = excluded.held_until;
  end if;

  return v_name;
end;
$$;

revoke execute on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Who can read and write what.
--
-- Everyone, signed in or not, can read a profile's public face: web gig walls
-- show @handles to people who never sign in. is_admin stays private, which
-- takes column privileges: a table-level SELECT grant would cover it (the
-- same trap as 20260920130000_fix_profile_column_grants.sql), so the table
-- grant goes and the safe columns come back one by one. A consequence:
-- `select=*` on profiles is refused; name the columns.
-- ---------------------------------------------------------------------------
revoke select on public.profiles from anon, authenticated;
grant select (id, username, display_name, avatar_url, created_at)
  on public.profiles to anon, authenticated;

-- username changes only through set_username(), which checks holds and the
-- reserved list; the rest a person may edit directly.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

drop policy profiles_select_own on public.profiles;

create policy profiles_read on public.profiles
  for select using (
    not public.is_blocked_between((select auth.uid()), id)
  );
