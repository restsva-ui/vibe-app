-- VYBE private profile-photo delivery.
-- Edge v144+ signs photo object paths before returning them to clients.

update public.profiles
set photo_url = split_part(
  split_part(photo_url, '/storage/v1/object/public/profile-photos/', 2),
  '?',
  1
)
where photo_url like '%/storage/v1/object/public/profile-photos/%';

update storage.buckets
set public = false,
    allowed_mime_types = array['image/webp','image/jpeg']::text[],
    file_size_limit = 2097152
where id='profile-photos';
