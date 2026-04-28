import {
  createPlanRun,
  createPlanRunSteps,
  fetchDevices,
  fetchPlan,
  fetchPlanZones,
  fetchSchedulablePlans,
  fetchActiveRunsForPlan,
  fetchRun,
  fetchRunSteps,
  fetchScheduledRunsForWindow,
  fetchZoneBindings,
  insertDeviceCommandLog,
  updatePlanRun,
  updatePlanRunStep,
} from './supabase-rest.mjs';

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export function createRunService(config, logger = console) {
  const activeRuns = new Set();
  const recentlyScheduled = new Set();
  let schedulerTimer = null;
  let schedulerTickRunning = false;

  function formatHm(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function startOfMinute(date) {
    const next = new Date(date);
    next.setSeconds(0, 0);
    return next;
  }

  function endOfMinute(date) {
    const next = startOfMinute(date);
    next.setMinutes(next.getMinutes() + 1);
    return next;
  }

  function getWeekdayNumber(date) {
    const weekday = date.getDay();
    return weekday === 0 ? 7 : weekday;
  }

  function daysBetween(startDate, endDate) {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
    return Math.floor((end - start) / 86400000);
  }

  function shouldRunNow(plan, now) {
    if (!plan?.enabled || plan.mode !== 'auto') {
      return false;
    }

    const startAt = String(plan.start_at ?? '').slice(0, 5);
    if (!startAt || formatHm(now) !== startAt) {
      return false;
    }

    if (plan.schedule_type === 'daily') {
      return true;
    }

    if (plan.schedule_type === 'weekly') {
      const weekdays = Array.isArray(plan.weekdays)
        ? plan.weekdays.map((value) => Number(value)).filter(Number.isFinite)
        : [];
      return weekdays.includes(getWeekdayNumber(now));
    }

    if (plan.schedule_type === 'interval') {
      const intervalDays = Number(plan.interval_days ?? 0);
      if (!Number.isFinite(intervalDays) || intervalDays <= 0 || !plan.created_at) {
        return false;
      }

      return daysBetween(new Date(plan.created_at), now) % intervalDays === 0;
    }

    return false;
  }

  async function isCancelRequested(runId) {
    const run = await fetchRun(config, runId);
    return run?.status === 'cancel_requested';
  }

  async function closeBindings(runId, stepId, bindings, deviceById) {
    for (const binding of bindings) {
      const device = deviceById.get(binding.device_id);
      if (!device) {
        continue;
      }
      await insertDeviceCommandLog(config, {
        run_id: runId,
        run_step_id: stepId,
        device_id: binding.device_id,
        command_type: 'close',
        transport: 'mqtt',
        payload: {
          deviceId: device.client_key,
          stationIndex: Number(binding.station_id),
        },
        status: 'pending',
        sent_at: nowIso(),
      });

      try {
        await postJson(`${config.mqttGatewayBaseUrl}/devices/${encodeURIComponent(device.client_key)}/commands/close`, {
          stationIndex: Number(binding.station_id),
        });
      } catch (error) {
        logger.error('[execution-service] close command failed', error);
      }
    }
  }

  async function executeRun(runId, steps, bindingsByZoneId, deviceById) {
    if (activeRuns.has(runId)) {
      return;
    }
    activeRuns.add(runId);

    try {
      await updatePlanRun(config, runId, {
        status: 'running',
        started_at: nowIso(),
      });

      for (const step of steps) {
        if (await isCancelRequested(runId)) {
          await updatePlanRun(config, runId, {
            status: 'cancelled',
            finished_at: nowIso(),
            current_zone_id: null,
          });
          return;
        }

        const bindings = bindingsByZoneId.get(step.zone_id) ?? [];
        if (bindings.length === 0) {
          await updatePlanRunStep(config, step.id, {
            status: 'failed',
            started_at: nowIso(),
            finished_at: nowIso(),
            error_message: '该分区未绑定设备站点',
          });
          await updatePlanRun(config, runId, {
            status: 'failed',
            finished_at: nowIso(),
            current_zone_id: step.zone_id,
            error_message: '存在未绑定设备的分区',
          });
          return;
        }

        await updatePlanRun(config, runId, {
          current_zone_id: step.zone_id,
        });
        await updatePlanRunStep(config, step.id, {
          status: 'running',
          started_at: nowIso(),
        });

        for (const binding of bindings) {
          const device = deviceById.get(binding.device_id);
          if (!device) {
            throw new Error(`未找到设备 ${binding.device_id}`);
          }

          await insertDeviceCommandLog(config, {
            run_id: runId,
            run_step_id: step.id,
            device_id: binding.device_id,
            command_type: 'open',
            transport: 'mqtt',
            payload: {
              deviceId: device.client_key,
              stationIndex: Number(binding.station_id),
              durationSeconds: Math.round(step.target_duration_minutes * 60 * config.durationScale),
            },
            status: 'sent',
            sent_at: nowIso(),
          });

          await postJson(`${config.mqttGatewayBaseUrl}/devices/${encodeURIComponent(device.client_key)}/commands/open`, {
            stationIndex: Number(binding.station_id),
            durationSeconds: Math.round(step.target_duration_minutes * 60 * config.durationScale),
          });
        }

        const totalWaitMs = Math.max(1000, step.target_duration_minutes * 60 * 1000 * config.durationScale);
        let waitedMs = 0;
        while (waitedMs < totalWaitMs) {
          if (await isCancelRequested(runId)) {
            await closeBindings(runId, step.id, bindings, deviceById);
            await updatePlanRunStep(config, step.id, {
              status: 'cancelled',
              finished_at: nowIso(),
              actual_duration_minutes: Number((waitedMs / 60000 / config.durationScale).toFixed(2)),
            });
            await updatePlanRun(config, runId, {
              status: 'cancelled',
              finished_at: nowIso(),
              current_zone_id: null,
            });
            return;
          }

          const tick = Math.min(config.statusPollMs, totalWaitMs - waitedMs);
          await sleep(tick);
          waitedMs += tick;
        }

        await closeBindings(runId, step.id, bindings, deviceById);
        await updatePlanRunStep(config, step.id, {
          status: 'success',
          finished_at: nowIso(),
          actual_duration_minutes: step.target_duration_minutes,
        });
      }

      await updatePlanRun(config, runId, {
        status: 'success',
        finished_at: nowIso(),
        current_zone_id: null,
      });
    } catch (error) {
      logger.error('[execution-service] executeRun failed', error);
      await updatePlanRun(config, runId, {
        status: 'failed',
        finished_at: nowIso(),
        error_message: error instanceof Error ? error.message : '执行失败',
      }).catch(() => {});
    } finally {
      activeRuns.delete(runId);
    }
  }

  async function startRun(planId, triggerType = 'manual') {
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

    const run = await createPlanRun(config, {
      user_id: plan.user_id,
      plan_id: plan.id,
      field_id: plan.field_id,
      status: 'pending',
      trigger_type: triggerType,
    });

    const steps = await createPlanRunSteps(config, planZones.map((zone) => ({
      run_id: run.id,
      zone_id: zone.zone_id,
      zone_name: zone.zone_name ?? `站点 ${zone.site_number}`,
      site_number: zone.site_number,
      sort_order: zone.sort_order,
      status: 'pending',
      target_duration_minutes: zone.duration_minutes,
    })));

    const bindings = await fetchZoneBindings(
      config,
      [...new Set(planZones.map((zone) => zone.zone_id).filter(Boolean))],
    );
    const deviceIds = [...new Set(bindings.map((binding) => binding.device_id))];
    const devices = await fetchDevices(config, deviceIds);
    const deviceById = new Map(devices.map((device) => [device.id, device]));
    const bindingsByZoneId = new Map();
    bindings.forEach((binding) => {
      const list = bindingsByZoneId.get(binding.zone_id) ?? [];
      list.push(binding);
      bindingsByZoneId.set(binding.zone_id, list);
    });

    void executeRun(run.id, steps, bindingsByZoneId, deviceById);
    return run;
  }

  async function startManualRun(planId) {
    return startRun(planId, 'manual');
  }

  async function startScheduledRun(planId) {
    return startRun(planId, 'schedule');
  }

  async function schedulerTick() {
    if (schedulerTickRunning) {
      return;
    }
    schedulerTickRunning = true;

    const now = new Date();
    const currentMinuteKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${formatHm(now)}`;
    const windowStart = startOfMinute(now);
    const windowEnd = endOfMinute(now);

    try {
      const plans = await fetchSchedulablePlans(config);
      for (const plan of plans) {
        if (!shouldRunNow(plan, now)) {
          continue;
        }

        const dedupeKey = `${plan.id}:${currentMinuteKey}`;
        if (recentlyScheduled.has(dedupeKey)) {
          continue;
        }

        const [activeRuns, existingWindowRuns] = await Promise.all([
          fetchActiveRunsForPlan(config, plan.id),
          fetchScheduledRunsForWindow(config, plan.id, windowStart.toISOString(), windowEnd.toISOString()),
        ]);

        if ((activeRuns?.length ?? 0) > 0 || (existingWindowRuns?.length ?? 0) > 0) {
          recentlyScheduled.add(dedupeKey);
          continue;
        }

        try {
          await startScheduledRun(plan.id);
          recentlyScheduled.add(dedupeKey);
          logger.log('[execution-service] scheduled run started', {
            planId: plan.id,
            minute: currentMinuteKey,
          });
        } catch (error) {
          logger.error('[execution-service] scheduled run failed to start', {
            planId: plan.id,
            error: error instanceof Error ? error.message : error,
          });
        }
      }

      for (const key of [...recentlyScheduled]) {
        if (!key.endsWith(currentMinuteKey)) {
          recentlyScheduled.delete(key);
        }
      }
    } catch (error) {
      logger.error('[execution-service] scheduler tick failed', error);
    } finally {
      schedulerTickRunning = false;
    }
  }

  function startScheduler() {
    if (!config.schedulerEnabled || schedulerTimer !== null) {
      return;
    }

    logger.log('[execution-service] scheduler enabled', {
      pollMs: config.schedulerPollMs,
    });

    void schedulerTick();
    schedulerTimer = setInterval(() => {
      void schedulerTick();
    }, config.schedulerPollMs);
  }

  function stopScheduler() {
    if (schedulerTimer !== null) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  }

  async function stopRun(runId) {
    await updatePlanRun(config, runId, {
      status: 'cancel_requested',
    });
  }

  async function getRunDetail(runId) {
    const run = await fetchRun(config, runId);
    if (!run) {
      return null;
    }
    const steps = await fetchRunSteps(config, runId);
    return { run, steps };
  }

  return {
    startManualRun,
    stopRun,
    getRunDetail,
    startScheduler,
    stopScheduler,
  };
}
