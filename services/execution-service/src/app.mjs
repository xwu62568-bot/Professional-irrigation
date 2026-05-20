import http from 'node:http';
import crypto from 'node:crypto';

function corsHeaders(req) {
  return {
    'access-control-allow-origin': req.headers.origin ?? '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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

function errorBody(error, fallbackMessage) {
  return {
    error: error instanceof Error ? error.message : fallbackMessage,
    code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
  };
}

function planMutationStatus(error) {
  if (error && typeof error === 'object' && error.code === 'SCHEDULE_SYNC_FAILED') {
    return 502;
  }
  if (error && typeof error === 'object' && 'statusCode' in error && Number(error.statusCode) >= 400) {
    return Number(error.statusCode);
  }
  return 400;
}

function parseSupabaseAccessToken(req, body) {
  if (body && typeof body.supabaseAccessToken === 'string' && body.supabaseAccessToken.trim()) {
    return body.supabaseAccessToken.trim();
  }
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

function withCode(error, code, fallbackMessage) {
  const wrapped = new Error(
    error instanceof Error && error.message ? error.message : fallbackMessage,
  );
  wrapped.code = code;
  if (error instanceof Error && error.cause) {
    wrapped.cause = error.cause;
  } else if (error) {
    wrapped.cause = error;
  }
  return wrapped;
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

function safeEqualHex(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function verifyAckSignature(config, body, headers) {
  if (!config.ackSignatureSecret) return true;
  const signature = typeof headers['x-ack-signature'] === 'string' ? headers['x-ack-signature'] : '';
  const timestamp = typeof headers['x-ack-timestamp'] === 'string' ? Number(headers['x-ack-timestamp']) : 0;
  if (!signature || !timestamp || !Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() - timestamp) > config.ackSignatureSkewMs) return false;
  const payload = `${timestamp}.${JSON.stringify(body)}`;
  const expected = crypto.createHmac('sha256', config.ackSignatureSecret).update(payload).digest('hex');
  return safeEqualHex(signature, expected);
}

const usedAckNonces = new Map();
function cleanupUsedNonces(maxAgeMs) {
  const now = Date.now();
  for (const [nonce, ts] of usedAckNonces.entries()) {
    if (now - ts > maxAgeMs) {
      usedAckNonces.delete(nonce);
    }
  }
}

export function verifyAckNonce(config, headers) {
  const nonce = typeof headers['x-ack-nonce'] === 'string' ? headers['x-ack-nonce'].trim() : '';
  if (!nonce) {
    return false;
  }
  cleanupUsedNonces(config.ackSignatureSkewMs);
  if (usedAckNonces.has(nonce)) {
    return false;
  }
  usedAckNonces.set(nonce, Date.now());
  return true;
}

export function resetAckNonceStoreForTest() {
  usedAckNonces.clear();
}

async function proxyAssistantMessage(req, res, config) {
  const body = await readJson(req);
  const upstream = await fetch(`${config.assistantServiceBaseUrl}/mini/assistant/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : '',
    },
    body: JSON.stringify(body),
  });
  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';

  res.writeHead(upstream.status, {
    'content-type': contentType,
    'cache-control': upstream.headers.get('cache-control') ?? 'no-cache, no-transform',
    'x-accel-buffering': upstream.headers.get('x-accel-buffering') ?? 'no',
    ...corsHeaders(req),
  });
  res.flushHeaders?.();

  if (!upstream.body) {
    const text = await upstream.text();
    res.end(text);
    return;
  }

  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      res.write(Buffer.from(value));
    }
  }
  res.end();
}

export function buildHealthPayload(config, runService) {
  return {
    ok: true,
    service: config.serviceName,
    mqttGatewayBaseUrl: config.mqttGatewayBaseUrl,
    miniApi: true,
    engineMode: config.engineMode,
    rolloutMode: config.rolloutMode,
    internalScheduling: {
      internalTokenConfigured: Boolean(config.internalAuthToken),
      internalApiBaseUrl: config.internalApiBaseUrl,
      projectTimezone: config.projectTimezone,
    },
    runtimeMetrics: runService.getRuntimeMetrics?.() ?? null,
  };
}

export async function createPlanWithScheduleSync({ miniService, runService, userId, body }) {
  const result = await miniService.createPlan(userId, body);
  try {
    await runService.syncPlanSchedule(result.id);
    return result;
  } catch (syncError) {
    try {
      await miniService.rollbackCreatedPlan(userId, result.id);
    } catch (rollbackError) {
      const wrapped = withCode(
        rollbackError,
        'PLAN_CREATE_ROLLBACK_FAILED',
        '计划调度同步失败，且创建回滚失败',
      );
      wrapped.cause = { syncError, rollbackError };
      throw wrapped;
    }
    throw syncError;
  }
}

export async function updatePlanWithScheduleSync({ miniService, runService, userId, planId, body }) {
  const result = await miniService.updatePlan(userId, planId, body);
  await runService.syncPlanSchedule(result.id);
  return result;
}

export async function deletePlanWithScheduleUnsync({ miniService, runService, userId, planId }) {
  await miniService.assertPlanOwner(userId, planId);
  await runService.unsyncPlanSchedule(planId);
  try {
    return await miniService.deletePlan(userId, planId);
  } catch (deleteError) {
    try {
      await runService.syncPlanSchedule(planId);
    } catch (restoreError) {
      const wrapped = withCode(
        restoreError,
        'PLAN_DELETE_RESTORE_FAILED',
        '计划删除失败，且调度恢复失败',
      );
      wrapped.cause = { deleteError, restoreError };
      throw wrapped;
    }
    throw deleteError;
  }
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
        return json(req, res, 200, buildHealthPayload(config, runService));
      }

      if (req.method === 'POST' && url.pathname.startsWith('/internal/')) {
        const token = typeof req.headers['x-internal-token'] === 'string'
          ? req.headers['x-internal-token']
          : '';
        if (!config.internalAuthToken || token !== config.internalAuthToken) {
          return json(req, res, 401, { error: 'Unauthorized internal access' });
        }

        if (url.pathname.startsWith('/internal/plans/') && url.pathname.endsWith('/dispatch')) {
          const planId = url.pathname.split('/')[3] ?? '';
          try {
            const run = await runService.startScheduledRun(planId);
            return json(req, res, 202, { data: { accepted: true, runId: run.id } });
          } catch (error) {
            return json(req, res, 400, { error: error instanceof Error ? error.message : '计划调度失败' });
          }
        }

        if (url.pathname.startsWith('/internal/commands/') && url.pathname.endsWith('/dispatch')) {
          const commandId = url.pathname.split('/')[3] ?? '';
          try {
            const result = await runService.dispatchCommand(commandId);
            return json(req, res, 200, { data: result });
          } catch (error) {
            return json(req, res, 400, { error: error instanceof Error ? error.message : '命令分发失败' });
          }
        }

        if (url.pathname === '/internal/device-events/ack') {
          try {
            const body = await readJson(req);
            if (!verifyAckSignature(config, body, req.headers)) {
              return json(req, res, 401, { error: 'Invalid ACK signature' });
            }
            if (!verifyAckNonce(config, req.headers)) {
              return json(req, res, 409, { error: 'Duplicate or missing ACK nonce' });
            }
            await runService.handleGatewayAckEvent(body);
            return json(req, res, 202, { data: { accepted: true } });
          } catch (error) {
            return json(req, res, 400, { error: error instanceof Error ? error.message : '回执处理失败' });
          }
        }

        if (url.pathname.startsWith('/internal/steps/') && url.pathname.endsWith('/timeout')) {
          const stepId = url.pathname.split('/')[3] ?? '';
          try {
            const result = await runService.handleStepTimeout(stepId);
            return json(req, res, 202, { data: result });
          } catch (error) {
            return json(req, res, 400, { error: error instanceof Error ? error.message : '步骤超时处理失败' });
          }
        }
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
          return json(req, res, statusCode, errorBody(error, '登录失败'));
        }
      }

      if (req.method === 'POST' && url.pathname === '/web/auth/exchange') {
        try {
          const body = await readJson(req);
          const supabaseAccessToken = parseSupabaseAccessToken(req, body);
          const session = await authService.exchangeSupabaseToken(supabaseAccessToken);
          return json(req, res, 200, {
            data: {
              accessToken: session.token,
              expiresAt: session.expiresAt,
              user: session.user,
            },
          });
        } catch (error) {
          const statusCode = error && typeof error === 'object' && 'statusCode' in error
            ? Number(error.statusCode) || 401
            : 401;
          return json(req, res, statusCode, errorBody(error, '认证失败'));
        }
      }

      if (req.method === 'POST' && url.pathname === '/mini/assistant/messages') {
        try {
          return await proxyAssistantMessage(req, res, config);
        } catch (error) {
          console.error('[execution-service] /mini/assistant/messages proxy failed', {
            assistantServiceBaseUrl: config.assistantServiceBaseUrl,
            error: error instanceof Error ? error.message : String(error),
            cause:
              error instanceof Error && error.cause && typeof error.cause === 'object'
                ? {
                    message: 'message' in error.cause ? error.cause.message : undefined,
                    code: 'code' in error.cause ? error.cause.code : undefined,
                  }
                : undefined,
          });
          return json(req, res, 502, { error: 'AI 服务暂不可用，请稍后重试' });
        }
      }

      if (url.pathname.startsWith('/mini/')) {
        if (req.method === 'POST' && url.pathname === '/mini/auth/logout') {
          return json(req, res, 200, { data: await authService.logout(req) });
        }

        const session = await authService.getSession(req);
        if (!session) {
          return json(req, res, 401, { ...unauthorized(), code: 'AUTH_SESSION_INVALID' });
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
            const result = await createPlanWithScheduleSync({
              miniService,
              runService,
              userId: session.user.id,
              body,
            });
            return json(req, res, 201, { data: result });
          } catch (error) {
            return json(req, res, planMutationStatus(error), errorBody(error, '计划创建失败'));
          }
        }

        if (req.method === 'PATCH' && url.pathname.startsWith('/mini/plans/')) {
          const segments = url.pathname.split('/').filter(Boolean);
          if (segments.length !== 3 || segments[0] !== 'mini' || segments[1] !== 'plans') {
            return notFound(req, res);
          }
          const planId = segments[2] ?? '';
          try {
            const body = await readJson(req);
            const result = await updatePlanWithScheduleSync({
              miniService,
              runService,
              userId: session.user.id,
              planId,
              body,
            });
            return json(req, res, 200, { data: result });
          } catch (error) {
            return json(req, res, planMutationStatus(error), errorBody(error, '计划更新失败'));
          }
        }

        if (req.method === 'DELETE' && url.pathname.startsWith('/mini/plans/')) {
          const segments = url.pathname.split('/').filter(Boolean);
          if (segments.length !== 3 || segments[0] !== 'mini' || segments[1] !== 'plans') {
            return notFound(req, res);
          }
          const planId = segments[2] ?? '';
          try {
            const result = await deletePlanWithScheduleUnsync({
              miniService,
              runService,
              userId: session.user.id,
              planId,
            });
            return json(req, res, 200, { data: result });
          } catch (error) {
            return json(req, res, planMutationStatus(error), errorBody(error, '计划删除失败'));
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
