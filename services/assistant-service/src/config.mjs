function required(name, fallback = '') {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig() {
  return {
    host: process.env.ASSISTANT_SERVICE_HOST ?? process.env.HOST ?? '127.0.0.1',
    port: Number(process.env.ASSISTANT_SERVICE_PORT ?? process.env.PORT ?? 4311),
    supabaseUrl: required('SUPABASE_URL', 'http://127.0.0.1:54321'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY', 'dev-placeholder'),
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-placeholder',
    sessionTtlHours: Number(process.env.MINI_SESSION_TTL_HOURS ?? 24),
    authUpstreamTimeoutMs: Number(process.env.MINI_AUTH_UPSTREAM_TIMEOUT_MS ?? 8000),
    difyBaseUrl: process.env.DIFY_BASE_URL ?? 'https://dify.hyecosmart.com/v1',
    difyApiKey: process.env.DIFY_API_KEY ?? '',
    serviceName: 'assistant-service',
  };
}
