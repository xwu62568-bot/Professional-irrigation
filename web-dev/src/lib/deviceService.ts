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

export async function seedDevicesInSupabase(userId: string) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { data: existingRows, error: countError } = await supabase
    .from('irrigation_devices')
    .select('id, client_key')
    .eq('user_id', userId);

  if (countError) {
    throw countError;
  }
  const existingClientKeys = new Set((existingRows ?? []).map((row) => row.client_key));

  const sourceDevices = [...mockDevices];
  const wifiDemoDevice = getWifiDemoAppDevice();
  if (wifiDemoDevice && !sourceDevices.some((device) => device.id === wifiDemoDevice.id)) {
    sourceDevices.push(wifiDemoDevice);
  }

  const rows = sourceDevices
    .filter((device) => !existingClientKeys.has(device.id))
    .map((device) => ({
    id: device.id === wifiDemoDevice?.id ? device.id : `${userId}:${device.id}`,
    user_id: userId,
    client_key: device.id,
    name: device.name,
    model: device.model,
    type: device.type,
    status: device.status,
    station_code: device.stationNo ?? null,
    stations: getDeviceSeedStations(device),
    field_id: null,
    zone_id: null,
    center_lng: null,
    center_lat: null,
    signal_strength: device.signalStrength ?? null,
    battery_level: device.batteryLevel ?? null,
    last_seen_label: device.lastSeen,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from('irrigation_devices').insert(rows);
  if (error) {
    throw error;
  }
}

export async function fetchDevicesFromSupabase() {
  if (!supabase) {
    return [];
  }

  const { data: deviceRows, error: deviceError } = await supabase
    .from('irrigation_devices')
    .select('id, user_id, client_key, name, model, type, status, station_code, stations, field_id, zone_id, center_lng, center_lat, signal_strength, battery_level, last_seen_label')
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
      .select('field_id, zone_id, device_id, station_id, station_name, lng, lat')
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
        geoPosition: lng !== null && lat !== null ? [lng, lat] as [number, number] : undefined,
      };
    });
    const primaryBinding = bindings[0];
    const centerLng = asNumber(row.center_lng);
    const centerLat = asNumber(row.center_lat);

    return {
      id: row.id,
      name: row.name,
      model: row.model,
      type: row.type,
      status: row.status,
      position: [0, 0],
      geoPosition: primaryBinding?.geoPosition ?? (
        centerLng !== null && centerLat !== null ? [centerLng, centerLat] : undefined
      ),
      zoneId: primaryBinding?.zoneId ?? row.zone_id ?? '',
      fieldId: primaryBinding?.fieldId ?? row.field_id ?? '',
      stationNo: primaryBinding?.stationName ?? row.station_code ?? undefined,
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
    position: [number, number];
  }>;
}) {
  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const { error: deleteError } = await supabase
    .from('zone_device_bindings')
    .delete()
    .eq('zone_id', input.zoneId);

  if (deleteError) {
    throw deleteError;
  }

  if (input.bindings.length > 0) {
    const { error: insertError } = await supabase
      .from('zone_device_bindings')
      .insert(
        input.bindings.map((binding) => ({
          user_id: input.userId,
          field_id: input.fieldId,
          zone_id: input.zoneId,
          device_id: binding.deviceId,
          station_id: binding.stationId,
          station_name: binding.stationName,
          lng: binding.position[0],
          lat: binding.position[1],
        })),
      );

    if (insertError) {
      throw insertError;
    }
  }

  const updates = new Map<string, { zoneId: string; stationName: string; lng: number; lat: number }>();
  input.bindings.forEach((binding) => {
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
