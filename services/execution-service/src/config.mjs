function required(name, fallback = '') {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig() {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 4310);
  return {
    host,
    port,
    mqttGatewayBaseUrl: process.env.MQTT_GATEWAY_BASE_URL ?? 'http://127.0.0.1:4320',
    assistantServiceBaseUrl: process.env.ASSISTANT_SERVICE_BASE_URL ?? 'http://127.0.0.1:4311',
    wifiDemoDeviceId: process.env.WIFI_DEMO_DEVICE_ID ?? '',
    supabaseUrl: required('SUPABASE_URL', 'http://127.0.0.1:54321'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', 'dev-placeholder'),
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-placeholder',
    sessionTtlHours: Number(process.env.MINI_SESSION_TTL_HOURS ?? 24),
    authUpstreamTimeoutMs: Number(process.env.MINI_AUTH_UPSTREAM_TIMEOUT_MS ?? 8000),
    durationScale: Number(process.env.EXECUTION_DURATION_SCALE ?? 1),
    statusPollMs: Number(process.env.EXECUTION_STATUS_POLL_MS ?? 2000),
    schedulerEnabled: process.env.EXECUTION_SCHEDULER_ENABLED === 'true',
    schedulerPollMs: Number(process.env.EXECUTION_SCHEDULER_POLL_MS ?? 30000),
    engineMode: process.env.EXECUTION_ENGINE_MODE ?? 'event_driven',
    internalAuthToken: process.env.EXECUTION_INTERNAL_TOKEN ?? '',
    internalApiBaseUrl: process.env.EXECUTION_INTERNAL_API_BASE_URL ?? `http://${host}:${port}`,
    projectTimezone: process.env.EXECUTION_PROJECT_TIMEZONE ?? 'Asia/Shanghai',
    commandRetryMs: Number(process.env.EXECUTION_COMMAND_RETRY_MS ?? 3000),
    commandDeadlineMs: Number(process.env.EXECUTION_COMMAND_DEADLINE_MS ?? 15000),
    commandMaxAttempts: Number(process.env.EXECUTION_COMMAND_MAX_ATTEMPTS ?? 3),
    ackSignatureSecret: process.env.EXECUTION_ACK_SIGNATURE_SECRET ?? '',
    ackSignatureSkewMs: Number(process.env.EXECUTION_ACK_SIGNATURE_SKEW_MS ?? 300000),
    reconcileEnabled: process.env.EXECUTION_RECONCILE_ENABLED === 'true',
    reconcileMs: Number(process.env.EXECUTION_RECONCILE_MS ?? 1800000),
    rolloutMode: process.env.EXECUTION_ENGINE_ROLLOUT_MODE ?? 'full',
    canaryPlanIds: process.env.EXECUTION_ENGINE_CANARY_PLAN_IDS ?? '',
    rolloutAutoRollbackEnabled: process.env.EXECUTION_ROLLOUT_AUTO_ROLLBACK_ENABLED === 'true',
    rolloutWindowMinutes: Number(process.env.EXECUTION_ROLLOUT_WINDOW_MINUTES ?? 30),
    rolloutMinSamples: Number(process.env.EXECUTION_ROLLOUT_MIN_SAMPLES ?? 10),
    rolloutFailRateThreshold: Number(process.env.EXECUTION_ROLLOUT_FAIL_RATE_THRESHOLD ?? 0.3),
    sloDispatchSuccessRate: Number(process.env.EXECUTION_SLO_DISPATCH_SUCCESS_RATE ?? 0.99),
    sloAckSuccessRate: Number(process.env.EXECUTION_SLO_ACK_SUCCESS_RATE ?? 0.98),
    sloTimeoutRate: Number(process.env.EXECUTION_SLO_TIMEOUT_RATE ?? 0.02),
    alertCooldownMs: Number(process.env.EXECUTION_ALERT_COOLDOWN_MS ?? 300000),
    serviceName: 'execution-service',
  };
}
