import { mockDevices, type Device } from '../app/data/mockData';
import { supabase } from './supabase';
import { getWifiDemoAppDevice } from './wifiDemoConfig';

type DeviceRow = {
  id: string;
  user_id: string;
  client_key: string;
  name: string;
  model: string;
  type: Device['type'];
  sensor_type: Device['sensorType'] | null;
  status: Device['status'];
  station_code: string | null;
  stations: unknown;
  field_id: string | null;
  zone_id: string | null;
  center_lng: number | string | null;
  center_lat: number | string | null;
  signal_strength: number | null;
  battery_level: number | null;
  last_seen_label: string | null;
};

type ZoneDeviceBindingRow = {
  field_id: string;
  zone_id: string;
  device_id: string;
  station_id: string;
  station_name: string;
  switch_status: 'open' | 'closed' | 'unknown' | 'none' | null;
  lng: number | string | null;
  lat: number | string | null;
};

function asNumber(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseStations(value: unknown, stationCode: string | null) {
  if (Array.isArray(value)) {
    const stations = value
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const id = 'id' in item ? String(item.id ?? '').trim() : '';
        const name = 'name' in item ? String(item.name ?? '').trim() : '';
        if (!id || !name) {
          return null;
        }

        return { id, name };
      })
      .filter((item): item is { id: string; name: string } => Boolean(item));

    if (stations.length > 0) {
      return stations;
    }
  }

  if (stationCode) {
    return [{ id: stationCode, name: stationCode }];
  }

  return [];
}

function getDeviceSeedStations(device: Device) {
  if (device.stations && device.stations.length > 0) {
    return device.stations;
  }

  if (device.stationNo) {
    return [{ id: device.stationNo, name: device.stationNo }];
  }

  return [];
}

function inferSensorType(row: Pick<DeviceRow, 'client_key' | 'name' | 'model' | 'sensor_type' | 'type'>): Device['sensorType'] | undefined {
  if (row.type !== 'sensor') {
    return undefined;
  }

  if (row.sensor_type) {
    return row.sensor_type;
  }

  const mockMatch = mockDevices.find((device) => device.id === row.client_key);
  if (mockMatch?.sensorType) {
    return mockMatch.sensorType;
  }

  const haystack = `${row.client_key} ${row.name} ${row.model}`.toLowerCase();
  if (haystack.includes('rain') || haystack.includes('rainfall') || haystack.includes('雨量') || haystack.includes('rs-')) {
    return 'rainfall';
  }
  if (haystack.includes('soil') || haystack.includes('moisture') || haystack.includes('土壤') || haystack.includes('湿度') || haystack.includes('ss-')) {
    return 'soil_moisture';
  }
  if (haystack.includes('temp') || haystack.includes('temperature') || haystack.includes('温度')) {
    return 'temperature';
  }

  return undefined;
}

function asUuidOrNull(value: string | null | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

const LEGACY_MOCK_DEVICE_KEYS = [
  'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'd11', 'd12', 'd13', 'd14', 'd15',
];

export async function seedDevicesInSupabase(userId: string) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const sourceDevices = [...mockDevices];
  const wifiDemoDevice = getWifiDemoAppDevice();
  if (wifiDemoDevice && !sourceDevices.some((device) => device.id === wifiDemoDevice.id)) {
    sourceDevices.push(wifiDemoDevice);
  }

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('irrigation_devices')
    .select('client_key, field_id, zone_id, center_lng, center_lat, station_code')
    .eq('user_id', userId);

  if (existingRowsError) {
    throw existingRowsError;
  }

  const existingRowByClientKey = new Map<string, Pick<DeviceRow, 'client_key' | 'field_id' | 'zone_id' | 'center_lng' | 'center_lat' | 'station_code'>>();
  (existingRows ?? []).forEach((row) => {
    existingRowByClientKey.set(String(row.client_key), row as Pick<DeviceRow, 'client_key' | 'field_id' | 'zone_id' | 'center_lng' | 'center_lat' | 'station_code'>);
  });

  const sourceClientKeys = new Set(sourceDevices.map((device) => device.id));
  const staleMockKeys = LEGACY_MOCK_DEVICE_KEYS.filter((key) => !sourceClientKeys.has(key));
  if (staleMockKeys.length > 0) {
    const { error: staleDeleteError } = await supabase
      .from('irrigation_devices')
      .delete()
      .eq('user_id', userId)
      .in('client_key', staleMockKeys);

    if (staleDeleteError) {
      throw staleDeleteError;
    }
  }

  const rows = sourceDevices.map((device) => {
    const existingRow = existingRowByClientKey.get(device.id);
    const seededFieldId = asUuidOrNull(device.fieldId) ?? existingRow?.field_id ?? null;
    const seededZoneId = asUuidOrNull(device.zoneId) ?? existingRow?.zone_id ?? null;
    const seededCenterLng = device.geoPosition?.[0] ?? asNumber(existingRow?.center_lng) ?? null;
    const seededCenterLat = device.geoPosition?.[1] ?? asNumber(existingRow?.center_lat) ?? null;
    const seededStationCode = device.stationNo ?? existingRow?.station_code ?? null;

    return {
      id: device.id === wifiDemoDevice?.id ? device.id : `${userId}:${device.id}`,
      user_id: userId,
      client_key: device.id,
      name: device.name,
      model: device.model,
      type: device.type,
      sensor_type: device.sensorType ?? null,
      status: device.status,
      station_code: seededStationCode,
      stations: getDeviceSeedStations(device),
      field_id: seededFieldId,
      zone_id: seededZoneId,
      center_lng: seededCenterLng,
      center_lat: seededCenterLat,
      signal_strength: device.signalStrength ?? null,
      battery_level: device.batteryLevel ?? null,
      last_seen_label: device.lastSeen,
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from('irrigation_devices')
      .upsert(rows, { onConflict: 'user_id,client_key' });

    if (error) {
      throw error;
    }
  }
}

export async function fetchDevicesFromSupabase() {
  if (!supabase) {
    return [];
  }

  const { data: deviceRows, error: deviceError } = await supabase
    .from('irrigation_devices')
    .select('id, user_id, client_key, name, model, type, sensor_type, status, station_code, stations, field_id, zone_id, center_lng, center_lat, signal_strength, battery_level, last_seen_label')
    .order('name', { ascending: true });

  if (deviceError) {
    throw deviceError;
  }

  const devices = (deviceRows ?? []) as DeviceRow[];
  const deviceIds = devices.map((device) => device.id);

  let bindingRows: ZoneDeviceBindingRow[] = [];
  if (deviceIds.length > 0) {
    const { data, error } = await supabase
      .from('zone_device_bindings')
      .select('field_id, zone_id, device_id, station_id, station_name, switch_status, lng, lat')
      .in('device_id', deviceIds)
      .order('station_name', { ascending: true });

    if (error) {
      throw error;
    }

    bindingRows = (data ?? []) as ZoneDeviceBindingRow[];
  }

  const bindingsByDeviceId = new Map<string, ZoneDeviceBindingRow[]>();
  bindingRows.forEach((binding) => {
    const list = bindingsByDeviceId.get(binding.device_id) ?? [];
    list.push(binding);
    bindingsByDeviceId.set(binding.device_id, list);
  });

  return devices.map((row) => {
    const bindings = (bindingsByDeviceId.get(row.id) ?? []).map((binding) => {
      const lng = asNumber(binding.lng);
      const lat = asNumber(binding.lat);
      return {
        fieldId: binding.field_id,
        zoneId: binding.zone_id,
        stationId: binding.station_id,
        stationName: binding.station_name,
        switchStatus: binding.switch_status ?? 'unknown',
        geoPosition: lng !== null && lat !== null ? [lng, lat] as [number, number] : undefined,
      };
    });
    const primaryBinding = bindings[0];
    const centerLng = asNumber(row.center_lng);
    const centerLat = asNumber(row.center_lat);
    const deviceCenter = centerLng !== null && centerLat !== null ? [centerLng, centerLat] as [number, number] : undefined;
    const geoPosition = row.type === 'controller'
      ? (deviceCenter ?? primaryBinding?.geoPosition)
      : (primaryBinding?.geoPosition ?? deviceCenter);

    return {
      id: row.id,
      name: row.name,
      model: row.model,
      type: row.type,
      sensorType: inferSensorType(row),
      status: row.status,
      position: [0, 0],
      geoPosition,
      zoneId: row.type === 'controller' ? (row.zone_id ?? primaryBinding?.zoneId ?? '') : (primaryBinding?.zoneId ?? row.zone_id ?? ''),
      fieldId: row.type === 'controller' ? (row.field_id ?? primaryBinding?.fieldId ?? '') : (primaryBinding?.fieldId ?? row.field_id ?? ''),
      stationNo: row.type === 'controller' ? (row.station_code ?? primaryBinding?.stationName ?? undefined) : (primaryBinding?.stationName ?? row.station_code ?? undefined),
      lastSeen: row.last_seen_label ?? '—',
      signalStrength: row.signal_strength ?? undefined,
      batteryLevel: row.battery_level ?? undefined,
      stations: parseStations(row.stations, row.station_code),
      bindings,
    } satisfies Device;
  });
}

export async function saveZoneDeviceBindingsInSupabase(input: {
  userId: string;
  fieldId: string;
  zoneId: string;
  bindings: Array<{
    deviceId: string;
    stationId: string;
    stationName: string;
    switchStatus?: 'open' | 'closed' | 'unknown' | 'none';
    position: [number, number];
  }>;
  controllerPositions?: Array<{
    deviceId: string;
    position: [number, number];
  }>;
}) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const requestedDeviceIds = [
    ...new Set([
      ...input.bindings.map((binding) => binding.deviceId),
      ...(input.controllerPositions ?? []).map((item) => item.deviceId),
    ]),
  ];

  const resolvedDeviceIds = new Map<string, string>();
  if (requestedDeviceIds.length > 0) {
    const { data: deviceRows, error: deviceLookupError } = await supabase
      .from('irrigation_devices')
      .select('id, client_key')
      .eq('user_id', input.userId);

    if (deviceLookupError) {
      throw deviceLookupError;
    }

    (deviceRows ?? [])
      .filter((row: Pick<DeviceRow, 'id' | 'client_key'>) => requestedDeviceIds.includes(row.id) || requestedDeviceIds.includes(row.client_key))
      .forEach((row: Pick<DeviceRow, 'id' | 'client_key'>) => {
        resolvedDeviceIds.set(row.id, row.id);
        resolvedDeviceIds.set(row.client_key, row.id);
      });
  }

  const bindings = input.bindings.map((binding) => {
    const resolvedDeviceId = resolvedDeviceIds.get(binding.deviceId);
    if (!resolvedDeviceId) {
      throw new Error(`设备未同步到数据库：${binding.deviceId}`);
    }
    return { ...binding, deviceId: resolvedDeviceId };
  });

  const controllerPositions = (input.controllerPositions ?? []).map((item) => {
    const resolvedDeviceId = resolvedDeviceIds.get(item.deviceId);
    if (!resolvedDeviceId) {
      throw new Error(`设备未同步到数据库：${item.deviceId}`);
    }
    return { ...item, deviceId: resolvedDeviceId };
  });

  const { error: deleteError } = await supabase
    .from('zone_device_bindings')
    .delete()
    .eq('zone_id', input.zoneId);

  if (deleteError) {
    throw deleteError;
  }

  if (bindings.length > 0) {
    const { error: insertError } = await supabase
      .from('zone_device_bindings')
      .insert(
        bindings.map((binding) => ({
          user_id: input.userId,
          field_id: input.fieldId,
          zone_id: input.zoneId,
          device_id: binding.deviceId,
          station_id: binding.stationId,
          station_name: binding.stationName,
          switch_status: binding.switchStatus ?? 'unknown',
          lng: binding.position[0],
          lat: binding.position[1],
        })),
      );

    if (insertError) {
      throw insertError;
    }
  }

  const updates = new Map<string, { zoneId: string; stationName: string; lng: number; lat: number }>();
  bindings.forEach((binding) => {
    if (!updates.has(binding.deviceId)) {
      updates.set(binding.deviceId, {
        zoneId: input.zoneId,
        stationName: binding.stationName,
        lng: binding.position[0],
        lat: binding.position[1],
      });
    }
  });

  await Promise.all(
    [...updates.entries()].map(async ([deviceId, binding]) => {
      const { error } = await supabase
        .from('irrigation_devices')
        .update({
          field_id: input.fieldId,
          zone_id: binding.zoneId,
          station_code: binding.stationName,
          center_lng: binding.lng,
          center_lat: binding.lat,
        })
        .eq('id', deviceId);

      if (error) {
        throw error;
      }
    }),
  );

  if (controllerPositions.length > 0) {
    await Promise.all(
      controllerPositions.map(async ({ deviceId, position }) => {
        const { error } = await supabase
          .from('irrigation_devices')
          .update({
            field_id: input.fieldId,
            zone_id: input.zoneId,
            center_lng: position[0],
            center_lat: position[1],
          })
          .eq('id', deviceId);

        if (error) {
          throw error;
        }
      }),
    );
  }
}

export async function clearDeviceAssignmentsForFieldInSupabase(fieldId: string) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { error } = await supabase
    .from('irrigation_devices')
    .update({
      field_id: null,
      zone_id: null,
      station_code: null,
      center_lng: null,
      center_lat: null,
    })
    .eq('field_id', fieldId);

  if (error) {
    throw error;
  }
}
