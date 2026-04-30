import { supabase } from './supabase';
import type { Field, Zone } from '../app/data/mockData';
import {
  applyVisualGeometryFromGeo,
  boundaryToJson,
  computeGeoCenter,
  parseBoundary,
  type GeoPoint,
} from '../app/data/fieldGeo';

type FieldSummaryRow = {
  id: string;
  user_id: string;
  name: string;
  code: string;
  crop_type: string;
  growth_stage: string;
  area_mu: number | string | null;
  soil_type: string | null;
  irrigation_efficiency: number | string | null;
  center_lat: number | string | null;
  center_lng: number | string | null;
  boundary: unknown;
  zone_count: number | null;
  et0: number | string | null;
  kc: number | string | null;
  etc: number | string | null;
  rainfall_mm: number | string | null;
  effective_rainfall_mm: number | string | null;
  net_irrigation_need_mm: number | string | null;
  et_date: string | null;
};

type ZoneRow = {
  id: string;
  field_id: string;
  name: string;
  site_number: number;
  area_mu: number | string | null;
  design_flow_rate: number | string | null;
  priority: number;
  boundary: unknown;
};

type ZoneDeviceBindingRow = {
  zone_id: string;
  device_id: string;
  station_name: string;
};

type FieldEtConfigRow = {
  field_id: string;
  kc_default: number | string | null;
};

type ActivePlanRunRow = {
  id: string;
  field_id: string | null;
  plan_id: string;
  status: string;
  current_zone_id: string | null;
};

type ActivePlanRunStepRow = {
  run_id: string;
  zone_id: string | null;
  status: string;
};

type ActiveFieldRun = {
  currentZoneId: string | null;
  pendingZoneIds: Set<string>;
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

function asPositiveNumber(value: number | string | null | undefined, fallback = 0) {
  const next = asNumber(value, fallback);
  return next > 0 ? next : fallback;
}

function deriveFieldStatus(netNeed: number, etc: number): Field['status'] {
  if (netNeed >= 5 || etc >= 5) {
    return 'alarm';
  }
  if (netNeed >= 2.5 || etc >= 3.8) {
    return 'warning';
  }
  return 'normal';
}

function deriveZoneStatus(fieldStatus: Field['status'], priority: number): Zone['status'] {
  if (fieldStatus === 'alarm' && priority <= 1) {
    return 'alarm';
  }
  return 'idle';
}

function estimateSoilMoisture(netNeed: number) {
  return Math.max(25, Math.min(78, Math.round(68 - netNeed * 6)));
}

function getStationDisplayValue(value: string) {
  const trimmed = value.trim();
  const chMatch = trimmed.match(/CH\s*(\d+)/i);
  if (chMatch) {
    return `S${chMatch[1]}`;
  }

  const routeMatch = trimmed.match(/(\d+)\s*路/);
  if (routeMatch) {
    return `S${routeMatch[1]}`;
  }

  const namedStationMatch = trimmed.match(/站点\s*(\d+)/);
  if (namedStationMatch) {
    return `S${namedStationMatch[1]}`;
  }

  const stationMatch = trimmed.match(/S0*(\d+)/i);
  if (stationMatch) {
    return `S${stationMatch[1]}`;
  }

  return trimmed;
}

function toField(
  row: FieldSummaryRow,
  zones: ZoneRow[],
  zoneBindingsByZoneId: Map<string, ZoneDeviceBindingRow[]>,
  activeRun?: ActiveFieldRun,
  etConfig?: FieldEtConfigRow,
): Field {
  const hasEtDaily = row.et_date !== null || row.et0 !== null || row.etc !== null || row.net_irrigation_need_mm !== null;
  const boundary = parseBoundary(row.boundary);
  const center = computeGeoCenter(boundary);
  const et0 = asPositiveNumber(row.et0, 4.2);
  const kc = asPositiveNumber(etConfig?.kc_default, asPositiveNumber(row.kc, 0.95));
  const etc = hasEtDaily ? asNumber(row.etc, Number((et0 * kc).toFixed(2))) : 0;
  const rainfall24h = asNumber(row.rainfall_mm, 0);
  const netNeed = hasEtDaily ? asNumber(row.net_irrigation_need_mm, Math.max(0, etc - rainfall24h)) : 0;
  const status = deriveFieldStatus(netNeed, etc);
  const soilMoisture = estimateSoilMoisture(netNeed);

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
    center: [450, 260],
    geoBoundary: boundary,
    geoCenter: center ?? undefined,
    zones: zones.map((zone) => {
      const zoneBoundary = parseBoundary(zone.boundary);
      const zoneCenter = computeGeoCenter(zoneBoundary);
      const bindings = zoneBindingsByZoneId.get(zone.id) ?? [];
      const stationNames = [...new Set(bindings.map((binding) => getStationDisplayValue(binding.station_name)))];
      const deviceIds = [...new Set(bindings.map((binding) => binding.device_id))];
      return {
        id: zone.id,
        fieldId: zone.field_id,
        name: zone.name,
        siteNumber: zone.site_number,
        stationNo: stationNames.length > 0 ? stationNames.join(' / ') : `S${String(zone.site_number).padStart(2, '0')}`,
        status: activeRun?.currentZoneId === zone.id
          ? 'running'
          : activeRun?.pendingZoneIds.has(zone.id)
            ? 'pending'
            : deriveZoneStatus(status, zone.priority),
        duration: 45,
        soilMoisture: Math.max(20, soilMoisture - zone.priority * 2),
        polygon: [],
        center: [0, 0],
        geoBoundary: zoneBoundary,
        geoCenter: zoneCenter ?? undefined,
        deviceIds,
      };
    }),
  };
}

export async function fetchFieldsFromSupabase() {
  if (!supabase) {
    return [];
  }

  const { data: fieldRows, error: fieldError } = await supabase
    .from('field_summary_view')
    .select('*')
    .order('name', { ascending: true });

  if (fieldError) {
    throw fieldError;
  }

  const fields = (fieldRows ?? []) as FieldSummaryRow[];
  const fieldIds = fields.map((field) => field.id);

  let zoneRows: ZoneRow[] = [];
  if (fieldIds.length > 0) {
    const { data, error } = await supabase
      .from('field_zones')
      .select('id, field_id, name, site_number, area_mu, design_flow_rate, priority, boundary')
      .in('field_id', fieldIds)
      .order('site_number', { ascending: true });

    if (error) {
      throw error;
    }

    zoneRows = (data ?? []) as ZoneRow[];
  }

  const zonesByFieldId = new Map<string, ZoneRow[]>();
  zoneRows.forEach((zone) => {
    const list = zonesByFieldId.get(zone.field_id) ?? [];
    list.push(zone);
    zonesByFieldId.set(zone.field_id, list);
  });

  const etConfigByFieldId = new Map<string, FieldEtConfigRow>();
  if (fieldIds.length > 0) {
    const { data, error } = await supabase
      .from('field_et_configs')
      .select('field_id, kc_default')
      .in('field_id', fieldIds);

    if (error) {
      throw error;
    }

    ((data ?? []) as FieldEtConfigRow[]).forEach((config) => {
      etConfigByFieldId.set(config.field_id, config);
    });
  }

  const zoneIds = zoneRows.map((zone) => zone.id);
  const zoneBindingsByZoneId = new Map<string, ZoneDeviceBindingRow[]>();
  if (zoneIds.length > 0) {
    const { data, error } = await supabase
      .from('zone_device_bindings')
      .select('zone_id, device_id, station_name')
      .in('zone_id', zoneIds);

    if (error) {
      throw error;
    }

    ((data ?? []) as ZoneDeviceBindingRow[]).forEach((binding) => {
      const list = zoneBindingsByZoneId.get(binding.zone_id) ?? [];
      list.push(binding);
      zoneBindingsByZoneId.set(binding.zone_id, list);
    });
  }

  const activeRunsByFieldId = new Map<string, ActiveFieldRun>();
  if (fieldIds.length > 0) {
    const { data, error } = await supabase
      .from('plan_runs')
      .select('id, field_id, plan_id, status, current_zone_id')
      .in('field_id', fieldIds)
      .eq('status', 'running')
      .order('started_at', { ascending: false });

    if (!error) {
      const runs = (data ?? []) as ActivePlanRunRow[];
      const runIds = runs.map((run) => run.id);
      const pendingZoneIdsByRunId = new Map<string, Set<string>>();

      if (runIds.length > 0) {
        const { data: stepRows, error: stepError } = await supabase
          .from('plan_run_steps')
          .select('run_id, zone_id, status')
          .in('run_id', runIds)
          .eq('status', 'pending');

        if (!stepError) {
          ((stepRows ?? []) as ActivePlanRunStepRow[]).forEach((step) => {
            if (!step.zone_id) {
              return;
            }
            const pendingZoneIds = pendingZoneIdsByRunId.get(step.run_id) ?? new Set<string>();
            pendingZoneIds.add(step.zone_id);
            pendingZoneIdsByRunId.set(step.run_id, pendingZoneIds);
          });
        } else {
          console.error('Failed to load pending plan run steps:', stepError);
        }
      }

      runs.forEach((run) => {
        if (run.field_id && !activeRunsByFieldId.has(run.field_id)) {
          activeRunsByFieldId.set(run.field_id, {
            currentZoneId: run.current_zone_id,
            pendingZoneIds: pendingZoneIdsByRunId.get(run.id) ?? new Set<string>(),
          });
        }
      });
    } else {
      console.error('Failed to load active plan runs:', error);
    }
  }

  const mapped = fields.map((row) => toField(
    row,
    zonesByFieldId.get(row.id) ?? [],
    zoneBindingsByZoneId,
    activeRunsByFieldId.get(row.id),
    etConfigByFieldId.get(row.id),
  ));

  return applyVisualGeometryFromGeo(
    mapped,
    fields.map((row) => ({
      id: row.id,
      boundary: parseBoundary(row.boundary),
      zones: (zonesByFieldId.get(row.id) ?? []).map((zone) => ({
        id: zone.id,
        boundary: parseBoundary(zone.boundary),
      })),
    })),
  );
}

function estimateAreaMu(boundary: GeoPoint[]) {
  if (boundary.length < 3) {
    return 0;
  }

  const lngScale = 111320;
  const avgLat = boundary.reduce((sum, [, lat]) => sum + lat, 0) / boundary.length;
  const latScale = 110540;
  const xys = boundary.map(([lng, lat]) => [
    lng * lngScale * Math.cos((avgLat * Math.PI) / 180),
    lat * latScale,
  ]);

  let area = 0;
  for (let i = 0; i < xys.length; i += 1) {
    const [x1, y1] = xys[i];
    const [x2, y2] = xys[(i + 1) % xys.length];
    area += x1 * y2 - x2 * y1;
  }

  return Number((Math.abs(area) / 2 / 666.6667).toFixed(2));
}

export async function createFieldInSupabase(input: {
  userId: string;
  name: string;
  code: string;
  cropType: string;
  growthStage: string;
  kcDefault: number;
  irrigationEfficiency: number;
  boundary: GeoPoint[];
}) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const center = computeGeoCenter(input.boundary);
  const { data, error } = await supabase
    .from('fields')
    .insert({
      user_id: input.userId,
      name: input.name,
      code: input.code,
      crop_type: input.cropType,
      growth_stage: input.growthStage,
      area_mu: estimateAreaMu(input.boundary),
      irrigation_efficiency: input.irrigationEfficiency,
      center_lng: center?.[0] ?? null,
      center_lat: center?.[1] ?? null,
      boundary: boundaryToJson(input.boundary),
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  const { error: etConfigError } = await supabase
    .from('field_et_configs')
    .upsert({
      field_id: data.id,
      kc_default: input.kcDefault,
      crop_type: input.cropType,
      growth_stage: input.growthStage,
      latitude: center?.[1] ?? null,
      longitude: center?.[0] ?? null,
    }, { onConflict: 'field_id' });

  if (etConfigError) {
    throw etConfigError;
  }

  return data;
}

export async function createZoneInSupabase(input: {
  fieldId: string;
  name: string;
  siteNumber: number;
  boundary: GeoPoint[];
}) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { data, error } = await supabase
    .from('field_zones')
    .insert({
      field_id: input.fieldId,
      name: input.name,
      site_number: input.siteNumber,
      area_mu: estimateAreaMu(input.boundary),
      boundary: boundaryToJson(input.boundary),
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateFieldInSupabase(input: {
  fieldId: string;
  name: string;
  code: string;
  cropType: string;
  growthStage: string;
  kcDefault: number;
  irrigationEfficiency: number;
  boundary: GeoPoint[];
}) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const center = computeGeoCenter(input.boundary);
  const { error } = await supabase
    .from('fields')
    .update({
      name: input.name,
      code: input.code,
      crop_type: input.cropType,
      growth_stage: input.growthStage,
      area_mu: estimateAreaMu(input.boundary),
      irrigation_efficiency: input.irrigationEfficiency,
      center_lng: center?.[0] ?? null,
      center_lat: center?.[1] ?? null,
      boundary: boundaryToJson(input.boundary),
    })
    .eq('id', input.fieldId);

  if (error) {
    throw error;
  }

  const { error: etConfigError } = await supabase
    .from('field_et_configs')
    .upsert({
      field_id: input.fieldId,
      kc_default: input.kcDefault,
      crop_type: input.cropType,
      growth_stage: input.growthStage,
      latitude: center?.[1] ?? null,
      longitude: center?.[0] ?? null,
    }, { onConflict: 'field_id' });

  if (etConfigError) {
    throw etConfigError;
  }
}

export async function updateZoneInSupabase(input: {
  zoneId: string;
  name: string;
  siteNumber: number;
  boundary: GeoPoint[];
}) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { error } = await supabase
    .from('field_zones')
    .update({
      name: input.name,
      site_number: input.siteNumber,
      area_mu: estimateAreaMu(input.boundary),
      boundary: boundaryToJson(input.boundary),
    })
    .eq('id', input.zoneId);

  if (error) {
    throw error;
  }
}

export async function deleteZonesByFieldInSupabase(fieldId: string) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { error } = await supabase
    .from('field_zones')
    .delete()
    .eq('field_id', fieldId);

  if (error) {
    throw error;
  }
}

export async function deleteFieldInSupabase(fieldId: string) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { error } = await supabase.from('fields').delete().eq('id', fieldId);
  if (error) {
    throw error;
  }
}
