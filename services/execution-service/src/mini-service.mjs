import {
  createIrrigationPlan,
  deleteIrrigationPlan,
  deletePlanZonesForPlan,
  fetchPlan,
  insertPlanZones,
  updateIrrigationPlan,
} from './supabase-rest.mjs';

function getDemoDevices(config) {
  return [
    {
      id: config.wifiDemoDeviceId || 'demo-gateway-1',
      name: '固定演示设备',
      model: 'WC800WF',
      type: 'controller',
      status: 'online',
      fieldId: '',
      fieldName: '演示地块',
      signalStrength: 100,
      batteryLevel: 100,
      lastSeen: '演示模式',
      source: 'demo',
      channelCount: 4,
      stations: [
        { id: 'CH1', name: '1路站点' },
        { id: 'CH2', name: '2路站点' },
      ],
      bindings: [],
    },
  ];
}

function headers(config, extra = {}) {
  return {
    apikey: config.supabaseServiceRoleKey,
    authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    'content-type': 'application/json',
    ...extra,
  };
}

async function requestRows(config, path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: headers(config, options.headers),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function asNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function asNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return asNumber(value, 0);
}

function parseBoundary(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? JSON.parse(value || '[]')
      : [];

  return raw
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const lng = Number(point[0]);
        const lat = Number(point[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          return [lng, lat];
        }
      }

      if (point && typeof point === 'object') {
        const lng = Number(point.lng);
        const lat = Number(point.lat);
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          return [lng, lat];
        }
      }

      return null;
    })
    .filter(Boolean);
}

function computeGeoCenter(boundary) {
  if (!boundary.length) {
    return null;
  }
  const [lng, lat] = boundary.reduce(
    (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
    [0, 0],
  );
  return [Number((lng / boundary.length).toFixed(6)), Number((lat / boundary.length).toFixed(6))];
}

function deriveFieldStatus(netNeed, etc) {
  if (netNeed >= 5 || etc >= 5) return 'alarm';
  if (netNeed >= 2.5 || etc >= 3.8) return 'warning';
  return 'normal';
}

function estimateSoilMoisture(netNeed) {
  return Math.max(25, Math.min(78, Math.round(68 - netNeed * 6)));
}

function zoneStatusFor(fieldStatus, priority, activeRun, zoneId) {
  if (activeRun?.currentZoneId === zoneId) return 'running';
  if (activeRun?.pendingZoneIds.has(zoneId)) return 'pending';
  if (fieldStatus === 'alarm' && priority <= 1) return 'alarm';
  return 'idle';
}

function getStationDisplayValue(value) {
  const trimmed = String(value ?? '').trim();
  const chMatch = trimmed.match(/CH\s*(\d+)/i);
  if (chMatch) return `S${chMatch[1]}`;
  const routeMatch = trimmed.match(/(\d+)\s*路/);
  if (routeMatch) return `S${routeMatch[1]}`;
  const stationMatch = trimmed.match(/S0*(\d+)/i);
  if (stationMatch) return `S${stationMatch[1]}`;
  return trimmed;
}

function parseStations(value, stationCode) {
  if (Array.isArray(value)) {
    const stations = value
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const id = 'id' in item ? String(item.id ?? '').trim() : '';
        const name = 'name' in item ? String(item.name ?? '').trim() : '';
        if (!id || !name) return null;
        return { id, name };
      })
      .filter(Boolean);
    if (stations.length > 0) {
      return stations;
    }
  }

  if (stationCode) {
    return [{ id: stationCode, name: stationCode }];
  }

  return [];
}

function mapPlanMode(mode) {
  if (mode === 'semi_auto') return 'confirm';
  return mode;
}

function mapStrategyMode(mode) {
  if (mode === 'semi_auto') return 'confirm';
  if (mode === 'advisory') return 'suggest';
  return 'auto';
}

function mapExecutionMode(mode) {
  return mode === 'quota' ? 'quantity' : 'duration';
}

function mapRainPolicy(skipIfRain) {
  return skipIfRain ? 'skip' : 'continue';
}

function toNextRunLabel(plan) {
  if (plan.cycle === 'weekly') {
    return `每周 ${plan.startTime}`;
  }
  if (plan.cycle === 'interval') {
    return `每${plan.cycleValue ?? 1}天 ${plan.startTime}`;
  }
  return `每日 ${plan.startTime}`;
}

function toPlanPayload(userId, input) {
  return {
    user_id: userId,
    field_id: input.fieldId,
    name: input.name,
    schedule_type: input.cycle,
    weekdays: input.cycle === 'weekly' ? (Array.isArray(input.cycleValue) ? input.cycleValue : []) : [],
    interval_days: input.cycle === 'interval' ? Number(input.cycleValue ?? 1) : null,
    start_at: input.startTime,
    enabled: Boolean(input.enabled),
    skip_if_rain: input.rainPolicy === 'skip',
    mode: input.mode === 'confirm' ? 'semi_auto' : input.mode,
    execution_mode: input.executionMode === 'quantity' ? 'quota' : 'duration',
    target_water_m3_per_mu: input.executionMode === 'quantity' ? input.targetWater ?? null : null,
    irrigation_efficiency: input.executionMode === 'quantity' ? input.irrigationEfficiencyRate ?? null : null,
    max_duration_minutes: input.executionMode === 'quantity' ? input.maxDurationPerZone ?? null : null,
    split_rounds: input.executionMode === 'quantity' ? Boolean(input.allowSplit) : false,
  };
}

function resolvePlanZoneRows(fields, inputZones) {
  const zoneMetaById = new Map(
    fields.flatMap((field) => field.zones.map((zone) => [zone.id, zone])),
  );

  return inputZones.map((zone) => {
    const zoneMeta = zoneMetaById.get(zone.zoneId);
    if (!zoneMeta) {
      throw new Error(`计划分区 ${zone.zoneId} 不存在，请重新选择地块分区后再保存。`);
    }

    const parsedSiteNumber = Number.parseInt(String(zoneMeta.stationNo).replace(/\D+/g, ''), 10);
    if (!Number.isFinite(parsedSiteNumber)) {
      throw new Error(`分区 ${zoneMeta.name} 缺少有效站点号，无法保存计划。`);
    }

    return {
      zone_id: zone.zoneId,
      zone_name: zoneMeta.name,
      site_number: parsedSiteNumber,
      sort_order: zone.order,
      duration_minutes: zone.duration,
      enabled: zone.enabled,
    };
  });
}

async function fetchFieldRows(config, userId) {
  return requestRows(
    config,
    `field_summary_view?user_id=eq.${encodeURIComponent(userId)}&select=*&order=name.asc`,
    { method: 'GET' },
  );
}

async function fetchZoneRows(config, fieldIds) {
  if (fieldIds.length === 0) return [];
  const joined = fieldIds.map((id) => `"${id}"`).join(',');
  return requestRows(
    config,
    `field_zones?field_id=in.(${encodeURIComponent(joined)})&select=id,field_id,name,site_number,area_mu,design_flow_rate,priority,boundary&order=site_number.asc`,
    { method: 'GET' },
  );
}

async function fetchEtConfigs(config, fieldIds) {
  if (fieldIds.length === 0) return [];
  const joined = fieldIds.map((id) => `"${id}"`).join(',');
  return requestRows(
    config,
    `field_et_configs?field_id=in.(${encodeURIComponent(joined)})&select=field_id,kc_default`,
    { method: 'GET' },
  );
}

async function fetchZoneBindingsByZone(config, zoneIds) {
  if (zoneIds.length === 0) return [];
  const joined = zoneIds.map((id) => `"${id}"`).join(',');
  return requestRows(
    config,
    `zone_device_bindings?zone_id=in.(${encodeURIComponent(joined)})&select=field_id,zone_id,device_id,station_id,station_name,switch_status,lng,lat&order=station_name.asc`,
    { method: 'GET' },
  );
}

async function fetchActiveRuns(config, fieldIds) {
  if (fieldIds.length === 0) return [];
  const joined = fieldIds.map((id) => `"${id}"`).join(',');
  return requestRows(
    config,
    `plan_runs?field_id=in.(${encodeURIComponent(joined)})&status=eq.running&select=id,field_id,plan_id,status,current_zone_id,started_at&order=started_at.desc`,
    { method: 'GET' },
  );
}

async function fetchPendingRunSteps(config, runIds) {
  if (runIds.length === 0) return [];
  const joined = runIds.map((id) => `"${id}"`).join(',');
  return requestRows(
    config,
    `plan_run_steps?run_id=in.(${encodeURIComponent(joined)})&status=eq.pending&select=run_id,zone_id,status`,
    { method: 'GET' },
  );
}

async function fetchDeviceRows(config, userId) {
  return requestRows(
    config,
    `irrigation_devices?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,client_key,name,model,type,sensor_type,status,station_code,stations,field_id,zone_id,center_lng,center_lat,signal_strength,battery_level,last_seen_label&order=name.asc`,
    { method: 'GET' },
  );
}

async function fetchBindingsByDevice(config, deviceIds) {
  if (deviceIds.length === 0) return [];
  const joined = deviceIds.map((id) => `"${id}"`).join(',');
  return requestRows(
    config,
    `zone_device_bindings?device_id=in.(${encodeURIComponent(joined)})&select=field_id,zone_id,device_id,station_id,station_name,switch_status,lng,lat&order=station_name.asc`,
    { method: 'GET' },
  );
}

async function fetchPlanRows(config, userId) {
  return requestRows(
    config,
    `irrigation_plans?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,field_id,name,schedule_type,weekdays,interval_days,start_at,enabled,skip_if_rain,mode,execution_mode,target_water_m3_per_mu,irrigation_efficiency,max_duration_minutes,split_rounds,created_at&order=created_at.desc`,
    { method: 'GET' },
  );
}

async function fetchPlanZoneRows(config, planIds) {
  if (planIds.length === 0) return [];
  const joined = planIds.map((id) => `"${id}"`).join(',');
  return requestRows(
    config,
    `irrigation_plan_zones?plan_id=in.(${encodeURIComponent(joined)})&select=id,plan_id,zone_id,zone_name,site_number,sort_order,duration_minutes,enabled&order=sort_order.asc`,
    { method: 'GET' },
  );
}

async function fetchStrategyRows(config, userId) {
  return requestRows(
    config,
    `automation_strategies?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,field_id,name,type,enabled,scope,zone_ids,moisture_min,moisture_recover,etc_trigger_mm,target_water_m3_per_mu,flow_rate_m3h,irrigation_efficiency,effective_rainfall_ratio,replenish_ratio,execution_mode,min_interval_hours,max_duration_minutes,split_rounds,rain_lock_enabled,mode,created_at&order=created_at.desc`,
    { method: 'GET' },
  );
}

async function fetchFieldBundle(config, userId) {
  const fieldRows = await fetchFieldRows(config, userId);
  const fieldIds = fieldRows.map((field) => field.id);
  const [zoneRows, etConfigs] = await Promise.all([
    fetchZoneRows(config, fieldIds),
    fetchEtConfigs(config, fieldIds),
  ]);

  let runs = [];
  try {
    runs = await fetchActiveRuns(config, fieldIds);
  } catch (error) {
    console.error('[mini-service] failed to load active plan runs:', error);
  }

  const actualZoneIds = zoneRows.map((zone) => zone.id);
  const zoneBindings = await fetchZoneBindingsByZone(config, actualZoneIds);
  let runSteps = [];
  try {
    runSteps = await fetchPendingRunSteps(config, runs.map((run) => run.id));
  } catch (error) {
    console.error('[mini-service] failed to load pending plan run steps:', error);
  }

  const zonesByFieldId = new Map();
  zoneRows.forEach((zone) => {
    const list = zonesByFieldId.get(zone.field_id) ?? [];
    list.push(zone);
    zonesByFieldId.set(zone.field_id, list);
  });

  const etConfigByFieldId = new Map();
  etConfigs.forEach((configRow) => {
    etConfigByFieldId.set(configRow.field_id, configRow);
  });

  const bindingsByZoneId = new Map();
  zoneBindings.forEach((binding) => {
    const list = bindingsByZoneId.get(binding.zone_id) ?? [];
    list.push(binding);
    bindingsByZoneId.set(binding.zone_id, list);
  });

  const pendingZoneIdsByRunId = new Map();
  runSteps.forEach((step) => {
    if (!step.zone_id) return;
    const zoneIds = pendingZoneIdsByRunId.get(step.run_id) ?? new Set();
    zoneIds.add(step.zone_id);
    pendingZoneIdsByRunId.set(step.run_id, zoneIds);
  });

  const activeRunByFieldId = new Map();
  runs.forEach((run) => {
    if (run.field_id && !activeRunByFieldId.has(run.field_id)) {
      activeRunByFieldId.set(run.field_id, {
        currentZoneId: run.current_zone_id,
        pendingZoneIds: pendingZoneIdsByRunId.get(run.id) ?? new Set(),
      });
    }
  });

  const fields = fieldRows.map((row) => {
    const boundary = parseBoundary(row.boundary);
    const center = computeGeoCenter(boundary) ?? (
      asNullableNumber(row.center_lng) !== null && asNullableNumber(row.center_lat) !== null
        ? [asNullableNumber(row.center_lng), asNullableNumber(row.center_lat)]
        : null
    );
    const et0 = asNumber(row.et0, 4.2);
    const kc = asNumber(etConfigByFieldId.get(row.id)?.kc_default, asNumber(row.kc, 0.95));
    const etc = asNumber(row.etc, Number((et0 * kc).toFixed(2)));
    const rainfall24h = asNumber(row.rainfall_mm, 0);
    const netNeed = asNumber(row.net_irrigation_need_mm, Math.max(0, etc - rainfall24h));
    const soilMoisture = estimateSoilMoisture(netNeed);
    const status = deriveFieldStatus(netNeed, etc);
    const activeRun = activeRunByFieldId.get(row.id);
    const zones = (zonesByFieldId.get(row.id) ?? []).map((zone) => {
      const zoneBoundary = parseBoundary(zone.boundary);
      const zoneCenter = computeGeoCenter(zoneBoundary);
      const zoneBindingsForZone = bindingsByZoneId.get(zone.id) ?? [];
      const stationNames = [...new Set(zoneBindingsForZone.map((binding) => getStationDisplayValue(binding.station_name)))];
      const deviceIds = [...new Set(zoneBindingsForZone.map((binding) => binding.device_id))];
      return {
        id: zone.id,
        fieldId: zone.field_id,
        name: zone.name,
        siteNumber: zone.site_number,
        stationNo: stationNames.length > 0 ? stationNames.join(' / ') : `S${String(zone.site_number).padStart(2, '0')}`,
        status: zoneStatusFor(status, zone.priority, activeRun, zone.id),
        duration: 45,
        soilMoisture: Math.max(20, soilMoisture - asNumber(zone.priority, 1) * 2),
        polygon: [],
        center: [0, 0],
        geoBoundary: zoneBoundary,
        geoCenter: zoneCenter ?? undefined,
        deviceIds,
      };
    });

    return {
      id: row.id,
      name: row.name,
      code: row.code,
      crop: row.crop_type,
      growthStage: row.growth_stage,
      area: asNumber(row.area_mu, 0),
      kc,
      irrigationEfficiency: asNumber(row.irrigation_efficiency, 0.85),
      status,
      soilMoisture,
      soilTemperature: 22,
      flowRate: 0,
      pressure: 0,
      lastIrrigation: '—',
      recommendedDuration: Math.max(30, Math.round(netNeed * 18)),
      rainfall24h,
      et0,
      etc,
      kcUpdateTime: row.et_date ?? '—',
      polygon: [],
      center: [0, 0],
      geoBoundary: boundary,
      geoCenter: center ?? undefined,
      zones,
    };
  });

  return {
    fields,
    fieldNameById: new Map(fields.map((field) => [field.id, field.name])),
  };
}

async function fetchRealDevices(config, userId, fieldNameById, includeDemo = false) {
  const deviceRows = await fetchDeviceRows(config, userId);
  const deviceIds = deviceRows.map((device) => device.id);
  const bindingRows = await fetchBindingsByDevice(config, deviceIds);
  const bindingsByDeviceId = new Map();

  bindingRows.forEach((binding) => {
    const list = bindingsByDeviceId.get(binding.device_id) ?? [];
    list.push(binding);
    bindingsByDeviceId.set(binding.device_id, list);
  });

  const realDevices = deviceRows.map((row) => {
    const bindings = (bindingsByDeviceId.get(row.id) ?? []).map((binding) => {
      const lng = asNullableNumber(binding.lng);
      const lat = asNullableNumber(binding.lat);
      return {
        fieldId: binding.field_id,
        zoneId: binding.zone_id,
        stationId: binding.station_id,
        stationName: binding.station_name,
        switchStatus: binding.switch_status ?? 'unknown',
        geoPosition: lng !== null && lat !== null ? [lng, lat] : undefined,
      };
    });
    const primaryBinding = bindings[0];
    const lng = asNullableNumber(row.center_lng);
    const lat = asNullableNumber(row.center_lat);
    const geoPosition = lng !== null && lat !== null
      ? [lng, lat]
      : primaryBinding?.geoPosition;

    return {
      id: row.id,
      name: row.name,
      model: row.model,
      type: row.type,
      sensorType: row.sensor_type ?? undefined,
      status: row.status,
      position: [0, 0],
      geoPosition,
      zoneId: row.zone_id ?? primaryBinding?.zoneId ?? '',
      fieldId: row.field_id ?? primaryBinding?.fieldId ?? '',
      stationNo: row.station_code ?? primaryBinding?.stationName ?? undefined,
      lastSeen: row.last_seen_label ?? '—',
      signalStrength: row.signal_strength ?? undefined,
      batteryLevel: row.battery_level ?? undefined,
      stations: parseStations(row.stations, row.station_code),
      bindings,
      fieldName: fieldNameById.get(row.field_id ?? primaryBinding?.fieldId ?? '') ?? '',
      source: 'real',
    };
  });

  return includeDemo ? [...getDemoDevices(config), ...realDevices] : realDevices;
}

async function fetchRealPlans(config, userId, fieldNameById) {
  const planRows = await fetchPlanRows(config, userId);
  const planIds = planRows.map((plan) => plan.id);
  const zoneRows = await fetchPlanZoneRows(config, planIds);
  const zonesByPlanId = new Map();

  zoneRows.forEach((zone) => {
    const list = zonesByPlanId.get(zone.plan_id) ?? [];
    list.push(zone);
    zonesByPlanId.set(zone.plan_id, list);
  });

  return planRows.map((row) => {
    const zones = (zonesByPlanId.get(row.id) ?? []).map((zone) => ({
      zoneId: zone.zone_id ?? zone.id,
      order: zone.sort_order,
      duration: zone.duration_minutes,
      enabled: zone.enabled,
    }));

    const cycle = row.schedule_type;
    const cycleValue = cycle === 'weekly'
      ? (Array.isArray(row.weekdays) ? row.weekdays : [])
      : cycle === 'interval'
        ? (row.interval_days ?? 1)
        : undefined;
    const startTime = String(row.start_at).slice(0, 5);

    return {
      id: row.id,
      name: row.name,
      fieldId: row.field_id,
      fieldName: fieldNameById.get(row.field_id) ?? '',
      mode: mapPlanMode(row.mode),
      cycle,
      cycleValue,
      startTime,
      executionMode: mapExecutionMode(row.execution_mode),
      rainPolicy: mapRainPolicy(row.skip_if_rain),
      enabled: row.enabled,
      totalDuration: zones.filter((zone) => zone.enabled).reduce((sum, zone) => sum + zone.duration, 0),
      zoneCount: zones.filter((zone) => zone.enabled).length,
      zones,
      targetWater: row.target_water_m3_per_mu == null ? undefined : asNumber(row.target_water_m3_per_mu),
      irrigationEfficiencyRate: row.irrigation_efficiency == null ? undefined : asNumber(row.irrigation_efficiency),
      maxDurationPerZone: row.max_duration_minutes ?? undefined,
      allowSplit: row.split_rounds,
    };
  });
}

async function fetchRealStrategies(config, userId, fieldNameById) {
  const rows = await fetchStrategyRows(config, userId);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    fieldId: row.field_id,
    fieldName: fieldNameById.get(row.field_id) ?? '',
    type: row.type,
    mode: mapStrategyMode(row.mode),
    scope: row.scope === 'zones' ? 'zones' : 'all',
    zoneIds: Array.isArray(row.zone_ids) ? row.zone_ids.map(String) : [],
    enabled: row.enabled,
    rainLock: row.rain_lock_enabled,
    minInterval: row.min_interval_hours ?? 0,
    maxDuration: row.max_duration_minutes ?? 0,
    moistureLow: row.moisture_min == null ? undefined : asNumber(row.moisture_min),
    moistureRestore: row.moisture_recover == null ? undefined : asNumber(row.moisture_recover),
    executionMode: row.execution_mode === 'quota' ? 'quantity' : 'duration',
    etDeficitThreshold: row.etc_trigger_mm == null ? undefined : asNumber(row.etc_trigger_mm),
    rainfallOffset: row.effective_rainfall_ratio == null ? undefined : asNumber(row.effective_rainfall_ratio),
    replenishRatio: row.replenish_ratio == null ? undefined : asNumber(row.replenish_ratio),
  }));
}

function buildOverview(fields, devices, plans, strategies) {
  const realDevices = devices.filter((device) => device.source === 'real');
  const onlineDevices = realDevices.filter((device) => device.status === 'online');
  const duePlans = plans
    .filter((plan) => plan.enabled)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      fieldId: plan.fieldId,
      fieldName: plan.fieldName ?? '',
      startTime: plan.startTime,
      nextRunLabel: toNextRunLabel(plan),
      totalDuration: plan.totalDuration,
      zoneCount: plan.zoneCount,
      mode: plan.mode,
      enabled: plan.enabled,
    }));

  const fieldRisks = [...fields]
    .map((field) => {
      const drynessGap = Math.max(0, 65 - field.soilMoisture);
      const etcPressure = Math.max(0, field.etc - 3.5) * 8;
      const alertPenalty = field.status === 'alarm' ? 22 : field.status === 'warning' ? 12 : 0;
      const rainfallGapMm = Number(Math.max(0, field.etc - field.rainfall24h * 0.8).toFixed(1));
      const riskScore = Number((drynessGap * 1.45 + etcPressure + alertPenalty).toFixed(1));
      const riskLevel = riskScore >= 55 ? '高' : riskScore >= 30 ? '中' : '低';
      const riskReason = field.soilMoisture < 35
        ? '墒情已逼近下限，需优先补水'
        : field.status === 'alarm'
          ? '分区/设备存在告警，执行链路需复核'
          : field.etc > 4.5
            ? '作物需水量偏高，建议按 ETc 补水'
            : '湿度处于关注区间，建议跟踪';

      return {
        id: field.id,
        name: field.name,
        crop: field.crop,
        growthStage: field.growthStage,
        soilMoisture: field.soilMoisture,
        etc: field.etc,
        suggestedDurationMinutes: field.recommendedDuration,
        riskScore,
        riskLevel,
        riskReason,
        rainfallGapMm,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const totalDurationMinutes = duePlans.reduce((sum, plan) => sum + plan.totalDuration, 0);
  const enabledStrategies = strategies.filter((strategy) => strategy.enabled);
  const decisionLevel = fieldRisks[0]?.riskLevel === '高' ? 'high' : fieldRisks[0]?.riskLevel === '中' ? 'medium' : 'low';

  return {
    snapshot: {
      totalFields: fields.length,
      totalDevices: realDevices.length,
      onlineDevices: onlineDevices.length,
      runningZones: fields.reduce((sum, field) => sum + field.zones.filter((zone) => zone.status === 'running').length, 0),
      attentionFields: fields.filter((field) => field.status !== 'normal').length,
      averageBatteryLevel: realDevices.length > 0
        ? Number((realDevices.reduce((sum, device) => sum + (device.batteryLevel ?? 0), 0) / realDevices.length).toFixed(1))
        : 0,
      averageEt0: fields.length > 0 ? Number((fields.reduce((sum, field) => sum + field.et0, 0) / fields.length).toFixed(2)) : 0,
      averageEtc: fields.length > 0 ? Number((fields.reduce((sum, field) => sum + field.etc, 0) / fields.length).toFixed(2)) : 0,
    },
    decision: {
      title: duePlans.length > 0 ? `按计划执行 ${duePlans.length} 个轮灌任务` : '今日暂无待执行计划',
      level: decisionLevel,
      reason: `${enabledStrategies.length} 个自动策略处于激活状态，今日计划总时长 ${totalDurationMinutes} 分钟`,
      durationMinutes: totalDurationMinutes,
    },
    fieldRisks,
    duePlans,
    mapFields: fields.map((field) => ({
      id: field.id,
      name: field.name,
      status: field.status,
      geoCenter: field.geoCenter,
      geoBoundary: field.geoBoundary,
    })),
    supplyOverview: {
      scheduledFlowM3h: Number((totalDurationMinutes / 60 * 3.5).toFixed(1)),
      systemRiskCount: realDevices.filter((device) => device.status === 'alarm').length,
      lowBatteryCount: realDevices.filter((device) => (device.batteryLevel ?? 100) < 30).length,
      offlineDeviceCount: realDevices.filter((device) => device.status === 'offline').length,
      alarmDeviceCount: realDevices.filter((device) => device.status === 'alarm').length,
    },
  };
}

export function createMiniService(config) {
  return {
    async getOverview(userId) {
      const { fields, fieldNameById } = await fetchFieldBundle(config, userId);
      const [devices, plans, strategies] = await Promise.all([
        fetchRealDevices(config, userId, fieldNameById, false),
        fetchRealPlans(config, userId, fieldNameById),
        fetchRealStrategies(config, userId, fieldNameById),
      ]);
      return buildOverview(fields, devices, plans, strategies);
    },

    async listFields(userId) {
      const { fields } = await fetchFieldBundle(config, userId);
      return fields.map((field) => ({
        id: field.id,
        name: field.name,
        code: field.code,
        crop: field.crop,
        growthStage: field.growthStage,
        area: field.area,
        status: field.status,
        soilMoisture: field.soilMoisture,
        zoneCount: field.zones.length,
        geoCenter: field.geoCenter,
      }));
    },

    async getFieldDetail(userId, id) {
      const { fields, fieldNameById } = await fetchFieldBundle(config, userId);
      const field = fields.find((item) => item.id === id) ?? null;
      if (!field) return null;

      const devices = await fetchRealDevices(config, userId, fieldNameById, false);
      return {
        field,
        devices: devices
          .filter((item) => item.fieldId === id || item.bindings?.some((binding) => binding.fieldId === id))
          .map(({ id: deviceId, name, type, status, signalStrength, batteryLevel, geoPosition, stations, bindings }) => ({
            id: deviceId,
            name,
            type,
            status,
            signalStrength,
            batteryLevel,
            geoPosition,
            stations,
            bindings,
          })),
      };
    },

    async listDevices(userId, { includeDemo = false } = {}) {
      const { fieldNameById } = await fetchFieldBundle(config, userId);
      return fetchRealDevices(config, userId, fieldNameById, includeDemo).then((devices) =>
        devices.map((item) => ({
          id: item.id,
          name: item.name,
          model: item.model,
          type: item.type,
          status: item.status,
          fieldId: item.fieldId,
          fieldName: item.fieldName,
          signalStrength: item.signalStrength,
          batteryLevel: item.batteryLevel,
          lastSeen: item.lastSeen,
          geoPosition: item.geoPosition,
          source: item.source,
        })),
      );
    },

    async getDeviceDetail(userId, id) {
      const { fieldNameById } = await fetchFieldBundle(config, userId);
      const devices = await fetchRealDevices(config, userId, fieldNameById, true);
      const device = devices.find((item) => item.id === id) ?? null;
      if (!device) return null;

      return {
        device,
        fieldName: device.fieldName,
        source: device.source,
        control: device.type === 'controller'
          ? { canOpen: true, canClose: true, canPause: true }
          : { canOpen: false, canClose: false, canPause: false },
      };
    },

    async listPlans(userId) {
      const { fieldNameById } = await fetchFieldBundle(config, userId);
      const plans = await fetchRealPlans(config, userId, fieldNameById);
      return {
        items: plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          fieldId: plan.fieldId,
          fieldName: plan.fieldName,
          startTime: plan.startTime,
          nextRunLabel: toNextRunLabel(plan),
          totalDuration: plan.totalDuration,
          zoneCount: plan.zoneCount,
          mode: plan.mode,
          enabled: plan.enabled,
        })),
      };
    },

    async getPlanDetail(userId, id) {
      const { fieldNameById } = await fetchFieldBundle(config, userId);
      const plans = await fetchRealPlans(config, userId, fieldNameById);
      const plan = plans.find((item) => item.id === id) ?? null;
      if (!plan) return null;
      return {
        plan,
        fieldName: plan.fieldName,
      };
    },

    async createPlan(userId, input) {
      const { fields } = await fetchFieldBundle(config, userId);
      const field = fields.find((item) => item.id === input.fieldId);
      if (!field) {
        throw new Error('所选地块不存在');
      }

      const planZoneRows = resolvePlanZoneRows(fields, input.zones ?? []);
      const created = await createIrrigationPlan(config, toPlanPayload(userId, input));
      if (!created?.id) {
        throw new Error('创建计划失败');
      }

      if (planZoneRows.length > 0) {
        await insertPlanZones(
          config,
          planZoneRows.map((zone) => ({
            plan_id: created.id,
            zone_id: zone.zone_id,
            zone_name: zone.zone_name,
            site_number: zone.site_number,
            sort_order: zone.sort_order,
            duration_minutes: zone.duration_minutes,
            enabled: zone.enabled,
          })),
        );
      }

      return { id: created.id };
    },

    async updatePlan(userId, planId, input) {
      const { fields, fieldNameById } = await fetchFieldBundle(config, userId);
      const plans = await fetchRealPlans(config, userId, fieldNameById);
      const existing = plans.find((item) => item.id === planId);
      if (!existing) {
        throw new Error('计划不存在');
      }

      const planZoneRows = resolvePlanZoneRows(fields, input.zones ?? []);
      await updateIrrigationPlan(config, planId, toPlanPayload(userId, input));
      await deletePlanZonesForPlan(config, planId);
      if (planZoneRows.length > 0) {
        await insertPlanZones(
          config,
          planZoneRows.map((zone) => ({
            plan_id: planId,
            zone_id: zone.zone_id,
            zone_name: zone.zone_name,
            site_number: zone.site_number,
            sort_order: zone.sort_order,
            duration_minutes: zone.duration_minutes,
            enabled: zone.enabled,
          })),
        );
      }

      return { id: planId };
    },

    async assertPlanOwner(userId, planId) {
      const row = await fetchPlan(config, planId);
      if (!row) {
        throw new Error('计划不存在');
      }
      if (row.user_id !== userId) {
        throw new Error('无权操作该计划');
      }
      return row;
    },

    async rollbackCreatedPlan(userId, planId) {
      await this.assertPlanOwner(userId, planId);
      await deletePlanZonesForPlan(config, planId);
      await deleteIrrigationPlan(config, planId);
      return { id: planId };
    },

    async deletePlan(userId, planId) {
      await this.assertPlanOwner(userId, planId);
      await deletePlanZonesForPlan(config, planId);
      await deleteIrrigationPlan(config, planId);
      return { id: planId };
    },

    async listStrategies(userId) {
      const { fieldNameById } = await fetchFieldBundle(config, userId);
      const strategies = await fetchRealStrategies(config, userId, fieldNameById);
      return {
        items: strategies,
      };
    },

    async getStrategyDetail(userId, id) {
      const { fieldNameById } = await fetchFieldBundle(config, userId);
      const strategies = await fetchRealStrategies(config, userId, fieldNameById);
      const strategy = strategies.find((item) => item.id === id) ?? null;
      if (!strategy) return null;
      return {
        strategy,
        fieldName: strategy.fieldName,
      };
    },
  };
}
