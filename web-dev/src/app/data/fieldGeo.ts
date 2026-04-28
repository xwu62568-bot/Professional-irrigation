import type { Field } from './mockData';

export type GeoPoint = [number, number];

type BoundaryPoint = {
  lng: number;
  lat: number;
};

export interface FieldGeoShape {
  id: string;
  boundary: GeoPoint[];
  zones: Array<{
    id: string;
    boundary: GeoPoint[];
  }>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseBoundaryPoint(value: unknown): GeoPoint | null {
  if (Array.isArray(value) && value.length >= 2) {
    const [lng, lat] = value;
    if (isFiniteNumber(lng) && isFiniteNumber(lat)) {
      return [lng, lat];
    }
  }

  if (value && typeof value === 'object') {
    const point = value as Partial<BoundaryPoint>;
    if (isFiniteNumber(point.lng) && isFiniteNumber(point.lat)) {
      return [point.lng, point.lat];
    }
  }

  return null;
}

export function parseBoundary(value: unknown): GeoPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(parseBoundaryPoint)
    .filter((point): point is GeoPoint => Boolean(point));
}

export function boundaryToJson(boundary: GeoPoint[]) {
  return boundary.map(([lng, lat]) => ({ lng, lat }));
}

export function computeGeoCenter(boundary: GeoPoint[]): GeoPoint | null {
  if (boundary.length === 0) {
    return null;
  }

  const lng = boundary.reduce((sum, [value]) => sum + value, 0) / boundary.length;
  const lat = boundary.reduce((sum, [, value]) => sum + value, 0) / boundary.length;
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

function toVisualPoint(
  point: GeoPoint,
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number },
) {
  const width = 900;
  const height = 520;
  const padding = 36;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.0001);
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.0001);

  const x = padding + ((point[0] - bounds.minLng) / lngRange) * innerWidth;
  const y = padding + ((bounds.maxLat - point[1]) / latRange) * innerHeight;

  return [Math.round(x), Math.round(y)] as [number, number];
}

export function applyVisualGeometryFromGeo<T extends Pick<Field, 'id' | 'polygon' | 'center' | 'zones'>>(
  fields: T[],
  shapes: FieldGeoShape[],
) {
  const allPoints = shapes.flatMap((field) => [
    ...field.boundary,
    ...field.zones.flatMap((zone) => zone.boundary),
  ]);

  if (allPoints.length === 0) {
    return fields;
  }

  const bounds = allPoints.reduce(
    (acc, [lng, lat]) => ({
      minLng: Math.min(acc.minLng, lng),
      maxLng: Math.max(acc.maxLng, lng),
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
    }),
    {
      minLng: allPoints[0][0],
      maxLng: allPoints[0][0],
      minLat: allPoints[0][1],
      maxLat: allPoints[0][1],
    },
  );

  const shapeMap = new Map(shapes.map((item) => [item.id, item]));

  return fields.map((field) => {
    const shape = shapeMap.get(field.id);
    if (!shape || shape.boundary.length < 3) {
      return field;
    }

    const zoneShapeMap = new Map(shape.zones.map((zone) => [zone.id, zone.boundary]));
    const polygon = shape.boundary.map((point) => toVisualPoint(point, bounds));
    const center = toVisualPoint(computeGeoCenter(shape.boundary) ?? shape.boundary[0], bounds);

    return {
      ...field,
      polygon,
      center,
      zones: field.zones.map((zone) => {
        const zoneBoundary = zoneShapeMap.get(zone.id);
        if (!zoneBoundary || zoneBoundary.length < 3) {
          return zone;
        }

        return {
          ...zone,
          polygon: zoneBoundary.map((point) => toVisualPoint(point, bounds)),
          center: toVisualPoint(computeGeoCenter(zoneBoundary) ?? zoneBoundary[0], bounds),
        };
      }),
    };
  });
}
