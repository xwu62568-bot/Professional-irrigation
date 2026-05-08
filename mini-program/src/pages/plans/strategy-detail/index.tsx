import Taro, { useLoad } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { useState } from 'react';
import type { Strategy } from '@irrigation/domain';
import { AppIcon } from '@/components/AppIcon';
import { loadStrategyDetail } from '@/services/dataService';

function strategyModeLabel(mode: Strategy['mode']) {
  if (mode === 'auto') return '自动';
  if (mode === 'confirm') return '待确认';
  return '建议';
}

export default function StrategyDetailPage() {
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [loading, setLoading] = useState(true);

  useLoad(async () => {
    try {
      const id = Taro.getCurrentInstance().router?.params?.id ?? '';
      const detail = await loadStrategyDetail(id);
      setStrategy(detail?.strategy ?? null);
      setFieldName(detail?.fieldName ?? '');
    } finally {
      setLoading(false);
    }
  });

  if (!strategy && loading) {
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
          {Array.from({ length: 3 }, (_, index) => (
            <View key={index} className="plan-detail-card skeleton-surface detail-skeleton-card">
              <View className="page-skeleton page-skeleton-section-title" />
              <View className="page-skeleton page-skeleton-block-large" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!strategy) return <View className="plan-detail-page" />;

  return (
    <View className="plan-detail-page">
      <View className="secondary-topbar" style={{ paddingTop: `${statusBarHeight + 15}px` }}>
        <View className="secondary-back" onClick={() => Taro.navigateBack()}>
          <View className="secondary-back-icon"><Text className="secondary-back-arrow">←</Text></View>
          <Text className="secondary-back-text">返回列表</Text>
        </View>
        <View className="secondary-title">{strategy.name}</View>
        <View className="secondary-subtitle">{fieldName || '未绑定地块'} · {strategy.type === 'threshold' ? '阈值策略' : 'ET策略'}</View>
      </View>

      <View className="plan-detail-body">
        <View className="plan-detail-card">
          <View className="plan-detail-card-title">策略概览</View>
          <View className="plan-detail-summary-grid">
            <View className="plan-detail-summary-tile blue">
              <View className="plan-detail-summary-label">执行模式</View>
              <View className="plan-detail-summary-value">{strategyModeLabel(strategy.mode)}</View>
            </View>
            <View className="plan-detail-summary-tile green">
              <View className="plan-detail-summary-label">作用范围</View>
              <View className="plan-detail-summary-value">{strategy.scope === 'all' ? '全部地块' : '分区策略'}</View>
            </View>
            <View className="plan-detail-summary-tile orange">
              <View className="plan-detail-summary-label">最小间隔</View>
              <View className="plan-detail-summary-value">{strategy.minInterval}小时</View>
            </View>
            <View className="plan-detail-summary-tile purple">
              <View className="plan-detail-summary-label">雨锁</View>
              <View className="plan-detail-summary-value small">{strategy.rainLock ? '已启用' : '未启用'}</View>
            </View>
          </View>
        </View>

        <View className="plan-detail-card">
          <View className="plan-detail-card-title">规则参数</View>
          <View className="plan-detail-info-list">
            <View className="plan-detail-info-row"><Text className="plan-detail-info-label">策略类型</Text><Text className="plan-detail-info-value">{strategy.type === 'threshold' ? '土壤阈值' : 'ET补水'}</Text></View>
            <View className="plan-detail-info-row"><Text className="plan-detail-info-label">启用状态</Text><Text className="plan-detail-info-value">{strategy.enabled ? '已启用' : '未启用'}</Text></View>
            <View className="plan-detail-info-row"><Text className="plan-detail-info-label">触发下限</Text><Text className="plan-detail-info-value">{strategy.moistureLow ?? '-'}%</Text></View>
            <View className="plan-detail-info-row"><Text className="plan-detail-info-label">恢复阈值</Text><Text className="plan-detail-info-value">{strategy.moistureRestore ?? '-'}%</Text></View>
          </View>
        </View>

        <View className="plan-detail-card">
          <View className="plan-detail-card-title">可执行动作</View>
          <View className="plan-detail-list">
            <View className="plan-detail-list-row">
              <View className="plan-detail-list-main">
                <Text className="plan-detail-list-title">确认本次建议</Text>
                <Text className="plan-detail-list-meta">按当前策略建议生成灌溉动作</Text>
              </View>
              <AppIcon name="chevronRight" size={16} className="icon-muted" />
            </View>
            <View className="plan-detail-list-row">
              <View className="plan-detail-list-main">
                <Text className="plan-detail-list-title">忽略本次建议</Text>
                <Text className="plan-detail-list-meta">跳过当前建议周期</Text>
              </View>
              <AppIcon name="chevronRight" size={16} className="icon-muted" />
            </View>
          </View>
        </View>

        <View className="plan-detail-actions">
          <View className="plan-detail-action ghost" onClick={() => Taro.showToast({ title: '已忽略（演示）', icon: 'none' })}>
            <Text>忽略本次</Text>
          </View>
          <View className="plan-detail-action primary" onClick={() => Taro.showToast({ title: '已确认（演示）', icon: 'none' })}>
            <Text>确认执行</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
