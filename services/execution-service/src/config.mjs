function required(name, fallback = '') {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig() {
  return {
    host: process.env.HOST ?? '127.0.0.1',
    port: Number(process.env.PORT ?? 4310),
    mqttGatewayBaseUrl: process.env.MQTT_GATEWAY_BASE_URL ?? 'http://127.0.0.1:4320',
    supabaseUrl: required('SUPABASE_URL', 'http://127.0.0.1:54321'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', 'dev-placeholder'),
    durationScale: Number(process.env.EXECUTION_DURATION_SCALE ?? 1),
    statusPollMs: Number(process.env.EXECUTION_STATUS_POLL_MS ?? 2000),
    schedulerEnabled: process.env.EXECUTION_SCHEDULER_ENABLED === 'true',
    schedulerPollMs: Number(process.env.EXECUTION_SCHEDULER_POLL_MS ?? 30000),
    serviceName: 'execution-service',
  };
}
