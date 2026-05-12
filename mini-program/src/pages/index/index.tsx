import Taro from '@tarojs/taro';
import { View, Text, Map } from '@tarojs/components';
import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { AiAssistantFab } from '@/components/AiAssistantFab';
import { loadOverviewViewModel } from '@/services/dataService';
import { buildOverviewMap } from '@/utils/map';

type OverviewViewModel = Awaited<ReturnType<typeof loadOverviewViewModel>>;
const OVERVIEW_MAP_ID = 'overview-map';

export default function IndexPage() {
  const [model, setModel] = useState<OverviewViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const systemInfo = Taro.getSystemInfoSync();
  const capsule = Taro.getMenuButtonBoundingClientRect?.();
  const statusBarHeight = systemInfo.statusBarHeight ?? 20;
  const heroPaddingTop = statusBarHeight + 24;
  const heroHeadHeight = capsule
    ? Math.max(52, capsule.bottom - statusBarHeight + capsule.top - statusBarHeight)
    : 52;

  useEffect(() => {
    setLoading(true);
    loadOverviewViewModel()
      .then(setModel)
      .finally(() => setLoading(false));
  }, []);
  const mapState = buildOverviewMap(model?.fields ?? []);
  const mapKey = (model?.fields ?? [])
    .map((field) => `${field.id}:${field.geoBoundary?.length ?? 0}:${field.geoCenter?.join(',') ?? 'none'}`)
    .join('|');

  useEffect(() => {
    if (!model?.fields.length) return;

    const points = [
      ...mapState.markers.map((marker) => ({
        latitude: marker.latitude,
        longitude: marker.longitude,
      })),
      ...mapState.polygons.flatMap((polygon) => polygon.points),
    ];

    if (points.length === 0) return;

    setTimeout(() => {
      Taro.createMapContext(OVERVIEW_MAP_ID).includePoints({
        points,
        padding: [10, 8, 10, 8],
      });
    }, 180);
  }, [model, mapState]);

  if (!model && loading) {
    return (
      <View className="overview-page">
        <View className="overview-hero" style={{ paddingTop: `${heroPaddingTop}px` }}>
          <View className="overview-hero-head" style={{ minHeight: `${heroHeadHeight}px` }}>
            <View>
              <View className="overview-system-title">智能灌溉系统</View>
              <View className="overview-system-date">正在加载数据...</View>
            </View>
          </View>

          <View className="overview-stats-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <View key={index} className="overview-stat-card skeleton-card">
                <View className="overview-skeleton overview-skeleton-icon" />
                <View className="overview-skeleton overview-skeleton-stat-value" />
                <View className="overview-skeleton overview-skeleton-stat-label" />
              </View>
            ))}
          </View>
        </View>

        <View className="overview-content">
          <View className="overview-card">
            <View className="overview-card-header top">
              <View className="overview-suggestion-head">
                <View className="overview-suggestion-icon skeleton-box" />
                <View className="overview-skeleton-stack">
                  <View className="overview-skeleton overview-skeleton-title" />
                  <View className="overview-skeleton overview-skeleton-subtle" />
                </View>
              </View>
              <View className="overview-skeleton overview-skeleton-badge" />
            </View>
            <View className="overview-skeleton overview-skeleton-body" />
            <View className="overview-inline-meta">
              <View className="overview-skeleton overview-skeleton-inline" />
              <View className="overview-skeleton overview-skeleton-inline" />
            </View>
          </View>

          <View className="overview-card">
            <View className="overview-card-header">
              <View className="overview-skeleton overview-skeleton-title" />
              <View className="overview-skeleton overview-skeleton-link" />
            </View>
            <View className="overview-map-board live skeleton-map-board" />
          </View>

          <View className="overview-card">
            <View className="overview-card-header">
              <View className="overview-skeleton overview-skeleton-title" />
            </View>
            <View className="overview-stack">
              {Array.from({ length: 2 }, (_, index) => (
                <View key={index} className="overview-risk-item skeleton-risk-item">
                  <View className="overview-skeleton overview-skeleton-risk-title" />
                  <View className="overview-skeleton overview-skeleton-risk-text" />
                  <View className="overview-skeleton overview-skeleton-risk-meta" />
                </View>
              ))}
            </View>
          </View>

          <View className="overview-card">
            <View className="overview-card-header">
              <View className="overview-skeleton overview-skeleton-title" />
              <View className="overview-skeleton overview-skeleton-subtle-short" />
            </View>
            <View className="overview-stack compact">
              {Array.from({ length: 3 }, (_, index) => (
                <View key={index} className="overview-plan-item skeleton-plan-item">
                  <View className="overview-skeleton overview-skeleton-plan-icon" />
                  <View className="overview-skeleton-stack grow">
                    <View className="overview-skeleton overview-skeleton-plan-name" />
                    <View className="overview-skeleton overview-skeleton-plan-sub" />
                  </View>
                  <View className="overview-skeleton overview-skeleton-plan-time" />
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (!model) {
    return <View className="overview-page" />;
  }

  const { snapshot, duePlans, decision, weatherOverview, fieldRisks, supplyOverview } = model;

  const riskLabel = decision.level === 'high' ? '高' : decision.level === 'medium' ? '中' : '低';
  const suggestionLabel = weatherOverview.recommendation === '需按计划补水' ? '建议灌溉' : weatherOverview.recommendation;
  const planCards = duePlans.slice(0, 3);
  const riskCards = fieldRisks.slice(0, 2);
  return (
    <View className="overview-page">
      <View className="overview-hero" style={{ paddingTop: `${heroPaddingTop}px` }}>
        <View className="overview-hero-head" style={{ minHeight: `${heroHeadHeight}px` }}>
          <View>
            <View className="overview-system-title">智能灌溉系统</View>
            <View className="overview-system-date">2026年5月7日 星期四</View>
          </View>
        </View>

        <View className="overview-stats-grid">
          <View className="overview-stat-card">
            <AppIcon name="mapPin" size={20} className="icon-soft-blue" />
            <View className="overview-stat-value">{snapshot.totalFields}</View>
            <View className="overview-stat-label">地块总数</View>
          </View>
          <View className="overview-stat-card">
            <AppIcon name="wifi" size={20} className="icon-soft-green" />
            <View className="overview-stat-value">{snapshot.onlineDevices}</View>
            <View className="overview-stat-label">在线设备</View>
          </View>
          <View className="overview-stat-card">
            <AppIcon name="clock" size={20} className="icon-soft-orange" />
            <View className="overview-stat-value">{duePlans.length}</View>
            <View className="overview-stat-label">待执行</View>
          </View>
          <View className="overview-stat-card">
            <AppIcon name="alertTriangle" size={20} className="icon-soft-red" />
            <View className="overview-stat-value">{supplyOverview.systemRiskCount}</View>
            <View className="overview-stat-label">告警</View>
          </View>
        </View>
      </View>

      <View className="overview-content">
        <View className="overview-card overview-map-card">
          <View className="overview-card-header top">
            <View className="overview-suggestion-head">
              <View className="overview-suggestion-icon">
                <AppIcon name="checkCircle2" size={20} className="icon-green" />
              </View>
              <View>
                <View className="overview-card-title">今日灌溉建议</View>
                <View className="overview-card-subtle">风险等级：{riskLabel}</View>
              </View>
            </View>
            <View className="overview-suggestion-badge">{suggestionLabel}</View>
          </View>
          <View className="overview-body-copy">{decision.reason}</View>
          <View className="overview-inline-meta">
            <View className="overview-inline-item">
              <AppIcon name="cloudRain" size={16} className="icon-muted" />
              <Text>降雨 0mm</Text>
            </View>
            <View className="overview-inline-item">
              <AppIcon name="trendingUp" size={16} className="icon-muted" />
              <Text>ET {snapshot.averageEt0.toFixed(1)}mm</Text>
            </View>
          </View>
        </View>

        <View className="overview-card">
          <View className="overview-card-header">
            <View className="overview-card-title">地块分布</View>
            <View className="overview-link">
              <Text>查看地图</Text>
              <AppIcon name="chevronRight" size={14} className="icon-blue" />
            </View>
          </View>
          <View className="overview-map-board live">
            <Map
              key={mapKey}
              id={OVERVIEW_MAP_ID}
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
              onMarkerTap={(event) => {
                const field = model.fields[Number(event.detail.markerId) - 1];
                if (field) {
                  Taro.navigateTo({ url: `/pages/fields/detail/index?id=${field.id}` });
                }
              }}
            />
            <View className="overview-map-float-badge">{snapshot.totalFields}个地块</View>
          </View>
        </View>

        <View className="overview-card">
          <View className="overview-card-header">
            <View className="overview-title-with-icon">
              <AppIcon name="alertCircle" size={18} className="icon-orange" />
              <View className="overview-card-title">高风险地块</View>
            </View>
          </View>
          <View className="overview-stack">
            {riskCards.map((risk) => (
              <View key={risk.id} className="overview-risk-item">
                <View className="overview-risk-top">
                  <View className="overview-risk-name">{risk.name}</View>
                  <View className="overview-risk-top-right">
                    <View className={`overview-risk-badge ${risk.riskLevel === '高' ? 'high' : 'medium'}`}>
                      {risk.riskLevel}风险
                    </View>
                    <AppIcon name="chevronRight" size={14} className="icon-muted" />
                  </View>
                </View>
                <View className="overview-risk-reason">{risk.riskReason}</View>
                <View className="overview-risk-meta">
                  <View className="overview-risk-meta-item">
                    <AppIcon name="droplets" size={14} className="icon-blue" />
                    <Text>墒情 {risk.soilMoisture}%</Text>
                  </View>
                  <View className="overview-risk-meta-item">
                    <AppIcon name="clock" size={14} className="icon-orange" />
                    <Text>建议 {Math.max(1, Math.round(risk.suggestedDurationMinutes / 60 * 10) / 10)}小时</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="overview-card">
          <View className="overview-card-header">
            <View className="overview-card-title">即将执行计划</View>
            <View className="overview-card-subtle">{planCards.length}个待执行</View>
          </View>
          <View className="overview-stack compact">
            {planCards.map((plan) => (
              <View key={plan.id} className="overview-plan-item">
                <View className="overview-plan-icon">
                  <AppIcon name="clock" size={16} className="icon-blue" />
                </View>
                <View className="overview-plan-main">
                  <View className="overview-plan-name">{plan.name}</View>
                  <View className="overview-plan-sub">{plan.fieldName} · {Math.max(1, Math.round(plan.totalDuration / 60 * 10) / 10)}小时</View>
                </View>
                <View className="overview-plan-time">{plan.startTime.includes(':') ? `今天 ${plan.startTime}` : plan.nextRunLabel}</View>
              </View>
            ))}
          </View>
        </View>
      </View>
      <AiAssistantFab />
    </View>
  );
}
