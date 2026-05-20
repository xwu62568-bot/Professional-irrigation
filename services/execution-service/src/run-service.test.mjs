import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRunService,
  buildCommandIdempotencyKey,
  buildDedupeKey,
  evaluateRuntimeSlo,
  resolveExecutionModeForPlan,
  shouldAutoRollbackFromRuns,
  toMs,
} from './run-service.mjs';

test('toMs should scale minute durations with floor guard', () => {
  assert.equal(toMs(0, 1), 1000);
  assert.equal(toMs(1, 1), 60000);
  assert.equal(toMs(2, 0.5), 60000);
});

test('buildDedupeKey should contain plan and trigger', () => {
  const key = buildDedupeKey('plan-1', 'schedule');
  assert.match(key, /^plan-1:schedule:/);
});

test('resolveExecutionModeForPlan should respect rollout mode and canary list', () => {
  assert.equal(
    resolveExecutionModeForPlan(
      { engineMode: 'event_driven', rolloutMode: 'full', canaryPlanIds: '' },
      'p1',
    ),
    'event_driven',
  );
  assert.equal(
    resolveExecutionModeForPlan(
      { engineMode: 'event_driven', rolloutMode: 'canary', canaryPlanIds: 'p2,p3' },
      'p1',
    ),
    'legacy',
  );
  assert.equal(
    resolveExecutionModeForPlan(
      { engineMode: 'event_driven', rolloutMode: 'canary', canaryPlanIds: 'p2,p3' },
      'p2',
    ),
    'event_driven',
  );
});

test('buildCommandIdempotencyKey should be deterministic for same inputs', () => {
  const step = { id: 'step-1' };
  const binding = { device_id: 'dev-1', station_id: 2 };
  const first = buildCommandIdempotencyKey(step, binding, 'open');
  const second = buildCommandIdempotencyKey(step, binding, 'open');
  assert.equal(first, second);
  assert.equal(first, 'step-1:dev-1:2:open');
});

test('evaluateRuntimeSlo should mark breaches by thresholds', () => {
  const result = evaluateRuntimeSlo(
    {
      startedEventRuns: 8,
      startedLegacyRuns: 2,
      dispatchSuccess: 90,
      dispatchFailed: 10,
      ackSuccess: 45,
      ackFailure: 5,
      timeoutTransitions: 1,
    },
    {
      dispatchSuccessRate: 0.95,
      ackSuccessRate: 0.9,
      timeoutRate: 0.05,
    },
  );
  assert.equal(result.rates.dispatchSuccessRate, 0.9);
  assert.equal(result.rates.ackSuccessRate, 0.9);
  assert.equal(result.rates.timeoutRate, 0.1);
  assert.equal(result.sloBreaches.dispatchSuccessRate, true);
  assert.equal(result.sloBreaches.ackSuccessRate, false);
  assert.equal(result.sloBreaches.timeoutRate, true);
});

test('shouldAutoRollbackFromRuns should return false when samples are insufficient', () => {
  const result = shouldAutoRollbackFromRuns([{ status: 'failed' }], {
    minSamples: 3,
    failRateThreshold: 0.2,
  });
  assert.equal(result.shouldRollback, false);
  assert.equal(result.reason, 'insufficient_samples');
});

test('syncPlanSchedule should throw when internal schedule sync is not configured', async () => {
  const service = createRunService({
    internalApiBaseUrl: '',
    internalAuthToken: '',
    reconcileEnabled: false,
    engineMode: 'event_driven',
    rolloutMode: 'full',
  });

  await assert.rejects(
    () => service.syncPlanSchedule('plan-1'),
    (error) => error && error.code === 'SCHEDULE_SYNC_FAILED',
  );
});

test('unsyncPlanSchedule should throw when internal schedule sync is not configured', async () => {
  const service = createRunService({
    internalApiBaseUrl: '',
    internalAuthToken: '',
    reconcileEnabled: false,
    engineMode: 'event_driven',
    rolloutMode: 'full',
  });

  await assert.rejects(
    () => service.unsyncPlanSchedule('plan-1'),
    (error) => error && error.code === 'SCHEDULE_SYNC_FAILED',
  );
});
