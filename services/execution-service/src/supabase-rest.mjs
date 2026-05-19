function headers(config, extra = {}) {
  return {
    apikey: config.supabaseServiceRoleKey,
    authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    'content-type': 'application/json',
    ...extra,
  };
}

function errorDetails(error) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const cause = error.cause && typeof error.cause === 'object'
    ? {
        message: 'message' in error.cause ? String(error.cause.message) : undefined,
        code: 'code' in error.cause ? String(error.cause.code) : undefined,
        host: 'host' in error.cause ? String(error.cause.host) : undefined,
        port: 'port' in error.cause ? String(error.cause.port) : undefined,
      }
    : undefined;

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause,
  };
}

async function request(config, path, options = {}) {
  const url = `${config.supabaseUrl}/rest/v1/${path}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: headers(config, options.headers),
    });
  } catch (error) {
    console.error('[execution-service] supabase request failed', {
      url,
      method: options.method ?? 'GET',
      details: errorDetails(error),
    });
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function createMiniSession(config, payload) {
  const rows = await request(config, 'mini_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

export async function fetchMiniSessionByToken(config, token) {
  const rows = await request(
    config,
    `mini_sessions?token=eq.${encodeURIComponent(token)}&select=*`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

export async function deleteMiniSessionByToken(config, token) {
  await request(config, `mini_sessions?token=eq.${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

export async function fetchPlan(config, planId) {
  const rows = await request(
    config,
    `irrigation_plans?id=eq.${encodeURIComponent(planId)}&select=id,user_id,field_id,name,schedule_type,weekdays,interval_days,start_at,enabled,mode,execution_mode,created_at`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

export async function createIrrigationPlan(config, payload) {
  const rows = await request(config, 'irrigation_plans', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

export async function updateIrrigationPlan(config, planId, payload) {
  const rows = await request(config, `irrigation_plans?id=eq.${encodeURIComponent(planId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

export async function deletePlanZonesForPlan(config, planId) {
  await request(config, `irrigation_plan_zones?plan_id=eq.${encodeURIComponent(planId)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

export async function insertPlanZones(config, payload) {
  return request(config, 'irrigation_plan_zones', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
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
    `irrigation_devices?id=in.(${encodeURIComponent(joined)})&select=id,client_key,name,type`,
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

export async function fetchRunByDedupeKey(config, dedupeKey) {
  if (!dedupeKey) return null;
  const rows = await request(
    config,
    `plan_runs?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=*`,
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

export async function fetchRunStep(config, stepId) {
  const rows = await request(
    config,
    `plan_run_steps?id=eq.${encodeURIComponent(stepId)}&select=*`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

export async function fetchActiveRunsForPlan(config, planId) {
  if (!planId) {
    return request(
      config,
      `plan_runs?status=in.(pending,running,cancel_requested)&select=id,plan_id,status,created_at,trigger_type`,
      { method: 'GET' },
    );
  }
  return request(
    config,
    `plan_runs?plan_id=eq.${encodeURIComponent(planId)}&status=in.(pending,running,cancel_requested)&select=id,status,created_at,trigger_type`,
    { method: 'GET' },
  );
}

export async function fetchTimedOutRunningSteps(config, nowIsoValue) {
  return request(
    config,
    `plan_run_steps?status=eq.running&timeout_at=lt.${encodeURIComponent(nowIsoValue)}&select=id,run_id,zone_id,timeout_at`,
    { method: 'GET' },
  );
}

export async function fetchRecentRunsByPlanIds(config, planIds, sinceIso, limit = 200) {
  if (!Array.isArray(planIds) || planIds.length === 0) {
    return [];
  }
  const joined = planIds.map((id) => `"${id}"`).join(',');
  return request(
    config,
    `plan_runs?plan_id=in.(${encodeURIComponent(joined)})&created_at=gte.${encodeURIComponent(sinceIso)}&select=id,plan_id,status,created_at&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 1000))}`,
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

export async function createDeviceCommand(config, payload) {
  const rows = await request(config, 'device_commands', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

export async function updateDeviceCommand(config, commandId, payload) {
  const rows = await request(config, `device_commands?id=eq.${encodeURIComponent(commandId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

export async function fetchDeviceCommand(config, commandId) {
  const rows = await request(
    config,
    `device_commands?id=eq.${encodeURIComponent(commandId)}&select=*`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

export async function fetchLatestSentCommand(config, { runStepId, deviceId, stationIndex, action }) {
  const rows = await request(
    config,
    `device_commands?run_step_id=eq.${encodeURIComponent(runStepId)}&device_id=eq.${encodeURIComponent(deviceId)}&station_index=eq.${encodeURIComponent(stationIndex)}&action=eq.${encodeURIComponent(action)}&status=in.(sent,pending)&select=*&order=created_at.desc&limit=1`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

export async function createDeviceEvent(config, payload) {
  const rows = await request(config, 'device_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

export async function createPlanControlEvent(config, payload) {
  const rows = await request(config, 'plan_control_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

export async function listRunStepsByStatus(config, runId, statuses = ['pending']) {
  const normalized = statuses.map((status) => String(status).trim()).filter(Boolean);
  const statusFilter = normalized.length > 0 ? `&status=in.(${normalized.join(',')})` : '';
  return request(
    config,
    `plan_run_steps?run_id=eq.${encodeURIComponent(runId)}${statusFilter}&select=*&order=sort_order.asc`,
    { method: 'GET' },
  );
}

export async function listCommandLogsForStep(config, runStepId) {
  return request(
    config,
    `device_command_logs?run_step_id=eq.${encodeURIComponent(runStepId)}&select=*&order=created_at.desc`,
    { method: 'GET' },
  );
}

export async function fetchRunCommands(config, runId) {
  return request(
    config,
    `device_commands?run_id=eq.${encodeURIComponent(runId)}&select=*&order=created_at.asc`,
    { method: 'GET' },
  );
}

export async function fetchRunEvents(config, runId) {
  return request(
    config,
    `device_events?run_id=eq.${encodeURIComponent(runId)}&select=*&order=created_at.asc`,
    { method: 'GET' },
  );
}

export async function fetchDeviceEventByCorrelation(config, correlationKey) {
  if (!correlationKey) return null;
  const rows = await request(
    config,
    `device_events?correlation_key=eq.${encodeURIComponent(correlationKey)}&select=*&limit=1`,
    { method: 'GET' },
  );
  return rows?.[0] ?? null;
}

export async function upsertPlanScheduleJob(config, { planId, apiBaseUrl, authToken, timezone = 'UTC' }) {
  const rows = await request(config, 'rpc/sync_plan_schedule_job', {
    method: 'POST',
    body: JSON.stringify({
      p_plan_id: planId,
      p_api_base_url: apiBaseUrl,
      p_auth_token: authToken,
      p_timezone: timezone,
    }),
  });
  return rows;
}

export async function removePlanScheduleJob(config, planId) {
  await request(config, 'rpc/unsync_plan_schedule_job', {
    method: 'POST',
    body: JSON.stringify({
      p_plan_id: planId,
    }),
  });
}

export async function scheduleStepTimeoutJob(config, { stepId, timeoutAt }) {
  const rows = await request(config, 'rpc/schedule_step_timeout_job', {
    method: 'POST',
    body: JSON.stringify({
      p_step_id: stepId,
      p_timeout_at: timeoutAt,
      p_api_base_url: config.internalApiBaseUrl,
      p_auth_token: config.internalAuthToken,
    }),
  });
  return rows;
}

export async function cancelStepTimeoutJob(config, stepId) {
  await request(config, 'rpc/cancel_step_timeout_job', {
    method: 'POST',
    body: JSON.stringify({
      p_step_id: stepId,
    }),
  });
}

export async function cleanupOrphanPlanScheduleJobs(config) {
  const rows = await request(config, 'rpc/cleanup_orphan_plan_schedule_jobs', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return Number(rows ?? 0);
}
