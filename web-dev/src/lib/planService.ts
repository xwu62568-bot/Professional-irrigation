import type { Field, Plan, PlanZone } from '../app/data/mockData';
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

function toDbPlanMode(mode: Plan['mode']): PlanRow['mode'] {
  if (mode === 'confirm') {
    return 'semi_auto';
  }
  return mode;
}

function toExecutionMode(mode: PlanRow['execution_mode']): Plan['executionMode'] {
  return mode === 'quota' ? 'quantity' : 'duration';
}

function toDbExecutionMode(mode: Plan['executionMode']): PlanRow['execution_mode'] {
  return mode === 'quantity' ? 'quota' : 'duration';
}

function toRainPolicy(skipIfRain: boolean): Plan['rainPolicy'] {
  return skipIfRain ? 'skip' : 'continue';
}

function toSkipIfRain(policy: Plan['rainPolicy']) {
  return policy === 'skip';
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

function resolvePlanZoneRows(fields: Field[], planZones: PlanZone[]) {
  const zoneMetaById = new Map(
    fields.flatMap((field) => field.zones.map((zone) => [zone.id, zone] as const)),
  );

  return planZones.map((zone) => {
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

export async function createPlanInSupabase(input: {
  userId: string;
  fields: Field[];
  plan: Omit<Plan, 'id'>;
}) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const planZoneRows = resolvePlanZoneRows(input.fields, input.plan.zones);

  const { data, error } = await supabase
    .from('irrigation_plans')
    .insert({
      user_id: input.userId,
      field_id: input.plan.fieldId,
      name: input.plan.name,
      schedule_type: input.plan.cycle,
      weekdays: input.plan.cycle === 'weekly' ? (Array.isArray(input.plan.cycleValue) ? input.plan.cycleValue : []) : [],
      interval_days: input.plan.cycle === 'interval' ? Number(input.plan.cycleValue ?? 1) : null,
      start_at: input.plan.startTime,
      enabled: input.plan.enabled,
      skip_if_rain: toSkipIfRain(input.plan.rainPolicy),
      mode: toDbPlanMode(input.plan.mode),
      execution_mode: toDbExecutionMode(input.plan.executionMode),
      target_water_m3_per_mu: input.plan.executionMode === 'quantity' ? input.plan.targetWater ?? null : null,
      irrigation_efficiency: input.plan.executionMode === 'quantity' ? input.plan.irrigationEfficiencyRate ?? null : null,
      max_duration_minutes: input.plan.executionMode === 'quantity' ? input.plan.maxDurationPerZone ?? null : null,
      split_rounds: input.plan.executionMode === 'quantity' ? Boolean(input.plan.allowSplit) : false,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  const { error: zonesError } = await supabase
    .from('irrigation_plan_zones')
    .insert(
      planZoneRows.map((zone) => ({
        plan_id: data.id,
        zone_id: zone.zone_id,
        zone_name: zone.zone_name,
        site_number: zone.site_number,
        sort_order: zone.sort_order,
        duration_minutes: zone.duration_minutes,
        enabled: zone.enabled,
      })),
    );

  if (zonesError) {
    throw zonesError;
  }

  return data;
}

export async function updatePlanInSupabase(input: {
  planId: string;
  fields: Field[];
  plan: Omit<Plan, 'id'>;
}) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const planZoneRows = resolvePlanZoneRows(input.fields, input.plan.zones);

  const { error } = await supabase
    .from('irrigation_plans')
    .update({
      field_id: input.plan.fieldId,
      name: input.plan.name,
      schedule_type: input.plan.cycle,
      weekdays: input.plan.cycle === 'weekly' ? (Array.isArray(input.plan.cycleValue) ? input.plan.cycleValue : []) : [],
      interval_days: input.plan.cycle === 'interval' ? Number(input.plan.cycleValue ?? 1) : null,
      start_at: input.plan.startTime,
      enabled: input.plan.enabled,
      skip_if_rain: toSkipIfRain(input.plan.rainPolicy),
      mode: toDbPlanMode(input.plan.mode),
      execution_mode: toDbExecutionMode(input.plan.executionMode),
      target_water_m3_per_mu: input.plan.executionMode === 'quantity' ? input.plan.targetWater ?? null : null,
      irrigation_efficiency: input.plan.executionMode === 'quantity' ? input.plan.irrigationEfficiencyRate ?? null : null,
      max_duration_minutes: input.plan.executionMode === 'quantity' ? input.plan.maxDurationPerZone ?? null : null,
      split_rounds: input.plan.executionMode === 'quantity' ? Boolean(input.plan.allowSplit) : false,
    })
    .eq('id', input.planId);

  if (error) {
    throw error;
  }

  const { error: deleteError } = await supabase
    .from('irrigation_plan_zones')
    .delete()
    .eq('plan_id', input.planId);

  if (deleteError) {
    throw deleteError;
  }

  const { error: zonesError } = await supabase
    .from('irrigation_plan_zones')
    .insert(
      planZoneRows.map((zone) => ({
        plan_id: input.planId,
        zone_id: zone.zone_id,
        zone_name: zone.zone_name,
        site_number: zone.site_number,
        sort_order: zone.sort_order,
        duration_minutes: zone.duration_minutes,
        enabled: zone.enabled,
      })),
    );

  if (zonesError) {
    throw zonesError;
  }
}

export async function deletePlanInSupabase(planId: string) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { error } = await supabase
    .from('irrigation_plans')
    .delete()
    .eq('id', planId);

  if (error) {
    throw error;
  }
}
