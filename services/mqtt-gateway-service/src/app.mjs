import http from 'node:http';

function corsHeaders(req) {
  return {
    'access-control-allow-origin': req.headers.origin ?? '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
  };
}

function json(req, res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...corsHeaders(req),
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createApp(config) {
  const gateway = config.gateway;

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req));
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(req, res, 200, {
        ok: true,
        service: config.serviceName,
        brokerUrl: config.brokerUrl,
        state: gateway.getState(),
      });
    }

    if (req.method === 'GET' && url.pathname === '/demo/state') {
      return json(req, res, 200, {
        state: gateway.getState(),
      });
    }

    if (req.method === 'POST' && url.pathname === '/demo/request-device-info') {
      try {
        const body = await readJson(req);
        const result = await gateway.requestDeviceInfo(body.deviceId ?? config.deviceId);
        return json(req, res, 202, { accepted: true, result, state: gateway.getState() });
      } catch (error) {
        return json(req, res, 400, {
          error: error instanceof Error ? error.message : '请求设备信息失败',
          state: gateway.getState(),
        });
      }
    }

    if (req.method === 'POST' && url.pathname.startsWith('/devices/') && url.pathname.endsWith('/commands/open')) {
      const deviceId = url.pathname.split('/')[2] ?? '';
      const body = await readJson(req);
      try {
        const result = await gateway.sendControl(deviceId, {
          stationIndex: Number(body.stationIndex),
          type: 'on',
          durationSeconds: Number(body.durationSeconds ?? 0),
        });
        return json(req, res, 202, { accepted: true, command: 'open', deviceId, result, state: gateway.getState() });
      } catch (error) {
        return json(req, res, 400, {
          error: error instanceof Error ? error.message : '开阀失败',
          state: gateway.getState(),
        });
      }
    }

    if (req.method === 'POST' && url.pathname.startsWith('/devices/') && url.pathname.endsWith('/commands/close')) {
      const deviceId = url.pathname.split('/')[2] ?? '';
      const body = await readJson(req);
      try {
        const result = await gateway.sendControl(deviceId, {
          stationIndex: Number(body.stationIndex),
          type: 'off',
          durationSeconds: Number(body.durationSeconds ?? 0),
        });
        return json(req, res, 202, { accepted: true, command: 'close', deviceId, result, state: gateway.getState() });
      } catch (error) {
        return json(req, res, 400, {
          error: error instanceof Error ? error.message : '关阀失败',
          state: gateway.getState(),
        });
      }
    }

    if (req.method === 'GET' && url.pathname.startsWith('/devices/') && url.pathname.endsWith('/status')) {
      const deviceId = url.pathname.split('/')[2] ?? '';
      return json(req, res, 200, {
        deviceId,
        state: gateway.getState(),
      });
    }

    return json(req, res, 404, { error: 'Not Found' });
  });
}
