import {
  createDeviceCommand,
  createDeviceEvent,
  createPlanControlEvent,
  createPlanRun,
  createPlanRunSteps,
  fetchActiveRunsForPlan,
  fetchDeviceCommand,
  fetchDeviceEventByCorrelation,
  fetchDevices,
  fetchRunByDedupeKey,
  fetchLatestSentCommand,
  fetchPlan,
  fetchPlanZones,
  fetchRecentRunsByPlanIds,
  fetchRunCommands,
  fetchRunEvents,
  fetchRunStep,
  fetchSchedulablePlans,
  fetchTimedOutRunningSteps,
  fetchRun,
  fetchRunSteps,
  fetchZoneBindings,
  insertDeviceCommandLog,
  listRunStepsByStatus,
  cancelStepTimeoutJob,
  cleanupOrphanPlanScheduleJobs,
  scheduleStepTimeoutJob,
  updateDeviceCommand,
  updatePlanRun,
  updatePlanRunStep,
  upsertPlanScheduleJob,
  removePlanScheduleJob,
} from './supabase-rest.mjs';
import { ScheduleSyncError } from './schedule-sync-error.mjs';

function nowIso() {
  return new Date().toISOString();
}

export function toMs(minutes, scale) {
  return Math.max(1000, Math.round(minutes * 60 * 1000 * scale));
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }
  return data;
}

export function buildDedupeKey(planId, triggerType) {
  const currentMinute = new Date(nowIso()).toISOString().slice(0, 16);
  return `${planId}:${triggerType}:${currentMinute}`;
}

export function resolveExecutionModeForPlan(config, planId) {
  const rolloutMode = String(config.rolloutMode ?? 'full').toLowerCase();
  if (config.engineMode === 'legacy') {
    return 'legacy';
  }
  if (rolloutMode === 'full') {
    return 'event_driven';
  }
  if (rolloutMode === 'shadow') {
    return 'legacy';
  }
  const canaryPlanIds = new Set(
    String(config.canaryPlanIds ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  return canaryPlanIds.has(planId) ? 'event_driven' : 'legacy';
}

export function buildCommandIdempotencyKey(step, binding, action) {
  return `${step.id}:${binding.device_id}:${binding.station_id}:${action}`;
}

export function evaluateRuntimeSlo(metrics, thresholds = {}) {
  const dispatchTotal = Number(metrics.dispatchSuccess ?? 0) + Number(metrics.dispatchFailed ?? 0);
  const ackTotal = Number(metrics.ackSuccess ?? 0) + Number(metrics.ackFailure ?? 0);
  const runTotal = Number(metrics.startedEventRuns ?? 0) + Number(metrics.startedLegacyRuns ?? 0);
  const dispatchSuccessRate = dispatchTotal > 0 ? Number(metrics.dispatchSuccess ?? 0) / dispatchTotal : 1;
  const ackSuccessRate = ackTotal > 0 ? Number(metrics.ackSuccess ?? 0) / ackTotal : 1;
  const timeoutRate = runTotal > 0 ? Number(metrics.timeoutTransitions ?? 0) / runTotal : 0;
  return {
    rates: {
      dispatchSuccessRate,
      ackSuccessRate,
      timeoutRate,
    },
    sloBreaches: {
      dispatchSuccessRate: dispatchSuccessRate < Number(thresholds.dispatchSuccessRate ?? 0.99),
      ackSuccessRate: ackSuccessRate < Number(thresholds.ackSuccessRate ?? 0.98),
      timeoutRate: timeoutRate > Number(thresholds.timeoutRate ?? 0.02),
    },
  };
}

export function shouldAutoRollbackFromRuns(runs, options = {}) {
  const minSamples = Math.max(1, Number(options.minSamples ?? 10));
  if (!Array.isArray(runs) || runs.length < minSamples) {
    return {
      shouldRollback: false,
      failRate: 0,
      sampleSize: Array.isArray(runs) ? runs.length : 0,
      reason: 'insufficient_samples',
    };
  }
  const failureStatuses = new Set(['failed', 'cancelled']);
  const failedCount = runs.filter((item) => failureStatuses.has(String(item?.status ?? ''))).length;
  const failRate = failedCount / Math.max(1, runs.length);
  const threshold = Number(options.failRateThreshold ?? 0.3);
  return {
    shouldRollback: failRate >= threshold,
    failRate,
    sampleSize: runs.length,
    reason: failRate >= threshold ? 'threshold_exceeded' : 'healthy',
  };
}

function canaryScopePlanIds(config, currentPlanId) {
  if (String(config.rolloutMode ?? '').toLowerCase() !== 'canary') {
    return [currentPlanId];
  }
  const ids = String(config.canaryPlanIds ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : [currentPlanId];
}

export function createRunService(config, logger = console) {
  const stepTimers = new Map();
  let reconcileTimer = null;
  let lastSloAlertAt = 0;
  const runtimeMetrics = {
    startedEventRuns: 0,
    startedLegacyRuns: 0,
    dispatchSuccess: 0,
    dispatchFailed: 0,
    ackSuccess: 0,
    ackFailure: 0,
    timeoutTransitions: 0,
    rollbackTriggered: 0,
    sloBreachAlerts: 0,
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getSloThresholds() {
    return {
      dispatchSuccessRate: Number(config.sloDispatchSuccessRate ?? 0.99),
      ackSuccessRate: Number(config.sloAckSuccessRate ?? 0.98),
      timeoutRate: Number(config.sloTimeoutRate ?? 0.02),
    };
  }

  function emitSloAlertIfNeeded(source) {
    const evaluated = evaluateRuntimeSlo(runtimeMetrics, getSloThresholds());
    const hasBreach = Object.values(evaluated.sloBreaches).some(Boolean);
    if (!hasBreach) return;
    const now = Date.now();
    const cooldownMs = Math.max(1000, Number(config.alertCooldownMs ?? 300000));
    if (now - lastSloAlertAt < cooldownMs) return;
    lastSloAlertAt = now;
    runtimeMetrics.sloBreachAlerts += 1;
    const snapshot = {
      source,
      service: config.serviceName,
      engineMode: config.engineMode,
      rolloutMode: config.rolloutMode,
      ...evaluated,
      updatedAt: nowIso(),
    };
    logger.warn('[execution-service] slo breach detected', snapshot);
  }

  async function syncPlanSchedule(planId, options = {}) {
    const strict = options.strict !== false;
    if (!config.internalApiBaseUrl || !config.internalAuthToken) {
      const message = 'Execution schedule sync is not configured';
      if (strict) {
        throw new ScheduleSyncError(message);
      }
      logger.error('[execution-service] sync plan schedule skipped', { planId, message });
      return;
    }
    try {
      await upsertPlanScheduleJob(config, {
        planId,
        apiBaseUrl: config.internalApiBaseUrl,
        authToken: config.internalAuthToken,
        timezone: config.projectTimezone,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (strict) {
        throw new ScheduleSyncError(message, { cause: error });
      }
      logger.error('[execution-service] sync plan schedule failed', { planId, error: message });
    }
  }

  async function unsyncPlanSchedule(planId) {
    if (!config.internalApiBaseUrl || !config.internalAuthToken) {
      throw new ScheduleSyncError('Execution schedule sync is not configured');
    }
    try {
      await removePlanScheduleJob(config, planId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ScheduleSyncError(message, { cause: error });
    }
  }

  async function syncAllPlanSchedules() {
    if (!config.internalApiBaseUrl || !config.internalAuthToken) {
      return;
    }
    const plans = await fetchSchedulablePlans(config).catch(() => []);
    await Promise.all(plans.map((plan) => syncPlanSchedule(plan.id, { strict: false })));
  }

  async function queueCommand({
    run,
    step,
    plan,
    binding,
    device,
    action,
    durationSeconds = null,
  }) {
    const idempotencyKey = buildCommandIdempotencyKey(step, binding, action);
    const command = await createDeviceCommand(config, {
      run_id: run.id,
      run_step_id: step.id,
      plan_id: plan.id,
      zone_id: step.zone_id,
      device_id: binding.device_id,
      action,
      station_index: Number(binding.station_id),
      duration_seconds: durationSeconds,
      status: 'pending',
      idempotency_key: idempotencyKey,
      deadline_at: new Date(Date.now() + config.commandDeadlineMs).toISOString(),
      metadata: {
        clientKey: device.client_key,
      },
    });

    await insertDeviceCommandLog(config, {
      run_id: run.id,
      run_step_id: step.id,
      device_id: binding.device_id,
      command_type: action,
      transport: 'mqtt',
      payload: {
        deviceId: device.client_key,
        stationIndex: Number(binding.station_id),
        durationSeconds,
      },
      status: 'pending',
      sent_at: nowIso(),
    }).catch(() => {});

    return command;
  }

  async function dispatchCommand(commandId) {
    const command = await fetchDeviceCommand(config, commandId);
    if (!command || !['pending', 'failed', 'timeout'].includes(command.status)) {
      return command;
    }

    const endpoint = command.action === 'open' ? 'open' : 'close';
    const payload = {
      stationIndex: command.station_index,
      durationSeconds: Math.min(7200, Math.max(1, Number(command.duration_seconds ?? 1))),
      runId: command.run_id,
      runStepId: command.run_step_id,
      planId: command.plan_id,
    };

    try {
      await postJson(
        `${config.mqttGatewayBaseUrl}/devices/${encodeURIComponent(command.metadata?.clientKey ?? command.device_id)}/commands/${endpoint}`,
        payload,
      );
      runtimeMetrics.dispatchSuccess += 1;
      void emitSloAlertIfNeeded('dispatch_success');
      return updateDeviceCommand(config, command.id, {
        status: 'sent',
        sent_at: nowIso(),
        attempt_count: Number(command.attempt_count ?? 0) + 1,
        error_message: null,
      });
    } catch (error) {
      runtimeMetrics.dispatchFailed += 1;
      void emitSloAlertIfNeeded('dispatch_failed');
      const attemptCount = Number(command.attempt_count ?? 0) + 1;
      const canRetry = attemptCount < Number(command.max_attempts ?? config.commandMaxAttempts);
      const updated = await updateDeviceCommand(config, command.id, {
        status: canRetry ? 'failed' : 'timeout',
        attempt_count: attemptCount,
        error_message: error instanceof Error ? error.message : 'dispatch failed',
      });
      if (canRetry) {
        setTimeout(() => {
          void dispatchCommand(command.id);
        }, config.commandRetryMs);
      }
      return updated;
    }
  }

  function clearStepTimer(stepId) {
    const timer = stepTimers.get(stepId);
    if (timer) {
      clearTimeout(timer);
      stepTimers.delete(stepId);
    }
  }

  async function finishRunIfNoPending(runId) {
    const pending = await listRunStepsByStatus(config, runId, ['pending', 'running']);
    if (pending.length > 0) return;
    await updatePlanRun(config, runId, {
      status: 'success',
      finished_at: nowIso(),
      current_zone_id: null,
      error_message: null,
    });
  }

  async function activateNextStep(run, plan, bindingsByZoneId, deviceById) {
    const [nextStep] = await listRunStepsByStatus(config, run.id, ['pending']);
    if (!nextStep) {
      await finishRunIfNoPending(run.id);
      return;
    }

    const bindings = bindingsByZoneId.get(nextStep.zone_id) ?? [];
    if (bindings.length === 0) {
      await updatePlanRunStep(config, nextStep.id, {
        status: 'failed',
        started_at: nowIso(),
        finished_at: nowIso(),
        error_message: '该分区未绑定可执行控制器站点',
      });
      await activateNextStep(run, plan, bindingsByZoneId, deviceById);
      return;
    }

    const binding = bindings[0];
    const device = deviceById.get(binding.device_id);
    if (!device) {
      await updatePlanRunStep(config, nextStep.id, {
        status: 'failed',
        started_at: nowIso(),
        finished_at: nowIso(),
        error_message: `设备不存在: ${binding.device_id}`,
      });
      await activateNextStep(run, plan, bindingsByZoneId, deviceById);
      return;
    }

    const durationMs = toMs(nextStep.target_duration_minutes, config.durationScale);
    await updatePlanRun(config, run.id, {
      status: 'running',
      current_zone_id: nextStep.zone_id,
      started_at: run.started_at ?? nowIso(),
    });
    const timeoutAt = new Date(Date.now() + durationMs).toISOString();
    await updatePlanRunStep(config, nextStep.id, {
      status: 'running',
      started_at: nowIso(),
      timeout_at: timeoutAt,
      error_message: null,
    });
    const timeoutJobId = await scheduleStepTimeoutJob(config, {
      stepId: nextStep.id,
      timeoutAt,
    }).catch(() => null);
    if (timeoutJobId) {
      await updatePlanRunStep(config, nextStep.id, {
        timeout_job_id: Number(timeoutJobId),
      }).catch(() => {});
    }

    const openCommand = await queueCommand({
      run,
      step: nextStep,
      plan,
      binding,
      device,
      action: 'open',
      durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
    });
    await dispatchCommand(openCommand.id);

    clearStepTimer(nextStep.id);
    stepTimers.set(nextStep.id, setTimeout(() => {
      void closeStepByTimeout(run, nextStep, plan, binding, device, bindingsByZoneId, deviceById);
    }, durationMs));
  }

  async function closeStepByTimeout(run, step, plan, binding, device, bindingsByZoneId, deviceById) {
    clearStepTimer(step.id);
    runtimeMetrics.timeoutTransitions += 1;
    void emitSloAlertIfNeeded('step_timeout');
    await cancelStepTimeoutJob(config, step.id).catch(() => {});
    const closeCommand = await queueCommand({
      run,
      step,
      plan,
      binding,
      device,
      action: 'close',
      durationSeconds: 0,
    });
    await dispatchCommand(closeCommand.id);
    await createDeviceEvent(config, {
      command_id: closeCommand.id,
      run_id: run.id,
      run_step_id: step.id,
      plan_id: plan.id,
      device_id: binding.device_id,
      event_type: 'timeout',
      source: 'system',
      station_index: Number(binding.station_id),
      success: true,
      payload: { reason: 'step_timeout' },
    }).catch(() => {});

    await updatePlanRunStep(config, step.id, {
      status: 'success',
      finished_at: nowIso(),
      actual_duration_minutes: step.target_duration_minutes,
    });
    await activateNextStep(run, plan, bindingsByZoneId, deviceById);
  }

  async function buildRunContext(planId) {
    const plan = await fetchPlan(config, planId);
    if (!plan) {
      throw new Error('计划不存在');
    }
    if (!plan.enabled) {
      throw new Error('计划已停用');
    }

    const planZones = await fetchPlanZones(config, planId);
    if (planZones.length === 0) {
      throw new Error('计划未配置可执行分区');
    }

    const bindings = await fetchZoneBindings(config, [...new Set(planZones.map((zone) => zone.zone_id).filter(Boolean))]);
    const deviceIds = [...new Set(bindings.map((binding) => binding.device_id))];
    const devices = await fetchDevices(config, deviceIds);
    const deviceById = new Map(devices.map((item) => [item.id, item]));
    const bindingsByZoneId = new Map();
    bindings.forEach((binding) => {
      const device = deviceById.get(binding.device_id);
      if (!device || device.type !== 'controller') return;
      const list = bindingsByZoneId.get(binding.zone_id) ?? [];
      if (list.length === 0) {
        list.push(binding);
        bindingsByZoneId.set(binding.zone_id, list);
      }
    });

    return { plan, planZones, bindingsByZoneId, deviceById };
  }

  async function resolveExecutionModeWithRollback(planId) {
    const mode = resolveExecutionModeForPlan(config, planId);
    if (mode !== 'event_driven' || !config.rolloutAutoRollbackEnabled) {
      return mode;
    }

    const windowMs = Math.max(1, Number(config.rolloutWindowMinutes ?? 30)) * 60 * 1000;
    const sinceIso = new Date(Date.now() - windowMs).toISOString();
    const scopePlanIds = canaryScopePlanIds(config, planId);
    const runs = await fetchRecentRunsByPlanIds(config, scopePlanIds, sinceIso).catch(() => []);
    const minSamples = Math.max(1, Number(config.rolloutMinSamples ?? 10));
    const rollbackDecision = shouldAutoRollbackFromRuns(runs, {
      minSamples,
      failRateThreshold: config.rolloutFailRateThreshold,
    });
    if (!rollbackDecision.shouldRollback) {
      return mode;
    }
    runtimeMetrics.rollbackTriggered += 1;
    logger.error('[execution-service] auto rollback to legacy', {
      failRate: rollbackDecision.failRate,
      threshold: config.rolloutFailRateThreshold,
      sampleSize: rollbackDecision.sampleSize,
      scopePlanIds,
    });
    return 'legacy';
  }

  async function startRun(planId, triggerType = 'manual') {
    const executionMode = await resolveExecutionModeWithRollback(planId);
    const { plan, planZones, bindingsByZoneId, deviceById } = await buildRunContext(planId);
    const effectiveTriggerType = triggerType;
    const dedupeKey = buildDedupeKey(plan.id, `${effectiveTriggerType}:${executionMode}`);
    let run;
    try {
      run = await createPlanRun(config, {
        user_id: plan.user_id,
        plan_id: plan.id,
        field_id: plan.field_id,
        status: 'pending',
        trigger_type: effectiveTriggerType,
        scheduled_for: nowIso(),
        dedupe_key: dedupeKey,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate key value/i.test(message)) {
        throw error;
      }
      const existing = await fetchRunByDedupeKey(config, dedupeKey);
      if (!existing) {
        throw error;
      }
      return existing;
    }

    const steps = await createPlanRunSteps(config, planZones.map((zone) => ({
      run_id: run.id,
      zone_id: zone.zone_id,
      zone_name: zone.zone_name ?? `站点 ${zone.site_number}`,
      site_number: zone.site_number,
      sort_order: zone.sort_order,
      status: 'pending',
      target_duration_minutes: zone.duration_minutes,
    })));

    await createPlanControlEvent(config, {
      run_id: run.id,
      plan_id: plan.id,
      requested_by: plan.user_id,
      action: 'start',
      source: effectiveTriggerType === 'schedule' ? 'scheduler' : 'api',
      payload: {
        triggerType: effectiveTriggerType,
        engineMode: config.engineMode,
        rolloutMode: config.rolloutMode,
        executionMode,
      },
    }).catch(() => {});

    if (executionMode === 'legacy') {
      runtimeMetrics.startedLegacyRuns += 1;
      if (String(config.rolloutMode ?? '').toLowerCase() === 'shadow') {
        logger.log('[execution-service] shadow rollout legacy execution', {
          planId: plan.id,
          runId: run.id,
        });
      }
      void executeLegacyRun(run, plan, steps, bindingsByZoneId, deviceById);
    } else {
      runtimeMetrics.startedEventRuns += 1;
      await activateNextStep(run, plan, bindingsByZoneId, deviceById);
    }
    return run;
  }

  async function executeLegacyRun(run, plan, steps, bindingsByZoneId, deviceById) {
    await updatePlanRun(config, run.id, {
      status: 'running',
      started_at: nowIso(),
    });
    for (const step of steps) {
      const latestRun = await fetchRun(config, run.id);
      if (!latestRun || latestRun.status === 'cancelled') {
        return;
      }
      const bindings = bindingsByZoneId.get(step.zone_id) ?? [];
      const binding = bindings[0];
      if (!binding) {
        await updatePlanRunStep(config, step.id, {
          status: 'failed',
          finished_at: nowIso(),
          error_message: 'legacy: no binding',
        });
        continue;
      }
      const device = deviceById.get(binding.device_id);
      if (!device) continue;
      await updatePlanRunStep(config, step.id, {
        status: 'running',
        started_at: nowIso(),
      });
      const openCommand = await queueCommand({
        run,
        step,
        plan,
        binding,
        device,
        action: 'open',
        durationSeconds: Math.max(1, Math.round(toMs(step.target_duration_minutes, config.durationScale) / 1000)),
      });
      await dispatchCommand(openCommand.id);
      await sleep(toMs(step.target_duration_minutes, config.durationScale));
      const closeCommand = await queueCommand({
        run,
        step,
        plan,
        binding,
        device,
        action: 'close',
      });
      await dispatchCommand(closeCommand.id);
      await updatePlanRunStep(config, step.id, {
        status: 'success',
        finished_at: nowIso(),
      });
    }
    await updatePlanRun(config, run.id, {
      status: 'success',
      finished_at: nowIso(),
      current_zone_id: null,
    });
  }

  async function startManualRun(planId) {
    const run = await startRun(planId, 'manual');
    await syncPlanSchedule(planId, { strict: false });
    return run;
  }

  async function startScheduledRun(planId) {
    return startRun(planId, 'schedule');
  }

  async function stopRun(runId, requestedBy = null) {
    const run = await fetchRun(config, runId);
    if (!run) {
      throw new Error('执行任务不存在');
    }
    await updatePlanRun(config, runId, {
      status: 'cancelled',
      finished_at: nowIso(),
      current_zone_id: null,
      error_message: null,
    });
    const runningSteps = await listRunStepsByStatus(config, runId, ['running', 'pending']);
    await Promise.all(runningSteps.map(async (step) => {
      clearStepTimer(step.id);
      await cancelStepTimeoutJob(config, step.id).catch(() => {});
      await updatePlanRunStep(config, step.id, {
        status: 'cancelled',
        finished_at: nowIso(),
      });
    }));
    await createPlanControlEvent(config, {
      run_id: runId,
      plan_id: run.plan_id,
      requested_by: requestedBy,
      action: 'stop',
      source: 'api',
      payload: {},
    }).catch(() => {});
  }

  async function stopPlan(planId, requestedBy = null) {
    const activeRuns = await fetchActiveRunsForPlan(config, planId);
    if (!activeRuns || activeRuns.length === 0) {
      throw new Error('当前没有可停止的执行任务');
    }
    await Promise.all(activeRuns.map((run) => stopRun(run.id, requestedBy)));
    return activeRuns;
  }

  async function handleGatewayAckEvent(payload) {
    if (payload.correlationKey) {
      const existing = await fetchDeviceEventByCorrelation(config, payload.correlationKey);
      if (existing) {
        return { deduped: true };
      }
    }
    const runStepId = payload.runStepId;
    const deviceId = payload.deviceId;
    const stationIndex = Number(payload.stationIndex ?? 0);
    const action = payload.action === 'open' ? 'open' : 'close';
    if (!runStepId || !deviceId) {
      throw new Error('missing runStepId/deviceId for gateway ack');
    }
    const command = await fetchLatestSentCommand(config, { runStepId, deviceId, stationIndex, action });
    if (!command) {
      throw new Error('未匹配到命令');
    }
    const success = payload.success !== false;
    if (success) {
      runtimeMetrics.ackSuccess += 1;
    } else {
      runtimeMetrics.ackFailure += 1;
    }
    void emitSloAlertIfNeeded(success ? 'ack_success' : 'ack_failure');
    await updateDeviceCommand(config, command.id, {
      status: success ? 'acked' : 'failed',
      acked_at: nowIso(),
      error_message: success ? null : String(payload.error ?? 'nack'),
    });
    await createDeviceEvent(config, {
      command_id: command.id,
      run_id: command.run_id,
      run_step_id: command.run_step_id,
      plan_id: command.plan_id,
      device_id: command.device_id,
      event_type: success ? 'command_ack' : 'command_nack',
      source: 'mqtt-gateway',
      station_index: command.station_index,
      success,
      correlation_key: payload.correlationKey ?? null,
      payload,
    });
    if (success && action === 'close') {
      await cancelStepTimeoutJob(config, command.run_step_id).catch(() => {});
      await updatePlanRunStep(config, command.run_step_id, {
        status: 'success',
        finished_at: nowIso(),
      }).catch(() => {});
      const run = await fetchRun(config, command.run_id);
      if (run) {
        const { plan, bindingsByZoneId, deviceById } = await buildRunContext(run.plan_id);
        await activateNextStep(run, plan, bindingsByZoneId, deviceById).catch(() => {});
      }
    }
  }

  async function handleStepTimeout(stepId) {
    const step = await fetchRunStep(config, stepId);
    if (!step || step.status !== 'running') {
      return { ignored: true, reason: 'step_not_running' };
    }
    const run = await fetchRun(config, step.run_id);
    if (!run) {
      return { ignored: true, reason: 'run_not_found' };
    }
    const { plan, bindingsByZoneId, deviceById } = await buildRunContext(run.plan_id);
    const bindings = bindingsByZoneId.get(step.zone_id) ?? [];
    const binding = bindings[0];
    if (!binding) {
      await updatePlanRunStep(config, step.id, {
        status: 'failed',
        finished_at: nowIso(),
        error_message: 'timeout reached but no binding',
      });
      return { ignored: false, reason: 'no_binding' };
    }
    const device = deviceById.get(binding.device_id);
    if (!device) {
      await updatePlanRunStep(config, step.id, {
        status: 'failed',
        finished_at: nowIso(),
        error_message: 'timeout reached but device missing',
      });
      return { ignored: false, reason: 'missing_device' };
    }
    await closeStepByTimeout(run, step, plan, binding, device, bindingsByZoneId, deviceById);
    return { ignored: false };
  }

  async function getRunDetail(runId) {
    const run = await fetchRun(config, runId);
    if (!run) return null;
    const [steps, commands, events] = await Promise.all([
      fetchRunSteps(config, runId),
      fetchRunCommands(config, runId).catch(() => []),
      fetchRunEvents(config, runId).catch(() => []),
    ]);
    return { run, steps, commands, events };
  }

  function getRuntimeMetrics() {
    const evaluated = evaluateRuntimeSlo(runtimeMetrics, {
      ...getSloThresholds(),
    });
    return {
      ...runtimeMetrics,
      engineMode: config.engineMode,
      rolloutMode: config.rolloutMode,
      ...evaluated,
      updatedAt: nowIso(),
    };
  }

  function startScheduler() {
    if (config.engineMode === 'legacy') {
      logger.log('[execution-service] legacy scheduler mode not migrated in this release');
    }
    if (!config.reconcileEnabled || reconcileTimer !== null) {
      void syncAllPlanSchedules();
      return;
    }
    void syncAllPlanSchedules();
    reconcileTimer = setInterval(() => {
      void reconcileTimedOutSteps();
    }, config.reconcileMs);
  }

  async function reconcileTimedOutSteps() {
    try {
      await cleanupOrphanPlanScheduleJobs(config).catch(() => 0);
      const timedOutSteps = await fetchTimedOutRunningSteps(config, nowIso());
      if (!timedOutSteps?.length) {
        return;
      }
      logger.log('[execution-service] reconcile found timed-out running steps', {
        count: timedOutSteps.length,
      });
      for (const step of timedOutSteps) {
        await handleStepTimeout(step.id);
      }
    } catch (error) {
      logger.error('[execution-service] reconcile failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function stopScheduler() {
    for (const [, timer] of stepTimers) {
      clearTimeout(timer);
    }
    stepTimers.clear();
    if (reconcileTimer !== null) {
      clearInterval(reconcileTimer);
      reconcileTimer = null;
    }
  }

  return {
    startManualRun,
    startScheduledRun,
    stopRun,
    stopPlan,
    getRunDetail,
    getRuntimeMetrics,
    dispatchCommand,
    handleGatewayAckEvent,
    handleStepTimeout,
    syncPlanSchedule,
    unsyncPlanSchedule,
    syncAllPlanSchedules,
    startScheduler,
    stopScheduler,
  };
}
