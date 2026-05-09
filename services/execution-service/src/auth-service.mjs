import crypto from 'node:crypto';
import {
  createMiniSession,
  deleteMiniSessionByToken,
  fetchMiniSessionByToken,
} from './supabase-rest.mjs';

class AuthServiceError extends Error {
  constructor(code, message, statusCode = 500) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function authHeaders(config) {
  return {
    apikey: config.supabaseAnonKey,
    authorization: `Bearer ${config.supabaseAnonKey}`,
    'content-type': 'application/json',
  };
}

async function loginWithSupabase(config, email, password) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.authUpstreamTimeoutMs);

  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authHeaders(config),
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.msg || payload?.error_description || payload?.error || '登录失败';
      if (response.status === 400 || response.status === 401) {
        throw new AuthServiceError('AUTH_INVALID_CREDENTIALS', message, 401);
      }
      throw new AuthServiceError('AUTH_UPSTREAM_REJECTED', message, 502);
    }

    return payload;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AuthServiceError('AUTH_UPSTREAM_TIMEOUT', '认证服务响应超时，请稍后重试', 504);
    }
    throw new AuthServiceError('AUTH_UPSTREAM_UNAVAILABLE', '认证服务暂时不可用，请稍后重试', 502);
  } finally {
    clearTimeout(timeout);
  }
}

function deriveDisplayName(email) {
  const localPart = String(email ?? '').split('@')[0] ?? '';
  return localPart || '用户';
}

export function createAuthService(config) {
  async function createSession(user) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600 * 1000).toISOString();
    const sessionPayload = {
      token,
      expires_at: expiresAt,
      user_id: user.id,
      user_email: user.email,
      user_name: user.name,
      user_role: user.role ?? null,
      project_id: null,
      project_name: null,
    };
    let row;
    try {
      row = await createMiniSession(config, sessionPayload);
    } catch {
      throw new AuthServiceError('AUTH_SESSION_STORE_FAILED', '登录会话创建失败，请稍后重试', 500);
    }
    if (!row?.token) {
      throw new AuthServiceError('AUTH_SESSION_STORE_FAILED', '登录会话创建失败，请稍后重试', 500);
    }
    return {
      token: row.token,
      expiresAt: row.expires_at ?? expiresAt,
      user,
      project: undefined,
    };
  }

  function parseBearerToken(req) {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      return '';
    }
    return header.slice(7).trim();
  }

  async function getSession(req) {
    const token = parseBearerToken(req);
    if (!token) {
      return null;
    }
    const row = await fetchMiniSessionByToken(config, token);
    if (!row) {
      return null;
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await deleteMiniSessionByToken(config, token).catch(() => undefined);
      return null;
    }
    return {
      token: row.token,
      expiresAt: row.expires_at,
      user: {
        id: row.user_id,
        email: row.user_email,
        name: row.user_name,
        role: row.user_role ?? 'operator',
      },
      project: row.project_id
        ? {
            id: row.project_id,
            name: row.project_name ?? '默认项目',
          }
        : undefined,
    };
  }

  return {
    async login(input) {
      const email = String(input.email ?? '').trim();
      const password = String(input.password ?? '');
      if (!email || !password) {
        throw new AuthServiceError('AUTH_MISSING_CREDENTIALS', '缺少账号或密码', 400);
      }

      const payload = await loginWithSupabase(config, email, password);
      const user = {
        id: payload.user?.id ?? payload.user?.email ?? email,
        email: payload.user?.email ?? email,
        name: payload.user?.user_metadata?.name ?? deriveDisplayName(payload.user?.email ?? email),
        role: payload.user?.user_metadata?.role ?? 'operator',
      };

      return createSession(user);
    },

    async logout(req) {
      const token = parseBearerToken(req);
      if (token) {
        await deleteMiniSessionByToken(config, token).catch(() => undefined);
      }
      return { success: true };
    },

    getSession,
  };
}
