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
