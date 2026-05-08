import Taro, { useLoad } from '@tarojs/taro';
import { View, Text, Map } from '@tarojs/components';
import { useEffect, useMemo, useState } from 'react';
import type { Device, Field } from '@irrigation/domain';
import { AppIcon } from '@/components/AppIcon';
import { loadFieldDetail } from '@/services/dataService';
import { buildFieldDetailMap } from '@/utils/map';
const FIELD_DETAIL_MAP_ID = 'field-detail-map';

function formatArea(area: number) {
  return Number.isInteger(area) ? `${area}` : area.toFixed(1);
}

function getZoneStatusLabel(status: Field['zones'][number]['status']) {
  if (status === 'alarm') return '告警';
  if (status === 'pending') return '待执行';
  return '正常';
}

function getZoneStatusClass(status: Field['zones'][number]['status']) {
  if (status === 'alarm') return 'danger';
  if (status === 'pending') return 'warning';
  return 'success';
}

function getDeviceSummary(device: Device) {
  if (device.status === 'offline') return '离线 | 等待恢复';
  if (device.type === 'controller') {
    return `在线 | 信号 ${device.signalStrength ?? 0}%`;
  }
  return `在线 | 电量 ${device.batteryLevel ?? 0}%`;
}

export default function FieldDetailPage() {
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;
  const [field, setField] = useState<Field | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useLoad(async () => {
    try {
      const id = Taro.getCurrentInstance().router?.params?.id ?? '';
      const detail = await loadFieldDetail(id);
      setField(detail?.field ?? null);
      setDevices((detail?.devices as Device[]) ?? []);
    } finally {
      setLoading(false);
    }
  });

  const metricCards = useMemo(() => {
    if (!field) return [];

    return [
      {
        key: 'soil',
        label: '土壤墒情',
        value: `${field.soilMoisture}%`,
        icon: 'droplets' as const,
        tone: 'blue',
      },
      {
        key: 'et',
        label: 'ET值',
        value: `${field.et0.toFixed(1)}mm`,
        icon: 'trendingUp' as const,
        tone: 'green',
      },
      {
        key: 'duration',
        label: '建议时长',
        value: `${(field.recommendedDuration / 60).toFixed(1)}小时`,
        icon: 'clock' as const,
        tone: 'orange',
      },
      {
        key: 'last',
        label: '最近灌溉',
        value: field.lastIrrigation.slice(5, 10).replace('-', '月') + '日',
        icon: 'calendar' as const,
        tone: 'purple',
      },
    ];
  }, [field]);

  const mapState = field ? buildFieldDetailMap(field, devices) : null;
  const mapKey = field
    ? `${field.id}:${field.geoBoundary?.length ?? 0}:${field.zones.map((zone) => `${zone.id}:${zone.geoBoundary?.length ?? 0}`).join('|')}:${devices.length}`
    : 'empty';

  useEffect(() => {
    if (!mapState) return;

    const points = [
      { latitude: mapState.latitude, longitude: mapState.longitude },
      ...mapState.markers.map((marker) => ({
        latitude: marker.latitude,
        longitude: marker.longitude,
      })),
      ...mapState.polygons.flatMap((polygon) => polygon.points),
    ];

    setTimeout(() => {
      Taro.createMapContext(FIELD_DETAIL_MAP_ID).includePoints({
        points,
        padding: [10, 8, 10, 8],
      });
    }, 180);
  }, [mapState]);

  if (!field && loading) {
    return (
      <View className="field-detail-page">
        <View className="secondary-topbar" style={{ paddingTop: `${statusBarHeight + 15}px` }}>
          <View className="secondary-back">
            <View className="secondary-back-icon"><Text className="secondary-back-arrow">←</Text></View>
            <Text className="secondary-back-text">返回列表</Text>
          </View>
          <View className="page-skeleton page-skeleton-secondary-title" />
          <View className="page-skeleton page-skeleton-secondary-subtitle" />
        </View>
        <View className="field-detail-body">
          {Array.from({ length: 4 }, (_, index) => (
            <View key={index} className="field-detail-card skeleton-surface detail-skeleton-card">
              <View className="page-skeleton page-skeleton-section-title" />
              <View className="page-skeleton page-skeleton-block-large" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!field) {
    return <View className="field-detail-page" />;
  }

  return (
    <View className="field-detail-page">
      <View className="secondary-topbar" style={{ paddingTop: `${statusBarHeight + 15}px` }}>
        <View className="secondary-back" onClick={() => Taro.navigateBack()}>
          <View className="secondary-back-icon">
            <Text className="secondary-back-arrow">←</Text>
          </View>
          <Text className="secondary-back-text">返回列表</Text>
        </View>
        <View className="secondary-title">{field.name}</View>
        <View className="secondary-subtitle">编号: {field.code}</View>
      </View>

      <View className="field-detail-body">
        <View className="field-detail-card field-detail-card-info">
          <View className="field-detail-card-title">基础信息</View>
          <View className="field-detail-info-grid">
            <View className="field-detail-info-item">
              <Text className="field-detail-info-label">作物类型</Text>
              <Text className="field-detail-info-value">{field.crop}</Text>
            </View>
            <View className="field-detail-info-item">
              <Text className="field-detail-info-label">种植面积</Text>
              <Text className="field-detail-info-value">{formatArea(field.area)}亩</Text>
            </View>
            <View className="field-detail-info-item">
              <Text className="field-detail-info-label">生育期</Text>
              <Text className="field-detail-info-value">{field.growthStage}</Text>
            </View>
            <View className="field-detail-info-item">
              <Text className="field-detail-info-label">分区数量</Text>
              <Text className="field-detail-info-value">{field.zones.length}个</Text>
            </View>
          </View>
        </View>

        <View className="field-detail-card">
          <View className="field-detail-card-title">地块轮廓</View>
          <View className="field-detail-map">
            {mapState ? (
              <>
                <Map
                  key={mapKey}
                  id={FIELD_DETAIL_MAP_ID}
                  className="wx-map"
                  latitude={mapState.latitude}
                  longitude={mapState.longitude}
                  scale={mapState.scale}
                  markers={mapState.markers as never}
                  polygons={mapState.polygons as never}
                  enableScroll
                  enableZoom
                  enableRotate={false}
                  enable3D={false}
                  onError={() => {}}
                />
                <View className="field-detail-map-hint">地块与分区地图</View>
              </>
            ) : null}
          </View>
        </View>

        <View className="field-detail-card">
          <View className="field-detail-card-title">当前状态摘要</View>
          <View className="field-detail-status-grid">
            {metricCards.map((item) => (
              <View key={item.key} className={`field-detail-status-tile ${item.tone}`}>
                <View className="field-detail-status-head">
                  <AppIcon
                    name={item.icon}
                    size={16}
                    className={
                      item.tone === 'blue'
                        ? 'icon-blue'
                        : item.tone === 'green'
                          ? 'icon-green'
                          : item.tone === 'orange'
                            ? 'icon-orange'
                            : 'icon-purple'
                    }
                  />
                  <Text className="field-detail-status-label">{item.label}</Text>
                </View>
                <Text className="field-detail-status-value">{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="field-detail-card">
          <View className="field-detail-card-title">分区列表</View>
          <View className="field-detail-list">
            {field.zones.map((zone, index) => (
              <View key={zone.id} className="field-detail-list-row">
                <View className="field-detail-list-main">
                  <Text className="field-detail-list-title">分区 {index + 1}</Text>
                  <View className="field-detail-list-meta">
                    <Text>站号: {zone.stationNo}</Text>
                    <Text>湿度: {zone.soilMoisture}%</Text>
                  </View>
                </View>
                <View className={`field-detail-badge ${getZoneStatusClass(zone.status)}`}>
                  {getZoneStatusLabel(zone.status)}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="field-detail-card">
          <View className="field-detail-card-title">关联设备</View>
          <View className="field-detail-device-list">
            {devices.map((device) => (
              <View key={device.id} className="field-detail-device-row">
                <View className="field-detail-device-main">
                  <Text className="field-detail-device-title">{device.name}</Text>
                  <Text className="field-detail-device-meta">{getDeviceSummary(device)}</Text>
                </View>
                <AppIcon name="chevronRight" size={16} className="icon-muted" />
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
