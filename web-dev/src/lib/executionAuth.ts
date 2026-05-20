import { supabase } from './supabase';

const TOKEN_KEY = 'irrigation_execution_token';

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  code?: string;
};

function executionBaseUrl() {
  const base = import.meta.env.VITE_EXECUTION_SERVICE_URL?.trim();
  if (!base) {
    throw new Error('未配置 VITE_EXECUTION_SERVICE_URL');
  }
  return base.replace(/\/$/, '');
}

export function clearExecutionSession() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function logoutExecutionSession(): Promise<void> {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    clearExecutionSession();
    return;
  }

  try {
    await fetch(`${executionBaseUrl()}/mini/auth/logout`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
  } finally {
    clearExecutionSession();
  }
}

export async function exchangeExecutionSession(): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  const supabaseAccessToken = data.session?.access_token;
  if (!supabaseAccessToken) {
    throw new Error('Supabase 会话无效，请重新登录');
  }

  const response = await fetch(`${executionBaseUrl()}/web/auth/exchange`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${supabaseAccessToken}`,
    },
    body: JSON.stringify({}),
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<{ accessToken: string }>;
  if (!response.ok || !payload.data?.accessToken) {
    throw new Error(payload.error ?? '换取执行服务令牌失败');
  }

  sessionStorage.setItem(TOKEN_KEY, payload.data.accessToken);
  return payload.data.accessToken;
}

export async function ensureExecutionSession(): Promise<string> {
  const existing = sessionStorage.getItem(TOKEN_KEY);
  if (existing) {
    return existing;
  }
  return exchangeExecutionSession();
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok) {
    const message = payload.error ?? '请求失败';
    const err = new Error(message) as Error & { code?: string };
    if (payload.code) {
      err.code = payload.code;
    }
    throw err;
  }
  if (payload.data === undefined) {
    throw new Error(payload.error ?? '请求失败');
  }
  return payload.data;
}

export async function executionFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${executionBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }

  const send = async (token: string) => {
    headers.set('authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  let token = await ensureExecutionSession();
  let response = await send(token);

  if (response.status === 401) {
    clearExecutionSession();
    token = await exchangeExecutionSession();
    response = await send(token);
  }

  return parseResponse<T>(response);
}
