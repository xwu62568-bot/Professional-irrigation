import Taro from '@tarojs/taro';
import { Input, Switch, Text, View } from '@tarojs/components';
import { useEffect, useMemo, useState } from 'react';
import type { Field, Strategy } from '@irrigation/domain';
import type { MiniStrategyCreateInput, MiniFieldListItem } from '@irrigation/api';
import { AppIcon } from '@/components/AppIcon';
import { createStrategy, loadFieldDetail, loadFields } from '@/services/dataService';

type StrategyType = Strategy['type'];
type StrategyMode = Strategy['mode'];
type ScopeType = Strategy['scope'];
type ExecMode = NonNullable<Strategy['executionMode']>;

const MODE_OPTIONS: Array<{ value: StrategyMode; label: string }> = [
  { value: 'suggest', label: '建议模式' },
  { value: 'confirm', label: '确认后执行' },
  { value: 'auto', label: '自动执行' },
];

const SCOPE_OPTIONS: Array<{ value: ScopeType; label: string }> = [
  { value: 'all', label: '整个地块' },
  { value: 'zones', label: '指定分区' },
];

const EXECUTION_OPTIONS: Array<{ value: ExecMode; label: string }> = [
  { value: 'duration', label: '按时长' },
  { value: 'quantity', label: '按定量' },
];

export default function StrategyCreatePage() {
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;
  const [fields, setFields] = useState<MiniFieldListItem[]>([]);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [name, setName] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [type, setType] = useState<StrategyType>('threshold');
  const [mode, setMode] = useState<StrategyMode>('confirm');
  const [scope, setScope] = useState<ScopeType>('all');
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [rainLock, setRainLock] = useState(true);
  const [minInterval, setMinInterval] = useState('12');
  const [maxDuration, setMaxDuration] = useState('120');
  const [moistureLow, setMoistureLow] = useState('55');
  const [moistureRestore, setMoistureRestore] = useState('75');
  const [executionMode, setExecutionMode] = useState<ExecMode>('duration');
  const [etDeficitThreshold, setEtDeficitThreshold] = useState('8');
  const [rainfallOffset, setRainfallOffset] = useState('0.8');
  const [replenishRatio, setReplenishRatio] = useState('0.9');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFields().then((data) => {
      const items = data as MiniFieldListItem[];
      setFields(items);
      setSelectedFieldId(items[0]?.id ?? '');
    });
  }, []);

  useEffect(() => {
    if (!selectedFieldId) {
      setSelectedField(null);
      setZoneIds([]);
      return;
    }

    setFieldLoading(true);
    loadFieldDetail(selectedFieldId)
      .then((detail) => {
        setSelectedField(detail?.field ?? null);
        setZoneIds((current) => current.filter((zoneId) => detail?.field?.zones.some((zone) => zone.id === zoneId)));
      })
      .finally(() => setFieldLoading(false));
  }, [selectedFieldId]);

  const selectedFieldName = useMemo(
    () => fields.find((field) => field.id === selectedFieldId)?.name ?? '',
    [fields, selectedFieldId],
  );

  function toggleZone(zoneId: string) {
    setZoneIds((current) => (
      current.includes(zoneId)
        ? current.filter((item) => item !== zoneId)
        : [...current, zoneId]
    ));
  }

  async function submitStrategy() {
    if (!name.trim()) {
      Taro.showToast({ title: '请填写策略名称', icon: 'none' });
      return;
    }
    if (!selectedFieldId) {
      Taro.showToast({ title: '请选择地块', icon: 'none' });
      return;
    }
    if (scope === 'zones' && zoneIds.length === 0) {
      Taro.showToast({ title: '请至少选择一个分区', icon: 'none' });
      return;
    }

    const payload: MiniStrategyCreateInput = {
      name: name.trim(),
      fieldId: selectedFieldId,
      type,
      mode,
      scope,
      zoneIds: scope === 'zones' ? zoneIds : [],
      enabled,
      rainLock,
      minInterval: Number(minInterval || 0),
      maxDuration: Number(maxDuration || 0),
      ...(type === 'threshold'
        ? {
            moistureLow: Number(moistureLow || 0),
            moistureRestore: Number(moistureRestore || 0),
            executionMode,
          }
        : {
            etDeficitThreshold: Number(etDeficitThreshold || 0),
            rainfallOffset: Number(rainfallOffset || 0),
            replenishRatio: Number(replenishRatio || 0),
          }),
    };

    setSubmitting(true);
    try {
      await createStrategy(payload);
      Taro.showToast({ title: enabled ? '策略已创建并启用' : '策略已创建', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/plans/index' });
      }, 300);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="plan-form-page">
      <View className="secondary-topbar" style={{ paddingTop: `${statusBarHeight + 15}px` }}>
        <View className="secondary-back" onClick={() => Taro.navigateBack()}>
          <View className="secondary-back-icon"><Text className="secondary-back-arrow">←</Text></View>
          <Text className="secondary-back-text">返回列表</Text>
        </View>
        <View className="secondary-title">新建策略</View>
        <View className="secondary-subtitle">移动端快速配置</View>
      </View>

      <View className="plan-form-body">
        <View className="plan-form-card">
          <View className="plan-form-title">基本信息</View>
          <View className="plan-form-group">
            <Text className="plan-form-label">策略名称</Text>
            <Input className="plan-form-input" placeholder="例如：北区土壤阈值策略" value={name} onInput={(e) => setName(e.detail.value)} />
          </View>
          <View className="plan-form-group">
            <Text className="plan-form-label">所属地块</Text>
            <View className="plan-form-chip-grid">
              {fields.map((field) => (
                <View
                  key={field.id}
                  className={`plan-form-chip ${selectedFieldId === field.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedFieldId(field.id);
                    setScope('all');
                    setZoneIds([]);
                  }}
                >
                  {field.name}
                </View>
              ))}
            </View>
            {selectedFieldName ? <Text className="plan-form-helper">当前地块：{selectedFieldName}{fieldLoading ? ' · 加载中' : ''}</Text> : null}
          </View>
          <View className="plan-form-group">
            <Text className="plan-form-label">执行模式</Text>
            <View className="plan-form-chip-grid">
              {MODE_OPTIONS.map((item) => (
                <View
                  key={item.value}
                  className={`plan-form-chip ${mode === item.value ? 'active' : ''}`}
                  onClick={() => setMode(item.value)}
                >
                  {item.label}
                </View>
              ))}
            </View>
            <Text className="plan-form-helper">
              {mode === 'suggest' ? '策略仅生成建议，不自动执行' : mode === 'confirm' ? '生成决策后需人工确认再执行' : '满足条件后自动触发灌溉'}
            </Text>
          </View>
          <View className="plan-form-inline-grid">
            <View className="plan-form-group inline">
              <Text className="plan-form-label">启用策略</Text>
              <View className="plan-form-switch-row">
                <Text className="plan-form-switch-text">{enabled ? '已启用' : '未启用'}</Text>
                <Switch checked={enabled} color="#2563eb" onChange={(e) => setEnabled(e.detail.value)} />
              </View>
            </View>
            <View className="plan-form-group inline">
              <Text className="plan-form-label">雨天锁定</Text>
              <View className="plan-form-switch-row">
                <Text className="plan-form-switch-text">{rainLock ? '已启用' : '未启用'}</Text>
                <Switch checked={rainLock} color="#2563eb" onChange={(e) => setRainLock(e.detail.value)} />
              </View>
            </View>
          </View>
        </View>

        <View className="plan-form-card">
          <View className="plan-form-title">策略类型</View>
          <View className="plan-form-chip-grid">
            {[
              { key: 'threshold', label: '土壤阈值' },
              { key: 'etc', label: 'ET补水' },
            ].map((item) => (
              <View
                key={item.key}
                className={`plan-form-chip ${type === item.key ? 'active' : ''}`}
                onClick={() => setType(item.key as typeof type)}
              >
                {item.label}
              </View>
            ))}
          </View>
        </View>

        <View className="plan-form-card">
          <View className="plan-form-title">作用范围</View>
          <View className="plan-form-chip-grid">
            {SCOPE_OPTIONS.map((item) => (
              <View
                key={item.value}
                className={`plan-form-chip ${scope === item.value ? 'active' : ''}`}
                onClick={() => {
                  setScope(item.value);
                  if (item.value === 'all') setZoneIds([]);
                }}
              >
                {item.label}
              </View>
            ))}
          </View>
          {scope === 'zones' ? (
            <View className="plan-zone-list">
              {(selectedField?.zones ?? []).map((zone) => (
                <View key={zone.id} className="plan-zone-row">
                  <View className="plan-zone-main">
                    <Text className="plan-zone-title">{zone.name}</Text>
                    <Text className="plan-zone-meta">站号 {zone.stationNo}</Text>
                  </View>
                  <View
                    className={`plan-zone-toggle ${zoneIds.includes(zone.id) ? 'active' : ''}`}
                    onClick={() => toggleZone(zone.id)}
                  >
                    {zoneIds.includes(zone.id) ? '已选择' : '选择'}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {type === 'threshold' ? (
          <View className="plan-form-card">
            <View className="plan-form-title">阈值参数</View>
            <Text className="plan-form-helper">当土壤湿度低于下限时触发灌溉，恢复到阈值后停止</Text>
            <View className="plan-form-inline-grid">
              <View className="plan-form-group inline">
                <Text className="plan-form-label">湿度下限 (%)</Text>
                <Input className="plan-form-input" type="number" value={moistureLow} onInput={(e) => setMoistureLow(e.detail.value)} />
              </View>
              <View className="plan-form-group inline">
                <Text className="plan-form-label">恢复阈值 (%)</Text>
                <Input className="plan-form-input" type="number" value={moistureRestore} onInput={(e) => setMoistureRestore(e.detail.value)} />
              </View>
            </View>
            <View className="plan-form-group">
              <Text className="plan-form-label">灌溉方式</Text>
              <View className="plan-form-chip-grid">
                {EXECUTION_OPTIONS.map((item) => (
                  <View
                    key={item.value}
                    className={`plan-form-chip ${executionMode === item.value ? 'active' : ''}`}
                    onClick={() => setExecutionMode(item.value)}
                  >
                    {item.label}
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View className="plan-form-card">
            <View className="plan-form-title">ETc 参数</View>
            <Text className="plan-form-helper">根据 ET 累计缺水量和有效降雨系数计算补水量</Text>
            <View className="plan-form-inline-grid">
              <View className="plan-form-group inline">
                <Text className="plan-form-label">ET缺水阈值 (mm)</Text>
                <Input className="plan-form-input" type="digit" value={etDeficitThreshold} onInput={(e) => setEtDeficitThreshold(e.detail.value)} />
              </View>
              <View className="plan-form-group inline">
                <Text className="plan-form-label">有效降雨系数</Text>
                <Input className="plan-form-input" type="digit" value={rainfallOffset} onInput={(e) => setRainfallOffset(e.detail.value)} />
              </View>
            </View>
            <View className="plan-form-group">
              <Text className="plan-form-label">补水比例</Text>
              <Input className="plan-form-input" type="digit" value={replenishRatio} onInput={(e) => setReplenishRatio(e.detail.value)} />
            </View>
          </View>
        )}

        <View className="plan-form-card">
          <View className="plan-form-title">约束条件</View>
          <View className="plan-form-inline-grid">
            <View className="plan-form-group inline">
              <Text className="plan-form-label">最短触发间隔 (h)</Text>
              <Input className="plan-form-input" type="number" value={minInterval} onInput={(e) => setMinInterval(e.detail.value)} />
            </View>
            <View className="plan-form-group inline">
              <Text className="plan-form-label">单次最长时长 (min)</Text>
              <Input className="plan-form-input" type="number" value={maxDuration} onInput={(e) => setMaxDuration(e.detail.value)} />
            </View>
          </View>
        </View>

        <View className="plan-form-actions">
          <View className="plan-detail-action ghost" onClick={() => Taro.navigateBack()}>
            <Text>取消</Text>
          </View>
          <View
            className={`plan-detail-action primary ${submitting ? 'disabled' : ''}`}
            onClick={submitStrategy}
          >
            <AppIcon name="settings" size={16} className="icon-white" />
            <Text>创建策略</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
