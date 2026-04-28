create table if not exists public.irrigation_devices (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_key text not null,
  name text not null,
  model text not null,
  type text not null check (type in ('valve', 'sensor', 'controller', 'pump')),
  status text not null check (status in ('online', 'offline', 'alarm')),
  station_code text,
  stations jsonb not null default '[]'::jsonb,
  field_id uuid references public.fields(id) on delete set null,
  zone_id uuid references public.field_zones(id) on delete set null,
  center_lat numeric(10,6),
  center_lng numeric(10,6),
  signal_strength integer,
  battery_level integer,
  last_seen_label text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint irrigation_devices_user_client_key_unique unique (user_id, client_key)
);

create table if not exists public.zone_device_bindings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  zone_id uuid not null references public.field_zones(id) on delete cascade,
  device_id text not null references public.irrigation_devices(id) on delete cascade,
  station_id text not null,
  station_name text not null,
  lng numeric(10,6),
  lat numeric(10,6),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint zone_device_bindings_zone_device_station_unique unique (zone_id, device_id, station_id)
);

create index if not exists idx_irrigation_devices_user_id on public.irrigation_devices(user_id);
create index if not exists idx_irrigation_devices_field_id on public.irrigation_devices(field_id);
create index if not exists idx_irrigation_devices_zone_id on public.irrigation_devices(zone_id);
create index if not exists idx_zone_device_bindings_user_id on public.zone_device_bindings(user_id);
create index if not exists idx_zone_device_bindings_field_id on public.zone_device_bindings(field_id);
create index if not exists idx_zone_device_bindings_zone_id on public.zone_device_bindings(zone_id);
create index if not exists idx_zone_device_bindings_device_id on public.zone_device_bindings(device_id);

create trigger set_irrigation_devices_updated_at
before update on public.irrigation_devices
for each row execute function public.set_updated_at();

create trigger set_zone_device_bindings_updated_at
before update on public.zone_device_bindings
for each row execute function public.set_updated_at();

alter table public.irrigation_devices enable row level security;
alter table public.zone_device_bindings enable row level security;

create policy "irrigation_devices_own_all"
on public.irrigation_devices
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "zone_device_bindings_own_all"
on public.zone_device_bindings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
