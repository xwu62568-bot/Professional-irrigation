import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateRuntimeSlo, shouldAutoRollbackFromRuns } from './run-service.mjs';

test('P1: canary rollback should trigger on sustained high failure rate', () => {
  const runs = [
    { status: 'success' },
    { status: 'failed' },
    { status: 'cancelled' },
    { status: 'failed' },
    { status: 'success' },
    { status: 'failed' },
    { status: 'success' },
    { status: 'failed' },
    { status: 'failed' },
    { status: 'success' },
  ];
  const decision = shouldAutoRollbackFromRuns(runs, {
    minSamples: 10,
    failRateThreshold: 0.4,
  });
  assert.equal(decision.sampleSize, 10);
  assert.equal(decision.shouldRollback, true);
  assert.equal(decision.reason, 'threshold_exceeded');
});

test('P1: chaos-like mixed traffic should keep SLO healthy with conservative thresholds', () => {
  const metrics = {
    startedEventRuns: 120,
    startedLegacyRuns: 0,
    dispatchSuccess: 1180,
    dispatchFailed: 20,
    ackSuccess: 1150,
    ackFailure: 30,
    timeoutTransitions: 2,
  };
  const result = evaluateRuntimeSlo(metrics, {
    dispatchSuccessRate: 0.97,
    ackSuccessRate: 0.95,
    timeoutRate: 0.03,
  });
  assert.equal(result.sloBreaches.dispatchSuccessRate, false);
  assert.equal(result.sloBreaches.ackSuccessRate, false);
  assert.equal(result.sloBreaches.timeoutRate, false);
});

test('P1: e2e-like run window should stay in canary when failure ratio is under threshold', () => {
  const runWindow = [
    { status: 'success' },
    { status: 'success' },
    { status: 'failed' },
    { status: 'success' },
    { status: 'success' },
    { status: 'cancelled' },
    { status: 'success' },
    { status: 'success' },
    { status: 'success' },
    { status: 'success' },
  ];
  const decision = shouldAutoRollbackFromRuns(runWindow, {
    minSamples: 10,
    failRateThreshold: 0.3,
  });
  assert.equal(decision.shouldRollback, false);
  assert.equal(decision.reason, 'healthy');
});
