import Taro, { useLoad } from '@tarojs/taro';
import { Input, Switch, Text, View } from '@tarojs/components';
import { useEffect, useMemo, useState } from 'react';
import type { Plan } from '@irrigation/domain';
import type { MiniPlanCreateInput, MiniFieldListItem } from '@irrigation/api';
import { AppIcon } from '@/components/AppIcon';
import { createPlan, loadFieldDetail, loadFields, loadPlanDetail, updatePlan } from '@/services/dataService';

type CycleType = Plan['cycle'];
type ExecMode = Plan['executionMode'];
type PlanMode = Plan['mode'];
type RainPolicy = Plan['rainPolicy'];

type PlanZoneForm = MiniPlanCreateInput['zones'][number] & {
  name: string;
  stationNo: string;
};

const WEEKDAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];

const MODE_OPTIONS: Array<{ value: PlanMode; label: string }> = [
  { value: 'manual', label: '手动执行' },
  { value: 'confirm', label: '确认后执行' },
  { value: 'auto', label: '允许策略执行' },
];

const CYCLE_OPTIONS: Array<{ value: CycleType; label: string }> = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'interval', label: '间隔' },
];

const EXECUTION_OPTIONS: Array<{ value: ExecMode; label: string }> = [
  { value: 'duration', label: '按时长' },
  { value: 'quantity', label: '按定量' },
];

const RAIN_OPTIONS: Array<{ value: RainPolicy; label: string }> = [
  { value: 'skip', label: '雨天跳过' },
  { value: 'continue', label: '雨天继续' },
  { value: 'delay', label: '雨天延后' },
];

function defaultStartTime() {
  return '06:00';
}

export default function PlanCreatePage() {
  const statusBarHeight = Taro.getSystemInfoSync().statusBarHeight ?? 20;
  const [fields, setFields] = useState<MiniFieldListItem[]>([]);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [name, setName] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [mode, setMode] = useState<PlanMode>('confirm');
  const [cycle, setCycle] = useState<CycleType>('daily');
  const [cycleInterval, setCycleInterval] = useState('3');
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [startTime, setStartTime] = useState(defaultStartTime());
  const [executionMode, setExecutionMode] = useState<ExecMode>('duration');
  const [rainPolicy, setRainPolicy] = useState<RainPolicy>('skip');
  const [enabled, setEnabled] = useState(true);
  const [zones, setZones] = useState<PlanZoneForm[]>([]);
  const [targetWater, setTargetWater] = useState('25');
  const [irrigationEfficiencyRate, setIrrigationEfficiencyRate] = useState('0.85');
  const [maxDurationPerZone, setMaxDurationPerZone] = useState('60');
  const [allowSplit, setAllowSplit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFields().then((data) => {
      const items = data as MiniFieldListItem[];
      setFields(items);
      if (items[0]) {
        setSelectedFieldId(items[0].id);
      }
    });
  }, []);

  useLoad(async () => {
    const id = Taro.getCurrentInstance().router?.params?.id ?? '';
    if (!id) return;
    setEditingId(id);
    const detail = await loadPlanDetail(id);
    const current = detail?.plan;
    if (!current) return;

    setName(current.name);
    setSelectedFieldId(current.fieldId);
    setMode(current.mode);
    setCycle(current.cycle);
    setCycleInterval(typeof current.cycleValue === 'number' ? String(current.cycleValue) : '3');
    setWeekdays(Array.isArray(current.cycleValue) ? current.cycleValue : [1, 3, 5]);
    setStartTime(current.startTime);
    setExecutionMode(current.executionMode);
    setRainPolicy(current.rainPolicy);
    setEnabled(current.enabled);
    setTargetWater(String(current.targetWater ?? '25'));
    setIrrigationEfficiencyRate(String(current.irrigationEfficiencyRate ?? '0.85'));
    setMaxDurationPerZone(String(current.maxDurationPerZone ?? '60'));
    setAllowSplit(Boolean(current.allowSplit));
    setZones(
      current.zones.map((zone) => ({
        zoneId: zone.zoneId,
        order: zone.order,
        duration: zone.duration,
        enabled: zone.enabled,
        name: '',
        stationNo: '',
      })),
    );
  });

  useEffect(() => {
    if (!selectedFieldId) {
      setZones([]);
      return;
    }

    setFieldLoading(true);
    loadFieldDetail(selectedFieldId)
      .then((detail) => {
        setZones((currentZones) => {
          const existingById = new Map(currentZones.map((zone) => [zone.zoneId, zone]));
          return (detail?.field?.zones ?? []).map((zone, index) => {
            const existing = existingById.get(zone.id);
            return {
              zoneId: zone.id,
              order: existing?.order ?? index + 1,
              duration: existing?.duration ?? zone.duration,
              enabled: existing?.enabled ?? true,
              name: zone.name,
              stationNo: zone.stationNo,
            };
          });
        });
      })
      .finally(() => setFieldLoading(false));
  }, [selectedFieldId]);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? null,
    [fields, selectedFieldId],
  );

  function toggleWeekday(value: number) {
    setWeekdays((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value].sort((a, b) => a - b);
    });
  }

  function updateZone(zoneId: string, patch: Partial<PlanZoneForm>) {
    setZones((prev) => prev.map((zone) => (zone.zoneId === zoneId ? { ...zone, ...patch } : zone)));
  }

  function moveZone(zoneId: string, direction: -1 | 1) {
    setZones((prev) => {
      const next = [...prev];
      const currentIndex = next.findIndex((item) => item.zoneId === zoneId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= next.length) {
        return prev;
      }
      [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
      return next.map((zone, index) => ({ ...zone, order: index + 1 }));
    });
  }

  async function submitPlan() {
    if (!name.trim()) {
      Taro.showToast({ title: '请填写计划名称', icon: 'none' });
      return;
    }
    if (!selectedFieldId) {
      Taro.showToast({ title: '请选择地块', icon: 'none' });
      return;
    }
    const enabledZones = zones.filter((zone) => zone.enabled);
    if (enabledZones.length === 0) {
      Taro.showToast({ title: '请至少启用一个分区', icon: 'none' });
      return;
    }
    if (cycle === 'weekly' && weekdays.length === 0) {
      Taro.showToast({ title: '请至少选择一个执行日', icon: 'none' });
      return;
    }

    const payload: MiniPlanCreateInput = {
      name: name.trim(),
      fieldId: selectedFieldId,
      mode,
      cycle,
      cycleValue: cycle === 'weekly'
        ? weekdays
        : cycle === 'interval'
          ? Number(cycleInterval || 1)
          : undefined,
      startTime,
      executionMode,
      rainPolicy,
      enabled,
      zones: zones.map(({ zoneId, order, duration, enabled: zoneEnabled }) => ({
        zoneId,
        order,
        duration,
        enabled: zoneEnabled,
      })),
      targetWater: executionMode === 'quantity' ? Number(targetWater || 0) : undefined,
      irrigationEfficiencyRate: executionMode === 'quantity' ? Number(irrigationEfficiencyRate || 0) : undefined,
      maxDurationPerZone: executionMode === 'quantity' ? Number(maxDurationPerZone || 0) : undefined,
      allowSplit: executionMode === 'quantity' ? allowSplit : undefined,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        const result = await updatePlan(editingId, payload);
        Taro.showToast({ title: '计划已更新', icon: 'success' });
        setTimeout(() => {
          Taro.redirectTo({ url: `/pages/plans/plan-detail/index?id=${result.id}` });
        }, 300);
      } else {
        await createPlan(payload);
        Taro.showToast({ title: '计划已创建', icon: 'success' });
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/plans/index' });
        }, 300);
      }
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
        <View className="secondary-title">{editingId ? '编辑计划' : '新建计划'}</View>
        <View className="secondary-subtitle">{editingId ? '修改现有计划配置' : '按 Web 端字段快速创建'}</View>
      </View>

      <View className="plan-form-body">
        <View className="plan-form-card">
          <View className="plan-form-title">基本信息</View>
          <View className="plan-form-group">
            <Text className="plan-form-label">计划名称</Text>
            <Input className="plan-form-input" placeholder="例如：北区晨间灌溉计划" value={name} onInput={(e) => setName(e.detail.value)} />
          </View>
          <View className="plan-form-group">
            <Text className="plan-form-label">所属地块</Text>
            <View className="plan-form-chip-grid">
              {fields.map((field) => (
                <View
                  key={field.id}
                  className={`plan-form-chip ${selectedFieldId === field.id ? 'active' : ''}`}
                  onClick={() => setSelectedFieldId(field.id)}
                >
                  {field.name}
                </View>
              ))}
            </View>
          </View>
          <View className="plan-form-inline-grid">
            <View className="plan-form-group inline">
              <Text className="plan-form-label">开始时间</Text>
              <Input className="plan-form-input" placeholder="06:00" value={startTime} onInput={(e) => setStartTime(e.detail.value)} />
            </View>
            <View className="plan-form-group inline">
              <Text className="plan-form-label">启用计划</Text>
              <View className="plan-form-switch-row">
                <Text className="plan-form-switch-text">{enabled ? '已启用' : '未启用'}</Text>
                <Switch checked={enabled} color="#2563eb" onChange={(e) => setEnabled(e.detail.value)} />
              </View>
            </View>
          </View>
        </View>

        <View className="plan-form-card">
          <View className="plan-form-title">执行方式</View>
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
          <View className="plan-form-group">
            <Text className="plan-form-label">雨天策略</Text>
            <View className="plan-form-chip-grid">
              {RAIN_OPTIONS.map((item) => (
                <View
                  key={item.value}
                  className={`plan-form-chip ${rainPolicy === item.value ? 'active' : ''}`}
                  onClick={() => setRainPolicy(item.value)}
                >
                  {item.label}
                </View>
              ))}
            </View>
          </View>
        </View>

        <View className="plan-form-card">
          <View className="plan-form-title">执行周期</View>
          <View className="plan-form-group">
            <Text className="plan-form-label">周期类型</Text>
            <View className="plan-form-chip-grid">
              {CYCLE_OPTIONS.map((item) => (
                <View
                  key={item.value}
                  className={`plan-form-chip ${cycle === item.value ? 'active' : ''}`}
                  onClick={() => setCycle(item.value)}
                >
                  {item.label}
                </View>
              ))}
            </View>
          </View>
          {cycle === 'weekly' ? (
            <View className="plan-form-group">
              <Text className="plan-form-label">执行日</Text>
              <View className="plan-form-chip-grid">
                {WEEKDAYS.map((day) => (
                  <View
                    key={day.value}
                    className={`plan-form-chip ${weekdays.includes(day.value) ? 'active' : ''}`}
                    onClick={() => toggleWeekday(day.value)}
                  >
                    {day.label}
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {cycle === 'interval' ? (
            <View className="plan-form-group">
              <Text className="plan-form-label">间隔天数</Text>
              <Input
                className="plan-form-input"
                type="number"
                placeholder="3"
                value={cycleInterval}
                onInput={(e) => setCycleInterval(e.detail.value)}
              />
            </View>
          ) : null}
        </View>

        {executionMode === 'quantity' ? (
          <View className="plan-form-card">
            <View className="plan-form-title">定量灌溉参数</View>
            <View className="plan-form-inline-grid">
              <View className="plan-form-group inline">
                <Text className="plan-form-label">目标水量</Text>
                <Input className="plan-form-input" type="digit" value={targetWater} onInput={(e) => setTargetWater(e.detail.value)} />
              </View>
              <View className="plan-form-group inline">
                <Text className="plan-form-label">灌溉效率</Text>
                <Input className="plan-form-input" type="digit" value={irrigationEfficiencyRate} onInput={(e) => setIrrigationEfficiencyRate(e.detail.value)} />
              </View>
            </View>
            <View className="plan-form-inline-grid">
              <View className="plan-form-group inline">
                <Text className="plan-form-label">单区最长时长</Text>
                <Input className="plan-form-input" type="number" value={maxDurationPerZone} onInput={(e) => setMaxDurationPerZone(e.detail.value)} />
              </View>
              <View className="plan-form-group inline">
                <Text className="plan-form-label">允许拆分</Text>
                <View className="plan-form-switch-row">
                  <Text className="plan-form-switch-text">{allowSplit ? '允许' : '不允许'}</Text>
                  <Switch checked={allowSplit} color="#2563eb" onChange={(e) => setAllowSplit(e.detail.value)} />
                </View>
              </View>
            </View>
          </View>
        ) : null}

        <View className="plan-form-card">
          <View className="plan-form-title">分区编排</View>
          {selectedField ? (
            <Text className="plan-form-helper">当前地块：{selectedField.name}{fieldLoading ? ' · 加载中' : ''}</Text>
          ) : null}
          <View className="plan-zone-list">
            {zones.map((zone, index) => (
              <View key={zone.zoneId} className="plan-zone-row">
                <View className="plan-zone-main">
                  <Text className="plan-zone-title">{zone.name || `分区 ${index + 1}`}</Text>
                  <Text className="plan-zone-meta">顺序 {zone.order} · 站号 {zone.stationNo}</Text>
                </View>
                <View className="plan-zone-tools">
                  <Input
                    className="plan-zone-duration"
                    type="number"
                    value={String(zone.duration)}
                    onInput={(e) => updateZone(zone.zoneId, { duration: Number(e.detail.value || 0) })}
                  />
                  <Text className="plan-zone-duration-unit">分钟</Text>
                  <View className={`plan-zone-toggle ${zone.enabled ? 'active' : ''}`} onClick={() => updateZone(zone.zoneId, { enabled: !zone.enabled })}>
                    {zone.enabled ? '启用' : '停用'}
                  </View>
                  <View className="plan-zone-order-btn" onClick={() => moveZone(zone.zoneId, -1)}>上移</View>
                  <View className="plan-zone-order-btn" onClick={() => moveZone(zone.zoneId, 1)}>下移</View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="plan-form-actions">
          <View className="plan-detail-action ghost" onClick={() => Taro.navigateBack()}>
            <Text>取消</Text>
          </View>
          <View className={`plan-detail-action primary ${submitting ? 'disabled' : ''}`} onClick={submitPlan}>
            <AppIcon name="calendar" size={16} className="icon-white" />
            <Text>{editingId ? '保存计划' : '创建计划'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
