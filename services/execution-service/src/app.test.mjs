import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  buildHealthPayload,
  createPlanWithScheduleSync,
  createApp,
  deletePlanWithScheduleUnsync,
  resetAckNonceStoreForTest,
  updatePlanWithScheduleSync,
  verifyAckNonce,
  verifyAckSignature,
} from './app.mjs';

function signAck(secret, body, timestamp) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${JSON.stringify(body)}`).digest('hex');
}

async function withServer(handler) {
  const app = createApp(handler.config);
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      app.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      app.off('error', onError);
      resolve();
    };
    app.once('error', onError);
    app.listen(0, '127.0.0.1', onListening);
  });
  const { port } = app.address();
  try {
    await handler.run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
}

test('verifyAckSignature should validate hmac with timestamp window', () => {
  const body = { runStepId: 's1', deviceId: 'd1', success: true };
  const config = { ackSignatureSecret: 'secret', ackSignatureSkewMs: 60_000 };
  const timestamp = Date.now();
  const signature = signAck(config.ackSignatureSecret, body, timestamp);
  assert.equal(
    verifyAckSignature(config, body, { 'x-ack-signature': signature, 'x-ack-timestamp': String(timestamp) }),
    true,
  );
  assert.equal(
    verifyAckSignature(config, body, { 'x-ack-signature': signature, 'x-ack-timestamp': String(timestamp - 120_000) }),
    false,
  );
});

test('verifyAckNonce should reject duplicated nonce', () => {
  resetAckNonceStoreForTest();
  const config = { ackSignatureSkewMs: 300_000 };
  const headers = { 'x-ack-nonce': 'nonce-1' };
  assert.equal(verifyAckNonce(config, headers), true);
  assert.equal(verifyAckNonce(config, headers), false);
});

test('buildHealthPayload should expose internal scheduling readiness', () => {
  const config = {
    serviceName: 'execution-service',
    mqttGatewayBaseUrl: 'http://gateway.internal',
    engineMode: 'event_driven',
    rolloutMode: 'full',
    internalAuthToken: '',
    internalApiBaseUrl: 'http://127.0.0.1:4310',
    projectTimezone: 'Asia/Shanghai',
  };
  const runtimeMetrics = { startedEventRuns: 3 };

  const payload = buildHealthPayload(config, {
    getRuntimeMetrics: () => runtimeMetrics,
  });

  assert.deepEqual(payload.internalScheduling, {
    internalTokenConfigured: false,
    internalApiBaseUrl: 'http://127.0.0.1:4310',
    projectTimezone: 'Asia/Shanghai',
  });
  assert.equal(payload.ok, true);
  assert.equal(payload.service, 'execution-service');
  assert.equal(payload.runtimeMetrics, runtimeMetrics);
});

test('createPlanWithScheduleSync should roll back created plan when sync fails', async () => {
  const calls = [];
  const miniService = {
    createPlan: async () => {
      calls.push('createPlan');
      return { id: 'plan-1' };
    },
    rollbackCreatedPlan: async (_userId, planId) => {
      calls.push(`rollback:${planId}`);
      return { id: planId };
    },
  };
  const runService = {
    syncPlanSchedule: async () => {
      calls.push('sync');
      const error = new Error('sync failed');
      error.code = 'SCHEDULE_SYNC_FAILED';
      throw error;
    },
  };

  await assert.rejects(
    () => createPlanWithScheduleSync({ miniService, runService, userId: 'u1', body: {} }),
    (error) => error instanceof Error && error.message === 'sync failed',
  );
  assert.deepEqual(calls, ['createPlan', 'sync', 'rollback:plan-1']);
});

test('createPlanWithScheduleSync should surface rollback failure explicitly', async () => {
  const miniService = {
    createPlan: async () => ({ id: 'plan-1' }),
    rollbackCreatedPlan: async () => {
      throw new Error('rollback failed');
    },
  };
  const runService = {
    syncPlanSchedule: async () => {
      const error = new Error('sync failed');
      error.code = 'SCHEDULE_SYNC_FAILED';
      throw error;
    },
  };

  await assert.rejects(
    () => createPlanWithScheduleSync({ miniService, runService, userId: 'u1', body: {} }),
    (error) => error && error.code === 'PLAN_CREATE_ROLLBACK_FAILED',
  );
});

test('updatePlanWithScheduleSync should sync updated plan', async () => {
  const calls = [];
  const miniService = {
    updatePlan: async (_userId, planId) => {
      calls.push(`update:${planId}`);
      return { id: planId };
    },
  };
  const runService = {
    syncPlanSchedule: async (planId) => {
      calls.push(`sync:${planId}`);
    },
  };

  const result = await updatePlanWithScheduleSync({
    miniService,
    runService,
    userId: 'u1',
    planId: 'plan-1',
    body: {},
  });

  assert.deepEqual(result, { id: 'plan-1' });
  assert.deepEqual(calls, ['update:plan-1', 'sync:plan-1']);
});

test('deletePlanWithScheduleUnsync should restore schedule if delete fails', async () => {
  const calls = [];
  const miniService = {
    assertPlanOwner: async (_userId, planId) => {
      calls.push(`owner:${planId}`);
    },
    deletePlan: async (_userId, planId) => {
      calls.push(`delete:${planId}`);
      throw new Error('delete failed');
    },
  };
  const runService = {
    unsyncPlanSchedule: async (planId) => {
      calls.push(`unsync:${planId}`);
    },
    syncPlanSchedule: async (planId) => {
      calls.push(`resync:${planId}`);
    },
  };

  await assert.rejects(
    () => deletePlanWithScheduleUnsync({ miniService, runService, userId: 'u1', planId: 'plan-1' }),
    (error) => error instanceof Error && error.message === 'delete failed',
  );
  assert.deepEqual(calls, ['owner:plan-1', 'unsync:plan-1', 'delete:plan-1', 'resync:plan-1']);
});

test('deletePlanWithScheduleUnsync should fail loudly when schedule restore also fails', async () => {
  const miniService = {
    assertPlanOwner: async () => {},
    deletePlan: async () => {
      throw new Error('delete failed');
    },
  };
  const runService = {
    unsyncPlanSchedule: async () => {},
    syncPlanSchedule: async () => {
      throw new Error('restore failed');
    },
  };

  await assert.rejects(
    () => deletePlanWithScheduleUnsync({ miniService, runService, userId: 'u1', planId: 'plan-1' }),
    (error) => error && error.code === 'PLAN_DELETE_RESTORE_FAILED',
  );
});

test('internal ack endpoint should enforce signature and nonce checks', async (t) => {
  resetAckNonceStoreForTest();
  const body = { runStepId: 'step-1', deviceId: 'dev-1', stationIndex: 1, action: 'open', success: true };
  const config = {
    serviceName: 'execution-service',
    mqttGatewayBaseUrl: 'http://127.0.0.1:4320',
    assistantServiceBaseUrl: 'http://127.0.0.1:4311',
    engineMode: 'event_driven',
    rolloutMode: 'full',
    internalAuthToken: 'token-123',
    ackSignatureSecret: 'secret-123',
    ackSignatureSkewMs: 300_000,
    runService: {
      getRuntimeMetrics: () => ({}),
      handleGatewayAckEvent: async () => ({ ok: true }),
      startScheduledRun: async () => ({ id: 'run-1' }),
      dispatchCommand: async () => ({}),
      handleStepTimeout: async () => ({}),
      syncPlanSchedule: async () => ({}),
      startManualRun: async () => ({ id: 'run-manual' }),
      stopPlan: async () => ([]),
      stopRun: async () => ({}),
      getRunDetail: async () => null,
    },
    miniService: {},
    authService: {
      login: async () => ({}),
      logout: async () => ({}),
      getSession: async () => null,
    },
  };

  try {
    await withServer({
      config,
      run: async (baseUrl) => {
        const ts = Date.now();
        const signature = signAck(config.ackSignatureSecret, body, ts);
        const commonHeaders = {
          'content-type': 'application/json',
          'x-internal-token': config.internalAuthToken,
          'x-ack-timestamp': String(ts),
          'x-ack-signature': signature,
        };
        const first = await fetch(`${baseUrl}/internal/device-events/ack`, {
          method: 'POST',
          headers: { ...commonHeaders, 'x-ack-nonce': 'nonce-a' },
          body: JSON.stringify(body),
        });
        assert.equal(first.status, 202);

        const duplicate = await fetch(`${baseUrl}/internal/device-events/ack`, {
          method: 'POST',
          headers: { ...commonHeaders, 'x-ack-nonce': 'nonce-a' },
          body: JSON.stringify(body),
        });
        assert.equal(duplicate.status, 409);

        const badSignature = await fetch(`${baseUrl}/internal/device-events/ack`, {
          method: 'POST',
          headers: { ...commonHeaders, 'x-ack-signature': 'abcd', 'x-ack-nonce': 'nonce-b' },
          body: JSON.stringify(body),
        });
        assert.equal(badSignature.status, 401);
      },
    });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EPERM') {
      t.skip('socket listen is not permitted in this environment');
      return;
    }
    throw error;
  }
});
