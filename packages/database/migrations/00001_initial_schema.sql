-- Digital Signage core schema + RLS + Realtime publication
-- Requires: extensions pgcrypto (gen_random_uuid) — enabled by default on Supabase

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Devices (TV). TV uses anonymous auth; registered_session_id = auth.uid().
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  registered_session_id uuid references auth.users (id) on delete set null,
  pairing_code text not null,
  name text not null default 'TV Device',
  status text not null default 'offline',
  last_seen timestamptz,
  created_at timestamptz not null default now(),
  constraint devices_pairing_code_format check (pairing_code ~ '^[0-9]{6}$'),
  constraint devices_status_check check (status in ('offline', 'online', 'pending_pairing'))
);

create unique index if not exists devices_pairing_code_key on public.devices (pairing_code);
create index if not exists devices_owner_id_idx on public.devices (owner_id);
create index if not exists devices_registered_session_id_idx on public.devices (registered_session_id);

-- ---------------------------------------------------------------------------
-- Media metadata (files live in Storage bucket `media`)
-- ---------------------------------------------------------------------------
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  file_type text not null default 'unknown',
  original_filename text,
  created_at timestamptz not null default now(),
  constraint media_file_type_check check (file_type in ('image', 'video', 'unknown'))
);

create index if not exists media_owner_id_idx on public.media (owner_id);
create unique index if not exists media_owner_storage_path_uid on public.media (owner_id, storage_path);

-- ---------------------------------------------------------------------------
-- Playlists
-- ---------------------------------------------------------------------------
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists playlists_owner_id_idx on public.playlists (owner_id);

-- ---------------------------------------------------------------------------
-- Playlist items
-- ---------------------------------------------------------------------------
create table if not exists public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete restrict,
  sort_order integer not null default 0,
  duration_seconds integer,
  display_from timestamptz,
  display_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists playlist_items_playlist_id_idx on public.playlist_items (playlist_id);
create index if not exists playlist_items_playlist_sort_idx on public.playlist_items (playlist_id, sort_order);

-- ---------------------------------------------------------------------------
-- Device ↔ playlist assignment
-- ---------------------------------------------------------------------------
create table if not exists public.device_playlists (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint device_playlists_unique_device_playlist unique (device_id, playlist_id)
);

create index if not exists device_playlists_device_id_idx on public.device_playlists (device_id);
create index if not exists device_playlists_playlist_id_idx on public.device_playlists (playlist_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.media enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.device_playlists enable row level security;

-- Profiles: users read/update self
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

-- Devices: owner OR registering anonymous session
drop policy if exists devices_select_access on public.devices;
create policy devices_select_access on public.devices
  for select using (
    auth.uid() = owner_id
    or auth.uid() = registered_session_id
  );

drop policy if exists devices_insert_tv on public.devices;
create policy devices_insert_tv on public.devices
  for insert with check (
    owner_id is null
    and registered_session_id = auth.uid()
    and pairing_code is not null
  );

drop policy if exists devices_update_owner on public.devices;
create policy devices_update_owner on public.devices
  for update using (auth.uid() = owner_id);

drop policy if exists devices_update_registering_session on public.devices;
create policy devices_update_registering_session on public.devices
  for update using (auth.uid() = registered_session_id);

-- Dashboard: link unclaimed device by code (authenticated user becomes owner)
drop policy if exists devices_update_claim_by_code on public.devices;
create policy devices_update_claim_by_code on public.devices
  for update using (
    owner_id is null
    and auth.uid() is not null
  )
  with check (
    owner_id = auth.uid()
  );

drop policy if exists devices_delete_owner on public.devices;
create policy devices_delete_owner on public.devices
  for delete using (auth.uid() = owner_id);

-- Media
drop policy if exists media_select_own on public.media;
create policy media_select_own on public.media
  for select using (auth.uid() = owner_id);

drop policy if exists media_insert_own on public.media;
create policy media_insert_own on public.media
  for insert with check (auth.uid() = owner_id);

drop policy if exists media_update_own on public.media;
create policy media_update_own on public.media
  for update using (auth.uid() = owner_id);

drop policy if exists media_delete_own on public.media;
create policy media_delete_own on public.media
  for delete using (auth.uid() = owner_id);

-- Playlists
drop policy if exists playlists_select_own on public.playlists;
create policy playlists_select_own on public.playlists
  for select using (auth.uid() = owner_id);

drop policy if exists playlists_insert_own on public.playlists;
create policy playlists_insert_own on public.playlists
  for insert with check (auth.uid() = owner_id);

drop policy if exists playlists_update_own on public.playlists;
create policy playlists_update_own on public.playlists
  for update using (auth.uid() = owner_id);

drop policy if exists playlists_delete_own on public.playlists;
create policy playlists_delete_own on public.playlists
  for delete using (auth.uid() = owner_id);

-- Playlist items: same owner as parent playlist
drop policy if exists playlist_items_select_own on public.playlist_items;
create policy playlist_items_select_own on public.playlist_items
  for select using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.device_playlists dp
      join public.devices d on d.id = dp.device_id
      where dp.playlist_id = playlist_items.playlist_id
        and d.registered_session_id = auth.uid()
    )
  );

drop policy if exists playlist_items_insert_own on public.playlist_items;
create policy playlist_items_insert_own on public.playlist_items
  for insert with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists playlist_items_update_own on public.playlist_items;
create policy playlist_items_update_own on public.playlist_items
  for update using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists playlist_items_delete_own on public.playlist_items;
create policy playlist_items_delete_own on public.playlist_items
  for delete using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.owner_id = auth.uid()
    )
  );

-- Device playlists: owner of device, or TV session registered on device
drop policy if exists device_playlists_select on public.device_playlists;
create policy device_playlists_select on public.device_playlists
  for select using (
    exists (
      select 1 from public.devices d
      where d.id = device_id
        and (d.owner_id = auth.uid() or d.registered_session_id = auth.uid())
    )
  );

drop policy if exists device_playlists_insert_owner on public.device_playlists;
create policy device_playlists_insert_owner on public.device_playlists
  for insert with check (
    exists (
      select 1 from public.devices d
      where d.id = device_id and d.owner_id = auth.uid()
    )
  );

drop policy if exists device_playlists_update_owner on public.device_playlists;
create policy device_playlists_update_owner on public.device_playlists
  for update using (
    exists (
      select 1 from public.devices d
      where d.id = device_id and d.owner_id = auth.uid()
    )
  );

drop policy if exists device_playlists_delete_owner on public.device_playlists;
create policy device_playlists_delete_owner on public.device_playlists
  for delete using (
    exists (
      select 1 from public.devices d
      where d.id = device_id and d.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.devices;
alter publication supabase_realtime add table public.playlists;
alter publication supabase_realtime add table public.playlist_items;
alter publication supabase_realtime add table public.media;
alter publication supabase_realtime add table public.device_playlists;

-- ---------------------------------------------------------------------------
-- Helpful RPC: link device from dashboard (validates code + unclaimed)
-- ---------------------------------------------------------------------------
create or replace function public.link_device_by_pairing_code(p_code text, p_name text default null)
returns public.devices
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.devices;
begin
  if p_code !~ '^[0-9]{6}$' then
    raise exception 'invalid_pairing_code';
  end if;

  update public.devices d
  set
    owner_id = auth.uid(),
    name = coalesce(nullif(trim(p_name), ''), d.name),
    status = 'pending_pairing'
  where d.pairing_code = p_code
    and d.owner_id is null
  returning * into strict result;

  return result;
exception
  when no_data_found then
    raise exception 'device_not_found_or_already_linked';
end;
$$;

grant execute on function public.link_device_by_pairing_code(text, text) to authenticated;
