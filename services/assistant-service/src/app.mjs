import http from 'node:http';

function corsHeaders(req) {
  return {
    'access-control-allow-origin': req.headers.origin ?? '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
  };
}

function requestProto(req) {
  const forwarded = req.headers['x-forwarded-proto'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return 'http';
}

function json(req, res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...corsHeaders(req),
  });
  res.end(JSON.stringify(body));
}

function streamHead(req, res, status = 200) {
  res.writeHead(status, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    'x-accel-buffering': 'no',
    ...corsHeaders(req),
  });
  res.flushHeaders?.();
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
  const authService = config.authService;
  const assistantService = config.assistantService;

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders(req));
        res.end();
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        return json(req, res, 200, {
          ok: true,
          service: config.serviceName,
          apiBaseUrl: `${requestProto(req)}://${req.headers.host ?? 'localhost'}`,
          difyBaseUrl: config.difyBaseUrl,
        });
      }

      if (req.method === 'POST' && url.pathname === '/mini/auth/login') {
        try {
          const body = await readJson(req);
          const session = await authService.login(body);
          return json(req, res, 200, {
            data: {
              accessToken: session.token,
              expiresAt: session.expiresAt,
              user: session.user,
              project: session.project,
            },
          });
        } catch (error) {
          const statusCode = error && typeof error === 'object' && 'statusCode' in error
            ? Number(error.statusCode) || 401
            : 401;
          return json(req, res, statusCode, {
            error: error instanceof Error ? error.message : '登录失败',
            code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
          });
        }
      }

      if (req.method === 'POST' && url.pathname === '/mini/auth/logout') {
        return json(req, res, 200, { data: await authService.logout(req) });
      }

      if (req.method === 'POST' && url.pathname === '/mini/assistant/messages') {
        const session = await authService.getSession(req);
        if (!session) {
          return json(req, res, 401, { error: 'Unauthorized', code: 'AUTH_SESSION_INVALID' });
        }

        try {
          const body = await readJson(req);
          const query = String(body.query ?? '').trim();
          const conversationId = String(body.conversationId ?? '').trim();

          if (!query) {
            return json(req, res, 400, { error: '消息内容不能为空' });
          }

          streamHead(req, res, 200);

          let donePayload = null;
          await assistantService.streamMessage({
            query,
            conversationId,
            userId: session.user.id,
            onDelta: (event) => {
              res.write(assistantService.encodeStreamEvent({
                type: 'delta',
                delta: event.delta,
                answer: event.answer,
                conversationId: event.conversationId,
                messageId: event.messageId,
                createdAt: event.createdAt,
              }));
            },
            onDone: (event) => {
              donePayload = event;
              res.write(assistantService.encodeStreamEvent({
                type: 'done',
                conversationId: event.conversationId,
                messageId: event.messageId,
                answer: event.answer,
                createdAt: event.createdAt,
              }));
            },
          });
          if (!donePayload) {
            res.write(assistantService.encodeStreamEvent({
              type: 'done',
              conversationId: '',
              messageId: '',
              answer: '',
              createdAt: Math.floor(Date.now() / 1000),
            }));
          }
          res.end();
          return;
        } catch (error) {
          console.error('[assistant-service] /mini/assistant/messages failed', {
            userId: session.user.id,
            error: error instanceof Error ? error.message : String(error),
          });
          if (!res.headersSent) {
            return json(req, res, 400, { error: error instanceof Error ? error.message : 'AI 回复失败' });
          }
          res.write(assistantService.encodeStreamEvent({
            type: 'error',
            error: error instanceof Error ? error.message : 'AI 回复失败',
          }));
          res.end();
          return;
        }
      }

      return json(req, res, 404, { error: 'Not Found' });
    } catch (error) {
      return json(req, res, 500, {
        error: error instanceof Error ? error.message : 'Internal Server Error',
      });
    }
  });
}
