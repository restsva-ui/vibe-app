-- VYBE discovery/profile media foundation.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  2097152,
  array['image/webp','image/jpeg','image/png']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists users_last_seen_idx
  on public.users(last_seen desc);

create index if not exists profiles_age_idx
  on public.profiles(age);

create index if not exists profiles_city_lower_idx
  on public.profiles(lower(city))
  where city is not null;
