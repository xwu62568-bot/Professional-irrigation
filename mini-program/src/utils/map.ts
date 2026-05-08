import type { Device, Field, Zone } from '@irrigation/domain';
import mapMarkerIcon from '@/assets/tabbar/map-active.png';
import deviceMarkerIcon from '@/assets/tabbar/radio-active.png';

type GeoTuple = [number, number];

interface MapPoint {
  latitude: number;
  longitude: number;
}

interface MapPolygon {
  points: MapPoint[];
  strokeWidth: number;
  strokeColor: string;
  fillColor: string;
}

interface MapMarker {
  id: number;
  latitude: number;
  longitude: number;
  iconPath: string;
  width: number;
  height: number;
  callout?: {
    content: string;
    color: string;
    fontSize: number;
    borderRadius: number;
    bgColor: string;
    padding: number;
    display: 'BYCLICK' | 'ALWAYS';
  };
}

const MAP_MARKER_ICON = mapMarkerIcon;
const DEVICE_MARKER_ICON = deviceMarkerIcon;

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

function toMapPoint(point: GeoTuple): MapPoint {
  return {
    longitude: point[0],
    latitude: point[1],
  };
}

function collectBounds(points: GeoTuple[]) {
  if (points.length === 0) {
    return null;
  }

  let minLng = points[0][0];
  let maxLng = points[0][0];
  let minLat = points[0][1];
  let maxLat = points[0][1];

  points.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  return { minLng, maxLng, minLat, maxLat };
}

function centerFromPoints(points: GeoTuple[], fallback: GeoTuple): GeoTuple {
  const bounds = collectBounds(points);
  if (!bounds) return fallback;

  return [
    roundCoordinate((bounds.minLng + bounds.maxLng) / 2),
    roundCoordinate((bounds.minLat + bounds.maxLat) / 2),
  ];
}

function scaleFromPoints(points: GeoTuple[], fallback: number): number {
  const bounds = collectBounds(points);
  if (!bounds) return fallback;

  const spanLng = Math.abs(bounds.maxLng - bounds.minLng);
  const spanLat = Math.abs(bounds.maxLat - bounds.minLat);
  const maxSpan = Math.max(spanLng, spanLat);

  if (maxSpan > 1) return 4;
  if (maxSpan > 0.5) return 5;
  if (maxSpan > 0.2) return 6;
  if (maxSpan > 0.1) return 7;
  if (maxSpan > 0.05) return 8;
  if (maxSpan > 0.02) return 9;
  if (maxSpan > 0.01) return 10;
  if (maxSpan > 0.005) return 11;
  if (maxSpan > 0.002) return 12;
  return fallback;
}

function rectangleFromCenter(center: GeoTuple, offsetLng: number, offsetLat: number): GeoTuple[] {
  const [lng, lat] = center;
  return [
    [lng - offsetLng, lat - offsetLat],
    [lng + offsetLng, lat - offsetLat],
    [lng + offsetLng, lat + offsetLat],
    [lng - offsetLng, lat + offsetLat],
  ];
}

function fieldOffsets(field: Field) {
  const scale = Math.max(1, Math.sqrt(field.area) / 4);
  return {
    lng: 0.0012 * scale,
    lat: 0.0007 * scale,
  };
}

function zoneOffsets(zoneIndex: number) {
  return {
    lng: 0.00038 + (zoneIndex % 2) * 0.00008,
    lat: 0.00022,
  };
}

export function getFieldCenter(field: Field): GeoTuple {
  return field.geoCenter ?? [120.678, 31.315];
}

export function getFieldBoundary(field: Field): GeoTuple[] {
  if (field.geoBoundary?.length) return field.geoBoundary;
  const center = getFieldCenter(field);
  const offsets = fieldOffsets(field);
  return rectangleFromCenter(center, offsets.lng, offsets.lat);
}

export function getZoneBoundary(field: Field, zone: Zone, zoneIndex: number): GeoTuple[] {
  if (zone.geoBoundary?.length) return zone.geoBoundary;

  const [fieldLng, fieldLat] = getFieldCenter(field);
  const baseOffsets = zoneOffsets(zoneIndex);
  const offsetX = zoneIndex % 2 === 0 ? -0.00052 : 0.00052;
  const offsetY = Math.floor(zoneIndex / 2) * 0.00042 - 0.0002;

  return rectangleFromCenter(
    [fieldLng + offsetX, fieldLat + offsetY],
    baseOffsets.lng,
    baseOffsets.lat,
  );
}

export function getDevicePosition(field: Field | null, device: Device, deviceIndex: number): GeoTuple {
  if (device.geoPosition) return device.geoPosition;
  const center = field ? getFieldCenter(field) : [120.678, 31.315] as GeoTuple;
  const ringOffset = 0.00055 + deviceIndex * 0.00006;
  const direction = deviceIndex % 4;

  if (direction === 0) return [center[0] - ringOffset, center[1] - 0.0002];
  if (direction === 1) return [center[0] + ringOffset, center[1] - 0.00018];
  if (direction === 2) return [center[0] + ringOffset * 0.7, center[1] + 0.00036];
  return [center[0] - ringOffset * 0.6, center[1] + 0.00034];
}

function fieldPolygonColors(field: Field) {
  if (field.status === 'alarm') {
    return {
      strokeColor: '#F97316',
      fillColor: '#F9731638',
    };
  }
  if (field.status === 'warning') {
    return {
      strokeColor: '#EAB308',
      fillColor: '#EAB30838',
    };
  }
  return {
    strokeColor: '#22C55E',
    fillColor: '#22C55E33',
  };
}

function zonePolygonColors(zone: Zone) {
  if (zone.status === 'alarm') {
    return {
      strokeColor: '#EF4444',
      fillColor: '#EF444433',
    };
  }
  if (zone.status === 'pending') {
    return {
      strokeColor: '#F59E0B',
      fillColor: '#F59E0B33',
    };
  }
  return {
    strokeColor: '#2563EB',
    fillColor: '#2563EB2E',
  };
}

export function buildOverviewMap(fields: Field[]): {
  latitude: number;
  longitude: number;
  scale: number;
  polygons: MapPolygon[];
  markers: MapMarker[];
} {
  const validFields = fields.length ? fields : [];
  const fieldBoundaries: GeoTuple[][] = validFields.map((field) => getFieldBoundary(field));
  const allPoints: GeoTuple[] = fieldBoundaries.flat();
  const fallbackCenter: GeoTuple = validFields[0] ? getFieldCenter(validFields[0]) : [120.678, 31.315];
  const center = centerFromPoints(allPoints, fallbackCenter);

  return {
    longitude: center[0],
    latitude: center[1],
    scale: scaleFromPoints(allPoints, 12),
    polygons: validFields.map((field, index) => {
      const colors = fieldPolygonColors(field);
      return {
        points: fieldBoundaries[index].map(toMapPoint),
        strokeWidth: 2,
        strokeColor: colors.strokeColor,
        fillColor: colors.fillColor,
      };
    }),
    markers: validFields.map((field, index) => {
      const point = getFieldCenter(field);
      return {
        id: index + 1,
        longitude: point[0],
        latitude: point[1],
        iconPath: MAP_MARKER_ICON,
        width: 18,
        height: 18,
        callout: {
          content: field.name,
          color: '#1F2937',
          fontSize: 10,
          borderRadius: 12,
          bgColor: '#FFFFFF',
          padding: 6,
          display: 'ALWAYS',
        },
      };
    }),
  };
}

export function buildFieldDetailMap(field: Field, devices: Device[]): {
  latitude: number;
  longitude: number;
  scale: number;
  polygons: MapPolygon[];
  markers: MapMarker[];
} {
  const zonePolygons: GeoTuple[][] = field.zones.length
    ? field.zones.map((zone, index) => getZoneBoundary(field, zone, index))
    : [getFieldBoundary(field)];
  const polygonPoints: GeoTuple[] = zonePolygons.flat();
  const fieldBoundary = getFieldBoundary(field);
  const center = centerFromPoints(polygonPoints, getFieldCenter(field));

  const deviceMarkers = devices.flatMap((device, index) => {
    const bindingMarkers = (device.bindings ?? [])
      .filter((binding) => binding.fieldId === field.id && binding.geoPosition)
      .map((binding, bindingIndex) => ({
        id: index * 100 + bindingIndex + 101,
        longitude: binding.geoPosition![0],
        latitude: binding.geoPosition![1],
        iconPath: DEVICE_MARKER_ICON,
        width: 18,
        height: 18,
        callout: {
          content: binding.stationName || device.name,
          color: '#1F2937',
          fontSize: 10,
          borderRadius: 12,
          bgColor: '#FFFFFF',
          padding: 6,
          display: 'ALWAYS' as const,
        },
      }));

    if (bindingMarkers.length > 0) {
      return bindingMarkers;
    }

    const point = getDevicePosition(field, device, index);
    return [{
      id: index + 1001,
      longitude: point[0],
      latitude: point[1],
      iconPath: DEVICE_MARKER_ICON,
      width: 18,
      height: 18,
      callout: {
        content: device.name,
        color: '#1F2937',
        fontSize: 10,
        borderRadius: 12,
        bgColor: '#FFFFFF',
        padding: 6,
        display: 'ALWAYS' as const,
      },
    }];
  });

  return {
    longitude: center[0],
    latitude: center[1],
    scale: scaleFromPoints([...fieldBoundary, ...polygonPoints], 15),
    polygons: field.zones.length
      ? [
          {
            points: fieldBoundary.map(toMapPoint),
            strokeWidth: 3,
            strokeColor: '#155DFC',
            fillColor: '#155DFC14',
          },
          ...field.zones.map((zone, index) => {
            const colors = zonePolygonColors(zone);
            return {
              points: zonePolygons[index].map(toMapPoint),
              strokeWidth: 2,
              strokeColor: colors.strokeColor,
              fillColor: colors.fillColor,
            };
          }),
        ]
      : [
          {
            points: fieldBoundary.map(toMapPoint),
            strokeWidth: 3,
            ...fieldPolygonColors(field),
          },
        ],
    markers: deviceMarkers,
  };
}
