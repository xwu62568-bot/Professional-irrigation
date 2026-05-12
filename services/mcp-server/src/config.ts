export interface Config {
  executionBaseUrl: string;
  email: string;
  password: string;
  host?: string;
  port?: number;
  authToken?: string;
  allowedHosts?: string[];
}

function trimEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function loadConfig(): Config {
  const executionBaseUrl = trimEnv('IRRIGATION_EXECUTION_BASE_URL') ?? 'http://127.0.0.1:4310';
  const email = trimEnv('IRRIGATION_MCP_EMAIL');
  const password = trimEnv('IRRIGATION_MCP_PASSWORD');
  const host = trimEnv('MCP_SERVER_HOST') ?? '127.0.0.1';
  const port = Number(trimEnv('MCP_SERVER_PORT') ?? '4330');
  const authToken = trimEnv('MCP_SERVER_AUTH_TOKEN');
  const allowedHosts = (trimEnv('MCP_SERVER_ALLOWED_HOSTS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!email || !password) {
    throw new Error('Missing MCP credentials. Set both IRRIGATION_MCP_EMAIL and IRRIGATION_MCP_PASSWORD.');
  }

  return {
    executionBaseUrl,
    email,
    password,
    host,
    port,
    authToken,
    allowedHosts,
  };
}
