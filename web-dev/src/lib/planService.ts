import type { Plan, PlanZone } from '../app/data/mockData';
import { executionFetch } from './executionAuth';
import { supabase } from './supabase';

type PlanRow = {
  id: string;
  user_id: string;
  field_id: string;
  name: string;
  schedule_type: 'daily' | 'weekly' | 'interval';
  weekdays: number[] | null;
  interval_days: number | null;
  start_at: string;
  enabled: boolean;
  skip_if_rain: boolean;
  mode: 'manual' | 'semi_auto' | 'auto';
  execution_mode: 'duration' | 'quota';
  target_water_m3_per_mu: number | string | null;
  irrigation_efficiency: number | string | null;
  max_duration_minutes: number | null;
  split_rounds: boolean;
};

type PlanZoneRow = {
  id: string;
  plan_id: string;
  zone_id: string | null;
  zone_name: string | null;
  site_number: number;
  sort_order: number;
  duration_minutes: number;
  enabled: boolean;
};

function asNumber(value: number | string | null | undefined, fallback = 0) {
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

function asOptionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return asNumber(value);
}

function toPlanMode(mode: PlanRow['mode']): Plan['mode'] {
  if (mode === 'semi_auto') {
    return 'confirm';
  }
  return mode;
}

function toExecutionMode(mode: PlanRow['execution_mode']): Plan['executionMode'] {
  return mode === 'quota' ? 'quantity' : 'duration';
}

function toRainPolicy(skipIfRain: boolean): Plan['rainPolicy'] {
  return skipIfRain ? 'skip' : 'continue';
}

function toPlan(row: PlanRow, zones: PlanZoneRow[]): Plan {
  const mappedZones: PlanZone[] = zones.map((zone) => ({
    zoneId: zone.zone_id ?? zone.id,
    order: zone.sort_order,
    duration: zone.duration_minutes,
    enabled: zone.enabled,
  }));

  return {
    id: row.id,
    name: row.name,
    fieldId: row.field_id,
    mode: toPlanMode(row.mode),
    cycle: row.schedule_type,
    cycleValue: row.schedule_type === 'weekly'
      ? (Array.isArray(row.weekdays) ? row.weekdays : [])
      : row.schedule_type === 'interval'
        ? (row.interval_days ?? 1)
        : undefined,
    startTime: row.start_at.slice(0, 5),
    executionMode: toExecutionMode(row.execution_mode),
    rainPolicy: toRainPolicy(row.skip_if_rain),
    enabled: row.enabled,
    totalDuration: mappedZones.filter((zone) => zone.enabled).reduce((sum, zone) => sum + zone.duration, 0),
    zoneCount: mappedZones.filter((zone) => zone.enabled).length,
    zones: mappedZones,
    targetWater: asOptionalNumber(row.target_water_m3_per_mu),
    irrigationEfficiencyRate: asOptionalNumber(row.irrigation_efficiency),
    maxDurationPerZone: row.max_duration_minutes ?? undefined,
    allowSplit: row.split_rounds,
  };
}

type MiniPlanCreateInput = {
  name: string;
  fieldId: string;
  mode: Plan['mode'];
  cycle: Plan['cycle'];
  cycleValue?: number | number[];
  startTime: string;
  executionMode: Plan['executionMode'];
  rainPolicy: Plan['rainPolicy'];
  enabled: boolean;
  zones: Array<{ zoneId: string; order: number; duration: number; enabled: boolean }>;
  targetWater?: number;
  irrigationEfficiencyRate?: number;
  maxDurationPerZone?: number;
  allowSplit?: boolean;
};

function toMiniPlanInput(plan: Omit<Plan, 'id'>): MiniPlanCreateInput {
  const rainPolicy = plan.rainPolicy === 'delay' ? 'continue' : plan.rainPolicy;
  const cycleValue = plan.cycle === 'weekly'
    ? (Array.isArray(plan.cycleValue) ? plan.cycleValue : [])
    : plan.cycle === 'interval'
      ? Number(plan.cycleValue ?? 1)
      : undefined;

  return {
    name: plan.name,
    fieldId: plan.fieldId,
    mode: plan.mode,
    cycle: plan.cycle,
    cycleValue,
    startTime: plan.startTime,
    executionMode: plan.executionMode,
    rainPolicy,
    enabled: plan.enabled,
    zones: plan.zones.map((zone) => ({
      zoneId: zone.zoneId,
      order: zone.order,
      duration: zone.duration,
      enabled: zone.enabled,
    })),
    targetWater: plan.executionMode === 'quantity' ? plan.targetWater : undefined,
    irrigationEfficiencyRate: plan.executionMode === 'quantity' ? plan.irrigationEfficiencyRate : undefined,
    maxDurationPerZone: plan.executionMode === 'quantity' ? plan.maxDurationPerZone : undefined,
    allowSplit: plan.executionMode === 'quantity' ? plan.allowSplit : undefined,
  };
}

export function formatPlanSaveError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'SCHEDULE_SYNC_FAILED') {
    return '计划已保存到数据库，但调度同步失败，请重试保存';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '保存计划失败';
}

export async function createPlanViaExecutionApi(plan: Omit<Plan, 'id'>) {
  return executionFetch<{ id: string }>('/mini/plans', {
    method: 'POST',
    body: JSON.stringify(toMiniPlanInput(plan)),
  });
}

export async function updatePlanViaExecutionApi(planId: string, plan: Omit<Plan, 'id'>) {
  return executionFetch<{ id: string }>(`/mini/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(toMiniPlanInput(plan)),
  });
}

export async function deletePlanViaExecutionApi(planId: string) {
  return executionFetch<{ id: string }>(`/mini/plans/${planId}`, {
    method: 'DELETE',
  });
}

export async function startPlanViaExecutionApi(planId: string) {
  return executionFetch<{ success: boolean; runId?: string; message?: string }>(`/mini/plans/${planId}/start`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchPlansFromSupabase() {
  if (!supabase) {
    return [];
  }

  const { data: planRows, error: planError } = await supabase
    .from('irrigation_plans')
    .select('id, user_id, field_id, name, schedule_type, weekdays, interval_days, start_at, enabled, skip_if_rain, mode, execution_mode, target_water_m3_per_mu, irrigation_efficiency, max_duration_minutes, split_rounds')
    .order('created_at', { ascending: false });

  if (planError) {
    throw planError;
  }

  const plans = (planRows ?? []) as PlanRow[];
  const planIds = plans.map((plan) => plan.id);

  let zoneRows: PlanZoneRow[] = [];
  if (planIds.length > 0) {
    const { data, error } = await supabase
      .from('irrigation_plan_zones')
      .select('id, plan_id, zone_id, zone_name, site_number, sort_order, duration_minutes, enabled')
      .in('plan_id', planIds)
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    zoneRows = (data ?? []) as PlanZoneRow[];
  }

  const zonesByPlanId = new Map<string, PlanZoneRow[]>();
  zoneRows.forEach((zone) => {
    const list = zonesByPlanId.get(zone.plan_id) ?? [];
    list.push(zone);
    zonesByPlanId.set(zone.plan_id, list);
  });

  return plans.map((plan) => toPlan(plan, zonesByPlanId.get(plan.id) ?? []));
}

export function subscribeRunRealtime(onChange: () => void) {
  if (!supabase) {
    return () => {};
  }
  const channel = supabase
    .channel('execution-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_runs' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_run_steps' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'device_events' }, () => onChange())
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
