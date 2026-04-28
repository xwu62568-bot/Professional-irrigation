create table if not exists public.plan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.irrigation_plans(id) on delete cascade,
  field_id uuid references public.fields(id) on delete set null,
  status text not null check (status in ('pending', 'running', 'success', 'failed', 'cancel_requested', 'cancelled')),
  trigger_type text not null default 'manual' check (trigger_type in ('manual', 'schedule', 'retry', 'api')),
  current_zone_id uuid references public.field_zones(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.plan_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.plan_runs(id) on delete cascade,
  zone_id uuid references public.field_zones(id) on delete set null,
  zone_name text not null,
  site_number integer,
  sort_order integer not null,
  status text not null check (status in ('pending', 'running', 'success', 'failed', 'cancelled', 'skipped')),
  target_duration_minutes integer not null default 0,
  actual_duration_minutes integer,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.device_command_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.plan_runs(id) on delete set null,
  run_step_id uuid references public.plan_run_steps(id) on delete set null,
  device_id text references public.irrigation_devices(id) on delete set null,
  command_type text not null check (command_type in ('open', 'close', 'stop', 'status')),
  transport text not null default 'mqtt' check (transport in ('mqtt', 'http', 'mock')),
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'sent', 'acked', 'failed', 'timeout', 'cancelled')),
  correlation_id text,
  sent_at timestamptz,
  acked_at timestamptz,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_plan_runs_user_id on public.plan_runs(user_id);
create index if not exists idx_plan_runs_plan_id on public.plan_runs(plan_id);
create index if not exists idx_plan_runs_status on public.plan_runs(status);
create index if not exists idx_plan_run_steps_run_id on public.plan_run_steps(run_id);
create index if not exists idx_plan_run_steps_zone_id on public.plan_run_steps(zone_id);
create index if not exists idx_device_command_logs_run_id on public.device_command_logs(run_id);
create index if not exists idx_device_command_logs_run_step_id on public.device_command_logs(run_step_id);
create index if not exists idx_device_command_logs_device_id on public.device_command_logs(device_id);

create trigger set_plan_runs_updated_at
before update on public.plan_runs
for each row execute function public.set_updated_at();

create trigger set_plan_run_steps_updated_at
before update on public.plan_run_steps
for each row execute function public.set_updated_at();

create trigger set_device_command_logs_updated_at
before update on public.device_command_logs
for each row execute function public.set_updated_at();

alter table public.plan_runs enable row level security;
alter table public.plan_run_steps enable row level security;
alter table public.device_command_logs enable row level security;

create policy "plan_runs_own_all"
on public.plan_runs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "plan_run_steps_by_run_owner"
on public.plan_run_steps
for all
using (
  exists (
    select 1
    from public.plan_runs pr
    where pr.id = plan_run_steps.run_id
      and pr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.plan_runs pr
    where pr.id = plan_run_steps.run_id
      and pr.user_id = auth.uid()
  )
);

create policy "device_command_logs_by_run_owner"
on public.device_command_logs
for all
using (
  exists (
    select 1
    from public.plan_runs pr
    where pr.id = device_command_logs.run_id
      and pr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.plan_runs pr
    where pr.id = device_command_logs.run_id
      and pr.user_id = auth.uid()
  )
);
