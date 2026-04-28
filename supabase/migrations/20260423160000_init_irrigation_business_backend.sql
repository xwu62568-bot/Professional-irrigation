create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  code text not null,
  crop_type text not null,
  growth_stage text not null,
  area_mu numeric(10,2) not null default 0,
  soil_type text,
  irrigation_efficiency numeric(5,2) not null default 0.85,
  center_lat numeric(10,6),
  center_lng numeric(10,6),
  boundary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint fields_code_user_unique unique (user_id, code)
);

create table if not exists public.field_zones (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  name text not null,
  site_number integer not null,
  area_mu numeric(10,2),
  design_flow_rate numeric(10,2),
  priority integer not null default 1,
  boundary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_zones_field_site_unique unique (field_id, site_number)
);

create table if not exists public.irrigation_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  name text not null,
  schedule_type text not null check (schedule_type in ('daily', 'weekly', 'interval')),
  weekdays jsonb not null default '[]'::jsonb,
  interval_days integer,
  start_at time not null,
  enabled boolean not null default true,
  skip_if_rain boolean not null default true,
  mode text not null check (mode in ('manual', 'semi_auto', 'auto')),
  execution_mode text not null check (execution_mode in ('duration', 'quota')),
  target_water_m3_per_mu numeric(10,2),
  flow_rate_m3h numeric(10,2),
  irrigation_efficiency numeric(5,2),
  max_duration_minutes integer,
  split_rounds boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.irrigation_plan_zones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.irrigation_plans(id) on delete cascade,
  zone_id uuid references public.field_zones(id) on delete set null,
  zone_name text,
  site_number integer not null,
  sort_order integer not null default 1,
  duration_minutes integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.automation_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  name text not null,
  type text not null check (type in ('threshold', 'etc')),
  enabled boolean not null default true,
  scope text not null default 'field' check (scope in ('field', 'zones')),
  zone_ids jsonb not null default '[]'::jsonb,
  moisture_min numeric(6,2),
  moisture_recover numeric(6,2),
  etc_trigger_mm numeric(8,2),
  target_water_m3_per_mu numeric(10,2),
  flow_rate_m3h numeric(10,2),
  irrigation_efficiency numeric(5,2),
  effective_rainfall_ratio numeric(5,2),
  replenish_ratio numeric(5,2),
  execution_mode text not null check (execution_mode in ('duration', 'quota', 'etc')),
  min_interval_hours integer,
  max_duration_minutes integer,
  split_rounds boolean not null default false,
  rain_lock_enabled boolean not null default true,
  mode text not null check (mode in ('advisory', 'semi_auto', 'auto')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.field_et_configs (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null unique references public.fields(id) on delete cascade,
  kc_default numeric(6,3) not null default 0.80,
  crop_type text,
  growth_stage text,
  latitude numeric(10,6),
  longitude numeric(10,6),
  station_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.field_et_daily (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  date date not null,
  et0 numeric(8,2) not null default 0,
  kc numeric(8,3) not null default 0,
  etc numeric(8,2) not null default 0,
  rainfall_mm numeric(8,2) not null default 0,
  effective_rainfall_mm numeric(8,2) not null default 0,
  net_irrigation_need_mm numeric(8,2) not null default 0,
  source text not null default 'manual',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint field_et_daily_field_date_unique unique (field_id, date)
);

create index if not exists idx_fields_user_id on public.fields(user_id);
create index if not exists idx_field_zones_field_id on public.field_zones(field_id);
create index if not exists idx_irrigation_plans_user_id on public.irrigation_plans(user_id);
create index if not exists idx_irrigation_plans_field_id on public.irrigation_plans(field_id);
create index if not exists idx_irrigation_plan_zones_plan_id on public.irrigation_plan_zones(plan_id);
create index if not exists idx_automation_strategies_user_id on public.automation_strategies(user_id);
create index if not exists idx_automation_strategies_field_id on public.automation_strategies(field_id);
create index if not exists idx_field_et_daily_field_id on public.field_et_daily(field_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_fields_updated_at
before update on public.fields
for each row execute function public.set_updated_at();

create trigger set_field_zones_updated_at
before update on public.field_zones
for each row execute function public.set_updated_at();

create trigger set_irrigation_plans_updated_at
before update on public.irrigation_plans
for each row execute function public.set_updated_at();

create trigger set_irrigation_plan_zones_updated_at
before update on public.irrigation_plan_zones
for each row execute function public.set_updated_at();

create trigger set_automation_strategies_updated_at
before update on public.automation_strategies
for each row execute function public.set_updated_at();

create trigger set_field_et_configs_updated_at
before update on public.field_et_configs
for each row execute function public.set_updated_at();

create trigger set_field_et_daily_updated_at
before update on public.field_et_daily
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.fields enable row level security;
alter table public.field_zones enable row level security;
alter table public.irrigation_plans enable row level security;
alter table public.irrigation_plan_zones enable row level security;
alter table public.automation_strategies enable row level security;
alter table public.field_et_configs enable row level security;
alter table public.field_et_daily enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "fields_own_all"
on public.fields
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "field_zones_by_field_owner"
on public.field_zones
for all
using (
  exists (
    select 1
    from public.fields f
    where f.id = field_zones.field_id
      and f.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.fields f
    where f.id = field_zones.field_id
      and f.user_id = auth.uid()
  )
);

create policy "plans_own_all"
on public.irrigation_plans
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "plan_zones_by_plan_owner"
on public.irrigation_plan_zones
for all
using (
  exists (
    select 1
    from public.irrigation_plans p
    where p.id = irrigation_plan_zones.plan_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.irrigation_plans p
    where p.id = irrigation_plan_zones.plan_id
      and p.user_id = auth.uid()
  )
);

create policy "strategies_own_all"
on public.automation_strategies
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "field_et_configs_by_field_owner"
on public.field_et_configs
for all
using (
  exists (
    select 1
    from public.fields f
    where f.id = field_et_configs.field_id
      and f.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.fields f
    where f.id = field_et_configs.field_id
      and f.user_id = auth.uid()
  )
);

create policy "field_et_daily_by_field_owner"
on public.field_et_daily
for all
using (
  exists (
    select 1
    from public.fields f
    where f.id = field_et_daily.field_id
      and f.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.fields f
    where f.id = field_et_daily.field_id
      and f.user_id = auth.uid()
  )
);

create or replace view public.field_summary_view as
select
  f.id,
  f.user_id,
  f.name,
  f.code,
  f.crop_type,
  f.growth_stage,
  f.area_mu,
  f.soil_type,
  f.irrigation_efficiency,
  f.center_lat,
  f.center_lng,
  f.boundary,
  coalesce(z.zone_count, 0) as zone_count,
  etd.et0,
  etd.kc,
  etd.etc,
  etd.rainfall_mm,
  etd.effective_rainfall_mm,
  etd.net_irrigation_need_mm,
  etd.date as et_date
from public.fields f
left join (
  select field_id, count(*) as zone_count
  from public.field_zones
  group by field_id
) z on z.field_id = f.id
left join lateral (
  select *
  from public.field_et_daily etd
  where etd.field_id = f.id
  order by etd.date desc
  limit 1
) etd on true;

create or replace view public.dashboard_overview_view as
select
  p.id as user_id,
  count(distinct f.id) as total_fields,
  count(distinct pl.id) as total_plans,
  count(distinct s.id) as total_strategies,
  coalesce(avg(etd.et0), 0) as average_et0,
  coalesce(avg(etd.etc), 0) as average_etc
from public.profiles p
left join public.fields f on f.user_id = p.id
left join public.irrigation_plans pl on pl.user_id = p.id and pl.enabled = true
left join public.automation_strategies s on s.user_id = p.id and s.enabled = true
left join (
  select distinct on (field_id)
    field_id,
    et0,
    etc
  from public.field_et_daily
  order by field_id, date desc
) etd on etd.field_id = f.id
group by p.id;

create or replace function public.recalculate_field_et(p_field_id uuid, p_date date default current_date)
returns public.field_et_daily
language plpgsql
security definer
set search_path = public
as $$
declare
  v_field public.fields%rowtype;
  v_config public.field_et_configs%rowtype;
  v_kc numeric(8,3);
  v_et0 numeric(8,2);
  v_rainfall numeric(8,2);
  v_effective_rainfall numeric(8,2);
  v_net_need numeric(8,2);
  v_row public.field_et_daily%rowtype;
begin
  select *
  into v_field
  from public.fields
  where id = p_field_id;

  if not found then
    raise exception 'field % not found', p_field_id;
  end if;

  if v_field.user_id <> auth.uid() then
    raise exception 'not allowed';
  end if;

  select *
  into v_config
  from public.field_et_configs
  where field_id = p_field_id;

  v_kc := coalesce(v_config.kc_default, 0.80);
  v_et0 := 4.20;
  v_rainfall := 0;
  v_effective_rainfall := round(v_rainfall * 0.80, 2);
  v_net_need := round(greatest((v_et0 * v_kc) - v_effective_rainfall, 0), 2);

  insert into public.field_et_daily (
    field_id,
    date,
    et0,
    kc,
    etc,
    rainfall_mm,
    effective_rainfall_mm,
    net_irrigation_need_mm,
    source
  )
  values (
    p_field_id,
    p_date,
    v_et0,
    v_kc,
    round(v_et0 * v_kc, 2),
    v_rainfall,
    v_effective_rainfall,
    v_net_need,
    'manual_recalc'
  )
  on conflict (field_id, date)
  do update set
    et0 = excluded.et0,
    kc = excluded.kc,
    etc = excluded.etc,
    rainfall_mm = excluded.rainfall_mm,
    effective_rainfall_mm = excluded.effective_rainfall_mm,
    net_irrigation_need_mm = excluded.net_irrigation_need_mm,
    source = excluded.source,
    updated_at = timezone('utc', now())
  returning *
  into v_row;

  return v_row;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.fields to authenticated;
grant select, insert, update, delete on public.field_zones to authenticated;
grant select, insert, update, delete on public.irrigation_plans to authenticated;
grant select, insert, update, delete on public.irrigation_plan_zones to authenticated;
grant select, insert, update, delete on public.automation_strategies to authenticated;
grant select, insert, update, delete on public.field_et_configs to authenticated;
grant select, insert, update, delete on public.field_et_daily to authenticated;
grant select on public.field_summary_view to authenticated;
grant select on public.dashboard_overview_view to authenticated;
grant execute on function public.recalculate_field_et(uuid, date) to authenticated;

