create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.device_commands (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.plan_runs(id) on delete cascade,
  run_step_id uuid not null references public.plan_run_steps(id) on delete cascade,
  plan_id uuid not null references public.irrigation_plans(id) on delete cascade,
  zone_id uuid references public.field_zones(id) on delete set null,
  device_id text not null references public.irrigation_devices(id) on delete cascade,
  action text not null check (action in ('open', 'close', 'stop', 'status')),
  station_index integer not null,
  duration_seconds integer,
  status text not null default 'pending' check (status in ('pending', 'sent', 'acked', 'failed', 'timeout', 'cancelled')),
  idempotency_key text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  deadline_at timestamptz,
  sent_at timestamptz,
  acked_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ux_device_commands_idempotency_key on public.device_commands(idempotency_key);
create index if not exists idx_device_commands_run_id on public.device_commands(run_id);
create index if not exists idx_device_commands_step_status on public.device_commands(run_step_id, status);
create index if not exists idx_device_commands_pending on public.device_commands(status, created_at);

create table if not exists public.device_events (
  id uuid primary key default gen_random_uuid(),
  command_id uuid references public.device_commands(id) on delete set null,
  run_id uuid references public.plan_runs(id) on delete set null,
  run_step_id uuid references public.plan_run_steps(id) on delete set null,
  plan_id uuid references public.irrigation_plans(id) on delete set null,
  device_id text not null references public.irrigation_devices(id) on delete cascade,
  event_type text not null check (event_type in ('command_ack', 'command_nack', 'status_update', 'timeout', 'control_requested', 'control_applied')),
  source text not null default 'mqtt-gateway' check (source in ('mqtt-gateway', 'execution-service', 'system', 'manual')),
  station_index integer,
  success boolean,
  correlation_key text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_device_events_run_step on public.device_events(run_step_id, created_at desc);
create index if not exists idx_device_events_command_id on public.device_events(command_id);
create index if not exists idx_device_events_device on public.device_events(device_id, created_at desc);
create unique index if not exists ux_device_events_correlation_key on public.device_events(correlation_key) where correlation_key is not null;

create table if not exists public.plan_control_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.plan_runs(id) on delete cascade,
  plan_id uuid references public.irrigation_plans(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('start', 'pause', 'resume', 'stop', 'cancel')),
  source text not null default 'api' check (source in ('api', 'system', 'scheduler', 'manual')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_plan_control_events_plan_created on public.plan_control_events(plan_id, created_at desc);
create index if not exists idx_plan_control_events_run_created on public.plan_control_events(run_id, created_at desc);

create table if not exists public.plan_schedule_jobs (
  plan_id uuid primary key references public.irrigation_plans(id) on delete cascade,
  cron_job_id bigint,
  cron_key text not null,
  timezone text not null default 'UTC',
  cron_expression text not null,
  next_run_at timestamptz,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists ux_plan_schedule_jobs_cron_key on public.plan_schedule_jobs(cron_key);

alter table public.plan_run_steps
  add column if not exists timeout_job_id bigint,
  add column if not exists timeout_at timestamptz;

alter table public.plan_runs
  add column if not exists scheduled_for timestamptz,
  add column if not exists dedupe_key text;

create unique index if not exists ux_plan_runs_dedupe_key on public.plan_runs(dedupe_key) where dedupe_key is not null;

drop trigger if exists set_device_commands_updated_at on public.device_commands;
create trigger set_device_commands_updated_at
before update on public.device_commands
for each row execute function public.set_updated_at();

drop trigger if exists set_plan_schedule_jobs_updated_at on public.plan_schedule_jobs;
create trigger set_plan_schedule_jobs_updated_at
before update on public.plan_schedule_jobs
for each row execute function public.set_updated_at();

alter table public.device_commands enable row level security;
alter table public.device_events enable row level security;
alter table public.plan_control_events enable row level security;
alter table public.plan_schedule_jobs enable row level security;

drop policy if exists "device_commands_by_run_owner" on public.device_commands;
create policy "device_commands_by_run_owner"
on public.device_commands
for all
using (
  exists (
    select 1
    from public.plan_runs pr
    where pr.id = device_commands.run_id
      and pr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.plan_runs pr
    where pr.id = device_commands.run_id
      and pr.user_id = auth.uid()
  )
);

drop policy if exists "device_events_by_run_owner" on public.device_events;
create policy "device_events_by_run_owner"
on public.device_events
for select
using (
  exists (
    select 1
    from public.plan_runs pr
    where pr.id = device_events.run_id
      and pr.user_id = auth.uid()
  )
);

drop policy if exists "plan_control_events_by_owner" on public.plan_control_events;
create policy "plan_control_events_by_owner"
on public.plan_control_events
for select
using (
  exists (
    select 1
    from public.plan_runs pr
    where pr.id = plan_control_events.run_id
      and pr.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.irrigation_plans p
    where p.id = plan_control_events.plan_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "plan_schedule_jobs_by_owner" on public.plan_schedule_jobs;
create policy "plan_schedule_jobs_by_owner"
on public.plan_schedule_jobs
for select
using (
  exists (
    select 1
    from public.irrigation_plans p
    where p.id = plan_schedule_jobs.plan_id
      and p.user_id = auth.uid()
  )
);

create or replace function public.safe_unschedule(job_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if job_id is null then
    return;
  end if;
  perform cron.unschedule(job_id);
exception
  when others then
    -- ignore stale/missing cron jobs to keep schema updates idempotent
    return;
end;
$$;

create or replace function public.compute_plan_next_run_at(
  p_plan_id uuid,
  p_timezone text default 'UTC',
  p_from timestamptz default timezone('utc', now())
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.irrigation_plans%rowtype;
  v_tz text := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  v_base_local timestamp;
  v_target_local timestamp;
  v_candidate timestamptz;
  v_weekday int;
  v_next_weekday int;
  v_days_ahead int;
  v_interval int;
begin
  select * into v_plan from public.irrigation_plans where id = p_plan_id;
  if not found then
    return null;
  end if;

  v_base_local := p_from at time zone v_tz;
  v_target_local := date_trunc('day', v_base_local) + v_plan.start_at;
  v_weekday := extract(isodow from v_base_local);

  if v_plan.schedule_type = 'daily' then
    if v_target_local <= v_base_local then
      v_target_local := v_target_local + interval '1 day';
    end if;
    return v_target_local at time zone v_tz;
  end if;

  if v_plan.schedule_type = 'weekly' then
    select min(day_value)
    into v_next_weekday
    from (
      select cast(value as int) as day_value
      from jsonb_array_elements_text(coalesce(v_plan.weekdays, '[]'::jsonb)) as value
      where cast(value as int) between 1 and 7
    ) t
    where day_value > v_weekday
       or (day_value = v_weekday and v_target_local > v_base_local);

    if v_next_weekday is null then
      select min(cast(value as int))
      into v_next_weekday
      from jsonb_array_elements_text(coalesce(v_plan.weekdays, '[]'::jsonb)) as value
      where cast(value as int) between 1 and 7;
    end if;

    if v_next_weekday is null then
      v_next_weekday := v_weekday;
    end if;

    v_days_ahead := (v_next_weekday - v_weekday + 7) % 7;
    if v_days_ahead = 0 and v_target_local <= v_base_local then
      v_days_ahead := 7;
    end if;
    return (v_target_local + make_interval(days => v_days_ahead)) at time zone v_tz;
  end if;

  v_interval := greatest(coalesce(v_plan.interval_days, 1), 1);
  while v_target_local <= v_base_local loop
    v_target_local := v_target_local + make_interval(days => v_interval);
  end loop;
  v_candidate := v_target_local at time zone v_tz;
  return v_candidate;
end;
$$;

create or replace function public.sync_plan_schedule_job(
  p_plan_id uuid,
  p_api_base_url text,
  p_auth_token text,
  p_timezone text default 'UTC'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.irrigation_plans%rowtype;
  v_expr text;
  v_job_id bigint;
  v_old_job_id bigint;
  v_url text;
  v_tz text;
  v_job_name text;
  v_next_run_at timestamptz;
  v_local_base_ts timestamp;
  v_utc_base_ts timestamp;
  v_utc_hour int;
  v_utc_minute int;
  v_weekday_shift int;
begin
  select * into v_plan from public.irrigation_plans where id = p_plan_id;
  if not found then
    raise exception 'plan % not found', p_plan_id;
  end if;

  v_tz := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  v_job_name := 'plan_' || replace(p_plan_id::text, '-', '_');
  select public.compute_plan_next_run_at(p_plan_id, v_tz, timezone('utc', now()))
  into v_next_run_at;

  v_local_base_ts := date_trunc('day', timezone(v_tz, now())) + v_plan.start_at;
  v_utc_base_ts := timezone('UTC', v_local_base_ts at time zone v_tz);
  v_utc_hour := extract(hour from v_utc_base_ts)::int;
  v_utc_minute := extract(minute from v_utc_base_ts)::int;
  v_weekday_shift := (v_utc_base_ts::date - v_local_base_ts::date);

  if not v_plan.enabled or v_plan.mode <> 'auto' then
    select cron_job_id into v_old_job_id
    from public.plan_schedule_jobs
    where plan_id = p_plan_id;
    perform public.safe_unschedule(v_old_job_id);
    delete from public.plan_schedule_jobs where plan_id = p_plan_id;
    return null;
  end if;

  if v_plan.schedule_type = 'daily' then
    v_expr := format('%s %s * * *', v_utc_minute, v_utc_hour);
  elsif v_plan.schedule_type = 'weekly' then
    v_expr := format('%s %s * * %s',
      v_utc_minute,
      v_utc_hour,
      coalesce((
        select string_agg(
          case
            when shifted_day = 7 then '0'
            else shifted_day::text
          end,
          ','
          order by shifted_day
        )
        from (
          select (((cast(value as int) - 1 + v_weekday_shift + 7) % 7) + 1) as shifted_day
          from jsonb_array_elements_text(coalesce(v_plan.weekdays, '[]'::jsonb)) as value
          where cast(value as int) between 1 and 7
        ) shifted_days
      ), '0')
    );
  else
    v_expr := format('%s %s */%s * *',
      v_utc_minute,
      v_utc_hour,
      greatest(coalesce(v_plan.interval_days, 1), 1)
    );
  end if;

  select cron_job_id into v_old_job_id
  from public.plan_schedule_jobs
  where plan_id = p_plan_id;
  perform public.safe_unschedule(v_old_job_id);

  v_url := trim(trailing '/' from p_api_base_url) || '/internal/plans/' || p_plan_id::text || '/dispatch';
  select cron.schedule(
    v_job_name,
    v_expr,
    format(
      $cmd$
      select net.http_post(
        url:='%s',
        headers:='{"content-type":"application/json","x-internal-token":"%s"}'::jsonb,
        body:='{"trigger":"schedule"}'::jsonb,
        timeout_milliseconds:=10000
      );
      $cmd$,
      v_url,
      replace(p_auth_token, '"', '')
    )
  ) into v_job_id;

  insert into public.plan_schedule_jobs (
    plan_id,
    cron_job_id,
    cron_key,
    timezone,
    cron_expression,
    next_run_at,
    enabled,
    metadata
  )
  values (
    p_plan_id,
    v_job_id,
    v_job_name,
    v_tz,
    v_expr,
    v_next_run_at,
    true,
    jsonb_build_object('schedule_type', v_plan.schedule_type)
  )
  on conflict (plan_id) do update set
    cron_job_id = excluded.cron_job_id,
    cron_key = excluded.cron_key,
    timezone = excluded.timezone,
    cron_expression = excluded.cron_expression,
    next_run_at = excluded.next_run_at,
    enabled = excluded.enabled,
    metadata = excluded.metadata,
    updated_at = timezone('utc', now());

  return v_job_id;
end;
$$;

create or replace function public.unsync_plan_schedule_job(p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id bigint;
begin
  select cron_job_id into v_job_id
  from public.plan_schedule_jobs
  where plan_id = p_plan_id;

  perform public.safe_unschedule(v_job_id);
  delete from public.plan_schedule_jobs where plan_id = p_plan_id;
end;
$$;

create or replace function public.schedule_step_timeout_job(
  p_step_id uuid,
  p_timeout_at timestamptz,
  p_api_base_url text,
  p_auth_token text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step public.plan_run_steps%rowtype;
  v_timeout_at timestamptz;
  v_job_id bigint;
  v_job_name text;
  v_expr text;
  v_old_job_id bigint;
  v_url text;
begin
  select * into v_step from public.plan_run_steps where id = p_step_id;
  if not found then
    raise exception 'step % not found', p_step_id;
  end if;

  v_timeout_at := coalesce(p_timeout_at, timezone('utc', now()) + interval '1 minute');
  v_job_name := 'step_timeout_' || replace(p_step_id::text, '-', '_');
  v_expr := format(
    '%s %s %s %s *',
    extract(minute from v_timeout_at)::int,
    extract(hour from v_timeout_at)::int,
    extract(day from v_timeout_at)::int,
    extract(month from v_timeout_at)::int
  );

  v_old_job_id := v_step.timeout_job_id;
  perform public.safe_unschedule(v_old_job_id);

  v_url := trim(trailing '/' from p_api_base_url) || '/internal/steps/' || p_step_id::text || '/timeout';
  select cron.schedule(
    v_job_name,
    v_expr,
    format(
      $cmd$
      select net.http_post(
        url:='%s',
        headers:='{"content-type":"application/json","x-internal-token":"%s"}'::jsonb,
        body:='{"reason":"timeout_job"}'::jsonb,
        timeout_milliseconds:=10000
      );
      $cmd$,
      v_url,
      replace(p_auth_token, '"', '')
    )
  ) into v_job_id;

  update public.plan_run_steps
  set timeout_job_id = v_job_id,
      timeout_at = v_timeout_at,
      updated_at = timezone('utc', now())
  where id = p_step_id;

  return v_job_id;
end;
$$;

create or replace function public.cancel_step_timeout_job(p_step_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id bigint;
begin
  select timeout_job_id into v_job_id from public.plan_run_steps where id = p_step_id;
  perform public.safe_unschedule(v_job_id);
  update public.plan_run_steps
  set timeout_job_id = null,
      timeout_at = null,
      updated_at = timezone('utc', now())
  where id = p_step_id;
end;
$$;

create or replace function public.cleanup_orphan_plan_schedule_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer := 0;
  row_item record;
begin
  for row_item in
    select psj.plan_id, psj.cron_job_id
    from public.plan_schedule_jobs psj
    left join public.irrigation_plans p on p.id = psj.plan_id
    where p.id is null
       or p.enabled = false
       or p.mode <> 'auto'
  loop
    perform public.safe_unschedule(row_item.cron_job_id);
    delete from public.plan_schedule_jobs where plan_id = row_item.plan_id;
    removed_count := removed_count + 1;
  end loop;
  return removed_count;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.plan_runs;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.plan_run_steps;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.device_events;
exception when duplicate_object then null;
end $$;

