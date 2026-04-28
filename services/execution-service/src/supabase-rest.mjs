function headers(config, extra = {}) {
  return {
    apikey: config.supabaseServiceRoleKey,
    authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    'content-type': 'application/json',
    ...extra,
  };
}

async function request(config, path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: headers(config, options.headers),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function fetchPlan(config, planId) {
  const rows = await request(
    config,
    `irrigation_plans?id=eq.${encodeURIComponent(planId)}&select=id,user_id,field_id,name,schedule_type,weekdays,interval_days,start_at,enabled,mode,execution_mode,created_at`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

export async function fetchSchedulablePlans(config) {
  return request(
    config,
    `irrigation_plans?enabled=eq.true&mode=eq.auto&select=id,user_id,field_id,name,schedule_type,weekdays,interval_days,start_at,enabled,mode,execution_mode,created_at`,
    { method: 'GET' },
  );
}

export async function fetchPlanZones(config, planId) {
  return request(
    config,
    `irrigation_plan_zones?plan_id=eq.${encodeURIComponent(planId)}&enabled=eq.true&select=id,plan_id,zone_id,zone_name,site_number,sort_order,duration_minutes&order=sort_order.asc`,
    { method: 'GET' },
  );
}

export async function fetchZoneBindings(config, zoneIds) {
  if (zoneIds.length === 0) {
    return [];
  }
  const joined = zoneIds.map((id) => `"${id}"`).join(',');
  return request(
    config,
    `zone_device_bindings?zone_id=in.(${encodeURIComponent(joined)})&select=zone_id,device_id,station_id,station_name`,
    { method: 'GET' },
  );
}

export async function fetchDevices(config, deviceIds) {
  if (deviceIds.length === 0) {
    return [];
  }
  const joined = deviceIds.map((id) => `"${id}"`).join(',');
  return request(
    config,
    `irrigation_devices?id=in.(${encodeURIComponent(joined)})&select=id,client_key,name`,
    { method: 'GET' },
  );
}

export async function createPlanRun(config, payload) {
  const rows = await request(config, 'plan_runs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

export async function createPlanRunSteps(config, payload) {
  return request(config, 'plan_run_steps', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
}

export async function updatePlanRun(config, runId, payload) {
  await request(config, `plan_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { Prefer: 'return=minimal' },
  });
}

export async function updatePlanRunStep(config, stepId, payload) {
  await request(config, `plan_run_steps?id=eq.${encodeURIComponent(stepId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { Prefer: 'return=minimal' },
  });
}

export async function insertDeviceCommandLog(config, payload) {
  const rows = await request(config, 'device_command_logs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

export async function fetchRun(config, runId) {
  const rows = await request(
    config,
    `plan_runs?id=eq.${encodeURIComponent(runId)}&select=*`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

export async function fetchRunSteps(config, runId) {
  return request(
    config,
    `plan_run_steps?run_id=eq.${encodeURIComponent(runId)}&select=*&order=sort_order.asc`,
    { method: 'GET' },
  );
}

export async function fetchActiveRunsForPlan(config, planId) {
  return request(
    config,
    `plan_runs?plan_id=eq.${encodeURIComponent(planId)}&status=in.(pending,running,cancel_requested)&select=id,status,created_at,trigger_type`,
    { method: 'GET' },
  );
}

export async function fetchScheduledRunsForWindow(config, planId, windowStartIso, windowEndIso) {
  return request(
    config,
    `plan_runs?plan_id=eq.${encodeURIComponent(planId)}&trigger_type=eq.schedule&created_at=gte.${encodeURIComponent(windowStartIso)}&created_at=lt.${encodeURIComponent(windowEndIso)}&select=id,status,created_at`,
    { method: 'GET' },
  );
}
