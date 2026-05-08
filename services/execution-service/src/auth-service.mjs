import crypto from 'node:crypto';

function authHeaders(config) {
  return {
    apikey: config.supabaseAnonKey,
    authorization: `Bearer ${config.supabaseAnonKey}`,
    'content-type': 'application/json',
  };
}

async function loginWithSupabase(config, email, password) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.error_description || payload?.error || '登录失败');
  }

  return payload;
}

function deriveDisplayName(email) {
  const localPart = String(email ?? '').split('@')[0] ?? '';
  return localPart || '用户';
}

export function createAuthService(config) {
  const sessions = new Map();

  function createSession(user) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600 * 1000).toISOString();
    const session = {
      token,
      expiresAt,
      user,
      project: undefined,
    };
    sessions.set(token, session);
    return session;
  }

  function parseBearerToken(req) {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      return '';
    }
    return header.slice(7).trim();
  }

  function getSession(req) {
    const token = parseBearerToken(req);
    if (!token) {
      return null;
    }
    const session = sessions.get(token) ?? null;
    if (!session) {
      return null;
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    return session;
  }

  return {
    async login(input) {
      const email = String(input.email ?? '').trim();
      const password = String(input.password ?? '');
      if (!email || !password) {
        throw new Error('缺少账号或密码');
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

    logout(req) {
      const token = parseBearerToken(req);
      if (token) {
        sessions.delete(token);
      }
      return { success: true };
    },

    getSession,
  };
}
