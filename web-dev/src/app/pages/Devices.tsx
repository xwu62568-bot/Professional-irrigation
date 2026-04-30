import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Activity,
  AlertTriangle,
  Battery,
  ChevronRight,
  Cpu,
  Search,
  Signal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Device } from '../data/mockData';
import { getWifiDemoMissingConfig, wifiDemoDevice } from '../../lib/wifiDemoConfig';

const TYPE_ICONS: Record<string, any> = {
  sensor: Activity,
  controller: Cpu,
};

const TYPE_LABELS: Record<string, string> = {
  sensor: '传感器',
  controller: '多路控制器',
};

const TYPE_COLORS: Record<string, string> = {
  sensor: '#16a34a',
  controller: '#8b5cf6',
};

const STATUS_CONFIG = {
  online: { color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', label: '在线', icon: Wifi },
  offline: { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', label: '离线', icon: WifiOff },
  alarm: { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', label: '告警', icon: AlertTriangle },
};

function StatCard({
  title,
  value,
  sub,
  color,
}: {
  title: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{title}</div>
      <div style={{ color, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>{sub}</div>
    </div>
  );
}

function DeviceCard({
  device,
  fieldName,
  zoneName,
}: {
  device: Device;
  fieldName: string;
  zoneName: string;
}) {
  const status = STATUS_CONFIG[device.status];
  const TypeIcon = TYPE_ICONS[device.type] ?? Cpu;
  const typeColor = TYPE_COLORS[device.type];

  return (
    <div
      className="rounded-2xl p-5 transition-all"
      style={{
        background: '#ffffff',
        border: `1px solid ${device.status === 'alarm' ? '#fecaca' : '#e2e8f0'}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{ width: 44, height: 44, background: `${typeColor}15`, border: `1px solid ${typeColor}30` }}
        >
          <TypeIcon size={22} color={typeColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600 }} className="truncate">{device.name}</h3>
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0"
              style={{ background: status.bg, color: status.color, fontSize: 11, border: `1px solid ${status.border}` }}
            >
              <status.icon size={10} />
              {status.label}
            </span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{device.model}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-2.5 rounded-xl" style={{ background: '#f8fafc' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>设备类型</div>
          <div style={{ color: typeColor, fontSize: 13, fontWeight: 500 }}>{TYPE_LABELS[device.type]}</div>
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: '#f8fafc' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>站点号</div>
          <div style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>{device.stationNo || '—'}</div>
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: '#f8fafc' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>所属地块</div>
          <div style={{ color: '#374151', fontSize: 12 }} className="truncate">{fieldName}</div>
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: '#f8fafc' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>所属分区</div>
          <div style={{ color: '#374151', fontSize: 12 }} className="truncate">{zoneName || '未绑定'}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        {device.signalStrength !== undefined && (
          <div className="flex items-center gap-1.5 flex-1">
            <Signal size={13} color={device.signalStrength > 70 ? '#22c55e' : device.signalStrength > 40 ? '#f59e0b' : '#ef4444'} />
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: '#f1f5f9' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${device.signalStrength}%`,
                  background: device.signalStrength > 70 ? '#22c55e' : device.signalStrength > 40 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>{device.signalStrength}%</span>
          </div>
        )}
        {device.batteryLevel !== undefined && (
          <div className="flex items-center gap-1">
            <Battery size={13} color={device.batteryLevel > 30 ? '#22c55e' : '#ef4444'} />
            <span style={{ color: '#94a3b8', fontSize: 11 }}>{device.batteryLevel}%</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid #f1f5f9', color: '#94a3b8', fontSize: 12 }}>
        <span>最后在线：{device.lastSeen}</span>
      </div>
    </div>
  );
}

function WifiDemoDeviceCard() {
  const missingConfig = getWifiDemoMissingConfig();
  const isReady = missingConfig.length === 0;
  const status = isReady ? STATUS_CONFIG.online : STATUS_CONFIG.offline;

  return (
    <Link
      to="/wifi-device-demo"
      className="rounded-2xl p-5 transition-all block"
      style={{
        background: '#ffffff',
        border: `1px solid ${isReady ? '#e2e8f0' : '#fecaca'}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{ width: 44, height: 44, background: '#0ea5e915', border: '1px solid #0ea5e930' }}
        >
          <Wifi size={22} color="#0ea5e9" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600 }} className="truncate">
              WC800WF
            </h3>
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0"
              style={{ background: status.bg, color: status.color, fontSize: 11, border: `1px solid ${status.border}` }}
            >
              <status.icon size={10} />
              {isReady ? '已接入' : '待配置'}
            </span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{wifiDemoDevice.model}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-2.5 rounded-xl" style={{ background: '#f8fafc' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>设备类型</div>
          <div style={{ color: '#0ea5e9', fontSize: 13, fontWeight: 500 }}>Wi-Fi 控制器</div>
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: '#f8fafc' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>站点数量</div>
          <div style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>{wifiDemoDevice.stationList.length || '—'}</div>
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: '#f8fafc' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>所属地块</div>
          <div style={{ color: '#374151', fontSize: 12 }} className="truncate">
            {wifiDemoDevice.fieldName || '未配置'}
          </div>
        </div>
        <div className="p-2.5 rounded-xl" style={{ background: '#f8fafc' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>设备 ID</div>
          <div style={{ color: '#374151', fontSize: 12 }} className="truncate">
            {wifiDemoDevice.deviceId || '未配置'}
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-2 pt-3"
        style={{ borderTop: '1px solid #f1f5f9', color: '#64748b', fontSize: 12 }}
      >
        <span>{isReady ? '查看实时 MQTT 状态与控制' : `缺少配置：${missingConfig.join('、')}`}</span>
        <ChevronRight size={16} color="#94a3b8" />
      </div>
    </Link>
  );
}

export function Devices() {
  const { devices, fields } = useApp();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const getFieldName = (device: Device) => {
    if (device.fieldId) return fields.find((field) => field.id === device.fieldId)?.name ?? '—';
    if (device.bindings && device.bindings.length > 0) {
      return fields.find((field) => field.id === device.bindings[0].fieldId)?.name ?? '—';
    }
    return '未绑定';
  };

  const getZoneName = (device: Device) => {
    if (device.zoneId) {
      for (const field of fields) {
        const zone = field.zones.find((item) => item.id === device.zoneId);
        if (zone) return zone.name;
      }
    }
    if (device.bindings && device.bindings.length > 0) {
      for (const field of fields) {
        const zone = field.zones.find((item) => item.id === device.bindings![0].zoneId);
        if (zone) return zone.name;
      }
    }
    return '';
  };

  const filtered = useMemo(
    () =>
      devices.filter((device) => {
        const matchSearch =
          !search ||
          device.name.includes(search) ||
          device.model.includes(search) ||
          (device.stationNo ?? '').includes(search);
        const matchStatus = filterStatus === 'all' || device.status === filterStatus;
        const matchType = filterType === 'all' || device.type === filterType;
        return matchSearch && matchStatus && matchType;
      }),
    [devices, filterStatus, filterType, search],
  );

  const statusCounts = {
    online: devices.filter((device) => device.status === 'online').length,
    alarm: devices.filter((device) => device.status === 'alarm').length,
    offline: devices.filter((device) => device.status === 'offline').length,
  };

  const lowBatteryCount = devices.filter((device) => (device.batteryLevel ?? 100) < 30).length;
  const weakSignalCount = devices.filter(
    (device) => typeof device.signalStrength === 'number' && device.signalStrength > 0 && device.signalStrength < 55,
  ).length;
  const wifiDemoMissingConfig = getWifiDemoMissingConfig();
  const showWifiDemoCard =
    (filterStatus === 'all' || (wifiDemoMissingConfig.length === 0 ? 'online' : 'offline') === filterStatus) &&
    (filterType === 'all' || filterType === 'controller') &&
    (!search ||
      wifiDemoDevice.deviceName.includes(search) ||
      wifiDemoDevice.model.includes(search) ||
      wifiDemoDevice.deviceId.includes(search) ||
      wifiDemoDevice.fieldName.includes(search));
  const visibleDeviceCount = filtered.length + (showWifiDemoCard ? 1 : 0);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#f0f4f8' }}>
      <div className="px-6 py-5" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 style={{ color: '#0f172a', fontSize: 20, fontWeight: 700 }}>设备中心</h1>
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
              查看现场设备状态、链路质量和接入设备详情
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <StatCard title="在线设备" value={`${statusCounts.online}`} sub={`总设备 ${devices.length} 台`} color="#16a34a" />
          <StatCard title="异常设备" value={`${statusCounts.alarm + statusCounts.offline}`} sub="告警与离线合计" color="#ef4444" />
          <StatCard title="低电量设备" value={`${lowBatteryCount}`} sub="建议安排上门巡检" color="#f59e0b" />
          <StatCard title="弱信号点位" value={`${weakSignalCount}`} sub="可能影响指令下发" color="#8b5cf6" />
        </div>

        <div className="flex items-center gap-4">
          {[
            { key: 'online', label: '在线', count: statusCounts.online, color: '#22c55e', bg: '#f0fdf4' },
            { key: 'alarm', label: '告警', count: statusCounts.alarm, color: '#ef4444', bg: '#fef2f2' },
            { key: 'offline', label: '离线', count: statusCounts.offline, color: '#94a3b8', bg: '#f8fafc' },
          ].map(({ key, label, count, color, bg }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
              style={{
                background: filterStatus === key ? bg : '#f8fafc',
                border: `1px solid ${filterStatus === key ? color : '#e2e8f0'}`,
              }}
            >
              <div className="rounded-full" style={{ width: 8, height: 8, background: color }} />
              <span style={{ color: filterStatus === key ? color : '#64748b', fontSize: 13, fontWeight: 500 }}>
                {label} {count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color="#94a3b8" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索设备名称、型号、站点号..."
              className="w-full pl-9 pr-4 py-2 rounded-xl outline-none"
              style={{ border: '1px solid #e2e8f0', fontSize: 14, background: '#f8fafc', color: '#0f172a' }}
            />
          </div>
          <div className="flex items-center gap-2 p-1 rounded-xl" style={{ background: '#f1f5f9' }}>
            <button
              onClick={() => setFilterType('all')}
              className="px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: filterType === 'all' ? '#ffffff' : 'transparent',
                color: filterType === 'all' ? '#0f172a' : '#64748b',
                fontSize: 13,
                boxShadow: filterType === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              全部
            </button>
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? 'all' : type)}
                className="px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: filterType === type ? '#ffffff' : 'transparent',
                  color: filterType === type ? TYPE_COLORS[type] : '#64748b',
                  fontSize: 13,
                  boxShadow: filterType === type ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>共 {visibleDeviceCount} 台</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {visibleDeviceCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: '#94a3b8' }}>
            <Cpu size={48} className="mb-4 opacity-30" />
            <p style={{ fontSize: 16 }}>未找到匹配设备</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {showWifiDemoCard && <WifiDemoDeviceCard />}
            {filtered.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                fieldName={getFieldName(device)}
                zoneName={getZoneName(device)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
