import Taro, { useLoad } from '@tarojs/taro';
import { View, Text, Input } from '@tarojs/components';
import { useMemo, useState } from 'react';
import type { Device } from '@irrigation/domain';
import { AppIcon } from '@/components/AppIcon';
import type { AppIconName } from '@/components/AppIcon';
import { controlDevice, loadDeviceDetail } from '@/services/dataService';

function statusLabel(status: Device['status']) {
  if (status === 'online') return '在线';
  if (status === 'offline') return '离线';
  return '告警';
}

function signalLabel(signalStrength?: number) {
  if (signalStrength == null || signalStrength <= 0) return '-';
  if (signalStrength >= 75) return '良好';
  if (signalStrength >= 45) return '一般';
  return '弱';
}

function statusClass(status: Device['status']) {
  if (status === 'online') return 'success';
  if (status === 'offline') return 'danger';
  return 'warning';
}

export default function DeviceDetailPage() {
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;
  const [device, setDevice] = useState<Device | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [source, setSource] = useState<'real' | 'demo'>('real');
  const [controlEnabled, setControlEnabled] = useState(false);
  const [durationByStation, setDurationByStation] = useState<Record<string, string>>({});
  const [submittingKey, setSubmittingKey] = useState('');
  const [loading, setLoading] = useState(true);

  useLoad(async () => {
    try {
      const id = Taro.getCurrentInstance().router?.params?.id ?? '';
      const detail = await loadDeviceDetail(id);
      setDevice(detail?.device ?? null);
      setFieldName(detail?.fieldName ?? '');
      setSource(detail?.source ?? 'real');
      setControlEnabled(Boolean(detail?.control?.canOpen || detail?.control?.canClose));
    } finally {
      setLoading(false);
    }
  });

  const summaryCards = useMemo(() => {
    if (!device) return [];

    return [
      {
        key: 'status',
        label: '在线状态',
        value: statusLabel(device.status),
        icon: (device.status === 'online' ? 'wifi' : device.status === 'offline' ? 'wifiOff' : 'alertTriangle') as AppIconName,
        tone: device.status === 'online' ? 'green' : device.status === 'offline' ? 'red' : 'orange',
      },
      {
        key: 'signal',
        label: '信号强度',
        value: `${device.signalStrength ?? 0}%`,
        icon: 'signal' as const,
        tone: 'blue',
      },
      {
        key: 'battery',
        label: '电量',
        value: device.batteryLevel != null ? `${device.batteryLevel}%` : '-',
        icon: 'battery' as const,
        tone: 'orange',
      },
      {
        key: 'lastSeen',
        label: '最后在线',
        value: device.lastSeen,
        icon: 'clock' as const,
        tone: 'purple',
      },
    ];
  }, [device]);

  if (!device && loading) {
    return (
      <View className="device-detail-page">
        <View className="secondary-topbar" style={{ paddingTop: `${statusBarHeight + 15}px` }}>
          <View className="secondary-back">
            <View className="secondary-back-icon"><Text className="secondary-back-arrow">←</Text></View>
            <Text className="secondary-back-text">返回列表</Text>
          </View>
          <View className="page-skeleton page-skeleton-secondary-title" />
          <View className="page-skeleton page-skeleton-secondary-subtitle" />
        </View>
        <View className="device-detail-body">
          {Array.from({ length: 4 }, (_, index) => (
            <View key={index} className="device-detail-card skeleton-surface detail-skeleton-card">
              <View className="page-skeleton page-skeleton-section-title" />
              <View className="page-skeleton page-skeleton-block-large" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!device) {
    return <View className="device-detail-page" />;
  }

  return (
    <View className="device-detail-page">
      <View className="secondary-topbar" style={{ paddingTop: `${statusBarHeight + 15}px` }}>
        <View className="secondary-back" onClick={() => Taro.navigateBack()}>
          <View className="secondary-back-icon">
            <Text className="secondary-back-arrow">←</Text>
          </View>
          <Text className="secondary-back-text">返回列表</Text>
        </View>
        <View className="secondary-title">{device.name}</View>
        <View className="secondary-subtitle">
          {device.model} · {device.type === 'controller' ? '控制器' : '传感器'}
        </View>
      </View>

      <View className="device-detail-body">
        <View className="device-detail-card">
          <View className="device-detail-card-title">运行状态</View>
          <View className="device-detail-summary-grid">
            {summaryCards.map((item) => (
              <View key={item.key} className={`device-detail-summary-tile ${item.tone}`}>
                <View className="device-detail-summary-head">
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
                            : item.tone === 'red'
                              ? 'icon-red'
                              : 'icon-purple'
                    }
                  />
                  <Text className="device-detail-summary-label">{item.label}</Text>
                </View>
                <Text className="device-detail-summary-value">{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="device-detail-card">
          <View className="device-detail-card-title">基础信息</View>
          <View className="device-detail-info-list">
            <View className="device-detail-info-row">
              <Text className="device-detail-info-label">设备名称</Text>
              <Text className="device-detail-info-value">{device.name}</Text>
            </View>
            <View className="device-detail-info-row">
              <Text className="device-detail-info-label">设备型号</Text>
              <Text className="device-detail-info-value">{device.model}</Text>
            </View>
            <View className="device-detail-info-row">
              <Text className="device-detail-info-label">设备类型</Text>
              <Text className="device-detail-info-value">{device.type === 'controller' ? '控制器' : '传感器'}</Text>
            </View>
            <View className="device-detail-info-row">
              <Text className="device-detail-info-label">所属地块</Text>
              <Text className="device-detail-info-value">{fieldName || '未绑定'}</Text>
            </View>
            <View className="device-detail-info-row">
              <Text className="device-detail-info-label">设备来源</Text>
              <Text className="device-detail-info-value">{source === 'demo' ? '固定演示设备' : '正式设备'}</Text>
            </View>
          </View>
        </View>

        {source === 'demo' && controlEnabled && device.type === 'controller' ? (
          <View className="device-detail-card">
            <View className="device-detail-card-title">开关操作</View>
            <View className="device-detail-list">
              {(device.stations ?? []).map((station, index) => {
                const key = station.id || String(index);
                const duration = durationByStation[key] ?? '60';
                return (
                  <View key={key} className="device-detail-control-card">
                    <View className="device-detail-list-main">
                      <Text className="device-detail-list-title">{station.name}</Text>
                      <Text className="device-detail-list-meta">站点 {station.id || index + 1} · 按秒控制</Text>
                    </View>
                    <View className="device-detail-control-row">
                      <Input
                        className="device-detail-duration-input"
                        type="number"
                        value={duration}
                        onInput={(event) => {
                          setDurationByStation((current) => ({ ...current, [key]: event.detail.value }));
                        }}
                      />
                      <View
                        className={`device-detail-control-button open ${submittingKey === `${key}:open` ? 'disabled' : ''}`}
                        onClick={async () => {
                          try {
                            setSubmittingKey(`${key}:open`);
                            const result = await controlDevice(device.id, {
                              action: 'open',
                              stationIndex: index,
                              durationSeconds: Math.max(1, Number(duration || 0)),
                            });
                            Taro.showToast({ title: result.message, icon: 'none' });
                          } catch (error) {
                            Taro.showToast({ title: error instanceof Error ? error.message : '开阀失败', icon: 'none' });
                          } finally {
                            setSubmittingKey('');
                          }
                        }}
                      >
                        开启
                      </View>
                      <View
                        className={`device-detail-control-button close ${submittingKey === `${key}:close` ? 'disabled' : ''}`}
                        onClick={async () => {
                          try {
                            setSubmittingKey(`${key}:close`);
                            const result = await controlDevice(device.id, {
                              action: 'close',
                              stationIndex: index,
                              durationSeconds: Math.max(1, Number(duration || 0)),
                            });
                            Taro.showToast({ title: result.message, icon: 'none' });
                          } catch (error) {
                            Taro.showToast({ title: error instanceof Error ? error.message : '关阀失败', icon: 'none' });
                          } finally {
                            setSubmittingKey('');
                          }
                        }}
                      >
                        关闭
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {device.type === 'controller' ? (
          <View className="device-detail-card">
            <View className="device-detail-card-title">通道状态</View>
            <View className="device-detail-list">
              {Array.from({ length: device.channelCount ?? 4 }, (_, index) => (
                <View key={index} className="device-detail-list-row">
                  <View className="device-detail-list-main">
                    <Text className="device-detail-list-title">通道 {index + 1}</Text>
                    <Text className="device-detail-list-meta">
                      {device.stations?.[index]?.name ?? `${index + 1}路站点`}
                    </Text>
                  </View>
                  <View className="device-detail-badge success">正常</View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="device-detail-card">
          <View className="device-detail-card-title">最近上报数据</View>
          <View className="device-detail-info-list">
            <View className="device-detail-info-row">
              <Text className="device-detail-info-label">信号状态</Text>
              <Text className="device-detail-info-value">{signalLabel(device.signalStrength)}</Text>
            </View>
            <View className="device-detail-info-row">
              <Text className="device-detail-info-label">电量</Text>
              <Text className="device-detail-info-value">{device.batteryLevel != null ? `${device.batteryLevel}%` : '-'}</Text>
            </View>
            <View className="device-detail-info-row">
              <Text className="device-detail-info-label">上报时间</Text>
              <Text className="device-detail-info-value">{device.lastSeen}</Text>
            </View>
            <View className="device-detail-info-row">
              <Text className="device-detail-info-label">设备状态</Text>
              <Text className={`device-detail-info-value ${statusClass(device.status)}`}>{statusLabel(device.status)}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
