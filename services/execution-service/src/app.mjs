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

function notFound(req, res) {
  json(req, res, 404, { error: 'Not Found' });
}

export function createApp(config) {
  const runService = config.runService;

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
        mqttGatewayBaseUrl: config.mqttGatewayBaseUrl,
      });
    }

    if (req.method === 'POST' && url.pathname === '/runs/manual-start') {
      try {
        const body = await readJson(req);
        const run = await runService.startManualRun(body.planId);
        return json(req, res, 202, {
          accepted: true,
          runId: run.id,
        });
      } catch (error) {
        return json(req, res, 400, { error: error instanceof Error ? error.message : '启动计划失败' });
      }
    }

    if (req.method === 'POST' && url.pathname.startsWith('/runs/') && url.pathname.endsWith('/stop')) {
      const runId = url.pathname.split('/')[2] ?? '';
      try {
        await runService.stopRun(runId);
        return json(req, res, 202, {
          accepted: true,
          runId,
        });
      } catch (error) {
        return json(req, res, 400, { error: error instanceof Error ? error.message : '停止执行失败' });
      }
    }

    if (req.method === 'GET' && url.pathname.startsWith('/runs/')) {
      const runId = url.pathname.split('/')[2] ?? '';
      try {
        const detail = await runService.getRunDetail(runId);
        if (!detail) {
          return json(req, res, 404, { error: 'Run not found' });
        }
        return json(req, res, 200, detail);
      } catch (error) {
        return json(req, res, 400, { error: error instanceof Error ? error.message : '读取执行状态失败' });
      }
    }

    return notFound(req, res);
  });
}
