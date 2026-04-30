import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  CloudRain,
  Cpu,
  Droplets,
  Leaf,
  RefreshCw,
  TrendingUp,
  Waves,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import type { Device, Field } from '../data/mockData';
import { isAmapConfigured, loadAmap } from '../../lib/amap';
import {
  fetchEt0Forecast,
  fetchWeatherOverview,
  getForecastLocation,
  type Et0ForecastDay,
  type WeatherOverviewData,
} from '../../lib/weatherEtService';
import {
  etHistory,
  rainfallHistory,
  soilMoistureHistory,
} from '../data/mockData';
import {
  buildDashboardSnapshot,
  buildDecisionSummary,
  buildDuePlans,
  buildFieldRisks,
  buildSensorOverview,
  buildStrategyState,
  buildSupplyOverview,
  buildWeatherOverview,
} from '../data/workspaceMock';
import { compactStationLabel, controllerGlyphSvg, sensorGlyphSvg } from '../components/mapDeviceIcons';

const STATUS_COLORS: Record<Field['status'], string> = { normal: '#22c55e', warning: '#f59e0b', alarm: '#ef4444' };
const STATUS_LABELS: Record<Field['status'], string> = { normal: '正常', warning: '预警', alarm: '告警' };
const ZONE_STATUS_COLORS: Record<string, string> = { idle: '#94a3b8', pending: '#f59e0b', running: '#2563eb', alarm: '#ef4444' };
const ZONE_FILL_OPACITY: Record<string, number> = { idle: 0.14, pending: 0.26, running: 0.34, alarm: 0.32 };
const DEVICE_STATUS_COLORS: Record<'online' | 'offline' | 'partial' | 'alarm' | 'unknown', string> = {
  online: '#22c55e',
  offline: '#64748b',
  partial: '#f59e0b',
  alarm: '#ef4444',
  unknown: '#94a3b8',
};
const DEVICE_STATUS_LABELS: Record<'online' | 'offline' | 'partial' | 'alarm' | 'unknown', string> = {
  online: '在线',
  offline: '离线',
  partial: '部分离线',
  alarm: '告警',
  unknown: '未知',
};
const SWITCH_STATUS_LABELS: Record<'open' | 'closed' | 'unknown' | 'none', string> = {
  open: '开启',
  closed: '关闭',
  unknown: '未知',
  none: '无开关',
};
const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];
const OVERVIEW_MAP_CENTER_KEY = 'overview-map:last-center';

function getSiteStatus(devices: Device[]) {
  if (devices.length === 0) {
    return 'unknown' as const;
  }
  if (devices.some((device) => device.status === 'alarm')) {
    return 'alarm' as const;
  }
  if (devices.every((device) => device.status === 'offline')) {
    return 'offline' as const;
  }
  if (devices.some((device) => device.status === 'offline')) {
    return 'partial' as const;
  }
  if (devices.every((device) => device.status === 'online')) {
    return 'online' as const;
  }
  return 'unknown' as const;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function getBoundaryCenter(boundary: [number, number][]) {
  if (boundary.length === 0) {
    return DEFAULT_CENTER;
  }

  const lng = boundary.reduce((sum, [value]) => sum + value, 0) / boundary.length;
  const lat = boundary.reduce((sum, [, value]) => sum + value, 0) / boundary.length;
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))] as [number, number];
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

function getCachedCenter() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(OVERVIEW_MAP_CENTER_KEY);
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
      return [Number(parsed[0]), Number(parsed[1])] as [number, number];
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
    window.sessionStorage.setItem(OVERVIEW_MAP_CENTER_KEY, JSON.stringify(center));
  } catch {
    // ignore cache failures
  }
}

function getOverviewDeviceMarkers(fields: Field[], devices: Device[]) {
  const markers: Array<{
    key: string;
    position: [number, number];
    type: 'controller' | 'station' | 'sensor';
    status: 'online' | 'offline' | 'partial' | 'alarm' | 'unknown';
    switchStatus: 'open' | 'closed' | 'unknown' | 'none';
    label: string;
    sensorType?: Device['sensorType'];
  }> = [];
  const fieldIds = new Set(fields.map((field) => field.id));
  const zoneIds = new Set(fields.flatMap((field) => field.zones.map((zone) => zone.id)));

  devices.forEach((device) => {
    const belongsToVisibleField =
      fieldIds.has(device.fieldId) ||
      zoneIds.has(device.zoneId) ||
      (device.bindings?.some((binding) => fieldIds.has(binding.fieldId) || zoneIds.has(binding.zoneId)) ?? false);

    if (!belongsToVisibleField) {
      return;
    }

    if (device.type === 'controller' && device.geoPosition) {
      markers.push({
        key: `controller:${device.id}`,
        position: device.geoPosition,
        type: 'controller',
        status: getSiteStatus([device]),
        switchStatus: 'none',
        label: device.name,
      });
    }

    if (device.type === 'controller') {
      (device.bindings ?? [])
        .filter((binding) => binding.geoPosition && (fieldIds.has(binding.fieldId) || zoneIds.has(binding.zoneId)))
        .forEach((binding) => {
          if (!binding.geoPosition) {
            return;
          }

          markers.push({
            key: `${device.id}:${binding.stationId}`,
            position: binding.geoPosition,
            type: 'station',
            status: getSiteStatus([device]),
            switchStatus: binding.switchStatus ?? 'unknown',
            label: binding.stationName,
          });
        });
      return;
    }

    if (device.type === 'sensor' && device.geoPosition) {
      markers.push({
        key: `sensor:${device.id}`,
        position: device.geoPosition,
        type: 'sensor',
        status: getSiteStatus([device]),
        switchStatus: 'none',
        label: device.name,
        sensorType: device.sensorType,
      });
    }
  });

  return markers;
}

function renderOverviewDeviceMarker(markerInfo: ReturnType<typeof getOverviewDeviceMarkers>[number]) {
  const statusColor = DEVICE_STATUS_COLORS[markerInfo.status];
  if (markerInfo.type === 'station') {
    const switchColor = markerInfo.switchStatus === 'open'
      ? '#2563eb'
      : markerInfo.switchStatus === 'closed'
        ? '#64748b'
        : '#94a3b8';
    const stationLabel = compactStationLabel(markerInfo.label);
    return `
      <div title="${escapeHtml(`${markerInfo.label} · ${DEVICE_STATUS_LABELS[markerInfo.status]} · 开关${SWITCH_STATUS_LABELS[markerInfo.switchStatus]}`)}" style="position:relative;display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:999px;background:#fff;color:#0f172a;border:2px solid ${statusColor};box-shadow:0 8px 20px rgba(15,23,42,.22);">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:rgba(34,197,94,.12);color:#166534;border:1px solid rgba(34,197,94,.28);font-size:13px;line-height:1;font-weight:800;">${escapeHtml(stationLabel)}</span>
        <span style="position:absolute;right:-2px;top:-2px;width:11px;height:11px;border-radius:999px;background:${statusColor};border:2px solid #fff;"></span>
        <span style="position:absolute;left:-3px;bottom:-3px;width:15px;height:15px;border-radius:999px;background:${switchColor};border:2px solid #fff;color:#fff;font-size:9px;line-height:11px;text-align:center;font-weight:800;">${markerInfo.switchStatus === 'open' ? '开' : markerInfo.switchStatus === 'closed' ? '关' : '?'}</span>
      </div>
    `;
  }

  const nodeColor = markerInfo.type === 'sensor' ? '#16a34a' : '#7c3aed';
  return `
    <div title="${escapeHtml(`${markerInfo.label} · ${DEVICE_STATUS_LABELS[markerInfo.status]}`)}" style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:#fff;color:${nodeColor};border:2px solid ${statusColor};box-shadow:0 8px 20px rgba(15,23,42,.22);">
      ${markerInfo.type === 'sensor' ? sensorGlyphSvg(markerInfo.sensorType) : controllerGlyphSvg()}
      <span style="position:absolute;right:-3px;top:-3px;width:12px;height:12px;border-radius:999px;background:${statusColor};border:2px solid #fff;"></span>
    </div>
  `;
}

function InsightCard({
  title,
  chip,
  hero,
  sub,
  children,
}: {
  title: string;
  chip: string;
  hero: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className="rounded-2xl p-5"
      style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>{title}</h3>
        <span
          className="px-2.5 py-1 rounded-full"
          style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600 }}
        >
          {chip}
        </span>
      </div>
      <div className="mb-4">
        <div style={{ color: '#0f172a', fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{hero}</div>
        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{sub}</div>
      </div>
      {children}
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#f8fafc' }}>
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function PanelTitle({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>{title}</h3>
      {action && (
        <button
          onClick={onClick}
          style={{ color: '#2563eb', fontSize: 12, fontWeight: 500 }}
          className="flex items-center gap-1"
        >
          {action} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

export function Overview() {
  const { fields, plans, strategies, devices, refreshFields, refreshDevices, refreshPlans } = useApp();
  const navigate = useNavigate();
  const [refreshed, setRefreshed] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const overviewMapRef = useRef<any>(null);
  const overviewOverlaysRef = useRef<any[]>([]);
  const [overviewMapReady, setOverviewMapReady] = useState(false);
  const [hoveredField, setHoveredField] = useState<(typeof fields)[number] | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [liveWeather, setLiveWeather] = useState<WeatherOverviewData | null>(null);
  const [liveEt0Forecast, setLiveEt0Forecast] = useState<Et0ForecastDay[]>([]);
  const [weatherEtError, setWeatherEtError] = useState('');
  const [weatherEtRefreshKey, setWeatherEtRefreshKey] = useState(0);

  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  const liveEt0Today = liveEt0Forecast[0]?.et0;
  const liveFields = fields.map((field) => {
    if (typeof liveEt0Today !== 'number' || liveEt0Today <= 0) {
      return liveWeather ? { ...field, rainfall24h: liveWeather.todayRainMm } : field;
    }
    return {
      ...field,
      et0: liveEt0Today,
      etc: Number((liveEt0Today * field.kc).toFixed(2)),
      rainfall24h: liveWeather?.todayRainMm ?? field.rainfall24h,
    };
  });
  const dashboard = buildDashboardSnapshot(liveFields, devices);
  const fieldRisks = buildFieldRisks(liveFields);
  const duePlans = buildDuePlans(fields, plans);
  const decision = buildDecisionSummary(fieldRisks, duePlans, strategies);
  const fallbackWeather = buildWeatherOverview(fields);
  const weather = liveWeather ?? fallbackWeather;
  const sensorOverview = buildSensorOverview(liveFields, devices);
  const supplyOverview = buildSupplyOverview(devices, duePlans);
  const strategyState = buildStrategyState(strategies);
  const amapEnabled = isAmapConfigured();
  const initialFieldCenter = getInitialCenterFromFields(fields);
  const forecastLocation = getForecastLocation(fields);
  const forecastLocationKey = `${forecastLocation.lat.toFixed(4)},${forecastLocation.lng.toFixed(4)}`;
  const chartRainfallHistory = liveWeather?.dailyRain.length
    ? liveWeather.dailyRain.map((day) => ({
      date: day.date.slice(5).replace('-', '/'),
      rain: day.rainMm,
    }))
    : rainfallHistory;
  const chartEtHistory = liveEt0Forecast.length
    ? liveEt0Forecast.map((day) => ({
      date: day.date.slice(5).replace('-', '/'),
      et0: day.et0,
      etc_avg: Number((day.et0 * (dashboard.averageEtc / Math.max(dashboard.averageEt0, 0.01))).toFixed(2)),
    }))
    : etHistory;

  useEffect(() => {
    const controller = new AbortController();
    const { lat, lng } = forecastLocation;

    setWeatherEtError('');
    void Promise.all([
      fetchWeatherOverview(lat, lng, controller.signal),
      fetchEt0Forecast(lat, lng, controller.signal),
    ])
      .then(([nextWeather, nextEt0]) => {
        setLiveWeather(nextWeather);
        setLiveEt0Forecast(nextEt0);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setWeatherEtError(error instanceof Error ? error.message : '天气和 ET 数据读取失败');
          setLiveWeather(null);
          setLiveEt0Forecast([]);
        }
      });

    return () => controller.abort();
  }, [forecastLocationKey, weatherEtRefreshKey]);

  useEffect(() => {
    if (!amapEnabled || !mapContainerRef.current) {
      return;
    }

    let cancelled = false;

    void loadAmap()
      .then((AMap) => {
        if (cancelled || overviewMapRef.current || !mapContainerRef.current) {
          return;
        }

        const cachedCenter = getCachedCenter();
        const initialCenter = initialFieldCenter ?? cachedCenter ?? DEFAULT_CENTER;
        const map = new AMap.Map(mapContainerRef.current, {
          resizeEnable: true,
          zoom: 15,
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
        overviewMapRef.current = map;
        setOverviewMapReady(true);

        if (initialFieldCenter) {
          setCachedCenter(initialFieldCenter);
          return;
        }

        getBrowserLocation()
          .then((center) => {
            if (cancelled || !overviewMapRef.current) {
              return;
            }
            map.setCenter(center);
            setCachedCenter(center);
          })
          .catch(() => {
            getCityCenter(AMap)
              .then((center) => {
                if (cancelled || !overviewMapRef.current) {
                  return;
                }
                map.setCenter(center);
                setCachedCenter(center);
              })
              .catch(() => {});
          });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [amapEnabled, initialFieldCenter]);

  useEffect(() => {
    return () => {
      overviewOverlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
      overviewMapRef.current?.destroy?.();
      overviewMapRef.current = null;
      setOverviewMapReady(false);
      setHoveredField(null);
      setHoverPosition(null);
    };
  }, []);

  useEffect(() => {
    const map = overviewMapRef.current;
    const AMap = typeof window !== 'undefined' ? window.AMap : null;
    if (!map || !AMap || !overviewMapReady) {
      return;
    }

    overviewOverlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
    overviewOverlaysRef.current = [];

    const nextOverlays: any[] = [];

    fields.forEach((field) => {
      if (!field.geoBoundary || field.geoBoundary.length < 3) {
        return;
      }

      const statusColor = STATUS_COLORS[field.status];

      const polygon = new AMap.Polygon({
        path: field.geoBoundary,
        strokeColor: statusColor,
        strokeWeight: field.status === 'normal' ? 2 : 3,
        fillColor: statusColor,
        fillOpacity: field.status === 'normal' ? 0.12 : 0.18,
        zIndex: 20,
      });
      polygon.on('mouseover', (event: any) => {
        setHoveredField(field);
        if (event?.pixel) {
          setHoverPosition({ x: event.pixel.x + 14, y: event.pixel.y - 18 });
        }
      });
      polygon.on('mousemove', (event: any) => {
        if (event?.pixel) {
          setHoverPosition({ x: event.pixel.x + 14, y: event.pixel.y - 18 });
        }
      });
      polygon.on('mouseout', () => {
        setHoveredField(null);
        setHoverPosition(null);
      });
      polygon.on('click', () => navigate(`/field/${field.id}`));
      polygon.setMap(map);
      nextOverlays.push(polygon);

      field.zones.forEach((zone) => {
        if (!zone.geoBoundary || zone.geoBoundary.length < 3) {
          return;
        }

        const zonePolygon = new AMap.Polygon({
          path: zone.geoBoundary,
          strokeColor: ZONE_STATUS_COLORS[zone.status],
          strokeWeight: zone.status === 'idle' ? 2 : 3,
          strokeOpacity: 0.9,
          strokeStyle: 'dashed',
          fillOpacity: ZONE_FILL_OPACITY[zone.status] ?? 0.2,
          fillColor: ZONE_STATUS_COLORS[zone.status],
          zIndex: 35,
        });
        zonePolygon.setMap(map);
        nextOverlays.push(zonePolygon);

        const zoneLabel = new AMap.Text({
          text: zone.name,
          position: zone.geoCenter ?? zone.geoBoundary[0],
          offset: new AMap.Pixel(-30, -14),
          style: {
            padding: '3px 9px',
            borderRadius: '999px',
            border: `1px solid ${ZONE_STATUS_COLORS[zone.status]}66`,
            background: 'rgba(255,255,255,0.93)',
            color: '#0f172a',
            fontSize: '12px',
            fontWeight: zone.status !== 'idle' ? '700' : '600',
            boxShadow: '0 8px 18px rgba(15,23,42,0.18)',
          },
        });
        zoneLabel.setMap(map);
        nextOverlays.push(zoneLabel);
      });

      const label = new AMap.Text({
        text: field.name,
        position: field.geoCenter ?? field.geoBoundary[0],
        offset: new AMap.Pixel(-48, -34),
        style: {
          padding: '4px 10px',
          borderRadius: '999px',
          border: 'none',
          background: 'rgba(15, 23, 42, 0.78)',
          color: '#fff',
          fontSize: '12px',
          fontWeight: '600',
        },
      });
      label.setMap(map);
      nextOverlays.push(label);
    });

    getOverviewDeviceMarkers(fields, devices).forEach((markerInfo) => {
        const marker = new AMap.Marker({
          position: markerInfo.position,
          anchor: 'center',
          content: renderOverviewDeviceMarker(markerInfo),
          offset: new AMap.Pixel(0, 0),
          zIndex: markerInfo.type === 'station' ? 45 : 48,
        });
        marker.setMap(map);
        nextOverlays.push(marker);
      });

    overviewOverlaysRef.current = nextOverlays;

    if (nextOverlays.length > 0) {
      map.setFitView(nextOverlays, false, [40, 40, 40, 40]);
    }
  }, [devices, fields, navigate, overviewMapReady]);

  return (
    <div className="flex flex-col h-full overflow-auto" style={{ background: '#f0f4f8' }}>
      <div className="px-6 pt-6 pb-4" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ color: '#0f172a', fontSize: 22, fontWeight: 700 }}>灌溉总览</h1>
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
              {dateStr} · {timeStr} · {weatherEtError ? '天气/ET 使用本地回退数据' : liveWeather ? '天气/ET 接入 Open-Meteo 实时预报' : '天气/ET 数据加载中'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dashboard.attentionFields > 0 && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
              >
                <AlertTriangle size={16} color="#ef4444" />
                <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
                  {dashboard.attentionFields} 个关注地块
                </span>
              </div>
            )}
            <button
              onClick={() => {
                setRefreshed(true);
                setWeatherEtRefreshKey((key) => key + 1);
                void Promise.all([refreshFields(), refreshDevices(), refreshPlans()]);
                setTimeout(() => setRefreshed(false), 1200);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontSize: 13 }}
            >
              <RefreshCw size={14} className={refreshed ? 'animate-spin' : ''} />
              刷新态势
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-5">
        <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <InsightCard
            title="天气与雨量"
            chip="天气影响"
            hero={`${weather.next24hRainMm.toFixed(1)} mm`}
            sub="未来 24 小时预计降雨"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="今日累计雨量" value={`${weather.todayRainMm.toFixed(1)} mm`} />
              <MiniMetric label="降雨概率" value={`${weather.rainProbability}%`} />
            </div>
            <div className="mt-4 flex items-center gap-2" style={{ color: '#64748b', fontSize: 12 }}>
              <CloudRain size={14} color="#0ea5e9" />
              {weather.recommendation}
            </div>
          </InsightCard>

          <InsightCard
            title="土壤与传感"
            chip="传感聚合"
            hero={`${sensorOverview.averageSoilMoisture.toFixed(0)}%`}
            sub="全场平均土壤湿度"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric
                label="最低湿度地块"
                value={
                  sensorOverview.driestField
                    ? `${sensorOverview.driestField.name} · ${sensorOverview.driestField.soilMoisture}%`
                    : '暂无'
                }
              />
              <MiniMetric label="链路异常" value={`${sensorOverview.connectivityAlerts} 项`} />
            </div>
            <div className="mt-4 flex items-center gap-2" style={{ color: '#64748b', fontSize: 12 }}>
              <Droplets size={14} color="#16a34a" />
              重点关注南区低湿度与弱信号点位
            </div>
          </InsightCard>

          <InsightCard
            title="ET / 水量平衡"
            chip="蒸散趋势"
            hero={`${(dashboard.averageEtc - weather.todayRainMm * 0.8).toFixed(1)} mm`}
            sub="平均净需水量"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="平均 ET0" value={`${dashboard.averageEt0.toFixed(1)} mm`} />
              <MiniMetric label="平均 ETc" value={`${dashboard.averageEtc.toFixed(1)} mm`} />
            </div>
            <div className="mt-4 flex items-center gap-2" style={{ color: '#64748b', fontSize: 12 }}>
              <Leaf size={14} color="#16a34a" />
              ETc 较高地块优先按作物阶段补水
            </div>
          </InsightCard>

          <InsightCard
            title="供水执行健康"
            chip="系统健康"
            hero={`${supplyOverview.scheduledFlowM3h.toFixed(1)} m³/h`}
            sub="近期待执行总流量"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="在线设备" value={`${dashboard.onlineDevices}/${dashboard.totalDevices}`} />
              <MiniMetric label="系统风险" value={`${supplyOverview.systemRiskCount} 项`} />
            </div>
            <div className="mt-4 flex items-center gap-4" style={{ color: '#64748b', fontSize: 12 }}>
              <span>自动策略 {strategyState.autoEnabled}</span>
              <span>浇灌分区 {dashboard.runningZones}</span>
              <span>平均电量 {dashboard.averageBatteryLevel.toFixed(0)}%</span>
            </div>
          </InsightCard>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] 2xl:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)_minmax(260px,1fr)] gap-4 items-start xl:items-stretch">
          <div className="order-3 xl:col-span-2 2xl:order-1 2xl:col-span-1 flex flex-col gap-4">
            <article
              className="rounded-2xl p-3"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <PanelTitle title="环境趋势" />
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>近 7 日降雨量</div>
                  <ResponsiveContainer width="100%" height={90}>
                    <BarChart data={chartRainfallHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip formatter={(value: number) => [`${value} mm`, '降雨量']} />
                      <Bar dataKey="rain" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>今日土壤湿度趋势</div>
                  <ResponsiveContainer width="100%" height={90}>
                    <AreaChart data={soilMoistureHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis domain={[20, 90]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="f1" stroke="#22c55e" fill="#dcfce7" strokeWidth={2} name="北区" />
                      <Area type="monotone" dataKey="f2" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} name="东区" />
                      <Area type="monotone" dataKey="f3" stroke="#ef4444" fill="#fee2e2" strokeWidth={2} name="南区" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>ET0 / ETc 趋势</div>
                  <ResponsiveContainer width="100%" height={90}>
                    <LineChart data={chartEtHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis domain={[2, 6]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="et0" stroke="#0ea5e9" strokeWidth={2} dot={false} name="ET0" />
                      <Line type="monotone" dataKey="etc_avg" stroke="#16a34a" strokeWidth={2} dot={false} name="ETc均值" />
                      <Legend iconType="line" iconSize={12} wrapperStyle={{ fontSize: 11 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </article>

            <article
              className="rounded-2xl p-3 2xl:flex-1"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <PanelTitle title="计划与策略概况" />
              <div className="flex flex-col gap-3">
                <div className="rounded-xl p-4" style={{ background: '#f8fafc' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Waves size={14} color="#0ea5e9" />
                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>轮灌计划</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {duePlans.length} 个启用计划，今日预计覆盖 {dashboard.runningZones + duePlans.length} 个分区动作
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: '#f8fafc' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={14} color="#16a34a" />
                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>自动策略</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {strategyState.enabled} 个启用，其中 {strategyState.autoEnabled} 个自动执行，{strategyState.rainLocked} 个带雨锁
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: '#f8fafc' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu size={14} color="#8b5cf6" />
                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>设备健康</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    离线 {supplyOverview.offlineDeviceCount} 台，低电量 {supplyOverview.lowBatteryCount} 台，需巡检 {supplyOverview.alarmDeviceCount} 项
                  </div>
                </div>
              </div>
            </article>
          </div>

          <article
            className="order-1 xl:order-1 2xl:order-2 rounded-2xl overflow-hidden xl:h-full"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>地块态势地图</h3>
                <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                  地块水分主视图，分区灌溉状态作为辅助图层
                </p>
              </div>
              <button
                onClick={() => navigate('/field-map')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ background: '#16a34a', color: '#ffffff', fontSize: 12 }}
              >
                前往地图 <ArrowRight size={12} />
              </button>
            </div>
            <div style={{ minHeight: 440, height: 'calc(100% - 53px)' }}>
              <div
                className="relative overflow-hidden"
                style={{ minHeight: 440, height: '100%' }}
                ref={mapContainerRef}
              >
                {amapEnabled && !overviewMapReady && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.72)' }}>
                    <div style={{ color: '#64748b', fontSize: 13 }}>地图加载中...</div>
                  </div>
                )}
                {!amapEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
                    <div>
                      <Droplets size={34} color="#64748b" style={{ margin: '0 auto 12px' }} />
                      <div style={{ color: '#0f172a', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>总览地图待接入</div>
                      <div style={{ color: '#64748b', fontSize: 14 }}>请先配置高德地图 Key</div>
                    </div>
                  </div>
                )}
                <div
                  className="absolute left-4 top-4 z-10 rounded-xl px-3 py-2"
                  style={{
                    background: 'rgba(255,255,255,0.92)',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 22px rgba(15,23,42,0.10)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div style={{ color: '#0f172a', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>图例</div>
                  <div className="flex flex-col gap-2">
                    <div>
                      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>地块状态</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          ['normal', '正常'],
                          ['warning', '预警'],
                          ['alarm', '告警'],
                        ].map(([status, label]) => (
                          <div key={status} className="flex items-center gap-1.5" style={{ color: '#475569', fontSize: 11 }}>
                            <span
                              className="inline-flex items-center justify-center rounded-full"
                              style={{
                                width: 14,
                                height: 14,
                                background: '#ffffff',
                                border: `2px solid ${STATUS_COLORS[status as Field['status']]}`,
                              }}
                            />
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>分区状态</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          ['idle', '待机'],
                          ['pending', '等待'],
                          ['running', '浇灌中'],
                          ['alarm', '告警'],
                        ].map(([status, label]) => (
                          <div key={status} className="flex items-center gap-1.5" style={{ color: '#475569', fontSize: 11 }}>
                            <span
                              className="inline-block rounded-sm"
                              style={{
                                width: 14,
                                height: 9,
                                background: ZONE_STATUS_COLORS[status],
                                opacity: ZONE_FILL_OPACITY[status] ?? 0.2,
                                border: `2px solid ${ZONE_STATUS_COLORS[status]}`,
                              }}
                            />
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>设备状态</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          ['online', '在线'],
                          ['offline', '离线'],
                          ['partial', '部分离线'],
                          ['alarm', '告警'],
                        ].map(([status, label]) => (
                          <div key={status} className="flex items-center gap-1.5" style={{ color: '#475569', fontSize: 11 }}>
                            <span
                              className="inline-flex items-center justify-center rounded-full"
                              style={{
                                width: 14,
                                height: 14,
                                background: '#ffffff',
                                border: `2px solid ${DEVICE_STATUS_COLORS[status as keyof typeof DEVICE_STATUS_COLORS]}`,
                              }}
                            />
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>开关状态</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          ['open', '开启', '#2563eb'],
                          ['closed', '关闭', '#64748b'],
                          ['unknown', '未知', '#94a3b8'],
                        ].map(([key, label, color]) => (
                          <div key={key} className="flex items-center gap-1.5" style={{ color: '#475569', fontSize: 11 }}>
                            <span
                              className="inline-flex items-center justify-center rounded-full"
                              style={{
                                width: 16,
                                height: 16,
                                background: color,
                                color: '#ffffff',
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              {key === 'open' ? '开' : key === 'closed' ? '关' : '?'}
                            </span>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {amapEnabled && overviewMapReady && hoveredField && hoverPosition && (
                  <div
                    className="pointer-events-none absolute z-10 rounded-2xl p-4"
                    style={{
                      width: 240,
                      left: hoverPosition.x,
                      top: hoverPosition.y,
                      background: 'rgba(255,255,255,0.92)',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 12px 28px rgba(15,23,42,0.12)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                      {hoveredField.name}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>
                      {hoveredField.crop} · {hoveredField.growthStage}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniMetric label="土壤湿度" value={`${hoveredField.soilMoisture}%`} />
                      <MiniMetric label="ETc" value={`${hoveredField.etc.toFixed(1)} mm/d`} />
                      <MiniMetric label="建议时长" value={`${hoveredField.recommendedDuration} min`} />
                      <MiniMetric label="分区数" value={`${hoveredField.zones.length}`} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>

          <div className="order-2 xl:order-2 2xl:order-3 flex flex-col gap-4 xl:h-full">
            <article
              className="rounded-2xl p-3"
              style={{
                background:
                  decision.level === 'high'
                    ? 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)'
                    : decision.level === 'medium'
                      ? 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)'
                      : '#ffffff',
                border: `1px solid ${
                  decision.level === 'high' ? '#fdba74' : decision.level === 'medium' ? '#bfdbfe' : '#e2e8f0'
                }`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <PanelTitle title="今日灌溉决策" />
              <div style={{ color: '#0f172a', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{decision.title}</div>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>{decision.reason}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <MiniMetric label="待执行计划" value={`${duePlans.length} 个`} />
                <MiniMetric label="预计时长" value={`${decision.durationMinutes} 分钟`} />
                <MiniMetric label="自动策略" value={`${strategyState.autoEnabled} 个`} />
                <MiniMetric label="雨天锁定" value={`${strategyState.rainLocked} 个`} />
              </div>
            </article>

            <div className="grid grid-cols-1 gap-4 xl:flex-1">
              <article
                className="rounded-2xl p-3"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              >
                <PanelTitle title="风险列表" action="查看地块" onClick={() => navigate('/field-map')} />
                <div className="flex flex-col gap-3">
                  {fieldRisks.slice(0, 4).map((risk) => (
                    <button
                      key={risk.id}
                      onClick={() => navigate(`/field/${risk.id}`)}
                      className="text-left rounded-xl p-3"
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{risk.name}</span>
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{
                            background: risk.riskLevel === '高' ? '#fef2f2' : risk.riskLevel === '中' ? '#fffbeb' : '#f0fdf4',
                            color: risk.riskLevel === '高' ? '#ef4444' : risk.riskLevel === '中' ? '#d97706' : '#16a34a',
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {risk.riskLevel}
                        </span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{risk.riskReason}</div>
                      <div className="flex items-center gap-3 mt-2" style={{ color: '#94a3b8', fontSize: 11 }}>
                        <span>湿度 {risk.soilMoisture}%</span>
                        <span>ETc {risk.etc} mm/d</span>
                      </div>
                    </button>
                  ))}
                </div>
              </article>

              <div className="xl:flex-1" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
