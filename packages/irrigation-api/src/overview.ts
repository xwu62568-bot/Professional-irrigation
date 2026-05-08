import type {
  DashboardSnapshot,
  DecisionSummary,
  DuePlan,
  FieldRisk,
  SupplyOverview,
} from '@irrigation/domain';

export interface OverviewMapField {
  id: string;
  name: string;
  status: 'normal' | 'warning' | 'alarm';
  geoCenter?: [number, number];
  geoBoundary?: [number, number][];
}

export interface MiniOverviewResponse {
  snapshot: DashboardSnapshot;
  decision: DecisionSummary;
  fieldRisks: FieldRisk[];
  duePlans: DuePlan[];
  mapFields: OverviewMapField[];
  supplyOverview: SupplyOverview;
}
