import type { Device } from '@irrigation/domain';

export type DeviceSource = 'real' | 'demo';

export interface MiniDeviceListItem {
  id: string;
  name: string;
  model: string;
  type: Device['type'];
  status: Device['status'];
  fieldId: string;
  fieldName?: string;
  signalStrength?: number;
  batteryLevel?: number;
  lastSeen: string;
  geoPosition?: [number, number];
  source: DeviceSource;
}

export interface MiniDeviceControlCapability {
  canOpen: boolean;
  canClose: boolean;
  canPause?: boolean;
}

export interface MiniDeviceControlResponse {
  success: boolean;
  message: string;
  state?: unknown;
}

export interface MiniDeviceDetailResponse {
  device: Device;
  fieldName?: string;
  source: DeviceSource;
  control?: MiniDeviceControlCapability;
}

export interface DeviceControlInput {
  action: 'open' | 'close' | 'pause';
  stationId?: string;
}
