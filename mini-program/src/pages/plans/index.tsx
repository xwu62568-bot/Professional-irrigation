import Taro, { useDidHide, useDidShow } from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DuePlan, Strategy } from '@irrigation/domain';
import { AppIcon } from '@/components/AppIcon';
import { AiAssistantFab } from '@/components/AiAssistantFab';
import { loadPlans, loadStrategies, runPlanAction } from '@/services/dataService';

function planModeLabel(mode: DuePlan['mode']) {
  if (mode === 'auto') return '自动';
  if (mode === 'confirm') return '定时';
  return '手动';
}

function planDurationLabel(totalDuration: number) {
  const hours = Math.round((totalDuration / 60) * 10) / 10;
  return Number.isInteger(hours) ? `${hours}小时` : `${hours}小时`;
}

function strategyModeLabel(mode: Strategy['mode']) {
  if (mode === 'auto') return '自动';
  if (mode === 'confirm') return '待确认';
  return '建议';
}

export default function PlansPage() {
  const [items, setItems] = useState<DuePlan[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [activeTab, setActiveTab] = useState<'plans' | 'strategies'>('plans');
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const liveRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlight = useRef(false);
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;

  async function refreshPlansAndStrategies(options: { silent?: boolean } = {}) {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!options.silent) setRefreshing(true);
    try {
      const [nextPlans, nextStrategies] = await Promise.all([loadPlans(), loadStrategies()]);
      setItems(nextPlans);
      setStrategies(nextStrategies);
    } catch (_error) {
      // Keep silent for periodic refresh; explicit actions already show toast.
    } finally {
      refreshInFlight.current = false;
      setLoading(false);
      if (!options.silent) setRefreshing(false);
    }
  }

  function clearLiveRefreshTimer() {
    if (liveRefreshTimer.current) {
      clearTimeout(liveRefreshTimer.current);
      liveRefreshTimer.current = null;
    }
  }

  function scheduleLiveRefresh(delayMs: number) {
    clearLiveRefreshTimer();
    liveRefreshTimer.current = setTimeout(async () => {
      await refreshPlansAndStrategies({ silent: true });
      const nextDelay = activeTab === 'plans' ? 8000 : 15000;
      scheduleLiveRefresh(nextDelay);
    }, delayMs);
  }

  useEffect(() => {
    void refreshPlansAndStrategies();
  }, []);

  useDidShow(() => {
    void refreshPlansAndStrategies();
    scheduleLiveRefresh(8000);
  });

  useDidHide(() => {
    clearLiveRefreshTimer();
  });

  useEffect(() => {
    if (!loading) {
      scheduleLiveRefresh(activeTab === 'plans' ? 8000 : 15000);
    }
    return () => {
      clearLiveRefreshTimer();
    };
  }, [activeTab, loading]);

  useEffect(() => {
    return () => {
      clearLiveRefreshTimer();
    };
  }, []);

  const totalHours = useMemo(
    () => Math.round(items.reduce((sum, item) => sum + item.totalDuration, 0) / 60),
    [items],
  );

  async function handlePlanAction(planId: string, action: 'start' | 'pause' | 'stop') {
    try {
      setRunningActionId(`${planId}:${action}`);
      const result = await runPlanAction(planId, action);
      Taro.showToast({ title: result.message || '操作已提交', icon: 'none' });
      await refreshPlansAndStrategies({ silent: true });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' });
    } finally {
      setRunningActionId(null);
    }
  }

  return (
    <View className="plans-page">
      <View className="plans-toolbar" style={{ paddingTop: `${statusBarHeight + 16}px` }}>
        <View className="plans-page-title">计划与策略</View>
        <View className="plans-tab-row">
          <View
            className={`plans-tab ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveTab('plans')}
          >
            执行计划
          </View>
          <View
            className={`plans-tab ${activeTab === 'strategies' ? 'active' : ''}`}
            onClick={() => setActiveTab('strategies')}
          >
            自动策略
          </View>
        </View>
      </View>

      {activeTab === 'plans' ? (
        <View className="plans-header-content">
          <View className="plans-stats">
            <View className="plans-stat-card">
              <View className="plans-stat-label">启用计划</View>
              <View className="plans-stat-value">{items.filter((item) => item.enabled).length}</View>
            </View>
            <View className="plans-stat-card">
              <View className="plans-stat-label">今日总时长</View>
              <View className="plans-stat-value">{totalHours}h</View>
            </View>
            <View className="plans-stat-card">
              <View className="plans-stat-label">待执行</View>
              <View className="plans-stat-value warning">{items.length}</View>
            </View>
          </View>
        </View>
      ) : (
        <View className="plans-header-content">
          <View className="plans-stats">
            <View className="plans-stat-card">
              <View className="plans-stat-label">启用策略</View>
              <View className="plans-stat-value">{strategies.filter((item) => item.enabled).length}</View>
            </View>
            <View className="plans-stat-card">
              <View className="plans-stat-label">自动执行</View>
              <View className="plans-stat-value">{strategies.filter((item) => item.mode === 'auto').length}</View>
            </View>
            <View className="plans-stat-card">
              <View className="plans-stat-label">待确认</View>
              <View className="plans-stat-value warning">
                {strategies.filter((item) => item.mode === 'confirm').length}
              </View>
            </View>
          </View>
        </View>
      )}

      {activeTab === 'plans' ? (
        <>
          <View className="plans-header-content">
            <View
              className="plans-inline-create"
              onClick={() => Taro.navigateTo({ url: '/pages/plans/plan-create/index' })}
            >
              <AppIcon name="calendar" size={16} className="icon-blue" />
              <Text>新建计划</Text>
            </View>
          </View>

          <ScrollView
            className="plans-scroll"
            scrollY
            refresherEnabled
            refresherDefaultStyle="none"
            refresherTriggered={refreshing}
            onRefresherRefresh={() => {
              void refreshPlansAndStrategies();
            }}
          >
            <View className="plans-content">
              {refreshing ? (
                <View className="list-refresh-indicator">
                  <View className="list-refresh-spinner" />
                </View>
              ) : null}

              <View className="plans-list">
                {loading && items.length === 0
                  ? Array.from({ length: 3 }, (_, index) => (
                      <View key={index} className="plans-card skeleton-surface">
                        <View className="plans-card-head">
                          <View className="plans-card-title-row">
                            <View className="page-skeleton page-skeleton-title" />
                            <View className="page-skeleton page-skeleton-badge" />
                          </View>
                          <View className="page-skeleton page-skeleton-inline" />
                        </View>
                        <View className="plans-card-metrics">
                          {Array.from({ length: 3 }, (__unused, metricIndex) => (
                            <View key={metricIndex} className="plans-card-metric">
                              <View className="page-skeleton page-skeleton-label" />
                              <View className="page-skeleton page-skeleton-value" />
                            </View>
                          ))}
                        </View>
                        <View className="plans-card-footer">
                          <View className="page-skeleton page-skeleton-inline" />
                          <View className="page-skeleton page-skeleton-inline-short" />
                        </View>
                      </View>
                    ))
                  : null}
                {items.map((item) => (
                  <View
                    key={item.id}
                    className="plans-card"
                    onClick={() => Taro.navigateTo({ url: `/pages/plans/plan-detail/index?id=${item.id}` })}
                  >
                    <View className="plans-card-head">
                      <View className="plans-card-title-row">
                        <View className="plans-card-title">{item.name}</View>
                        <View className={`plans-card-badge ${item.enabled ? 'success' : 'neutral'}`}>
                          {item.enabled ? '启用' : '停用'}
                        </View>
                      </View>
                      <View className="plans-card-field">
                        <AppIcon name="mapPin" size={14} className="icon-muted" />
                        <Text>{item.fieldName}</Text>
                      </View>
                    </View>

                    <View className="plans-card-metrics">
                      <View className="plans-card-metric">
                        <View className="plans-card-metric-label">分区数</View>
                        <View className="plans-card-metric-value">{item.zoneCount}个</View>
                      </View>
                      <View className="plans-card-metric">
                        <View className="plans-card-metric-label">执行模式</View>
                        <View className="plans-card-metric-value">{planModeLabel(item.mode)}</View>
                      </View>
                      <View className="plans-card-metric">
                        <View className="plans-card-metric-label">总时长</View>
                        <View className="plans-card-metric-value">{planDurationLabel(item.totalDuration)}</View>
                      </View>
                    </View>

                    <View className="plans-card-footer">
                      <View className="plans-card-time">
                        <AppIcon name="clock" size={16} className="icon-blue" />
                        <Text>{item.startTime ? `今天 ${item.startTime}` : item.nextRunLabel}</Text>
                      </View>
                      <View className="plans-card-actions">
                        <View
                          className={`plans-action-button ${runningActionId === `${item.id}:start` ? 'disabled' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handlePlanAction(item.id, 'start');
                          }}
                        >
                          <AppIcon name="play" size={16} className="icon-green" />
                        </View>
                        <View
                          className={`plans-action-button ${runningActionId === `${item.id}:pause` ? 'disabled' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handlePlanAction(item.id, 'pause');
                          }}
                        >
                          <AppIcon name="pause" size={16} className="icon-orange" />
                        </View>
                        <View
                          className={`plans-action-button ${runningActionId === `${item.id}:stop` ? 'disabled' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handlePlanAction(item.id, 'stop');
                          }}
                        >
                          <AppIcon name="square" size={16} className="icon-red" />
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </>
      ) : (
        <>
          <View className="plans-header-content">
            <View
              className="plans-inline-create"
              onClick={() => Taro.navigateTo({ url: '/pages/plans/strategy-create/index' })}
            >
              <AppIcon name="settings" size={16} className="icon-blue" />
              <Text>新建策略</Text>
            </View>
          </View>

          <ScrollView
            className="plans-scroll"
            scrollY
            refresherEnabled
            refresherDefaultStyle="none"
            refresherTriggered={refreshing}
            onRefresherRefresh={() => {
              void refreshPlansAndStrategies();
            }}
          >
            <View className="plans-content">
              {refreshing ? (
                <View className="list-refresh-indicator">
                  <View className="list-refresh-spinner" />
                </View>
              ) : null}

              <View className="plans-list">
                {loading && strategies.length === 0
                  ? Array.from({ length: 3 }, (_, index) => (
                      <View key={index} className="plans-card strategy skeleton-surface">
                        <View className="plans-card-title-row">
                          <View className="page-skeleton page-skeleton-title" />
                          <View className="page-skeleton page-skeleton-badge" />
                        </View>
                        <View className="plans-strategy-grid">
                          {Array.from({ length: 4 }, (__unused, metricIndex) => (
                            <View key={metricIndex} className="plans-card-metric">
                              <View className="page-skeleton page-skeleton-label" />
                              <View className="page-skeleton page-skeleton-value" />
                            </View>
                          ))}
                        </View>
                      </View>
                    ))
                  : null}
                {strategies.map((item) => (
                  <View
                    key={item.id}
                    className="plans-card strategy"
                    onClick={() => Taro.navigateTo({ url: `/pages/plans/strategy-detail/index?id=${item.id}` })}
                  >
                    <View className="plans-card-title-row">
                      <View className="plans-card-title">{item.name}</View>
                      <View className={`plans-card-badge ${item.enabled ? 'success' : 'neutral'}`}>
                        {item.enabled ? '启用' : '停用'}
                      </View>
                    </View>
                    <View className="plans-strategy-grid">
                      <View className="plans-card-metric">
                        <View className="plans-card-metric-label">执行模式</View>
                        <View className="plans-card-metric-value">{strategyModeLabel(item.mode)}</View>
                      </View>
                      <View className="plans-card-metric">
                        <View className="plans-card-metric-label">雨锁状态</View>
                        <View className="plans-card-metric-value">{item.rainLock ? '已启用' : '未启用'}</View>
                      </View>
                      <View className="plans-card-metric">
                        <View className="plans-card-metric-label">最小间隔</View>
                        <View className="plans-card-metric-value">{item.minInterval}小时</View>
                      </View>
                      <View className="plans-card-metric">
                        <View className="plans-card-metric-label">作用范围</View>
                        <View className="plans-card-metric-value">{item.scope === 'all' ? '全部地块' : '分区策略'}</View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </>
      )}
      <AiAssistantFab />
    </View>
  );
}
