-- ---------------------------------------------------------------------------
-- The private bucket for stub photos. Created here rather than in config.toml
-- so `db push` makes it on the hosted project too.
--
-- Photos are never public: the apps and the website ask for short-lived
-- signed URLs, and a signed URL can only be made for an object the asker may
-- read under the policies below.
--
-- Object names are {user_id}/{gig_id}/{file}.jpg, the same shape the stubs
-- table checks its paths against.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stubs', 'stubs', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Both helpers check the name's shape before reading any part of it as a
-- uuid. Storage policies are evaluated against objects in every bucket, and
-- a cast error on another bucket's file name must not become an error here.

-- Uploads: your own folder, for a gig where you could post a stub right now.
-- Owner's rights because it reads attending and the not-yet-fired moment.
create function public.can_upload_stub_photo(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-z0-9_-]+\.jpg$' then
    return false;
  end if;
  return split_part(p_name, '/', 1)::uuid = auth.uid()
     and public.can_post_stub(split_part(p_name, '/', 2)::uuid);
end;
$$;

-- Reading: a photo is visible exactly when a stub using it is. Caller's
-- rights, so the stubs policy makes that decision.
create function public.can_read_stub_photo(p_name text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-z0-9_-]+\.jpg$' then
    return false;
  end if;
  return exists (
    select 1 from public.stubs s
    where s.user_id = split_part(p_name, '/', 1)::uuid
      and s.gig_id  = split_part(p_name, '/', 2)::uuid
      and p_name in (s.back_path, s.front_path, s.thumb_path)
  );
end;
$$;

revoke execute on function public.can_upload_stub_photo(text) from public, anon;
revoke execute on function public.can_read_stub_photo(text)   from public;
grant execute on function public.can_upload_stub_photo(text) to authenticated;
grant execute on function public.can_read_stub_photo(text)   to anon, authenticated;

create policy stub_photos_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stubs' and public.can_upload_stub_photo(name));

-- Plus your own folder, always: removing a file needs read as well as delete,
-- so without this an owner could not clear photos left behind by a stub that
-- failed to post.
create policy stub_photos_read on storage.objects
  for select
  using (
    bucket_id = 'stubs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.can_read_stub_photo(name)
    )
  );

-- Deleting your stub means deleting its photos too; your own folder only.
create policy stub_photos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'stubs' and (storage.foldername(name))[1] = (select auth.uid())::text);
