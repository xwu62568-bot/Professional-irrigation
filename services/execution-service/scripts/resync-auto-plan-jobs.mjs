function requiredEnv(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function request(baseUrl, serviceRoleKey, path, init = {}) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${text}`);
  }
  return payload;
}

async function main() {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const internalApiBaseUrl = requiredEnv('EXECUTION_INTERNAL_API_BASE_URL');
  const internalToken = requiredEnv('EXECUTION_INTERNAL_TOKEN');
  const timezone = String(process.env.EXECUTION_PROJECT_TIMEZONE ?? 'Asia/Shanghai').trim() || 'Asia/Shanghai';

  const plans = await request(
    supabaseUrl,
    serviceRoleKey,
    'rest/v1/irrigation_plans?select=id,name,mode,enabled&mode=eq.auto&enabled=eq.true&order=updated_at.desc',
    { method: 'GET' },
  );

  if (!Array.isArray(plans) || plans.length === 0) {
    console.log('[resync-auto-plan-jobs] no enabled auto plans found');
    return;
  }

  console.log(`[resync-auto-plan-jobs] syncing ${plans.length} plan(s) with ${internalApiBaseUrl}`);
  for (const plan of plans) {
    const result = await request(
      supabaseUrl,
      serviceRoleKey,
      'rest/v1/rpc/sync_plan_schedule_job',
      {
        method: 'POST',
        body: JSON.stringify({
          p_plan_id: plan.id,
          p_api_base_url: internalApiBaseUrl,
          p_auth_token: internalToken,
          p_timezone: timezone,
        }),
      },
    );
    console.log(`[resync-auto-plan-jobs] plan=${plan.id} name=${plan.name} job_id=${result}`);
  }
}

main().catch((error) => {
  console.error('[resync-auto-plan-jobs] failed', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
