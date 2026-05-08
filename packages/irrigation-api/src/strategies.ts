import type { Strategy } from '@irrigation/domain';

export interface MiniStrategyListResponse {
  items: Strategy[];
}

export interface MiniStrategyDetailResponse {
  strategy: Strategy;
  fieldName?: string;
}

export interface MiniStrategyCreateInput {
  name: string;
  fieldId: string;
  type: Strategy['type'];
  mode: Strategy['mode'];
  scope: Strategy['scope'];
  zoneIds?: string[];
  enabled?: boolean;
  rainLock: boolean;
  minInterval: number;
  maxDuration: number;
  moistureLow?: number;
  moistureRestore?: number;
  executionMode?: Strategy['executionMode'];
  etDeficitThreshold?: number;
  rainfallOffset?: number;
  replenishRatio?: number;
}

export interface StrategyActionInput {
  action: 'enable' | 'disable' | 'confirm' | 'ignore';
}
