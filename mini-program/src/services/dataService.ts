import {
  buildDashboardSnapshot,
  buildDecisionSummary,
  buildDuePlans,
  buildFieldRisks,
  buildSensorOverview,
  buildStrategyState,
  buildSupplyOverview,
  buildWeatherOverview,
  getForecastLocation,
  type Device,
  type Field,
  type Plan,
  type Strategy,
} from '@irrigation/domain';
import type {
  MiniDeviceControlResponse,
  MiniDeviceDetailResponse,
  MiniDeviceListItem,
  MiniFieldDetailResponse,
  MiniFieldListItem,
  MiniMeResponse,
  MiniOverviewResponse,
  MiniPlanDetailResponse,
  MiniStrategyCreateInput,
  MiniPlanListResponse,
  MiniRuntimeResponse,
  MiniStrategyDetailResponse,
  MiniStrategyListResponse,
} from '@irrigation/api';
import { devices, fields, plans, strategies } from '@/data/mockData';
import { runtimeConfig } from './config';
import { miniApi } from './endpoints';
import { apiGet, apiPatch, apiPost } from './http';

export interface OverviewPayload {
  fields: Field[];
  devices: Device[];
  plans: Plan[];
  strategies: Strategy[];
}

function emptyFieldFromListItem(item: MiniFieldListItem): Field {
  return {
    id: item.id,
    name: item.name,
    code: item.code,
    crop: item.crop,
    growthStage: item.growthStage,
    area: item.area,
    kc: 1,
    irrigationEfficiency: 0.85,
    status: item.status,
    soilMoisture: item.soilMoisture,
    soilTemperature: 0,
    flowRate: 0,
    pressure: 0,
    lastIrrigation: '',
    recommendedDuration: 0,
    rainfall24h: 0,
    et0: 0,
    etc: 0,
    kcUpdateTime: '',
    polygon: [],
    center: [0, 0],
    geoCenter: item.geoCenter,
    zones: [],
  };
}

function fieldFromOverviewMap(item: MiniOverviewResponse['mapFields'][number]): Field {
  return {
    id: item.id,
    name: item.name,
    code: item.id,
    crop: '',
    growthStage: '',
    area: 1,
    kc: 1,
    irrigationEfficiency: 0.85,
    status: item.status,
    soilMoisture: 0,
    soilTemperature: 0,
    flowRate: 0,
    pressure: 0,
    lastIrrigation: '',
    recommendedDuration: 0,
    rainfall24h: 0,
    et0: 0,
    etc: 0,
    kcUpdateTime: '',
    polygon: [],
    center: [0, 0],
    geoCenter: item.geoCenter,
    geoBoundary: item.geoBoundary,
    zones: [],
  };
}

function deviceFromListItem(item: MiniDeviceListItem): Device {
  return {
    id: item.id,
    name: item.name,
    model: item.model,
    type: item.type,
    status: item.status,
    position: [0, 0],
    geoPosition: item.geoPosition,
    zoneId: '',
    fieldId: item.fieldId,
    lastSeen: item.lastSeen,
    signalStrength: item.signalStrength,
    batteryLevel: item.batteryLevel,
  };
}

export async function loadOverviewPayload(): Promise<OverviewPayload> {
  if (runtimeConfig.useMockData) {
    return { fields, devices, plans, strategies };
  }

  const [fieldItems, deviceItems, planResponse, strategyResponse] = await Promise.all([
    apiGet<{ items: MiniFieldListItem[] }>(miniApi.fields),
    apiGet<{ items: MiniDeviceListItem[] }>(miniApi.devices),
    apiGet<MiniPlanListResponse>(miniApi.plans),
    apiGet<MiniStrategyListResponse>(miniApi.strategies),
  ]);

  return {
    fields: fieldItems.items.map(emptyFieldFromListItem),
    devices: deviceItems.items.map(deviceFromListItem),
    plans: planResponse.items.map((item) => ({
      id: item.id,
      name: item.name,
      fieldId: item.fieldId,
      mode: item.mode,
      cycle: 'daily',
      startTime: item.startTime,
      executionMode: 'duration',
      rainPolicy: 'skip',
      enabled: true,
      totalDuration: item.totalDuration,
      zoneCount: item.zoneCount,
      zones: [],
    })),
    strategies: strategyResponse.items,
  };
}

export async function loadOverviewViewModel() {
  if (!runtimeConfig.useMockData) {
    const overview = await apiGet<MiniOverviewResponse>(miniApi.overview);
    return {
      fields: overview.mapFields.map(fieldFromOverviewMap),
      devices: [] as Device[],
      plans: [] as Plan[],
      strategies: [] as Strategy[],
      snapshot: overview.snapshot,
      fieldRisks: overview.fieldRisks,
      duePlans: overview.duePlans,
      decision: overview.decision,
      sensorOverview: {
        online: overview.snapshot.onlineDevices,
        offline: Math.max(0, overview.snapshot.totalDevices - overview.snapshot.onlineDevices),
        alarm: overview.supplyOverview.alarmDeviceCount,
        lowBattery: overview.supplyOverview.lowBatteryCount,
      },
      strategyState: {
        activeCount: 0,
        confirmCount: 0,
        autoCount: 0,
      },
      supplyOverview: {
        ...overview.supplyOverview,
        supplyLoadPercent: Math.round((overview.supplyOverview.scheduledFlowM3h / 8) * 100),
      },
      weatherOverview: {
        recommendation: overview.decision.title,
        rain24h: 0,
        rainForecast: 0,
      },
      forecastLocation: '',
    };
  }

  const payload = await loadOverviewPayload();
  const fieldRisks = buildFieldRisks(payload.fields);
  const duePlans = buildDuePlans(payload.fields, payload.plans);

  return {
    ...payload,
    snapshot: buildDashboardSnapshot(payload.fields, payload.devices),
    fieldRisks,
    duePlans,
    decision: buildDecisionSummary(fieldRisks, duePlans, payload.strategies),
    sensorOverview: buildSensorOverview(payload.fields, payload.devices),
      strategyState: buildStrategyState(payload.strategies),
      supplyOverview: {
        ...buildSupplyOverview(payload.devices, duePlans),
        supplyLoadPercent: Math.round((buildSupplyOverview(payload.devices, duePlans).scheduledFlowM3h / 8) * 100),
      },
      weatherOverview: buildWeatherOverview(payload.fields, 0),
      forecastLocation: getForecastLocation(payload.fields),
    };
}

export async function loadDevices() {
  if (!runtimeConfig.useMockData) {
    const response = await apiGet<{ items: MiniDeviceListItem[] }>(`${miniApi.devices}?includeDemo=true`);
    return response.items.sort((left, right) => {
      if (left.source === right.source) return 0;
      return left.source === 'demo' ? -1 : 1;
    });
  }
  const payload = await loadOverviewPayload();
  return payload.devices;
}

export async function controlDevice(
  id: string,
  input: { action: 'open' | 'close'; stationIndex: number; durationSeconds?: number },
) {
  if (runtimeConfig.useMockData) {
    return { success: true, message: 'mock device control accepted' } satisfies MiniDeviceControlResponse;
  }

  return apiPost<MiniDeviceControlResponse>(miniApi.deviceControl(id), input);
}

export async function loadFields() {
  if (!runtimeConfig.useMockData) {
    const response = await apiGet<{ items: MiniFieldListItem[] }>(miniApi.fields);
    return response.items;
  }
  const payload = await loadOverviewPayload();
  return payload.fields;
}

export async function loadPlans() {
  if (!runtimeConfig.useMockData) {
    const response = await apiGet<MiniPlanListResponse>(miniApi.plans);
    return response.items;
  }
  const payload = await loadOverviewPayload();
  return buildDuePlans(payload.fields, payload.plans);
}

export async function runPlanAction(id: string, action: 'start' | 'pause' | 'stop') {
  if (runtimeConfig.useMockData) {
    return { success: true, message: `mock action accepted: ${action}` };
  }

  const endpoint = action === 'start'
    ? miniApi.planStart(id)
    : action === 'pause'
      ? miniApi.planPause(id)
      : miniApi.planStop(id);

  return apiPost<{ success: boolean; message: string }>(endpoint);
}

export async function createPlan(input: import('@irrigation/api').MiniPlanCreateInput) {
  if (runtimeConfig.useMockData) {
    return { id: `mock-plan-${Date.now()}` };
  }

  return apiPost<{ id: string }>(miniApi.planCreate, input);
}

export async function updatePlan(id: string, input: import('@irrigation/api').MiniPlanCreateInput) {
  if (runtimeConfig.useMockData) {
    return { id };
  }

  return apiPatch<{ id: string }>(miniApi.planDetail(id), input);
}

export async function loadStrategies() {
  if (!runtimeConfig.useMockData) {
    const response = await apiGet<MiniStrategyListResponse>(miniApi.strategies);
    return response.items;
  }
  const payload = await loadOverviewPayload();
  return payload.strategies;
}

export async function createStrategy(input: MiniStrategyCreateInput) {
  if (runtimeConfig.useMockData) {
    return { id: `mock-strategy-${Date.now()}` };
  }

  return apiPost<{ id: string }>(miniApi.strategies, input);
}

export async function loadFieldDetail(id: string) {
  if (!runtimeConfig.useMockData) {
    return apiGet<MiniFieldDetailResponse>(miniApi.fieldDetail(id));
  }

  const payload = await loadOverviewPayload();
  return {
    field: payload.fields.find((item) => item.id === id) ?? null,
    devices: payload.devices.filter((item) => item.fieldId === id),
  };
}

export async function loadDeviceDetail(id: string) {
  if (!runtimeConfig.useMockData) {
    return apiGet<MiniDeviceDetailResponse>(miniApi.deviceDetail(id));
  }

  const payload = await loadOverviewPayload();
  const device = payload.devices.find((item) => item.id === id) ?? null;
  return device
    ? {
        device,
        fieldName: payload.fields.find((item) => item.id === device.fieldId)?.name,
        source: 'demo' as const,
        control: device.type === 'controller' ? { canOpen: true, canClose: true, canPause: true } : undefined,
      }
    : null;
}

export async function loadPlanDetail(id: string) {
  if (!runtimeConfig.useMockData) {
    return apiGet<MiniPlanDetailResponse>(miniApi.planDetail(id));
  }

  const payload = await loadOverviewPayload();
  const plan = payload.plans.find((item) => item.id === id) ?? null;
  return plan
    ? {
        plan,
        fieldName: payload.fields.find((item) => item.id === plan.fieldId)?.name,
      }
    : null;
}

export async function loadStrategyDetail(id: string) {
  if (!runtimeConfig.useMockData) {
    return apiGet<MiniStrategyDetailResponse>(miniApi.strategyDetail(id));
  }

  const payload = await loadOverviewPayload();
  const strategy = payload.strategies.find((item) => item.id === id) ?? null;
  return strategy
    ? {
        strategy,
        fieldName: payload.fields.find((item) => item.id === strategy.fieldId)?.name,
      }
    : null;
}

export async function loadMiniMe() {
  if (runtimeConfig.useMockData) {
    return {
      user: {
        id: 'mock-user',
        name: '张三',
        role: '系统管理员',
      },
      project: {
        id: 'mock-project',
        name: '智慧农场A',
      },
    } satisfies MiniMeResponse;
  }

  return apiGet<MiniMeResponse>(miniApi.me);
}

export async function loadRuntimeInfo() {
  if (runtimeConfig.useMockData) {
    return {
      version: '0.1.0',
      apiBaseUrl: runtimeConfig.executionServiceUrl,
      dataSource: 'mock',
    } satisfies MiniRuntimeResponse;
  }

  return apiGet<MiniRuntimeResponse>(miniApi.runtime);
}
