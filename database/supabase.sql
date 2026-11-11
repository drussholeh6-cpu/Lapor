insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-evidence', 'complaint-evidence', true, 2097152, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view complaint evidence" on storage.objects;
create policy "Public can view complaint evidence"
on storage.objects for select
using (bucket_id = 'complaint-evidence');

create table if not exists complaints (
  code text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists staff_profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text,
  name text not null,
  role text not null default 'petugas' check (role in ('admin', 'petugas')),
  unit text not null default '',
  status text not null default 'registered' check (status in ('pending', 'registered')),
  auth_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table staff_profiles add column if not exists username text;
create unique index if not exists staff_profiles_username_unique
  on staff_profiles (lower(username))
  where username is not null;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists complaints_set_updated_at on complaints;
create trigger complaints_set_updated_at
before update on complaints
for each row
execute function set_updated_at();

drop trigger if exists staff_profiles_set_updated_at on staff_profiles;
create trigger staff_profiles_set_updated_at
before update on staff_profiles
for each row
execute function set_updated_at();
