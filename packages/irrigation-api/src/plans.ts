import type { DuePlan, Plan } from '@irrigation/domain';

export interface MiniPlanListResponse {
  items: DuePlan[];
}

export interface MiniPlanDetailResponse {
  plan: Plan;
  fieldName?: string;
}

export interface MiniPlanCreateZoneInput {
  zoneId: string;
  order: number;
  duration: number;
  enabled: boolean;
}

export interface MiniPlanCreateInput {
  name: string;
  fieldId: string;
  mode: Plan['mode'];
  cycle: Plan['cycle'];
  cycleValue?: number | number[];
  startTime: string;
  executionMode: Plan['executionMode'];
  rainPolicy: Plan['rainPolicy'];
  enabled: boolean;
  zones: MiniPlanCreateZoneInput[];
  targetWater?: number;
  irrigationEfficiencyRate?: number;
  maxDurationPerZone?: number;
  allowSplit?: boolean;
}

export interface PlanActionInput {
  action: 'start' | 'pause' | 'stop';
}
