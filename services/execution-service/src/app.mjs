import http from 'node:http';

function corsHeaders(req) {
  return {
    'access-control-allow-origin': req.headers.origin ?? '*',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
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
  const miniService = config.miniService;
  const authService = config.authService;

  function unauthorized() {
    return { error: 'Unauthorized' };
  }

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
          mqttGatewayBaseUrl: config.mqttGatewayBaseUrl,
          miniApi: true,
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
          return json(req, res, 401, { error: error instanceof Error ? error.message : '登录失败' });
        }
      }

      if (url.pathname.startsWith('/mini/')) {
        if (req.method === 'POST' && url.pathname === '/mini/auth/logout') {
          return json(req, res, 200, { data: authService.logout(req) });
        }

        const session = authService.getSession(req);
        if (!session) {
          return json(req, res, 401, unauthorized());
        }

        if (req.method === 'GET' && url.pathname === '/mini/me') {
          return json(req, res, 200, {
            data: {
              user: session.user,
              project: session.project,
            },
          });
        }

        if (req.method === 'GET' && url.pathname === '/mini/runtime') {
          return json(req, res, 200, {
            data: {
              version: '0.0.1',
              apiBaseUrl: `${requestProto(req)}://${req.headers.host ?? 'localhost'}`,
              dataSource: 'node',
            },
          });
        }

        if (req.method === 'GET' && url.pathname === '/mini/overview') {
          return json(req, res, 200, { data: await miniService.getOverview(session.user.id) });
        }

        if (req.method === 'GET' && url.pathname === '/mini/fields') {
          return json(req, res, 200, { data: { items: await miniService.listFields(session.user.id) } });
        }

        if (req.method === 'GET' && url.pathname.startsWith('/mini/fields/')) {
          const id = url.pathname.split('/')[3] ?? '';
          const detail = await miniService.getFieldDetail(session.user.id, id);
          if (!detail) {
            return json(req, res, 404, { error: 'Field not found' });
          }
          return json(req, res, 200, { data: detail });
        }

        if (req.method === 'GET' && url.pathname === '/mini/devices') {
          const includeDemo = url.searchParams.get('includeDemo') === 'true';
          return json(req, res, 200, { data: { items: await miniService.listDevices(session.user.id, { includeDemo }) } });
        }

        if (req.method === 'GET' && url.pathname.startsWith('/mini/devices/')) {
          const id = url.pathname.split('/')[3] ?? '';
          const detail = await miniService.getDeviceDetail(session.user.id, id);
          if (!detail) {
            return json(req, res, 404, { error: 'Device not found' });
          }
          return json(req, res, 200, { data: detail });
        }

        if (req.method === 'POST' && url.pathname.startsWith('/mini/devices/') && url.pathname.endsWith('/control')) {
          const id = url.pathname.split('/')[3] ?? '';
          try {
            const body = await readJson(req);
            const detail = await miniService.getDeviceDetail(session.user.id, id);
            if (!detail) {
              return json(req, res, 404, { error: 'Device not found' });
            }

            if (detail.source !== 'demo') {
              return json(req, res, 400, { error: '当前仅演示设备支持直接控制' });
            }

            const action = String(body.action ?? '').trim();
            const stationIndex = Number(body.stationIndex ?? body.stationId ?? 0);
            const durationSeconds = Math.max(1, Number(body.durationSeconds ?? 60));

            if (!['open', 'close'].includes(action)) {
              return json(req, res, 400, { error: 'Unsupported device action' });
            }

            const endpoint = action === 'open' ? 'open' : 'close';
            const response = await fetch(
              `${config.mqttGatewayBaseUrl}/devices/${encodeURIComponent(detail.device.id)}/commands/${endpoint}`,
              {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                },
                body: JSON.stringify({
                  stationIndex,
                  durationSeconds,
                }),
              },
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              return json(req, res, 400, {
                error: payload?.error ?? '设备控制失败',
              });
            }

            return json(req, res, 202, {
              data: {
                success: true,
                message: action === 'open' ? '开阀指令已发送' : '关阀指令已发送',
                state: payload?.state ?? null,
              },
            });
          } catch (error) {
            return json(req, res, 400, { error: error instanceof Error ? error.message : '设备控制失败' });
          }
        }

        if (req.method === 'GET' && url.pathname === '/mini/plans') {
          return json(req, res, 200, { data: await miniService.listPlans(session.user.id) });
        }

        if (req.method === 'GET' && url.pathname.startsWith('/mini/plans/')) {
          const id = url.pathname.split('/')[3] ?? '';
          const detail = await miniService.getPlanDetail(session.user.id, id);
          if (!detail) {
            return json(req, res, 404, { error: 'Plan not found' });
          }
          return json(req, res, 200, { data: detail });
        }

        if (req.method === 'GET' && url.pathname === '/mini/strategies') {
          return json(req, res, 200, { data: await miniService.listStrategies(session.user.id) });
        }

        if (req.method === 'GET' && url.pathname.startsWith('/mini/strategies/')) {
          const id = url.pathname.split('/')[3] ?? '';
          const detail = await miniService.getStrategyDetail(session.user.id, id);
          if (!detail) {
            return json(req, res, 404, { error: 'Strategy not found' });
          }
          return json(req, res, 200, { data: detail });
        }

        if (req.method === 'POST' && url.pathname === '/mini/plans') {
          try {
            const body = await readJson(req);
            const result = await miniService.createPlan(session.user.id, body);
            return json(req, res, 201, { data: result });
          } catch (error) {
            return json(req, res, 400, { error: error instanceof Error ? error.message : '计划创建失败' });
          }
        }

        if (req.method === 'PATCH' && url.pathname.startsWith('/mini/plans/')) {
          const planId = url.pathname.split('/')[3] ?? '';
          try {
            const body = await readJson(req);
            const result = await miniService.updatePlan(session.user.id, planId, body);
            return json(req, res, 200, { data: result });
          } catch (error) {
            return json(req, res, 400, { error: error instanceof Error ? error.message : '计划更新失败' });
          }
        }

        if (req.method === 'POST' && url.pathname.startsWith('/mini/plans/') && /(start|pause|stop)$/.test(url.pathname)) {
          const planId = url.pathname.split('/')[3] ?? '';
          const action = url.pathname.split('/')[4] ?? '';
          try {
            if (action === 'start') {
              const run = await runService.startManualRun(planId);
              return json(req, res, 202, {
                data: {
                  success: true,
                  runId: run.id,
                  message: '计划已提交执行',
                },
              });
            }

            await runService.stopPlan(planId);
            return json(req, res, 202, {
              data: {
                success: true,
                message: action === 'pause' ? '计划已提交暂停请求' : '计划已提交停止请求',
              },
            });
          } catch (error) {
            return json(req, res, 400, { error: error instanceof Error ? error.message : '计划动作执行失败' });
          }
        }

        if (req.method === 'POST' && url.pathname === '/mini/strategies') {
          return json(req, res, 501, { error: 'Strategy create not implemented yet' });
        }

        if (req.method === 'POST' && url.pathname.startsWith('/mini/strategies/') && /(enable|disable|confirm|ignore)$/.test(url.pathname)) {
          const strategyId = url.pathname.split('/')[3] ?? '';
          const action = url.pathname.split('/')[4] ?? '';
          return json(req, res, 202, {
            data: {
              success: true,
              message: `Strategy ${strategyId} action accepted: ${action}`,
            },
          });
        }
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
    } catch (error) {
      return json(req, res, 500, {
        error: error instanceof Error ? error.message : 'Internal Server Error',
      });
    }
  });
}
