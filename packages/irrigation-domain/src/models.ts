export interface Field {
  id: string;
  name: string;
  code: string;
  crop: string;
  growthStage: string;
  area: number;
  kc: number;
  irrigationEfficiency: number;
  status: 'normal' | 'warning' | 'alarm';
  soilMoisture: number;
  soilTemperature: number;
  flowRate: number;
  pressure: number;
  lastIrrigation: string;
  recommendedDuration: number;
  rainfall24h: number;
  et0: number;
  etc: number;
  kcUpdateTime: string;
  polygon: [number, number][];
  center: [number, number];
  geoBoundary?: [number, number][];
  geoCenter?: [number, number];
  zones: Zone[];
}

export interface Zone {
  id: string;
  fieldId: string;
  name: string;
  siteNumber?: number;
  stationNo: string;
  status: 'idle' | 'pending' | 'running' | 'alarm';
  duration: number;
  soilMoisture: number;
  polygon: [number, number][];
  center: [number, number];
  geoBoundary?: [number, number][];
  geoCenter?: [number, number];
  deviceIds: string[];
}

export interface Device {
  id: string;
  name: string;
  model: string;
  type: 'controller' | 'sensor';
  status: 'online' | 'offline' | 'alarm';
  position: [number, number];
  geoPosition?: [number, number];
  zoneId: string;
  fieldId: string;
  channelCount?: 2 | 4 | 6 | 8;
  sensorType?: 'soil_moisture' | 'rainfall' | 'temperature' | 'weather';
  stationNo?: string;
  lastSeen: string;
  signalStrength?: number;
  batteryLevel?: number;
  stations?: Array<{
    id: string;
    name: string;
  }>;
  bindings?: Array<{
    fieldId: string;
    zoneId: string;
    stationId: string;
    stationName: string;
    switchStatus?: 'open' | 'closed' | 'unknown';
    geoPosition?: [number, number];
  }>;
}

export interface Plan {
  id: string;
  name: string;
  fieldId: string;
  mode: 'manual' | 'confirm' | 'auto';
  cycle: 'daily' | 'weekly' | 'interval';
  cycleValue?: number | number[];
  startTime: string;
  executionMode: 'duration' | 'quantity';
  rainPolicy: 'skip' | 'continue' | 'delay';
  enabled: boolean;
  totalDuration: number;
  zoneCount: number;
  zones: PlanZone[];
  targetWater?: number;
  irrigationEfficiencyRate?: number;
  maxDurationPerZone?: number;
  allowSplit?: boolean;
}

export interface PlanZone {
  zoneId: string;
  order: number;
  duration: number;
  enabled: boolean;
}

export interface Strategy {
  id: string;
  name: string;
  fieldId: string;
  type: 'threshold' | 'etc';
  mode: 'suggest' | 'confirm' | 'auto';
  scope: 'all' | 'zones';
  zoneIds: string[];
  enabled: boolean;
  rainLock: boolean;
  minInterval: number;
  maxDuration: number;
  moistureLow?: number;
  moistureRestore?: number;
  executionMode?: 'duration' | 'quantity';
  etDeficitThreshold?: number;
  rainfallOffset?: number;
  replenishRatio?: number;
}
