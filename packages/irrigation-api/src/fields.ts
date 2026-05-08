import type { Device, Field } from '@irrigation/domain';

export interface MiniFieldListItem {
  id: string;
  name: string;
  code: string;
  crop: string;
  growthStage: string;
  area: number;
  status: Field['status'];
  soilMoisture: number;
  zoneCount: number;
  geoCenter?: [number, number];
}

export interface MiniFieldRelatedDevice {
  id: string;
  name: string;
  type: Device['type'];
  status: Device['status'];
  signalStrength?: number;
  batteryLevel?: number;
  geoPosition?: [number, number];
  stations?: Device['stations'];
  bindings?: Device['bindings'];
}

export interface MiniFieldDetailResponse {
  field: Field;
  devices: MiniFieldRelatedDevice[];
}
