import type { Field } from './mockData';

export {
  applyVisualGeometryFromGeo,
  boundaryToJson,
  computeGeoCenter,
  parseBoundary,
  parseBoundaryPoint,
} from '../../../../packages/irrigation-domain/src';
export type { FieldGeoShape, GeoPoint } from '../../../../packages/irrigation-domain/src';

export type VisualField = Pick<Field, 'id' | 'polygon' | 'center' | 'zones'>;
