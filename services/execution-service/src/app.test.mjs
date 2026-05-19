import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { createApp, resetAckNonceStoreForTest, verifyAckNonce, verifyAckSignature } from './app.mjs';

function signAck(secret, body, timestamp) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${JSON.stringify(body)}`).digest('hex');
}

async function withServer(handler) {
  const app = createApp(handler.config);
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
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

test('internal ack endpoint should enforce signature and nonce checks', async () => {
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
});
