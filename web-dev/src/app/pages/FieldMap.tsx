import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle, ArrowRight, Crosshair, Eye, Layers, MapPinned, Pencil, Plus,
  RotateCcw, Save, Trash2, X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Device, Field } from '../data/mockData';
import type { GeoPoint } from '../data/fieldGeo';
import {
  createFieldInSupabase,
  createZoneInSupabase,
  deleteZonesByFieldInSupabase,
  deleteFieldInSupabase,
  updateFieldInSupabase,
  updateZoneInSupabase,
} from '../../lib/fieldService';
import {
  clearDeviceAssignmentsForFieldInSupabase,
  saveZoneDeviceBindingsInSupabase,
} from '../../lib/deviceService';
import { isAmapConfigured, loadAmap } from '../../lib/amap';
import { isSupabaseConfigured } from '../../lib/supabase';

type MapMode = 'browse' | 'draw-field' | 'draw-zone';
type DrawStep = 'drawing' | 'info';
type FieldFormErrors = Partial<Record<'name' | 'code' | 'crop' | 'stage' | 'kc' | 'efficiency', string>>;
type ZoneFormErrors = Partial<Record<'name' | 'bindings', string>>;
type ZoneDeviceDraft = {
  key: string;
  deviceId: string;
  deviceName: string;
  stationId: string;
  stationName: string;
  position: GeoPoint;
};

const STATUS_COLORS: Record<Field['status'], string> = {
  normal: '#22c55e',
  warning: '#f59e0b',
  irrigating: '#2563eb',
  alarm: '#ef4444',
};

const STATUS_LABELS: Record<Field['status'], string> = {
  normal: '正常',
  warning: '预警',
  irrigating: '浇灌中',
  alarm: '告警',
};

const ZONE_STATUS_COLORS = {
  idle: '#94a3b8',
  running: '#22c55e',
  alarm: '#ef4444',
} as const;

const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];
const LAST_MAP_CENTER_KEY = 'field-map:last-center';

function getCachedCenter(): [number, number] | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(LAST_MAP_CENTER_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as [number, number];
    if (
      Array.isArray(parsed) &&
      parsed.length >= 2 &&
      Number.isFinite(parsed[0]) &&
      Number.isFinite(parsed[1])
    ) {
      return [Number(parsed[0]), Number(parsed[1])];
    }
  } catch {
    return null;
  }

  return null;
}

function setCachedCenter(center: [number, number]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(LAST_MAP_CENTER_KEY, JSON.stringify(center));
  } catch {
    // ignore cache failures
  }
}

function getBrowserLocation(): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('浏览器不支持定位'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve([position.coords.longitude, position.coords.latitude]);
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 300000,
      },
    );
  });
}

function getCityCenter(AMap: any): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    if (!AMap?.CitySearch) {
      reject(new Error('CitySearch 不可用'));
      return;
    }

    const citySearch = new AMap.CitySearch();
    citySearch.getLocalCity((status: string, result: any) => {
      if (status !== 'complete' || !result) {
        reject(new Error('城市定位失败'));
        return;
      }

      const rectangle = result.rectangle as string | undefined;
      if (rectangle) {
        const [southWest, northEast] = rectangle.split(';');
        if (southWest && northEast) {
          const [lng1, lat1] = southWest.split(',').map(Number);
          const [lng2, lat2] = northEast.split(',').map(Number);
          if ([lng1, lat1, lng2, lat2].every(Number.isFinite)) {
            resolve([(lng1 + lng2) / 2, (lat1 + lat2) / 2]);
            return;
          }
        }
      }

      if (result.center && Array.isArray(result.center) && result.center.length >= 2) {
        resolve([Number(result.center[0]), Number(result.center[1])]);
        return;
      }

      reject(new Error('城市中心点解析失败'));
    });
  });
}

function toAmapPath(boundary: GeoPoint[]) {
  return boundary.map(([lng, lat]) => [lng, lat]);
}

function parseSiteNumber(input: string, field: Field) {
  const direct = Number(input.replace(/[^\d]/g, ''));
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }

  const next = field.zones.reduce((max, zone) => {
    const value = Number(zone.stationNo.replace(/[^\d]/g, ''));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);

  return next + 1;
}

function getDeviceStations(device: Device) {
  if (device.stations && device.stations.length > 0) {
    return device.stations;
  }

  if (device.stationNo) {
    return [{ id: device.stationNo, name: device.stationNo }];
  }

  return [];
}

function getBoundaryCenter(boundary: GeoPoint[]) {
  if (boundary.length === 0) {
    return DEFAULT_CENTER;
  }

  const lng = boundary.reduce((sum, [value]) => sum + value, 0) / boundary.length;
  const lat = boundary.reduce((sum, [, value]) => sum + value, 0) / boundary.length;
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))] as GeoPoint;
}

function getInitialCenterFromFields(fields: Field[]) {
  const fieldWithCenter = fields.find((field) => field.geoCenter);
  if (fieldWithCenter?.geoCenter) {
    return fieldWithCenter.geoCenter;
  }

  const fieldWithBoundary = fields.find((field) => field.geoBoundary && field.geoBoundary.length >= 3);
  if (fieldWithBoundary?.geoBoundary) {
    return getBoundaryCenter(fieldWithBoundary.geoBoundary);
  }

  return null;
}

function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]) {
  if (polygon.length < 3) {
    return false;
  }

  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function getDraftPosition(boundary: GeoPoint[], index: number) {
  const center = getBoundaryCenter(boundary);
  const [lng, lat] = center;
  const offset = 0.00008;
  const angle = (index % 6) * (Math.PI / 3);
  const point: GeoPoint = [
    Number((lng + Math.cos(angle) * offset * (1 + Math.floor(index / 6))).toFixed(6)),
    Number((lat + Math.sin(angle) * offset * (1 + Math.floor(index / 6))).toFixed(6)),
  ];

  return isPointInPolygon(point, boundary) ? point : center;
}

function areBoundariesEqual(a: GeoPoint[] | undefined, b: GeoPoint[]) {
  if (!a || a.length !== b.length) {
    return false;
  }

  return a.every((point, index) => point[0] === b[index][0] && point[1] === b[index][1]);
}

function getDeviceMapPoints(device: Device) {
  if (device.bindings && device.bindings.length > 0) {
    return device.bindings
      .filter((binding) => binding.geoPosition)
      .map((binding) => ({
        key: `${device.id}:${binding.stationId}`,
        position: binding.geoPosition!,
        fieldId: binding.fieldId,
        zoneId: binding.zoneId,
      }));
  }

  if (device.geoPosition && (device.fieldId || device.zoneId)) {
    return [{
      key: device.id,
      position: device.geoPosition,
      fieldId: device.fieldId,
      zoneId: device.zoneId,
    }];
  }

  return [];
}

function shouldHideDevicePointDuringEdit(point: { fieldId?: string; zoneId?: string }, editingFieldId: string | null, editingZoneId: string | null) {
  if (editingZoneId && point.zoneId === editingZoneId) {
    return true;
  }

  if (editingFieldId && point.fieldId === editingFieldId) {
    return true;
  }

  return false;
}

export function FieldMap() {
  const {
    fields,
    setFields,
    devices,
    setDevices,
    refreshDevices,
    user,
    isAuthenticated,
    isFieldsLoading,
    refreshFields,
  } = useApp();
  const navigate = useNavigate();

  const backendEnabled = isSupabaseConfigured && isAuthenticated;
  const amapEnabled = isAmapConfigured();
  const canEditMap = backendEnabled && amapEnabled && Boolean(user);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const tempOverlaysRef = useRef<any[]>([]);
  const drawClickTimerRef = useRef<number | null>(null);
  const hasAutoFitMapRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapDebugPhase, setMapDebugPhase] = useState('idle');
  const [locationSource, setLocationSource] = useState('default');
  const [mode, setMode] = useState<MapMode>('browse');
  const [drawStep, setDrawStep] = useState<DrawStep>('drawing');
  const [drawPoints, setDrawPoints] = useState<GeoPoint[]>([]);
  const [mousePoint, setMousePoint] = useState<GeoPoint | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldCode, setNewFieldCode] = useState('');
  const [newFieldCrop, setNewFieldCrop] = useState('玉米');
  const [newFieldStage, setNewFieldStage] = useState('苗期');
  const [newFieldKc, setNewFieldKc] = useState('0.95');
  const [newFieldEff, setNewFieldEff] = useState('0.85');
  const [fieldFormErrors, setFieldFormErrors] = useState<FieldFormErrors>({});
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const [newZoneName, setNewZoneName] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [zoneDeviceDrafts, setZoneDeviceDrafts] = useState<ZoneDeviceDraft[]>([]);
  const [zoneFormErrors, setZoneFormErrors] = useState<ZoneFormErrors>({});
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);

  const selectedField = fields.find((field) => field.id === selectedFieldId) ?? null;
  const selectedZone = selectedField?.zones.find((zone) => zone.id === selectedZoneId) ?? null;
  const isDrawing = mode === 'draw-field' || mode === 'draw-zone';
  const bindableDevices = devices.filter((device) => getDeviceStations(device).length > 0);
  const initialFieldCenter = getInitialCenterFromFields(fields);
  const isEditingField = Boolean(editingFieldId);
  const isEditingZone = Boolean(editingZoneId);

  const toggleZoneDeviceDraft = (device: Device, stationId: string, stationName: string) => {
    const key = `${device.id}:${stationId}`;
    setZoneDeviceDrafts((prev) => {
      const exists = prev.some((item) => item.key === key);
      if (exists) {
        return prev.filter((item) => item.key !== key);
      }

      return [
        ...prev,
        {
          key,
          deviceId: device.id,
          deviceName: device.name,
          stationId,
          stationName,
          position: getDraftPosition(drawPoints, prev.length),
        },
      ];
    });
    setZoneFormErrors((prev) => ({ ...prev, bindings: undefined }));
  };

  const buildZoneDraftsForEdit = (field: Field, zoneId: string) => {
    const drafts: ZoneDeviceDraft[] = [];
    const seen = new Set<string>();
    const zone = field.zones.find((item) => item.id === zoneId);
    const zoneBoundary = zone?.geoBoundary ?? [];

    devices.forEach((device) => {
      const bindings = device.bindings?.filter((binding) => binding.zoneId === zoneId) ?? [];
      bindings.forEach((binding, index) => {
        const key = `${device.id}:${binding.stationId}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        drafts.push({
          key,
          deviceId: device.id,
          deviceName: device.name,
          stationId: binding.stationId,
          stationName: binding.stationName,
          position: binding.geoPosition ?? getDraftPosition(zoneBoundary, drafts.length + index),
        });
      });
    });

    zone?.deviceIds.forEach((deviceId) => {
      const device = devices.find((item) => item.id === deviceId);
      if (!device) {
        return;
      }

      const station = getDeviceStations(device)[0] ?? {
        id: device.stationNo ?? device.id,
        name: device.stationNo ?? device.name,
      };
      const key = `${device.id}:${station.id}`;
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      drafts.push({
        key,
        deviceId: device.id,
        deviceName: device.name,
        stationId: station.id,
        stationName: station.name,
        position: device.geoPosition ?? getDraftPosition(zoneBoundary, drafts.length),
      });
    });

    return drafts;
  };
  useEffect(() => {
    if (!amapEnabled || !mapContainerRef.current) {
      setMapDebugPhase(amapEnabled ? 'container-missing' : 'amap-disabled');
      return;
    }

    let cancelled = false;
    setMapDebugPhase('loading-script');

    void loadAmap()
      .then((AMap) => {
        if (cancelled || mapRef.current || !mapContainerRef.current) {
          setMapDebugPhase(cancelled ? 'cancelled' : 'map-exists');
          return;
        }

        setMapDebugPhase('creating-map');
        const cachedCenter = getCachedCenter();
        const initialCenter = cachedCenter ?? initialFieldCenter ?? DEFAULT_CENTER;
        const map = new AMap.Map(mapContainerRef.current, {
          resizeEnable: true,
          zoom: 16,
          mapStyle: 'amap://styles/whitesmoke',
          center: initialCenter,
        });

        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ position: 'RB' }));
        map.on('moveend', () => {
          const center = map.getCenter?.();
          const lng = center?.getLng?.();
          const lat = center?.getLat?.();
          if (typeof lng === 'number' && typeof lat === 'number') {
            setCachedCenter([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
          }
        });
        mapRef.current = map;
        setMapReady(true);
        setMapDebugPhase('map-ready');

        if (cachedCenter) {
          setLocationSource('cached');
          return;
        }

        if (initialFieldCenter) {
          setLocationSource('field-data');
          setCachedCenter(initialFieldCenter);
          return;
        }

        getBrowserLocation()
          .then((center) => {
            if (cancelled || !mapRef.current) return;
            map.setCenter(center);
            setCachedCenter(center);
            setLocationSource('browser-geolocation');
          })
          .catch(() => {
            getCityCenter(AMap)
              .then((center) => {
                if (cancelled || !mapRef.current) return;
                map.setCenter(center);
                setCachedCenter(center);
                setLocationSource('amap-city-search');
              })
              .catch(() => {
                setLocationSource(cachedCenter ? 'cached' : 'default');
              });
          });
      })
      .catch((error) => {
        setMapDebugPhase('map-error');
        setMapError(error instanceof Error ? error.message : '高德地图初始化失败');
      });

    return () => {
      cancelled = true;
    };
  }, [amapEnabled, initialFieldCenter]);

  useEffect(() => {
    return () => {
      if (drawClickTimerRef.current) {
        window.clearTimeout(drawClickTimerRef.current);
        drawClickTimerRef.current = null;
      }
      overlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
      tempOverlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      return;
    }

    const map = mapRef.current;
    overlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
    overlaysRef.current = [];

    const AMap = window.AMap;
    if (!AMap) {
      return;
    }

    const allOverlays: any[] = [];

    fields.forEach((field) => {
      if (!field.geoBoundary || field.geoBoundary.length < 3) {
        return;
      }

      const hideFieldWhileEditing = isEditingField && editingFieldId === field.id;
      const hideZonesWhileEditingField = hideFieldWhileEditing;
      const shouldRenderField = !hideFieldWhileEditing;

      const fieldSelected = selectedFieldId === field.id;
      if (shouldRenderField) {
        const fieldPolygon = new AMap.Polygon({
          path: toAmapPath(field.geoBoundary),
          strokeColor: STATUS_COLORS[field.status],
          strokeWeight: fieldSelected ? 4 : 2,
          fillColor: STATUS_COLORS[field.status],
          fillOpacity: fieldSelected ? 0.42 : field.status === 'normal' ? 0.24 : 0.34,
          zIndex: fieldSelected ? 30 : 20,
        });

        fieldPolygon.on('click', () => {
          setSelectedFieldId(field.id);
          setSelectedZoneId(null);
        });
        fieldPolygon.setMap(map);
        allOverlays.push(fieldPolygon);
      }

      field.zones.forEach((zone) => {
        if (!zone.geoBoundary || zone.geoBoundary.length < 3) {
          return;
        }

        const hideZoneWhileEditing = hideZonesWhileEditingField || (isEditingZone && editingZoneId === zone.id);
        if (hideZoneWhileEditing) {
          return;
        }

        const zoneSelected = selectedZoneId === zone.id;
        const zonePolygon = new AMap.Polygon({
          path: toAmapPath(zone.geoBoundary),
          strokeColor: ZONE_STATUS_COLORS[zone.status],
          strokeWeight: zoneSelected ? 3 : 2,
          strokeStyle: 'dashed',
          fillColor: '#2563eb',
          fillOpacity: zoneSelected ? 0.2 : 0.08,
          zIndex: zoneSelected ? 35 : 25,
        });

        zonePolygon.on('click', () => {
          setSelectedFieldId(field.id);
          setSelectedZoneId(zone.id);
        });
        zonePolygon.setMap(map);
        allOverlays.push(zonePolygon);

        const zoneLabelPosition = zone.geoCenter ?? zone.geoBoundary[0];
        const zoneLabel = new AMap.Text({
          text: zone.name,
          position: zoneLabelPosition,
          offset: new AMap.Pixel(-24, -12),
          style: {
            padding: '2px 7px',
            borderRadius: '999px',
            border: `1px solid ${ZONE_STATUS_COLORS[zone.status]}40`,
            background: zoneSelected ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.86)',
            color: '#0f172a',
            fontSize: '11px',
            fontWeight: zoneSelected || zone.status !== 'idle' ? '700' : '600',
            boxShadow: '0 6px 14px rgba(15,23,42,0.12)',
          },
        });
        zoneLabel.on('click', () => {
          setSelectedFieldId(field.id);
          setSelectedZoneId(zone.id);
        });
        zoneLabel.setMap(map);
        allOverlays.push(zoneLabel);
      });

      if (shouldRenderField) {
        const labelPosition = field.geoCenter ?? field.geoBoundary[0];
        const fieldLabel = new AMap.Text({
          text: field.name,
          position: labelPosition,
          offset: new AMap.Pixel(-28, -34),
          style: {
            padding: '4px 10px',
            borderRadius: '999px',
            border: 'none',
            background: 'rgba(15, 23, 42, 0.78)',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '600',
            boxShadow: '0 8px 20px rgba(15,23,42,0.18)',
          },
        });
        fieldLabel.setMap(map);
        allOverlays.push(fieldLabel);
      }
    });

    devices
      .flatMap((device) => getDeviceMapPoints(device).map((point) => ({ device, point })))
      .filter(({ point }) => !shouldHideDevicePointDuringEdit(point, editingFieldId, editingZoneId))
      .forEach(({ device, point }) => {
        const marker = new AMap.Marker({
          position: point.position,
          anchor: 'bottom-center',
          content: `
            <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#0f172a;color:#fff;border:2px solid #fff;box-shadow:0 6px 16px rgba(15,23,42,.22);font-size:12px;">
              ${device.type === 'sensor' ? 'S' : device.type === 'valve' ? 'V' : 'D'}
            </div>
          `,
          offset: new AMap.Pixel(-13, -13),
          zIndex: 60,
        });
        marker.setMap(map);
        allOverlays.push(marker);
      });

    overlaysRef.current = allOverlays;

    if (allOverlays.length > 0 && !hasAutoFitMapRef.current) {
      map.setFitView(allOverlays, false, [60, 60, 60, 60]);
      hasAutoFitMapRef.current = true;
    }
  }, [devices, editingFieldId, editingZoneId, fields, isEditingField, isEditingZone, mapReady, selectedFieldId, selectedZoneId]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      return;
    }

    const map = mapRef.current;
    if (isDrawing) {
      map.setStatus?.({
        dragEnable: true,
        zoomEnable: true,
        doubleClickZoom: false,
        keyboardEnable: false,
      });
    } else {
      map.setStatus?.({
        dragEnable: true,
        zoomEnable: true,
        doubleClickZoom: true,
        keyboardEnable: true,
      });
      setMousePoint(null);
    }

    return () => {
      map.setStatus?.({
        dragEnable: true,
        zoomEnable: true,
        doubleClickZoom: true,
        keyboardEnable: true,
      });
    };
  }, [isDrawing, mapReady]);

  const getLngLatFromClientPoint = (clientX: number, clientY: number) => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) {
      return null;
    }

    const rect = container.getBoundingClientRect();
    const pixelX = clientX - rect.left;
    const pixelY = clientY - rect.top;
    const lngLat = map.containerToLngLat([pixelX, pixelY]);
    const lng = lngLat?.getLng?.();
    const lat = lngLat?.getLat?.();

    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return null;
    }

    return [Number(lng.toFixed(6)), Number(lat.toFixed(6))] as GeoPoint;
  };

  const appendDrawPoint = (clientX: number, clientY: number) => {
    const point = getLngLatFromClientPoint(clientX, clientY);
    if (!point) {
      return;
    }

    setDrawPoints((prev) => [...prev, point]);
  };

  const updateMousePoint = (clientX: number, clientY: number) => {
    const point = getLngLatFromClientPoint(clientX, clientY);
    if (!point) {
      return;
    }

    setMousePoint(point);
  };

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !mapReady || !isDrawing || drawStep !== 'drawing') {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (drawClickTimerRef.current) {
        window.clearTimeout(drawClickTimerRef.current);
      }
      drawClickTimerRef.current = window.setTimeout(() => {
        appendDrawPoint(event.clientX, event.clientY);
        drawClickTimerRef.current = null;
      }, 220);
    };

    const handleMouseMove = (event: MouseEvent) => {
      updateMousePoint(event.clientX, event.clientY);
    };

    const handleDoubleClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (drawClickTimerRef.current) {
        window.clearTimeout(drawClickTimerRef.current);
        drawClickTimerRef.current = null;
      }
      if (drawPoints.length >= 3) {
        setDrawStep('info');
      }
    };

    container.addEventListener('click', handleClick);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('dblclick', handleDoubleClick);

    return () => {
      if (drawClickTimerRef.current) {
        window.clearTimeout(drawClickTimerRef.current);
        drawClickTimerRef.current = null;
      }
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [drawPoints.length, drawStep, isDrawing, mapReady]);

  useEffect(() => {
    if (!isDrawing || drawStep !== 'drawing') {
      setMousePoint(null);
    }
  }, [drawStep, isDrawing]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      return;
    }

    const AMap = window.AMap;
    if (!AMap) {
      return;
    }

    tempOverlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
    tempOverlaysRef.current = [];

    if (!isDrawing || drawPoints.length === 0) {
      return;
    }

    const map = mapRef.current;
    const previewPath = drawStep === 'drawing' && mousePoint ? [...drawPoints, mousePoint] : drawPoints;
    const nextTempOverlays: any[] = [];

    drawPoints.forEach((point, index) => {
      const marker = new AMap.CircleMarker({
        center: point,
        radius: 5,
        strokeColor: '#fff',
        strokeWeight: 2,
        fillColor: '#0ea5e9',
        fillOpacity: 1,
        zIndex: 90 + index,
      });
      marker.setMap(map);
      nextTempOverlays.push(marker);
    });

    if (previewPath.length >= 2) {
      const polyline = new AMap.Polyline({
        path: toAmapPath(previewPath),
        strokeColor: '#0ea5e9',
        strokeWeight: 3,
        strokeStyle: 'dashed',
        zIndex: 80,
      });
      polyline.setMap(map);
      nextTempOverlays.push(polyline);
    }

    if (drawPoints.length >= 3) {
      const polygon = new AMap.Polygon({
        path: toAmapPath(drawPoints),
        strokeColor: drawStep === 'info' ? '#16a34a' : '#0284c7',
        strokeWeight: 2,
        fillColor: drawStep === 'info' ? '#16a34a' : '#0ea5e9',
        fillOpacity: drawStep === 'info' ? 0.22 : 0.18,
        zIndex: 70,
      });
      polygon.setMap(map);
      nextTempOverlays.push(polygon);
    }

    if (mode === 'draw-zone' && drawStep === 'info') {
      zoneDeviceDrafts.forEach((draft) => {
        const marker = new AMap.Marker({
          position: draft.position,
          anchor: 'center',
          draggable: true,
          cursor: 'move',
          content: `
            <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#16a34a;color:#fff;border:2px solid #fff;box-shadow:0 8px 18px rgba(22,163,74,.28);font-size:12px;font-weight:700;">
                ${draft.deviceName.slice(0, 1)}
            </div>
          `,
          offset: new AMap.Pixel(0, 0),
          zIndex: 95,
        });

        marker.on('dragend', (event: any) => {
          const lng = event.lnglat?.getLng?.();
          const lat = event.lnglat?.getLat?.();
          if (typeof lng !== 'number' || typeof lat !== 'number') {
            return;
          }

          const nextPoint: GeoPoint = [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
          if (!isPointInPolygon(nextPoint, drawPoints)) {
            marker.setPosition(draft.position);
            return;
          }

          setZoneDeviceDrafts((prev) => prev.map((item) => (
            item.key === draft.key
              ? { ...item, position: nextPoint }
              : item
          )));
        });

        marker.setMap(map);
        nextTempOverlays.push(marker);
      });
    }

    tempOverlaysRef.current = nextTempOverlays;
  }, [drawPoints, drawStep, isDrawing, mapReady, mode, mousePoint, zoneDeviceDrafts]);

  const resetDrawState = () => {
    setMode('browse');
    setDrawStep('drawing');
    setDrawPoints([]);
    setMousePoint(null);
    setNewFieldName('');
    setNewFieldCode('');
    setNewFieldCrop('玉米');
    setNewFieldStage('苗期');
    setNewFieldKc('0.95');
    setNewFieldEff('0.85');
    setFieldFormErrors({});
    setEditingFieldId(null);
    setNewZoneName('');
    setSelectedDeviceId(null);
    setZoneDeviceDrafts([]);
    setZoneFormErrors({});
    setEditingZoneId(null);
  };

  const startZoneFlowForField = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    setSelectedZoneId(null);
    setMode('draw-zone');
    setDrawStep('drawing');
    setDrawPoints([]);
    setMousePoint(null);
    setNewZoneName('');
    setSelectedDeviceId(null);
    setZoneDeviceDrafts([]);
    setZoneFormErrors({});
  };

  const startDrawField = () => {
    if (!canEditMap) {
      setMapError('请先完成 Supabase 登录并配置高德地图 Key，再开始绘制地块。');
      return;
    }

    setSelectedZoneId(null);
    setMode('draw-field');
    setDrawStep('drawing');
    setDrawPoints([]);
    setMousePoint(null);
    setEditingFieldId(null);
  };

  const startDrawZone = () => {
    if (!canEditMap) {
      setMapError('请先完成 Supabase 登录并配置高德地图 Key，再开始绘制分区。');
      return;
    }

    if (!selectedFieldId) {
      return;
    }

    setMode('draw-zone');
    setDrawStep('drawing');
    setDrawPoints([]);
    setMousePoint(null);
    setEditingZoneId(null);
  };

  const startEditField = (field: Field) => {
    if (!canEditMap) {
      setMapError('请先完成 Supabase 登录并配置高德地图 Key，再开始编辑地块。');
      return;
    }

    const boundary = field.geoBoundary ?? [];
    setSelectedFieldId(field.id);
    setSelectedZoneId(null);
    setMode('draw-field');
    setEditingFieldId(field.id);
    setEditingZoneId(null);
    setNewFieldName(field.name);
    setNewFieldCode(field.code);
    setNewFieldCrop(field.crop);
    setNewFieldStage(field.growthStage);
    setNewFieldKc(String(field.kc || 0.95));
    setNewFieldEff(String(field.irrigationEfficiency));
    setFieldFormErrors({});
    setDrawPoints(boundary);
    setDrawStep(boundary.length >= 3 ? 'info' : 'drawing');
    setMousePoint(null);
  };

  const startEditZone = (field: Field, zoneId: string) => {
    if (!canEditMap) {
      setMapError('请先完成 Supabase 登录并配置高德地图 Key，再开始编辑分区。');
      return;
    }

    const zone = field.zones.find((item) => item.id === zoneId);
    if (!zone) {
      return;
    }

    const boundary = zone.geoBoundary ?? [];
    setSelectedFieldId(field.id);
    setSelectedZoneId(zone.id);
    setMode('draw-zone');
    setEditingFieldId(null);
    setEditingZoneId(zone.id);
    setNewZoneName(zone.name);
    setSelectedDeviceId(null);
    setZoneDeviceDrafts(buildZoneDraftsForEdit(field, zone.id));
    setZoneFormErrors({});
    setDrawPoints(boundary);
    setDrawStep(boundary.length >= 3 ? 'info' : 'drawing');
    setMousePoint(null);
  };

  const handleRedrawBoundary = () => {
    setDrawPoints([]);
    setMousePoint(null);
    setDrawStep('drawing');
    if (isEditingZone) {
      setSelectedDeviceId(null);
      setZoneDeviceDrafts([]);
      setZoneFormErrors({});
    }
  };

  const handleFinishDrawing = () => {
    if (drawPoints.length < 3) {
      return;
    }
    setDrawStep('info');
  };

  const handleSaveField = async () => {
    const nextErrors: FieldFormErrors = {};

    if (!newFieldName.trim()) {
      nextErrors.name = '请输入地块名称';
    }
    if (!newFieldCode.trim()) {
      nextErrors.code = '请输入地块编号';
    }
    if (!newFieldCrop.trim()) {
      nextErrors.crop = '请输入作物品种';
    }
    if (!newFieldStage.trim()) {
      nextErrors.stage = '请输入生育期';
    }
    if (!newFieldKc.trim()) {
      nextErrors.kc = '请输入植物系数 Kc';
    } else {
      const kc = Number(newFieldKc);
      if (!Number.isFinite(kc) || kc <= 0 || kc > 2) {
        nextErrors.kc = 'Kc 需为 0 到 2 之间';
      }
    }
    if (!newFieldEff.trim()) {
      nextErrors.efficiency = '请输入灌溉效率';
    } else {
      const efficiency = Number(newFieldEff);
      if (!Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 1) {
        nextErrors.efficiency = '灌溉效率需为 0 到 1 之间';
      }
    }

    setFieldFormErrors(nextErrors);

    if (!user || Object.keys(nextErrors).length > 0 || drawPoints.length < 3) {
      return;
    }

    const fieldBeingEdited = editingFieldId
      ? fields.find((field) => field.id === editingFieldId) ?? null
      : null;
    const boundaryChanged = editingFieldId
      ? !areBoundariesEqual(fieldBeingEdited?.geoBoundary, drawPoints)
      : false;

    setSaving(true);
    try {
      if (backendEnabled) {
        if (editingFieldId) {
          await updateFieldInSupabase({
            fieldId: editingFieldId,
            name: newFieldName.trim(),
            code: newFieldCode.trim(),
            cropType: newFieldCrop.trim(),
            growthStage: newFieldStage.trim(),
            kcDefault: Number(newFieldKc) || 0.95,
            irrigationEfficiency: Number(newFieldEff) || 0.85,
            boundary: drawPoints,
          });
          if (boundaryChanged) {
            await deleteZonesByFieldInSupabase(editingFieldId);
            await clearDeviceAssignmentsForFieldInSupabase(editingFieldId);
          }
          await Promise.all([refreshFields(), refreshDevices()]);
          resetDrawState();
          setSelectedFieldId(editingFieldId);
          setSelectedZoneId(null);
        } else {
          const created = await createFieldInSupabase({
            userId: user.id,
            name: newFieldName.trim(),
            code: newFieldCode.trim() || `FA-${String(fields.length + 1).padStart(3, '0')}`,
            cropType: newFieldCrop.trim() || '玉米',
            growthStage: newFieldStage.trim() || '苗期',
            kcDefault: Number(newFieldKc) || 0.95,
            irrigationEfficiency: Number(newFieldEff) || 0.85,
            boundary: drawPoints,
          });
          await refreshFields();
          startZoneFlowForField(created.id);
        }
      } else {
        if (editingFieldId) {
          setFields((prev) => prev.map((field) => (
            field.id === editingFieldId
              ? {
                  ...field,
                  name: newFieldName.trim(),
                  code: newFieldCode.trim(),
                  crop: newFieldCrop.trim(),
                  growthStage: newFieldStage.trim(),
                  kc: Number(newFieldKc) || field.kc,
                  etc: Number(((Number(newFieldKc) || field.kc) * field.et0).toFixed(2)),
                  irrigationEfficiency: Number(newFieldEff) || 0.85,
                  geoBoundary: drawPoints,
                  geoCenter: drawPoints[0],
                  zones: boundaryChanged ? [] : field.zones,
                }
              : field
          )));
          if (boundaryChanged) {
            setDevices((prev) => prev.map((device) => (
              device.fieldId === editingFieldId
                ? {
                    ...device,
                    fieldId: '',
                    zoneId: '',
                    stationNo: undefined,
                    geoPosition: undefined,
                    bindings: [],
                  }
                : device
            )));
          }
          resetDrawState();
          setSelectedFieldId(editingFieldId);
          setSelectedZoneId(null);
        } else {
          setFields((prev) => prev);
          resetDrawState();
        }
      }
    } catch (error) {
      setMapError(error instanceof Error ? error.message : '保存地块失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveZone = async () => {
    const nextErrors: ZoneFormErrors = {};
    const selectedStationValues = zoneDeviceDrafts.map((item) => item.stationId);

    if (!newZoneName.trim()) {
      nextErrors.name = '请输入分区名称';
    }
    if (zoneDeviceDrafts.length === 0) {
      nextErrors.bindings = '请至少选择一个设备站点';
    }

    setZoneFormErrors(nextErrors);

    if (!selectedField || (backendEnabled && !user) || Object.keys(nextErrors).length > 0 || drawPoints.length < 3) {
      return;
    }

    const selectedDeviceIds = [...new Set(zoneDeviceDrafts.map((item) => item.deviceId))];
    const primaryStation = selectedStationValues[0];
    let createdZoneId: string | null = editingZoneId;

    setSaving(true);
    try {
      if (backendEnabled) {
        if (editingZoneId) {
          await updateZoneInSupabase({
            zoneId: editingZoneId,
            name: newZoneName.trim(),
            siteNumber: parseSiteNumber(primaryStation, selectedField),
            boundary: drawPoints,
          });
          createdZoneId = editingZoneId;
        } else {
          const created = await createZoneInSupabase({
            fieldId: selectedField.id,
            name: newZoneName.trim(),
            siteNumber: parseSiteNumber(primaryStation, selectedField),
            boundary: drawPoints,
          });
          createdZoneId = created.id;
        }
        await saveZoneDeviceBindingsInSupabase({
          userId: user.id,
          fieldId: selectedField.id,
          zoneId: createdZoneId,
          bindings: zoneDeviceDrafts.map((draft) => ({
            deviceId: draft.deviceId,
            stationId: draft.stationId,
            stationName: draft.stationName,
            position: draft.position,
          })),
        });
        await Promise.all([refreshFields(), refreshDevices()]);
      }

      if (!backendEnabled) {
        const newZoneId = editingZoneId ?? `z${Date.now()}`;
        createdZoneId = newZoneId;
        setFields((prev) => prev.map((field) => (
          field.id === selectedField.id
            ? {
                ...field,
                zones: editingZoneId
                  ? field.zones.map((zone) => (
                      zone.id === editingZoneId
                        ? {
                            ...zone,
                            name: newZoneName.trim(),
                            stationNo: zoneDeviceDrafts.map((item) => item.stationName).join(' / '),
                            geoBoundary: drawPoints,
                            geoCenter: drawPoints[0],
                            deviceIds: selectedDeviceIds,
                          }
                        : zone
                    ))
                  : [
                      ...field.zones,
                      {
                        id: newZoneId,
                        fieldId: selectedField.id,
                        name: newZoneName.trim(),
                        stationNo: zoneDeviceDrafts.map((item) => item.stationName).join(' / '),
                        status: 'idle',
                        duration: 45,
                        soilMoisture: 60,
                        polygon: [],
                        center: [0, 0],
                        geoBoundary: drawPoints,
                        geoCenter: drawPoints[0],
                        deviceIds: selectedDeviceIds,
                      },
                    ],
              }
            : field
        )));
      }

      if (!backendEnabled) {
        setDevices((prev) => prev.map((device) => {
          if (!selectedDeviceIds.includes(device.id)) {
            return device;
          }

          const bindings = zoneDeviceDrafts
            .filter((item) => item.deviceId === device.id)
            .map((item) => ({
              fieldId: selectedField.id,
              zoneId: createdZoneId ?? device.zoneId,
              stationId: item.stationId,
              stationName: item.stationName,
              geoPosition: item.position,
            }));

          return {
            ...device,
            fieldId: selectedField.id,
            zoneId: createdZoneId ?? device.zoneId,
            stationNo: bindings[0]?.stationName ?? device.stationNo,
            geoPosition: bindings[0]?.geoPosition ?? device.geoPosition,
            bindings,
          };
        }));
      }

      resetDrawState();
      setSelectedFieldId(selectedField.id);
      setSelectedZoneId(createdZoneId);
    } catch (error) {
      setMapError(error instanceof Error ? error.message : '保存分区失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    setSaving(true);
    try {
      if (backendEnabled) {
        await deleteFieldInSupabase(fieldId);
        await Promise.all([refreshFields(), refreshDevices()]);
      } else {
        setFields((prev) => prev.filter((field) => field.id !== fieldId));
      }

      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
        setSelectedZoneId(null);
      }
      setDeleteConfirm(null);
    } catch (error) {
      setMapError(error instanceof Error ? error.message : '删除地块失败');
    } finally {
      setSaving(false);
    }
  };

  const fieldDevices = (field: Field) => {
    const zoneIds = field.zones.map((zone) => zone.id);
    return devices.filter((device) =>
      device.fieldId === field.id ||
      zoneIds.includes(device.zoneId) ||
      (device.bindings?.some((binding) => binding.fieldId === field.id || zoneIds.includes(binding.zoneId)) ?? false),
    );
  };

  const selectedDevice = selectedDeviceId
    ? bindableDevices.find((device) => device.id === selectedDeviceId) ?? null
    : null;
  const selectedDeviceStations = selectedDevice ? getDeviceStations(selectedDevice) : [];

  const setupHint = !isSupabaseConfigured
    ? '当前还是 mock 模式，地图可先显示，但地块读写还不会走服务端。'
    : !isAmapConfigured()
      ? '还缺高德 Key，请在 web-dev/.env 增加 VITE_AMAP_KEY，必要时再补 VITE_AMAP_SECURITY_JS_CODE。'
      : !isAuthenticated
        ? '地图已可显示；如需从服务端读取和保存地块，请先登录 Supabase 账号。'
        : '';

  return (
    <div
      className="flex overflow-hidden"
      style={{
        background: '#eef3f7',
        height: 'calc(100dvh - 56px)',
        minHeight: 560,
      }}
    >
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{ width: 280, background: '#ffffff', borderRight: '1px solid #e2e8f0' }}
      >
        <div className="px-4 py-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 style={{ color: '#0f172a', fontSize: 16, fontWeight: 600 }}>地块列表</h2>
            <button
              onClick={startDrawField}
              disabled={!canEditMap}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all"
              style={{ background: canEditMap ? '#16a34a' : '#94a3b8', color: '#ffffff', fontSize: 12 }}
            >
              <Plus size={14} /> 新建
            </button>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12 }}>
            {isFieldsLoading ? '地块数据加载中...' : `${fields.length} 个地块 · ${fields.reduce((sum, field) => sum + field.zones.length, 0)} 个分区`}
          </p>
          {setupHint ? (
            <div className="mt-3 rounded-xl px-3 py-2" style={{ background: '#fff7ed', color: '#9a3412', fontSize: 12 }}>
              {setupHint}
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {fields.map((field) => (
            <div
              key={field.id}
              onClick={() => {
                setSelectedFieldId(field.id);
                setSelectedZoneId(null);
              }}
              className="mx-2 mb-2 rounded-xl cursor-pointer transition-all"
              style={{
                border: `1.5px solid ${selectedFieldId === field.id ? STATUS_COLORS[field.status] : '#e2e8f0'}`,
                background: selectedFieldId === field.id ? '#f8fafc' : '#ffffff',
                padding: '12px 14px',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: STATUS_COLORS[field.status] }} />
                <span style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, flex: 1 }} className="truncate">{field.name}</span>
                <span
                  className="rounded-full px-2 py-0.5"
                  style={{
                    background: `${STATUS_COLORS[field.status]}20`,
                    color: STATUS_COLORS[field.status],
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {STATUS_LABELS[field.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5" style={{ fontSize: 11 }}>
                <div><span style={{ color: '#94a3b8' }}>编号：</span><span style={{ color: '#334155' }}>{field.code}</span></div>
                <div><span style={{ color: '#94a3b8' }}>作物：</span><span style={{ color: '#334155' }}>{field.crop}</span></div>
                <div><span style={{ color: '#94a3b8' }}>面积：</span><span style={{ color: '#334155' }}>{field.area} 亩</span></div>
                <div><span style={{ color: '#94a3b8' }}>分区：</span><span style={{ color: '#334155' }}>{field.zones.length} 个</span></div>
              </div>

              {selectedFieldId === field.id ? (
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/field/${field.id}`);
                    }}
                    className="flex-1 py-1.5 rounded-lg"
                    style={{ background: '#eff6ff', color: '#2563eb', fontSize: 12 }}
                  >
                    查看详情
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      startEditField(field);
                    }}
                    className="flex-1 py-1.5 rounded-lg"
                    style={{ background: '#fff7ed', color: '#c2410c', fontSize: 12 }}
                  >
                    编辑地块
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      startDrawZone();
                    }}
                    className="flex-1 py-1.5 rounded-lg"
                    style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 12 }}
                  >
                    新增分区
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteConfirm(field.id);
                    }}
                    className="px-2.5 py-1.5 rounded-lg"
                    style={{ background: '#fef2f2', color: '#ef4444' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#f1f5f9' }}>
            {[
              { mode: 'browse' as MapMode, label: '浏览', icon: Eye, onClick: resetDrawState },
              { mode: 'draw-field' as MapMode, label: '新建地块', icon: Plus, onClick: startDrawField },
              { mode: 'draw-zone' as MapMode, label: '新建分区', icon: Layers, onClick: startDrawZone },
            ].map(({ mode: buttonMode, label, icon: Icon, onClick }) => (
              <button
                key={buttonMode}
                onClick={onClick}
                disabled={buttonMode === 'draw-zone' && !selectedFieldId}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                style={{
                  background: mode === buttonMode ? '#16a34a' : 'transparent',
                  color: mode === buttonMode ? '#ffffff' : buttonMode === 'draw-zone' && !selectedFieldId ? '#cbd5e1' : '#64748b',
                  fontSize: 13,
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {isDrawing ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
              <Crosshair size={14} />
              <span style={{ fontSize: 13 }}>
                {drawStep === 'drawing'
                  ? mode === 'draw-field'
                    ? `${isEditingField ? '编辑地块' : '创建地块'}：单击添加顶点，双击完成绘制。当前已落点 ${drawPoints.length} 个`
                    : `${isEditingZone ? '编辑分区' : '创建分区'}：单击添加顶点，双击完成绘制。当前已落点 ${drawPoints.length} 个`
                  : mode === 'draw-field'
                    ? `${isEditingField ? '地块轮廓已就绪，请修改地块信息后保存' : '地块轮廓已完成，请填写地块基本信息后保存'}`
                    : `${isEditingZone ? '分区轮廓已就绪，请修改分区信息后保存' : '分区轮廓已完成，请填写分区基本信息后保存'}`}
              </span>
              {drawStep === 'drawing' ? (
                <>
                  <button
                    onClick={() => setDrawPoints((prev) => prev.slice(0, -1))}
                    disabled={drawPoints.length === 0}
                    className="px-2 py-0.5 rounded"
                    style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 11 }}
                  >
                    撤销
                  </button>
                  <button
                    onClick={handleFinishDrawing}
                    disabled={drawPoints.length < 3}
                    className="px-2 py-0.5 rounded"
                    style={{ background: drawPoints.length >= 3 ? '#1d4ed8' : '#93c5fd', color: '#ffffff', fontSize: 11 }}
                  >
                    完成绘制
                  </button>
                </>
              ) : null}
              <button onClick={resetDrawState} style={{ color: '#1d4ed8' }}>
                <X size={14} />
              </button>
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => refreshFields()}
              className="flex items-center gap-1 px-3 py-2 rounded-lg"
              style={{ background: '#f8fafc', color: '#475569', fontSize: 12, border: '1px solid #e2e8f0' }}
            >
              <RotateCcw size={14} /> 刷新
            </button>
          </div>
        </div>

        <div
          className="relative flex-1 overflow-hidden"
          style={{ background: '#dbeafe', minHeight: 520, height: '100%' }}
        >
          {amapEnabled ? (
            <div
              ref={mapContainerRef}
              style={{ width: '100%', height: '100%', minHeight: 520, cursor: isDrawing && drawStep === 'drawing' ? 'crosshair' : 'default' }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
              <div>
                <MapPinned size={34} color="#64748b" style={{ margin: '0 auto 12px' }} />
                <div style={{ color: '#0f172a', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>地块地图待接入</div>
                <div style={{ color: '#64748b', fontSize: 14, maxWidth: 520 }}>{setupHint || '高德地图尚未准备完成。'}</div>
              </div>
            </div>
          )}

          {mapError ? (
            <div className="absolute left-4 bottom-4 rounded-xl px-3 py-2" style={{ background: 'rgba(127,29,29,0.92)', color: '#fff', fontSize: 12 }}>
              {mapError}
            </div>
          ) : null}

          {isDrawing && drawStep === 'info' ? (
            <div
              className="absolute right-4 top-4 rounded-2xl shadow-xl p-5"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', width: 320, zIndex: 20 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>
                  {mode === 'draw-field'
                    ? isEditingField ? '编辑地块信息' : '填写地块信息'
                    : isEditingZone ? '编辑分区信息' : '填写分区信息'}
                </h3>
                <button onClick={resetDrawState}><X size={18} color="#64748b" /></button>
              </div>

              {mode === 'draw-field' ? (
                <div className="flex flex-col gap-3">
                  {[
                    { key: 'name' as const, label: '地块名称 *', value: newFieldName, onChange: setNewFieldName, placeholder: '如：北区一号田' },
                    { key: 'code' as const, label: '编号 *', value: newFieldCode, onChange: setNewFieldCode, placeholder: '如：FA-001' },
                    { key: 'crop' as const, label: '作物品种 *', value: newFieldCrop, onChange: setNewFieldCrop, placeholder: '如：玉米' },
                    { key: 'stage' as const, label: '生育期 *', value: newFieldStage, onChange: setNewFieldStage, placeholder: '如：拔节期' },
                    { key: 'kc' as const, label: '植物系数 Kc *', value: newFieldKc, onChange: setNewFieldKc, placeholder: '如：0.95' },
                    { key: 'efficiency' as const, label: '灌溉效率 *', value: newFieldEff, onChange: setNewFieldEff, placeholder: '0.85' },
                  ].map((item) => (
                    <div key={item.label}>
                      <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>{item.label}</label>
                      <input
                        value={item.value}
                        onChange={(event) => {
                          item.onChange(event.target.value);
                          setFieldFormErrors((prev) => ({ ...prev, [item.key]: undefined }));
                        }}
                        placeholder={item.placeholder}
                        className="w-full px-3 py-2 rounded-lg outline-none"
                        style={{
                          border: `1px solid ${fieldFormErrors[item.key] ? '#ef4444' : '#e2e8f0'}`,
                          fontSize: 13,
                          background: fieldFormErrors[item.key] ? '#fef2f2' : '#f8fafc',
                          color: '#0f172a',
                        }}
                      />
                      {fieldFormErrors[item.key] ? (
                        <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{fieldFormErrors[item.key]}</div>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleRedrawBoundary}
                    className="w-full py-2 rounded-lg"
                    style={{ border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: 13, background: '#eff6ff' }}
                  >
                    重新绘制地块轮廓
                  </button>
                  <div className="flex gap-2 mt-2">
                    <button onClick={resetDrawState} className="flex-1 py-2 rounded-lg" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 13 }}>取消</button>
                    <button
                      onClick={handleSaveField}
                      disabled={saving}
                      className="flex-1 py-2 rounded-lg flex items-center justify-center gap-2"
                      style={{ background: '#16a34a', color: '#ffffff', fontSize: 13 }}
                    >
                      <Save size={14} /> {isEditingField ? '保存修改' : '保存地块'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>所属地块</label>
                    <div className="px-3 py-2 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a' }}>
                      {selectedField?.name || '—'}
                    </div>
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>分区名称 *</label>
                    <input
                      value={newZoneName}
                      onChange={(event) => {
                        setNewZoneName(event.target.value);
                        setZoneFormErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      placeholder="如：A-1区"
                      className="w-full px-3 py-2 rounded-lg outline-none"
                      style={{
                        border: `1px solid ${zoneFormErrors.name ? '#ef4444' : '#e2e8f0'}`,
                        fontSize: 13,
                        background: zoneFormErrors.name ? '#fef2f2' : '#f8fafc',
                        color: '#0f172a',
                      }}
                    />
                    {zoneFormErrors.name ? (
                      <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{zoneFormErrors.name}</div>
                    ) : null}
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>绑定设备与站点 *</label>
                    <div
                      className="rounded-xl p-3"
                      style={{
                        border: `1px solid ${zoneFormErrors.bindings ? '#ef4444' : '#e2e8f0'}`,
                        background: zoneFormErrors.bindings ? '#fef2f2' : '#f8fafc',
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      {bindableDevices.length === 0 ? (
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>暂无可绑定设备</div>
                      ) : (
                        <>
                          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>先选择设备，再选择该设备下的站点。选中站点后会在区域内生成可拖动图标。</div>
                          <select
                            value={selectedDeviceId ?? ''}
                            onChange={(event) => setSelectedDeviceId(event.target.value || null)}
                            className="w-full px-3 py-2 rounded-lg outline-none"
                            style={{ border: '1px solid #e2e8f0', fontSize: 13, background: '#ffffff', color: '#0f172a' }}
                          >
                            <option value="">请选择设备</option>
                            {bindableDevices.map((device) => {
                              const selectedCount = zoneDeviceDrafts.filter((item) => item.deviceId === device.id).length;
                              return (
                                <option key={device.id} value={device.id}>
                                  {device.name} · {device.model}{selectedCount > 0 ? ` · 已添加${selectedCount}` : ''}
                                </option>
                              );
                            })}
                          </select>
                          {selectedDeviceId ? (
                            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                              <div style={{ color: '#0f172a', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                                选择站点
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {selectedDeviceStations.map((station) => {
                                  if (!selectedDevice) return null;
                                  const active = zoneDeviceDrafts.some((item) => item.key === `${selectedDevice.id}:${station.id}`);
                                  return (
                                    <button
                                      key={`${selectedDevice.id}-${station.id}`}
                                      type="button"
                                      onClick={() => toggleZoneDeviceDraft(selectedDevice, station.id, station.name)}
                                      className="px-2.5 py-1.5 rounded-lg"
                                      style={{
                                        border: `1px solid ${active ? '#16a34a' : '#cbd5e1'}`,
                                        background: active ? '#f0fdf4' : '#ffffff',
                                        color: active ? '#16a34a' : '#475569',
                                        fontSize: 12,
                                      }}
                                    >
                                      {station.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          {zoneDeviceDrafts.length > 0 ? (
                            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #e2e8f0' }}>
                              <div style={{ color: '#0f172a', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>已放置设备</div>
                              <div className="flex flex-col gap-2">
                                {zoneDeviceDrafts.map((item) => (
                                  <div
                                    key={item.key}
                                    className="flex items-center justify-between rounded-lg px-3 py-2"
                                    style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
                                  >
                                    <div>
                                      <div style={{ color: '#0f172a', fontSize: 12, fontWeight: 600 }}>{item.deviceName}</div>
                                      <div style={{ color: '#94a3b8', fontSize: 11 }}>{item.stationName} · 地图中可拖动调整位置，且不能移出分区</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setZoneDeviceDrafts((prev) => prev.filter((draft) => draft.key !== item.key))}
                                      style={{ color: '#ef4444', fontSize: 12 }}
                                    >
                                      移除
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                    {zoneFormErrors.bindings ? (
                      <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{zoneFormErrors.bindings}</div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleRedrawBoundary}
                    className="w-full py-2 rounded-lg"
                    style={{ border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: 13, background: '#eff6ff' }}
                  >
                    重新绘制分区轮廓
                  </button>
                  <div className="flex gap-2 mt-2">
                    <button onClick={resetDrawState} className="flex-1 py-2 rounded-lg" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 13 }}>取消</button>
                    <button
                      onClick={handleSaveZone}
                      disabled={saving}
                      className="flex-1 py-2 rounded-lg flex items-center justify-center gap-2"
                      style={{ background: '#16a34a', color: '#ffffff', fontSize: 13 }}
                    >
                      <Save size={14} /> {isEditingZone ? '保存修改' : '保存分区'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {selectedField && mode === 'browse' ? (
        <div
          className="flex flex-col shrink-0 overflow-hidden"
          style={{ width: 300, background: '#ffffff', borderLeft: '1px solid #e2e8f0' }}
        >
          <div className="px-4 py-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 style={{ color: '#0f172a', fontSize: 16, fontWeight: 600 }}>{selectedField.name}</h3>
              <button onClick={() => setSelectedFieldId(null)}><X size={16} color="#94a3b8" /></button>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: `${STATUS_COLORS[selectedField.status]}20`, color: STATUS_COLORS[selectedField.status] }}
              >
                {STATUS_LABELS[selectedField.status]}
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{selectedField.code}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['作物', selectedField.crop],
                ['生育期', selectedField.growthStage],
                ['面积', `${selectedField.area} 亩`],
                ['Kc', selectedField.kc],
                ['ETc', `${selectedField.etc} mm`],
                ['降雨', `${selectedField.rainfall24h} mm`],
              ].map(([label, value]) => (
                <div key={String(label)} className="p-2 rounded-lg" style={{ background: '#f8fafc' }}>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>{label}</div>
                  <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>分区列表</span>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{selectedField.zones.length} 个分区</span>
              </div>
              {selectedField.zones.length === 0 ? (
                <div className="text-center py-5 rounded-xl" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#94a3b8', fontSize: 12 }}>
                  暂无分区，右上角可直接开始绘制
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedField.zones.map((zone) => (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedZoneId(selectedZoneId === zone.id ? null : zone.id)}
                      className="p-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        border: `1px solid ${selectedZoneId === zone.id ? '#2563eb' : '#e2e8f0'}`,
                        background: selectedZoneId === zone.id ? '#eff6ff' : '#f8fafc',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{zone.name}</span>
                        <span
                          className="px-1.5 py-0.5 rounded-full text-xs"
                          style={{ background: `${ZONE_STATUS_COLORS[zone.status]}20`, color: ZONE_STATUS_COLORS[zone.status] }}
                        >
                          {zone.status === 'idle' ? '待机' : zone.status === 'running' ? '浇灌中' : '高风险'}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>
                        站点 {zone.stationNo} · 湿度 {zone.soilMoisture}% · 设备 {zone.deviceIds.length}
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditZone(selectedField, zone.id);
                          }}
                          style={{ color: '#1d4ed8', fontSize: 12 }}
                        >
                          编辑分区
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedZone ? (
              <div className="rounded-xl p-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ color: '#1d4ed8', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{selectedZone.name}</div>
                <div style={{ color: '#1e40af', fontSize: 12 }}>
                  站点 {selectedZone.stationNo} · 建议单次 {selectedZone.duration} 分钟
                </div>
              </div>
            ) : null}

            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>设备点位</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {fieldDevices(selectedField).length === 0 ? (
                  <div className="p-3 rounded-xl" style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 12 }}>
                    设备接口下一步接入，当前先完成地块与分区。
                  </div>
                ) : (
                  fieldDevices(selectedField).slice(0, 4).map((device) => (
                    <div key={device.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#f8fafc' }}>
                      <div
                        className="rounded-full shrink-0"
                        style={{ width: 8, height: 8, background: device.status === 'online' ? '#22c55e' : device.status === 'alarm' ? '#ef4444' : '#94a3b8' }}
                      />
                      <span style={{ color: '#374151', fontSize: 12, flex: 1 }} className="truncate">{device.name}</span>
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>{device.model}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-auto">
              <button
                onClick={() => navigate(`/field/${selectedField.id}`)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl w-full"
                style={{ background: '#16a34a', color: '#ffffff', fontSize: 14 }}
              >
                查看地块详情 <ArrowRight size={16} />
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => startEditField(selectedField)}
                  className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
                  style={{ background: '#fff7ed', color: '#c2410c', fontSize: 13 }}
                >
                  <Pencil size={14} /> 编辑地块
                </button>
                <button
                  onClick={startDrawZone}
                  className="flex-1 py-2 rounded-xl"
                  style={{ background: '#eff6ff', color: '#2563eb', fontSize: 13 }}
                >
                  新增分区
                </button>
                <button
                  onClick={() => setDeleteConfirm(selectedField.id)}
                  className="px-4 py-2 rounded-xl"
                  style={{ background: '#fef2f2', color: '#ef4444', fontSize: 13 }}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirm ? (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 shadow-2xl" style={{ background: '#ffffff', width: 360 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: '#fef2f2' }}>
                <AlertTriangle size={24} color="#ef4444" />
              </div>
              <div>
                <div style={{ color: '#0f172a', fontSize: 16, fontWeight: 600 }}>确认删除地块？</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>删除后将无法恢复</div>
              </div>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              将同时删除该地块下的所有分区。当前设备数据后续接入时会一起级联处理。
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 14 }}>取消</button>
              <button onClick={() => handleDeleteField(deleteConfirm)} className="flex-1 py-2.5 rounded-xl" style={{ background: '#ef4444', color: '#ffffff', fontSize: 14 }}>确认删除</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
