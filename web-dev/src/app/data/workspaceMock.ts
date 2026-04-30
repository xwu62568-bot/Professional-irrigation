import {
  Device,
  Field,
  Plan,
  Strategy,
  weatherData,
} from './mockData';

export interface DashboardSnapshot {
  totalFields: number;
  totalDevices: number;
  onlineDevices: number;
  runningZones: number;
  attentionFields: number;
  averageBatteryLevel: number;
  averageEt0: number;
  averageEtc: number;
}

export interface FieldRisk {
  id: string;
  name: string;
  crop: string;
  growthStage: string;
  soilMoisture: number;
  etc: number;
  suggestedDurationMinutes: number;
  riskScore: number;
  riskLevel: '高' | '中' | '低';
  riskReason: string;
  rainfallGapMm: number;
}

export interface DuePlan {
  id: string;
  name: string;
  fieldId: string;
  fieldName: string;
  startTime: string;
  nextRunLabel: string;
  totalDuration: number;
  zoneCount: number;
  mode: Plan['mode'];
}

export interface DecisionSummary {
  title: string;
  level: 'high' | 'medium' | 'low';
  reason: string;
  durationMinutes: number;
}

export interface WeatherOverview {
  todayRainMm: number;
  next24hRainMm: number;
  rainProbability: number;
  recommendation: string;
}

export interface SensorOverview {
  averageSoilMoisture: number;
  driestField: Field | null;
  connectivityAlerts: number;
}

export interface SupplyOverview {
  scheduledFlowM3h: number;
  systemRiskCount: number;
  lowBatteryCount: number;
  offlineDeviceCount: number;
  alarmDeviceCount: number;
}

export interface StrategyState {
  enabled: number;
  autoEnabled: number;
  rainLocked: number;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface DeviceRiskItem {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildDashboardSnapshot(
  fields: Field[],
  devices: Device[],
): DashboardSnapshot {
  const batteryValues = devices
    .map((device) => device.batteryLevel)
    .filter((value): value is number => typeof value === 'number');

  return {
    totalFields: fields.length,
    totalDevices: devices.length,
    onlineDevices: devices.filter((device) => device.status === 'online').length,
    runningZones: fields.reduce(
      (sum, field) => sum + field.zones.filter((zone) => zone.status === 'running').length,
      0,
    ),
    attentionFields: fields.filter((field) => field.status !== 'normal').length,
    averageBatteryLevel: avg(batteryValues),
    averageEt0: avg(fields.map((field) => field.et0)),
    averageEtc: avg(fields.map((field) => field.etc)),
  };
}

export function buildFieldRisks(fields: Field[]): FieldRisk[] {
  return [...fields]
    .map((field) => {
      const drynessGap = Math.max(0, 65 - field.soilMoisture);
      const etcPressure = Math.max(0, field.etc - 3.5) * 8;
      const alertPenalty = field.status === 'alarm' ? 22 : field.status === 'warning' ? 12 : 0;
      const rainfallGapMm = Number(Math.max(0, field.etc - field.rainfall24h * 0.8).toFixed(1));
      const riskScore = Number((drynessGap * 1.45 + etcPressure + alertPenalty).toFixed(1));
      const riskLevel = riskScore >= 55 ? '高' : riskScore >= 30 ? '中' : '低';
      const riskReason =
        field.soilMoisture < 35
          ? '墒情已逼近下限，需优先补水'
          : field.status === 'alarm'
            ? '分区/设备存在告警，执行链路需复核'
            : field.etc > 4.5
              ? '作物需水量偏高，建议按 ETc 补水'
              : '湿度处于关注区间，建议跟踪';

      return {
        id: field.id,
        name: field.name,
        crop: field.crop,
        growthStage: field.growthStage,
        soilMoisture: field.soilMoisture,
        etc: field.etc,
        suggestedDurationMinutes: field.recommendedDuration,
        riskScore,
        riskLevel,
        riskReason,
        rainfallGapMm,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

export function buildDuePlans(fields: Field[], plans: Plan[]): DuePlan[] {
  return plans
    .filter((plan) => plan.enabled)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      fieldId: plan.fieldId,
      fieldName: fields.find((field) => field.id === plan.fieldId)?.name ?? '未绑定地块',
      startTime: plan.startTime,
      nextRunLabel:
        plan.cycle === 'daily'
          ? `每日 ${plan.startTime}`
          : plan.cycle === 'weekly'
            ? `周计划 ${plan.startTime}`
            : `每 ${plan.cycleValue || 3} 天`,
      totalDuration: plan.totalDuration,
      zoneCount: plan.zoneCount,
      mode: plan.mode,
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function buildDecisionSummary(
  fieldRisks: FieldRisk[],
  duePlans: DuePlan[],
  strategies: Strategy[],
): DecisionSummary {
  const highestRisk = fieldRisks[0];
  const activeAutoStrategies = strategies.filter(
    (strategy) => strategy.enabled && strategy.mode === 'auto',
  ).length;
  const totalDuration = duePlans.reduce((sum, plan) => sum + plan.totalDuration, 0);

  if (highestRisk && highestRisk.riskLevel === '高') {
    return {
      title: `优先处理 ${highestRisk.name}`,
      level: 'high',
      reason: `${highestRisk.riskReason}，建议补水 ${highestRisk.suggestedDurationMinutes} 分钟`,
      durationMinutes: highestRisk.suggestedDurationMinutes,
    };
  }

  if (duePlans.length > 0) {
    return {
      title: `按计划执行 ${duePlans.length} 个轮灌任务`,
      level: 'medium',
      reason: `${activeAutoStrategies} 个自动策略处于激活状态，今日计划总时长 ${totalDuration} 分钟`,
      durationMinutes: totalDuration,
    };
  }

  return {
    title: '当前以监测为主',
    level: 'low',
    reason: '暂无紧急补水任务，建议持续跟踪墒情和设备链路',
    durationMinutes: 0,
  };
}

export function buildWeatherOverview(fields: Field[]): WeatherOverview {
  const avgEtc = avg(fields.map((field) => field.etc));
  const next24hRainMm = Number((weatherData.rainToday + avgEtc * 0.35).toFixed(1));
  const rainProbability = next24hRainMm > 1 ? 45 : 18;
  const recommendation =
    next24hRainMm >= avgEtc ? '可观望' : next24hRainMm > 1 ? '注意雨量折减' : '需按计划补水';

  return {
    todayRainMm: weatherData.rainToday,
    next24hRainMm,
    rainProbability,
    recommendation,
  };
}

export function buildSensorOverview(fields: Field[], devices: Device[]): SensorOverview {
  const driestField = [...fields].sort((a, b) => a.soilMoisture - b.soilMoisture)[0] ?? null;

  return {
    averageSoilMoisture: avg(fields.map((field) => field.soilMoisture)),
    driestField,
    connectivityAlerts: devices.filter(
      (device) =>
        device.status !== 'online' ||
        (typeof device.signalStrength === 'number' && device.signalStrength < 50),
    ).length,
  };
}

export function buildSupplyOverview(devices: Device[], duePlans: DuePlan[]): SupplyOverview {
  const stationCount = devices.reduce(
    (sum, device) => sum + (device.type === 'controller' ? device.stations?.length ?? device.channelCount ?? 0 : 0),
    0,
  );

  return {
    scheduledFlowM3h: Number((duePlans.reduce((sum, plan) => sum + plan.zoneCount * 2.8, 0)).toFixed(1)),
    systemRiskCount: devices.filter((device) => device.status !== 'online').length,
    lowBatteryCount: devices.filter((device) => (device.batteryLevel ?? 100) < 30).length,
    offlineDeviceCount: devices.filter((device) => device.status === 'offline').length,
    alarmDeviceCount: devices.filter((device) => device.status === 'alarm').length + Math.max(0, stationCount - 8),
  };
}

export function buildStrategyState(strategies: Strategy[]): StrategyState {
  return {
    enabled: strategies.filter((strategy) => strategy.enabled).length,
    autoEnabled: strategies.filter(
      (strategy) => strategy.enabled && strategy.mode === 'auto',
    ).length,
    rainLocked: strategies.filter((strategy) => strategy.enabled && strategy.rainLock).length,
  };
}

export function buildActionItems(
  fields: Field[],
  devices: Device[],
  duePlans: DuePlan[],
  fieldRisks: FieldRisk[],
): ActionItem[] {
  const items: ActionItem[] = [];
  const urgentField = fieldRisks.find((risk) => risk.riskLevel === '高');
  const offlineController = devices.find(
    (device) => device.type === 'controller' && device.status === 'offline',
  );
  const alarmField = fields.find((field) => field.status === 'alarm');

  if (urgentField) {
    items.push({
      id: `risk-${urgentField.id}`,
      title: `优先复核 ${urgentField.name}`,
      description: `${urgentField.soilMoisture}% 墒情偏低，建议补水 ${urgentField.suggestedDurationMinutes} 分钟`,
      severity: 'critical',
    });
  }

  if (offlineController) {
    items.push({
      id: `device-${offlineController.id}`,
      title: `控制器离线`,
      description: `${offlineController.name} 已离线，执行计划前需确认链路`,
      severity: 'warning',
    });
  }

  if (alarmField) {
    items.push({
      id: `field-${alarmField.id}`,
      title: `${alarmField.name} 存在告警`,
      description: `建议先检查压力/流量和分区状态，再执行自动灌溉`,
      severity: 'warning',
    });
  }

  if (duePlans[0]) {
    items.push({
      id: `plan-${duePlans[0].id}`,
      title: `准备执行 ${duePlans[0].name}`,
      description: `${duePlans[0].fieldName} · ${duePlans[0].nextRunLabel} · ${duePlans[0].totalDuration} 分钟`,
      severity: 'info',
    });
  }

  return items;
}

export function buildDeviceRiskItems(
  devices: Device[],
  fields: Field[],
): DeviceRiskItem[] {
  const items: DeviceRiskItem[] = [];

  devices
    .filter((device) => device.status !== 'online')
    .slice(0, 2)
    .forEach((device) => {
      items.push({
        id: device.id,
        title: `${device.name} 状态异常`,
        description: `${device.status === 'offline' ? '设备离线' : '设备告警'}，所属地块 ${
          fields.find((field) => field.id === device.fieldId)?.name ?? '未绑定'
        }`,
        severity: device.status === 'offline' ? 'critical' : 'warning',
      });
    });

  devices
    .filter((device) => (device.batteryLevel ?? 100) < 30)
    .slice(0, 2)
    .forEach((device) => {
      items.push({
        id: `${device.id}-battery`,
        title: `${device.name} 电量偏低`,
        description: `剩余电量 ${device.batteryLevel}% ，建议安排巡检或更换电池`,
        severity: 'warning',
      });
    });

  devices
    .filter(
      (device) =>
        typeof device.signalStrength === 'number' &&
        device.signalStrength > 0 &&
        device.signalStrength < 55,
    )
    .slice(0, 2)
    .forEach((device) => {
      items.push({
        id: `${device.id}-signal`,
        title: `${device.name} 信号偏弱`,
        description: `当前信号 ${device.signalStrength}% ，建议优化天线或点位`,
        severity: 'info',
      });
    });

  return items;
}
