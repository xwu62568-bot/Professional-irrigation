import Taro, { useDidHide, useDidShow, useLoad } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plan } from '@irrigation/domain';
import { AppIcon } from '@/components/AppIcon';
import { loadFieldDetail, loadPlanDetail, runPlanAction } from '@/services/dataService';

function planModeLabel(mode: Plan['mode']) {
  if (mode === 'auto') return '自动';
  if (mode === 'confirm') return '待确认';
  return '手动';
}

function rainPolicyLabel(policy: Plan['rainPolicy']) {
  if (policy === 'skip') return '遇雨跳过';
  if (policy === 'delay') return '延后执行';
  return '继续执行';
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function cycleLabel(plan: Plan) {
  if (plan.cycle === 'daily') return '每日';
  if (plan.cycle === 'weekly') {
    const days = Array.isArray(plan.cycleValue) ? plan.cycleValue.map((day) => WEEKDAY_LABELS[day - 1]).join('/') : '';
    return days ? `每周 ${days}` : '每周';
  }
  return `间隔 ${plan.cycleValue ?? 1} 天`;
}

function executionModeLabel(mode: Plan['executionMode']) {
  return mode === 'quantity' ? '按定量' : '按时长';
}

export default function PlanDetailPage() {
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [zoneNames, setZoneNames] = useState<Record<string, string>>({});
  const [runningAction, setRunningAction] = useState<'start' | 'pause' | 'stop' | null>(null);
  const [loading, setLoading] = useState(true);
  const liveRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPlanId = useRef<string>('');
  const refreshInFlight = useRef(false);

  async function refreshPlanDetail(planId: string, options: { silent?: boolean } = {}) {
    if (!planId) return;
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      if (!options.silent) setLoading(true);
      const detail = await loadPlanDetail(planId);
      setPlan(detail?.plan ?? null);
      setFieldName(detail?.fieldName ?? '');
      if (detail?.plan?.fieldId) {
        const fieldDetail = await loadFieldDetail(detail.plan.fieldId);
        const names = Object.fromEntries((fieldDetail?.field?.zones ?? []).map((zone) => [zone.id, `${zone.name} · ${zone.stationNo}`]));
        setZoneNames(names);
      }
    } finally {
      refreshInFlight.current = false;
      if (!options.silent) setLoading(false);
    }
  }

  function clearLiveRefreshTimer() {
    if (liveRefreshTimer.current) {
      clearTimeout(liveRefreshTimer.current);
      liveRefreshTimer.current = null;
    }
  }

  function scheduleLiveRefresh(delayMs = 8000) {
    clearLiveRefreshTimer();
    liveRefreshTimer.current = setTimeout(async () => {
      if (currentPlanId.current) {
        await refreshPlanDetail(currentPlanId.current, { silent: true });
      }
      scheduleLiveRefresh(8000);
    }, delayMs);
  }

  useLoad(async () => {
    const id = Taro.getCurrentInstance().router?.params?.id ?? '';
    currentPlanId.current = id;
    await refreshPlanDetail(id);
  });

  useDidShow(() => {
    if (currentPlanId.current) {
      void refreshPlanDetail(currentPlanId.current);
    }
    scheduleLiveRefresh(8000);
  });

  useDidHide(() => {
    clearLiveRefreshTimer();
  });

  useEffect(() => {
    return () => {
      clearLiveRefreshTimer();
    };
  }, []);

  const totalHours = useMemo(
    () => (plan ? Math.round((plan.totalDuration / 60) * 10) / 10 : 0),
    [plan],
  );

  async function handleAction(action: 'start' | 'pause' | 'stop') {
    if (!plan) return;
    try {
      setRunningAction(action);
      const result = await runPlanAction(plan.id, action);
      Taro.showToast({ title: result.message || '操作已提交', icon: 'none' });
      await refreshPlanDetail(plan.id, { silent: true });
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' });
    } finally {
      setRunningAction(null);
    }
  }

  if (!plan && loading) {
    return (
      <View className="plan-detail-page">
        <View className="secondary-topbar" style={{ paddingTop: `${statusBarHeight + 15}px` }}>
          <View className="secondary-back">
            <View className="secondary-back-icon"><Text className="secondary-back-arrow">←</Text></View>
            <Text className="secondary-back-text">返回列表</Text>
          </View>
          <View className="page-skeleton page-skeleton-secondary-title" />
          <View className="page-skeleton page-skeleton-secondary-subtitle" />
        </View>
        <View className="plan-detail-body">
          {Array.from({ length: 4 }, (_, index) => (
            <View key={index} className="plan-detail-card skeleton-surface detail-skeleton-card">
              <View className="page-skeleton page-skeleton-section-title" />
              <View className="page-skeleton page-skeleton-block-large" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!plan) return <View className="plan-detail-page" />;

  return (
    <View className="plan-detail-page">
      <View className="secondary-topbar" style={{ paddingTop: `${statusBarHeight + 15}px` }}>
        <View className="secondary-back" onClick={() => Taro.navigateBack()}>
          <View className="secondary-back-icon"><Text className="secondary-back-arrow">←</Text></View>
          <Text className="secondary-back-text">返回列表</Text>
        </View>
        <View className="secondary-title">{plan.name}</View>
        <View className="secondary-subtitle">{fieldName || '未绑定地块'} · {plan.startTime}</View>
      </View>

      <View className="plan-detail-body">
        <View className="plan-detail-card">
          <View className="plan-detail-card-title">执行概览</View>
          <View className="plan-detail-summary-grid">
            <View className="plan-detail-summary-tile blue">
              <View className="plan-detail-summary-label">执行模式</View>
              <View className="plan-detail-summary-value">{planModeLabel(plan.mode)}</View>
            </View>
            <View className="plan-detail-summary-tile green">
              <View className="plan-detail-summary-label">总时长</View>
              <View className="plan-detail-summary-value">{totalHours}小时</View>
            </View>
            <View className="plan-detail-summary-tile orange">
              <View className="plan-detail-summary-label">分区数量</View>
              <View className="plan-detail-summary-value">{plan.zoneCount}个</View>
            </View>
            <View className="plan-detail-summary-tile purple">
              <View className="plan-detail-summary-label">雨天策略</View>
              <View className="plan-detail-summary-value small">{rainPolicyLabel(plan.rainPolicy)}</View>
            </View>
          </View>
        </View>

        <View className="plan-detail-card">
          <View className="plan-detail-card-title">基础信息</View>
          <View className="plan-detail-info-list">
            <View className="plan-detail-info-row"><Text className="plan-detail-info-label">所属地块</Text><Text className="plan-detail-info-value">{fieldName || '未绑定地块'}</Text></View>
            <View className="plan-detail-info-row"><Text className="plan-detail-info-label">执行周期</Text><Text className="plan-detail-info-value">{cycleLabel(plan)}</Text></View>
            <View className="plan-detail-info-row"><Text className="plan-detail-info-label">开始时间</Text><Text className="plan-detail-info-value">{plan.startTime}</Text></View>
            <View className="plan-detail-info-row"><Text className="plan-detail-info-label">灌溉方式</Text><Text className="plan-detail-info-value">{executionModeLabel(plan.executionMode)}</Text></View>
            <View className="plan-detail-info-row"><Text className="plan-detail-info-label">启用状态</Text><Text className="plan-detail-info-value">{plan.enabled ? '已启用' : '未启用'}</Text></View>
          </View>
        </View>

        {plan.executionMode === 'quantity' ? (
          <View className="plan-detail-card">
            <View className="plan-detail-card-title">定量灌溉参数</View>
            <View className="plan-detail-info-list">
              <View className="plan-detail-info-row"><Text className="plan-detail-info-label">目标水量</Text><Text className="plan-detail-info-value">{plan.targetWater ?? '—'}</Text></View>
              <View className="plan-detail-info-row"><Text className="plan-detail-info-label">灌溉效率</Text><Text className="plan-detail-info-value">{plan.irrigationEfficiencyRate ?? '—'}</Text></View>
              <View className="plan-detail-info-row"><Text className="plan-detail-info-label">单区最长时长</Text><Text className="plan-detail-info-value">{plan.maxDurationPerZone ?? '—'} 分钟</Text></View>
              <View className="plan-detail-info-row"><Text className="plan-detail-info-label">允许拆分</Text><Text className="plan-detail-info-value">{plan.allowSplit ? '允许' : '不允许'}</Text></View>
            </View>
          </View>
        ) : null}

        <View className="plan-detail-card">
          <View className="plan-detail-card-title">分区编排</View>
          <View className="plan-detail-list">
            {plan.zones.map((zone, index) => (
              <View key={zone.zoneId} className="plan-detail-list-row">
                <View className="plan-detail-list-main">
                  <Text className="plan-detail-list-title">{zoneNames[zone.zoneId] ?? `分区 ${index + 1}`}</Text>
                  <Text className="plan-detail-list-meta">顺序 {zone.order} · 时长 {zone.duration}分钟</Text>
                </View>
                <View className={`plan-detail-badge ${zone.enabled ? 'success' : 'neutral'}`}>{zone.enabled ? '启用' : '停用'}</View>
              </View>
            ))}
          </View>
        </View>

        <View className="plan-detail-actions">
          <View className="plan-detail-action ghost" onClick={() => Taro.navigateTo({ url: `/pages/plans/plan-create/index?id=${plan.id}` })}>
            <AppIcon name="calendar" size={16} className="icon-blue" />
            <Text>编辑</Text>
          </View>
          <View className={`plan-detail-action ghost ${runningAction === 'pause' ? 'disabled' : ''}`} onClick={() => void handleAction('pause')}>
            <AppIcon name="pause" size={16} className="icon-orange" />
            <Text>暂停</Text>
          </View>
          <View className={`plan-detail-action primary ${runningAction === 'start' ? 'disabled' : ''}`} onClick={() => void handleAction('start')}>
            <AppIcon name="play" size={16} className="icon-white" />
            <Text>启动计划</Text>
          </View>
          <View className={`plan-detail-action ghost ${runningAction === 'stop' ? 'disabled' : ''}`} onClick={() => void handleAction('stop')}>
            <AppIcon name="square" size={16} className="icon-red" />
            <Text>停止</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
