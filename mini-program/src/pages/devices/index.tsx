import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { useEffect, useMemo, useState } from 'react';
import type { MiniDeviceListItem } from '@irrigation/api';
import { AppIcon } from '@/components/AppIcon';
import { AiAssistantFab } from '@/components/AiAssistantFab';
import { loadDevices } from '@/services/dataService';

type DeviceFilter = 'all' | 'online' | 'offline' | 'alarm';

function statusLabel(status: MiniDeviceListItem['status']) {
  if (status === 'online') return '在线';
  if (status === 'offline') return '离线';
  return '告警';
}

function statusTone(status: MiniDeviceListItem['status']) {
  if (status === 'online') return 'success';
  if (status === 'offline') return 'danger';
  return 'warning';
}

function signalLabel(signalStrength?: number) {
  if (signalStrength == null || signalStrength <= 0) return '-';
  if (signalStrength >= 75) return '良好';
  if (signalStrength >= 45) return '一般';
  return '弱';
}

function fieldLabel(item: MiniDeviceListItem) {
  return item.fieldName || (item.fieldId ? item.fieldId : '未绑定');
}

export default function DevicesPage() {
  const [items, setItems] = useState<MiniDeviceListItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<DeviceFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;

  async function refreshDevices() {
    setRefreshing(true);
    try {
      const data = await loadDevices();
      setItems(data as MiniDeviceListItem[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshDevices();
  }, []);

  useDidShow(() => {
    void refreshDevices();
  });

  const counts = useMemo(() => {
    const online = items.filter((item) => item.status === 'online').length;
    const offline = items.filter((item) => item.status === 'offline').length;
    const alarm = items.filter((item) => item.status === 'alarm').length;

    return {
      all: items.length,
      online,
      offline,
      alarm,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => item.status === activeFilter);
  }, [activeFilter, items]);

  return (
    <View className="devices-page">
      <View className="devices-toolbar" style={{ paddingTop: `${statusBarHeight + 16}px` }}>
        <Text className="devices-page-title">设备管理</Text>

        <View className="devices-search">
          <AppIcon name="search" size={16} className="icon-muted" />
          <Text className="devices-search-placeholder">搜索设备名称或型号</Text>
        </View>

        <View className="devices-filter-row">
          <View
            className={`devices-filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <Text>全部 ({counts.all})</Text>
          </View>
          <View
            className={`devices-filter-chip ${activeFilter === 'online' ? 'active' : ''}`}
            onClick={() => setActiveFilter('online')}
          >
            <Text>在线 ({counts.online})</Text>
          </View>
          <View
            className={`devices-filter-chip ${activeFilter === 'offline' ? 'active' : ''}`}
            onClick={() => setActiveFilter('offline')}
          >
            <Text>离线 ({counts.offline})</Text>
          </View>
          <View
            className={`devices-filter-chip ${activeFilter === 'alarm' ? 'active' : ''}`}
            onClick={() => setActiveFilter('alarm')}
          >
            <Text>告警 ({counts.alarm})</Text>
          </View>
        </View>
      </View>

      <View className="devices-header-content">
        <View className="devices-stats">
          <View className="devices-stat-card success">
            <AppIcon name="wifi" size={20} className="icon-soft-green" />
            <Text className="devices-stat-value">{counts.online}</Text>
            <Text className="devices-stat-label">在线设备</Text>
          </View>
          <View className="devices-stat-card danger">
            <AppIcon name="wifiOff" size={20} className="icon-soft-red" />
            <Text className="devices-stat-value">{counts.offline}</Text>
            <Text className="devices-stat-label">离线设备</Text>
          </View>
          <View className="devices-stat-card warning">
            <AppIcon name="alertTriangle" size={20} className="icon-soft-orange" />
            <Text className="devices-stat-value">{counts.alarm}</Text>
            <Text className="devices-stat-label">告警设备</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="devices-scroll"
        scrollY
        refresherEnabled
        refresherDefaultStyle="none"
        refresherTriggered={refreshing}
        onRefresherRefresh={() => {
          void refreshDevices();
        }}
      >
        <View className="devices-content">
          {refreshing ? (
            <View className="list-refresh-indicator">
              <View className="list-refresh-spinner" />
            </View>
          ) : null}

          <View className="devices-list">
            {loading && filteredItems.length === 0
              ? Array.from({ length: 4 }, (_, index) => (
                  <View key={index} className="devices-card skeleton-surface">
                    <View className="devices-card-head">
                      <View className="devices-card-title-wrap">
                        <View className="page-skeleton page-skeleton-title" />
                        <View className="page-skeleton page-skeleton-subtitle" />
                      </View>
                      <View className="page-skeleton page-skeleton-badge" />
                    </View>
                    <View className="devices-metrics">
                      {Array.from({ length: 3 }, (__unused, metricIndex) => (
                        <View key={metricIndex} className="devices-metric">
                          <View className="page-skeleton page-skeleton-label" />
                          <View className="page-skeleton page-skeleton-value" />
                        </View>
                      ))}
                    </View>
                    <View className="devices-card-footer">
                      <View className="page-skeleton page-skeleton-inline" />
                      <View className="page-skeleton page-skeleton-icon-small" />
                    </View>
                  </View>
                ))
              : null}
            {filteredItems.map((item) => (
              <View
                key={item.id}
                className="devices-card"
                onClick={() => Taro.navigateTo({ url: `/pages/devices/detail/index?id=${item.id}` })}
              >
                <View className="devices-card-head">
                  <View className="devices-card-title-wrap">
                    <Text className="devices-card-title">{item.name}</Text>
                    <Text className="devices-card-subtitle">
                      {item.model} · {item.type === 'controller' ? '控制器' : '传感器'}
                    </Text>
                  </View>
                  <View className={`devices-status-badge ${statusTone(item.status)}`}>
                    <Text>{statusLabel(item.status)}</Text>
                  </View>
                </View>

                <View className="devices-metrics">
                  <View className="devices-metric">
                    <Text className="devices-metric-label">所属地块</Text>
                    <Text className="devices-metric-value">{fieldLabel(item)}</Text>
                  </View>
                  <View className="devices-metric">
                    <Text className="devices-metric-label">信号</Text>
                    <Text className="devices-metric-value">{signalLabel(item.signalStrength)}</Text>
                  </View>
                  <View className="devices-metric">
                    <Text className="devices-metric-label">电量</Text>
                    <Text className="devices-metric-value">
                      {item.batteryLevel != null ? `${item.batteryLevel}%` : '-'}
                    </Text>
                  </View>
                </View>

                <View className="devices-card-footer">
                  <View className="devices-footer-meta">
                    <AppIcon name="clock" size={14} className="icon-muted" />
                    <Text>最后在线: {item.lastSeen}</Text>
                  </View>
                  <AppIcon name="chevronRight" size={16} className="icon-muted" />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <AiAssistantFab />
    </View>
  );
}
