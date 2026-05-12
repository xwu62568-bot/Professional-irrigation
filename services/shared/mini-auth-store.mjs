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
