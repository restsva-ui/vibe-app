-- Harden VYBE profile-photo storage.
-- Client sources may be JPG/PNG/WebP, but the official client normalizes
-- profile uploads to 900x900 WebP/JPEG before sending them to the Edge Function.

update storage.buckets
set allowed_mime_types = array['image/webp','image/jpeg']::text[],
    file_size_limit = 2097152
where id='profile-photos';

create or replace function public.vybe_profile_photo_objects(p_user_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    array(
      select o.name
      from storage.objects o
      where o.bucket_id='profile-photos'
        and o.name like p_user_id::text || '/%'
      order by o.created_at asc
      limit 50
    ),
    array[]::text[]
  );
$$;

revoke all on function public.vybe_profile_photo_objects(uuid)
  from public, anon, authenticated;
grant execute on function public.vybe_profile_photo_objects(uuid)
  to service_role;
