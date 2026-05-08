import { weatherData } from './mockData';
import { buildWeatherOverview as buildWeatherOverviewBase } from '../../../../packages/irrigation-domain/src';
import type { Field } from './mockData';

export type {
  ActionItem,
  DashboardSnapshot,
  DecisionSummary,
  DeviceRiskItem,
  DuePlan,
  FieldRisk,
  SensorOverview,
  StrategyState,
  SupplyOverview,
  WeatherOverview,
} from '../../../../packages/irrigation-domain/src';
export {
  buildActionItems,
  buildDashboardSnapshot,
  buildDecisionSummary,
  buildDeviceRiskItems,
  buildDuePlans,
  buildFieldRisks,
  buildSensorOverview,
  buildStrategyState,
  buildSupplyOverview,
} from '../../../../packages/irrigation-domain/src';

export function buildWeatherOverview(fields: Field[]) {
  return buildWeatherOverviewBase(fields, weatherData.rainToday);
}
