export interface Field {
  id: string;
  name: string;
  code: string;
  crop: string;
  growthStage: string;
  area: number;
  kc: number;
  irrigationEfficiency: number;
  status: 'normal' | 'warning' | 'irrigating' | 'alarm';
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
  stationNo: string;
  status: 'idle' | 'running' | 'alarm';
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
  type: 'valve' | 'sensor' | 'controller' | 'pump';
  status: 'online' | 'offline' | 'alarm';
  position: [number, number];
  geoPosition?: [number, number];
  zoneId: string;
  fieldId: string;
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

export const mockFields: Field[] = [
  {
    id: 'f1',
    name: '北区一号田',
    code: 'FA-001',
    crop: '玉米',
    growthStage: '拔节期',
    area: 12.4,
    kc: 1.15,
    irrigationEfficiency: 0.85,
    status: 'normal',
    soilMoisture: 68,
    soilTemperature: 22.3,
    flowRate: 12.6,
    pressure: 0.32,
    lastIrrigation: '2026-04-22 06:00',
    recommendedDuration: 95,
    rainfall24h: 0,
    et0: 4.2,
    etc: 4.83,
    kcUpdateTime: '2026-04-23 08:00',
    polygon: [[80, 60], [300, 42], [320, 188], [258, 220], [70, 196]],
    center: [190, 130],
    zones: [
      {
        id: 'z1', fieldId: 'f1', name: 'A-1区', stationNo: 'S01',
        status: 'idle', duration: 45, soilMoisture: 65,
        polygon: [[80, 60], [190, 51], [195, 196], [70, 196]],
        center: [130, 128], deviceIds: ['d1', 'd2']
      },
      {
        id: 'z2', fieldId: 'f1', name: 'A-2区', stationNo: 'S02',
        status: 'running', duration: 50, soilMoisture: 71,
        polygon: [[190, 51], [300, 42], [320, 188], [258, 220], [195, 196]],
        center: [255, 128], deviceIds: ['d3']
      },
    ]
  },
  {
    id: 'f2',
    name: '东区二号田',
    code: 'FA-002',
    crop: '小麦',
    growthStage: '抽穗期',
    area: 8.7,
    kc: 1.05,
    irrigationEfficiency: 0.88,
    status: 'warning',
    soilMoisture: 42,
    soilTemperature: 24.1,
    flowRate: 9.8,
    pressure: 0.28,
    lastIrrigation: '2026-04-20 07:30',
    recommendedDuration: 120,
    rainfall24h: 0,
    et0: 4.2,
    etc: 4.41,
    kcUpdateTime: '2026-04-23 08:00',
    polygon: [[360, 46], [600, 68], [580, 238], [348, 224]],
    center: [472, 144],
    zones: [
      {
        id: 'z3', fieldId: 'f2', name: 'B-1区', stationNo: 'S03',
        status: 'alarm', duration: 60, soilMoisture: 38,
        polygon: [[360, 46], [478, 56], [468, 238], [348, 224]],
        center: [410, 141], deviceIds: ['d4', 'd5']
      },
      {
        id: 'z4', fieldId: 'f2', name: 'B-2区', stationNo: 'S04',
        status: 'idle', duration: 60, soilMoisture: 46,
        polygon: [[478, 56], [600, 68], [580, 238], [468, 238]],
        center: [533, 141], deviceIds: ['d6']
      },
    ]
  },
  {
    id: 'f3',
    name: '南区三号田',
    code: 'FA-003',
    crop: '大豆',
    growthStage: '开花期',
    area: 18.2,
    kc: 1.1,
    irrigationEfficiency: 0.82,
    status: 'alarm',
    soilMoisture: 31,
    soilTemperature: 25.8,
    flowRate: 15.2,
    pressure: 0.35,
    lastIrrigation: '2026-04-18 08:00',
    recommendedDuration: 180,
    rainfall24h: 0,
    et0: 4.2,
    etc: 4.62,
    kcUpdateTime: '2026-04-23 08:00',
    polygon: [[75, 298], [445, 278], [462, 442], [195, 460], [60, 412]],
    center: [250, 370],
    zones: [
      {
        id: 'z5', fieldId: 'f3', name: 'C-1区', stationNo: 'S05',
        status: 'alarm', duration: 60, soilMoisture: 28,
        polygon: [[75, 298], [255, 288], [248, 442], [60, 412]],
        center: [155, 370], deviceIds: ['d7', 'd8']
      },
      {
        id: 'z6', fieldId: 'f3', name: 'C-2区', stationNo: 'S06',
        status: 'idle', duration: 60, soilMoisture: 32,
        polygon: [[255, 288], [445, 278], [462, 442], [248, 442]],
        center: [352, 370], deviceIds: ['d9']
      },
      {
        id: 'z7', fieldId: 'f3', name: 'C-3区', stationNo: 'S07',
        status: 'idle', duration: 60, soilMoisture: 34,
        polygon: [[248, 442], [462, 442], [195, 460]],
        center: [302, 448], deviceIds: ['d10']
      },
    ]
  },
  {
    id: 'f4',
    name: '西南四号田',
    code: 'FA-004',
    crop: '棉花',
    growthStage: '蕾期',
    area: 9.6,
    kc: 0.75,
    irrigationEfficiency: 0.90,
    status: 'normal',
    soilMoisture: 55,
    soilTemperature: 23.4,
    flowRate: 8.4,
    pressure: 0.30,
    lastIrrigation: '2026-04-22 18:00',
    recommendedDuration: 75,
    rainfall24h: 0,
    et0: 4.2,
    etc: 3.15,
    kcUpdateTime: '2026-04-23 08:00',
    polygon: [[525, 308], [755, 292], [772, 432], [542, 448]],
    center: [648, 370],
    zones: [
      {
        id: 'z8', fieldId: 'f4', name: 'D-1区', stationNo: 'S08',
        status: 'idle', duration: 40, soilMoisture: 55,
        polygon: [[525, 308], [640, 300], [650, 448], [542, 448]],
        center: [588, 376], deviceIds: ['d11', 'd12']
      },
      {
        id: 'z9', fieldId: 'f4', name: 'D-2区', stationNo: 'S09',
        status: 'idle', duration: 35, soilMoisture: 55,
        polygon: [[640, 300], [755, 292], [772, 432], [650, 448]],
        center: [709, 368], deviceIds: ['d13']
      },
    ]
  }
];

export const mockDevices: Device[] = [
  { id: 'd1', name: 'A-1区电磁阀', model: 'HV-200', type: 'valve', status: 'online', position: [105, 108], zoneId: 'z1', fieldId: 'f1', stationNo: 'S01', lastSeen: '刚刚', signalStrength: 92 },
  { id: 'd2', name: 'A-1区土壤传感器', model: 'SS-100', type: 'sensor', status: 'online', position: [145, 158], zoneId: 'z1', fieldId: 'f1', stationNo: 'S01', lastSeen: '2分钟前', signalStrength: 88, batteryLevel: 75 },
  { id: 'd3', name: 'A-2区电磁阀', model: 'HV-200', type: 'valve', status: 'online', position: [265, 118], zoneId: 'z2', fieldId: 'f1', stationNo: 'S02', lastSeen: '刚刚', signalStrength: 85 },
  { id: 'd4', name: 'B-1区电磁阀', model: 'HV-300', type: 'valve', status: 'alarm', position: [392, 121], zoneId: 'z3', fieldId: 'f2', stationNo: 'S03', lastSeen: '3分钟前', signalStrength: 45 },
  { id: 'd5', name: 'B-1区传感器', model: 'SS-200', type: 'sensor', status: 'online', position: [428, 161], zoneId: 'z3', fieldId: 'f2', stationNo: 'S03', lastSeen: '1分钟前', signalStrength: 78, batteryLevel: 40 },
  { id: 'd6', name: 'B-2区电磁阀', model: 'HV-300', type: 'valve', status: 'online', position: [545, 131], zoneId: 'z4', fieldId: 'f2', stationNo: 'S04', lastSeen: '刚刚', signalStrength: 90 },
  { id: 'd7', name: 'C-1区电磁阀', model: 'HV-500', type: 'valve', status: 'offline', position: [120, 348], zoneId: 'z5', fieldId: 'f3', stationNo: 'S05', lastSeen: '2小时前', signalStrength: 0 },
  { id: 'd8', name: 'C-1区传感器', model: 'SS-300', type: 'sensor', status: 'online', position: [175, 388], zoneId: 'z5', fieldId: 'f3', stationNo: 'S05', lastSeen: '5分钟前', signalStrength: 65, batteryLevel: 20 },
  { id: 'd9', name: 'C-2区电磁阀', model: 'HV-500', type: 'valve', status: 'online', position: [365, 358], zoneId: 'z6', fieldId: 'f3', stationNo: 'S06', lastSeen: '刚刚', signalStrength: 82 },
  { id: 'd10', name: 'C-3区电磁阀', model: 'HV-500', type: 'valve', status: 'online', position: [302, 440], zoneId: 'z7', fieldId: 'f3', stationNo: 'S07', lastSeen: '刚刚', signalStrength: 79 },
  { id: 'd11', name: 'D-1区电磁阀', model: 'HV-200', type: 'valve', status: 'online', position: [565, 358], zoneId: 'z8', fieldId: 'f4', stationNo: 'S08', lastSeen: '刚刚', signalStrength: 95 },
  { id: 'd12', name: 'D-1区传感器', model: 'SS-100', type: 'sensor', status: 'online', position: [608, 398], zoneId: 'z8', fieldId: 'f4', stationNo: 'S08', lastSeen: '1分钟前', signalStrength: 91, batteryLevel: 88 },
  { id: 'd13', name: 'D-2区电磁阀', model: 'HV-200', type: 'valve', status: 'online', position: [718, 358], zoneId: 'z9', fieldId: 'f4', stationNo: 'S09', lastSeen: '刚刚', signalStrength: 87 },
  { id: 'd14', name: '主控制器', model: 'RC-1000', type: 'controller', status: 'online', position: [450, 490], zoneId: '', fieldId: '', lastSeen: '刚刚', signalStrength: 98 },
  { id: 'd15', name: '主水泵', model: 'WP-500', type: 'pump', status: 'online', position: [480, 490], zoneId: '', fieldId: '', lastSeen: '刚刚', signalStrength: 98 },
];

export const mockPlans: Plan[] = [
  {
    id: 'p1', name: '北区玉米晨间计划', fieldId: 'f1', mode: 'confirm',
    cycle: 'daily', startTime: '06:00', executionMode: 'duration',
    rainPolicy: 'skip', enabled: true, totalDuration: 95, zoneCount: 2,
    zones: [
      { zoneId: 'z1', order: 1, duration: 45, enabled: true },
      { zoneId: 'z2', order: 2, duration: 50, enabled: true },
    ]
  },
  {
    id: 'p2', name: '东区小麦补水计划', fieldId: 'f2', mode: 'manual',
    cycle: 'weekly', cycleValue: [1, 3, 5], startTime: '07:30', executionMode: 'duration',
    rainPolicy: 'skip', enabled: true, totalDuration: 120, zoneCount: 2,
    zones: [
      { zoneId: 'z3', order: 1, duration: 60, enabled: true },
      { zoneId: 'z4', order: 2, duration: 60, enabled: true },
    ]
  },
  {
    id: 'p3', name: '南区大豆应急灌溉', fieldId: 'f3', mode: 'auto',
    cycle: 'interval', cycleValue: 3, startTime: '08:00', executionMode: 'quantity',
    rainPolicy: 'delay', enabled: false, totalDuration: 180, zoneCount: 3,
    targetWater: 30, irrigationEfficiencyRate: 0.82, maxDurationPerZone: 70, allowSplit: true,
    zones: [
      { zoneId: 'z5', order: 1, duration: 60, enabled: true },
      { zoneId: 'z6', order: 2, duration: 60, enabled: true },
      { zoneId: 'z7', order: 3, duration: 60, enabled: true },
    ]
  },
  {
    id: 'p4', name: '西南棉花滴灌计划', fieldId: 'f4', mode: 'confirm',
    cycle: 'daily', startTime: '18:00', executionMode: 'duration',
    rainPolicy: 'skip', enabled: true, totalDuration: 75, zoneCount: 2,
    zones: [
      { zoneId: 'z8', order: 1, duration: 40, enabled: true },
      { zoneId: 'z9', order: 2, duration: 35, enabled: true },
    ]
  },
];

export const mockStrategies: Strategy[] = [
  {
    id: 's1', name: '北区土壤阈值策略', fieldId: 'f1', type: 'threshold',
    mode: 'confirm', scope: 'all', zoneIds: [], enabled: true,
    rainLock: true, minInterval: 12, maxDuration: 120,
    moistureLow: 55, moistureRestore: 75, executionMode: 'duration',
  },
  {
    id: 's2', name: '东区ETc缺水策略', fieldId: 'f2', type: 'etc',
    mode: 'auto', scope: 'all', zoneIds: [], enabled: true,
    rainLock: true, minInterval: 24, maxDuration: 150,
    etDeficitThreshold: 8, rainfallOffset: 0.8, replenishRatio: 0.9,
  },
  {
    id: 's3', name: '南区干旱预警策略', fieldId: 'f3', type: 'threshold',
    mode: 'suggest', scope: 'zones', zoneIds: ['z5', 'z6'], enabled: true,
    rainLock: false, minInterval: 8, maxDuration: 90,
    moistureLow: 35, moistureRestore: 65, executionMode: 'duration',
  },
  {
    id: 's4', name: '西南棉花节水策略', fieldId: 'f4', type: 'etc',
    mode: 'confirm', scope: 'all', zoneIds: [], enabled: false,
    rainLock: true, minInterval: 48, maxDuration: 80,
    etDeficitThreshold: 10, rainfallOffset: 0.9, replenishRatio: 0.85,
  },
];

export const weatherData = {
  temperature: 28,
  humidity: 62,
  windSpeed: 3.2,
  windDir: '西南',
  uvIndex: 6,
  rainToday: 0,
  pressure: 1013,
  visibility: 12,
};

export const rainfallHistory = [
  { date: '04/17', rain: 0 },
  { date: '04/18', rain: 2.3 },
  { date: '04/19', rain: 0 },
  { date: '04/20', rain: 0 },
  { date: '04/21', rain: 5.1 },
  { date: '04/22', rain: 1.2 },
  { date: '04/23', rain: 0 },
];

export const soilMoistureHistory = [
  { time: '00:00', f1: 72, f2: 50, f3: 40 },
  { time: '04:00', f1: 71, f2: 48, f3: 38 },
  { time: '08:00', f1: 68, f2: 44, f3: 34 },
  { time: '12:00', f1: 66, f2: 42, f3: 31 },
  { time: '16:00', f1: 65, f2: 40, f3: 29 },
  { time: '20:00', f1: 68, f2: 42, f3: 31 },
  { time: '24:00', f1: 68, f2: 42, f3: 31 },
];

export const etHistory = [
  { date: '04/17', et0: 3.8, etc_avg: 4.2 },
  { date: '04/18', et0: 3.2, etc_avg: 3.5 },
  { date: '04/19', et0: 4.0, etc_avg: 4.4 },
  { date: '04/20', et0: 4.5, etc_avg: 5.0 },
  { date: '04/21', et0: 3.5, etc_avg: 3.9 },
  { date: '04/22', et0: 4.1, etc_avg: 4.6 },
  { date: '04/23', et0: 4.2, etc_avg: 4.7 },
];
