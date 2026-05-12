import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { useEffect, useState } from 'react';
import type { MiniFieldListItem } from '@irrigation/api';
import { AppIcon } from '@/components/AppIcon';
import { AiAssistantFab } from '@/components/AiAssistantFab';
import { loadFields } from '@/services/dataService';

function fieldStatusLabel(status: MiniFieldListItem['status']) {
  if (status === 'alarm') return '告警';
  if (status === 'warning') return '需关注';
  return '正常';
}

function fieldStatusClass(status: MiniFieldListItem['status']) {
  if (status === 'alarm') return 'danger';
  if (status === 'warning') return 'warning';
  return 'success';
}

function formatArea(area: number) {
  return Number.isInteger(area) ? `${area}` : area.toFixed(1);
}

export default function FieldsPage() {
  const [items, setItems] = useState<MiniFieldListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;

  async function refreshFields() {
    setRefreshing(true);
    try {
      const data = await loadFields();
      setItems(data as MiniFieldListItem[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshFields();
  }, []);

  useDidShow(() => {
    void refreshFields();
  });

  return (
    <View className="fields-page">
      <View className="fields-toolbar" style={{ paddingTop: `${statusBarHeight + 16}px` }}>
        <View className="fields-page-title">地块管理</View>

        <View className="fields-search">
          <AppIcon name="search" size={16} className="icon-muted" />
          <Text className="fields-search-placeholder">搜索地块名称或编号</Text>
        </View>

        <View className="fields-filter-row">
          <View className="fields-filter-chip active">全部</View>
          <View className="fields-filter-chip">
            <AppIcon name="filter" size={14} className="icon-muted" />
            <Text>状态</Text>
          </View>
          <View className="fields-filter-chip">
            <AppIcon name="filter" size={14} className="icon-muted" />
            <Text>作物</Text>
          </View>
          <View className="fields-filter-chip">
            <AppIcon name="filter" size={14} className="icon-muted" />
            <Text>区域</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="fields-scroll"
        scrollY
        refresherEnabled
        refresherDefaultStyle="none"
        refresherTriggered={refreshing}
        onRefresherRefresh={() => {
          void refreshFields();
        }}
      >
        <View className="fields-list">
          {refreshing ? (
            <View className="list-refresh-indicator">
              <View className="list-refresh-spinner" />
            </View>
          ) : null}
          {loading && items.length === 0
            ? Array.from({ length: 4 }, (_, index) => (
                <View key={index} className="fields-card skeleton-surface">
                  <View className="fields-card-head">
                    <View className="fields-card-title-wrap">
                      <View className="page-skeleton page-skeleton-title" />
                      <View className="page-skeleton page-skeleton-subtitle" />
                    </View>
                    <View className="page-skeleton page-skeleton-badge" />
                  </View>
                  <View className="fields-metrics">
                    {Array.from({ length: 4 }, (__unused, metricIndex) => (
                      <View key={metricIndex} className="fields-metric">
                        <View className="page-skeleton page-skeleton-label" />
                        <View className="page-skeleton page-skeleton-value" />
                      </View>
                    ))}
                  </View>
                  <View className="fields-card-footer">
                    <View className="page-skeleton page-skeleton-inline" />
                    <View className="page-skeleton page-skeleton-icon-small" />
                  </View>
                </View>
              ))
            : null}
          {items.map((item) => (
            <View
              key={item.id}
              className="fields-card"
              onClick={() => Taro.navigateTo({ url: `/pages/fields/detail/index?id=${item.id}` })}
            >
              <View className="fields-card-head">
                <View className="fields-card-title-wrap">
                  <View className="fields-card-title">{item.name}</View>
                  <View className="fields-card-code">{item.code} · {item.crop}</View>
                </View>
                <View className={`fields-status-badge ${fieldStatusClass(item.status)}`}>
                  {fieldStatusLabel(item.status)}
                </View>
              </View>

              <View className="fields-metrics">
                <View className="fields-metric">
                  <View className="fields-metric-label">面积</View>
                  <View className="fields-metric-value">{formatArea(item.area)}亩</View>
                </View>
                <View className="fields-metric">
                  <View className="fields-metric-label">生育期</View>
                  <View className="fields-metric-value">{item.growthStage}</View>
                </View>
                <View className="fields-metric">
                  <View className="fields-metric-label">墒情</View>
                  <View className="fields-metric-value">{item.soilMoisture}%</View>
                </View>
                <View className="fields-metric">
                  <View className="fields-metric-label">分区</View>
                  <View className="fields-metric-value">{item.zoneCount}个</View>
                </View>
              </View>

              <View className="fields-card-footer">
                <View className="fields-footer-meta">
                  <AppIcon name="droplets" size={14} className="icon-muted" />
                  <Text>墒情 {item.soilMoisture}%</Text>
                </View>
                <AppIcon name="chevronRight" size={16} className="icon-muted" />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <AiAssistantFab />
    </View>
  );
}
