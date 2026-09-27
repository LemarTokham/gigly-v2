-- ---------------------------------------------------------------------------
-- Reactions: five fixed ones, one per person per stub, no comments ever.
--
-- Stored as codes, not emoji. An emoji can arrive with or without an
-- invisible variation selector (U+FE0F), which would slip past an equality
-- check; packages/shared maps the codes to the emoji both apps draw.
-- ---------------------------------------------------------------------------
create type public.reaction_code as enum ('fire', 'hands', 'heart_eyes', 'laugh', 'horns');

create table public.reactions (
  stub_id    uuid                 not null references public.stubs (id) on delete cascade,
  user_id    uuid                 not null references public.profiles (id) on delete cascade,
  reaction   public.reaction_code not null,
  created_at timestamptz          not null default now(),
  -- One per person per stub; changing your mind is an update of this row.
  primary key (stub_id, user_id)
);

create index reactions_user on public.reactions (user_id);

alter table public.reactions enable row level security;

-- The subqueries on stubs run with the caller's rights, so the stub policy
-- applies inside them: "a stub you can see" is decided in exactly one place.

-- Anyone who can see a stub sees who reacted, minus anyone blocked.
create policy reactions_read on public.reactions
  for select using (
    exists (select 1 from public.stubs s where s.id = stub_id)
    and not public.is_blocked_between((select auth.uid()), user_id)
  );

-- On a stub you can see, and never your own.
create policy reactions_add on public.reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.stubs s where s.id = stub_id and s.user_id <> (select auth.uid()))
  );

-- Swapping is held to the same test as adding, or a reaction could be moved
-- onto a stub by editing a row that was allowed somewhere else.
create policy reactions_change on public.reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.stubs s where s.id = stub_id and s.user_id <> (select auth.uid()))
  );

create policy reactions_remove on public.reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.reactions from anon, authenticated;
grant select on public.reactions to anon, authenticated;
grant insert (stub_id, user_id, reaction) on public.reactions to authenticated;
grant update (reaction) on public.reactions to authenticated;
grant delete on public.reactions to authenticated;

-- ---------------------------------------------------------------------------
-- The tap: a new reaction adds it, a different one swaps it, the same one
-- takes it off. Returns what is now set, or null.
--
-- SECURITY INVOKER on purpose: every write below is checked by the policies
-- above exactly as if the app had made it. This only saves both apps from
-- writing the add/swap/remove logic twice.
-- ---------------------------------------------------------------------------
create function public.react(p_stub_id uuid, p_reaction public.reaction_code)
returns public.reaction_code
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_me      uuid := auth.uid();
  v_current public.reaction_code;
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select reaction into v_current
  from public.reactions
  where stub_id = p_stub_id and user_id = v_me;

  if v_current = p_reaction then
    delete from public.reactions where stub_id = p_stub_id and user_id = v_me;
    return null;
  end if;

  insert into public.reactions (stub_id, user_id, reaction)
  values (p_stub_id, v_me, p_reaction)
  on conflict (stub_id, user_id) do update set reaction = excluded.reaction;
  return p_reaction;
end;
$$;

revoke execute on function public.react(uuid, public.reaction_code) from public, anon;
grant execute on function public.react(uuid, public.reaction_code) to authenticated;
