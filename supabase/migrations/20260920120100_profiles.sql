-- One row per signed-up user, keyed to auth.users. Email deliberately lives
-- only in auth.users rather than being copied here.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_admin    boolean     not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile per auth user. is_admin gates the gig approval queue.';

-- Keep profiles in step with signups.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
