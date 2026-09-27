-- ---------------------------------------------------------------------------
-- Reports. With blocking, what the App Store asks of any app where strangers'
-- photos appear (guideline 1.2): a way to flag content and a person to act on
-- it.
--
-- reported_user_id is always set, stub reports included, and survives the
-- stub being deleted: an owner deleting a reported stub should not erase the
-- record that it was reported.
-- ---------------------------------------------------------------------------
create type public.report_reason as enum (
  'nudity', 'violence', 'harassment', 'spam', 'not_at_gig', 'other'
);

create table public.reports (
  id               uuid                 primary key default gen_random_uuid(),
  reporter_id      uuid                 not null references public.profiles (id) on delete cascade,
  reported_user_id uuid                 not null references public.profiles (id) on delete cascade,
  stub_id          uuid                 references public.stubs (id) on delete set null,
  reason           public.report_reason not null,
  details          text                 check (details is null or char_length(details) <= 500),
  created_at       timestamptz          not null default now(),
  resolved_at      timestamptz,
  resolved_by      uuid                 references public.profiles (id) on delete set null,
  constraint reports_not_self check (reporter_id <> reported_user_id)
);

create index reports_open on public.reports (created_at) where resolved_at is null;

alter table public.reports enable row level security;

-- Only what you can see: a stub visible to you, belonging to the person named,
-- or a person who has not blocked you. The stubs subquery runs under the
-- stubs policy.
create policy reports_file on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and not public.is_blocked_between((select auth.uid()), reported_user_id)
    and (
      stub_id is null
      or exists (select 1 from public.stubs s where s.id = stub_id and s.user_id = reported_user_id)
    )
  );

create policy reports_admin_read on public.reports
  for select using (public.is_admin());

create policy reports_admin_resolve on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

revoke all on public.reports from anon, authenticated;
grant insert (reporter_id, reported_user_id, stub_id, reason, details) on public.reports to authenticated;
grant select on public.reports to authenticated;
grant update (resolved_at, resolved_by) on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Expo push tokens, one row per device.
--
-- Keyed on the token, not the person: a phone signed out of one account and
-- into another must stop receiving the first account's pushes, which a
-- per-person key would not guarantee.
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token      text        primary key check (char_length(token) between 10 and 300),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  platform   text        not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy push_tokens_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Writes through the two functions only: registering has to be able to take
-- a token over from whichever account last had this device, which no policy
-- written from the new owner's side could allow.
revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;

create function public.register_push_token(p_token text, p_platform text)
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

  insert into public.push_tokens (token, user_id, platform)
  values (p_token, v_me, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- On sign-out. Only ever your own.
create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text)     from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text)     to authenticated;
