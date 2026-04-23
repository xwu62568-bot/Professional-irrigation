import { useState } from 'react';
import {
  Plus, Zap, Edit3, Trash2, X, AlertTriangle, TrendingUp, Droplets,
  Info, ToggleLeft, ToggleRight, CheckCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Strategy } from '../data/mockData';

type StrategyType = 'threshold' | 'etc';
type StrategyMode = 'suggest' | 'confirm' | 'auto';
type ScopeType = 'all' | 'zones';
type ExecMode = 'duration' | 'quantity';

const MODE_LABELS: Record<StrategyMode, string> = { suggest: '建议模式', confirm: '确认后执行', auto: '自动执行' };
const MODE_COLORS: Record<StrategyMode, string> = { suggest: '#3b82f6', confirm: '#f59e0b', auto: '#16a34a' };
const MODE_BG: Record<StrategyMode, string> = { suggest: '#eff6ff', confirm: '#fffbeb', auto: '#f0fdf4' };

interface StrategyFormState {
  name: string;
  fieldId: string;
  type: StrategyType;
  mode: StrategyMode;
  scope: ScopeType;
  zoneIds: string[];
  enabled: boolean;
  rainLock: boolean;
  minInterval: number;
  maxDuration: number;
  moistureLow: number;
  moistureRestore: number;
  executionMode: ExecMode;
  etDeficitThreshold: number;
  rainfallOffset: number;
  replenishRatio: number;
}

const defaultForm = (): StrategyFormState => ({
  name: '', fieldId: '', type: 'threshold', mode: 'confirm',
  scope: 'all', zoneIds: [], enabled: true, rainLock: true,
  minInterval: 12, maxDuration: 120,
  moistureLow: 55, moistureRestore: 75, executionMode: 'duration',
  etDeficitThreshold: 8, rainfallOffset: 0.8, replenishRatio: 0.9,
});

const SCOPE_OPTIONS: [ScopeType, string][] = [['all', '整个地块'], ['zones', '指定分区']];
const EXEC_OPTIONS: [ExecMode, string][] = [['duration', '按时长'], ['quantity', '按定量']];
const MODE_OPTIONS: StrategyMode[] = ['suggest', 'confirm', 'auto'];

export function AutoStrategy() {
  const { fields, strategies, setStrategies } = useApp();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState<StrategyFormState>(defaultForm());

  const selectedField = fields.find(f => f.id === form.fieldId);

  const openCreate = () => {
    setForm(defaultForm());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (s: Strategy) => {
    setForm({
      name: s.name, fieldId: s.fieldId, type: s.type, mode: s.mode,
      scope: s.scope, zoneIds: [...s.zoneIds], enabled: s.enabled,
      rainLock: s.rainLock, minInterval: s.minInterval, maxDuration: s.maxDuration,
      moistureLow: s.moistureLow ?? 55, moistureRestore: s.moistureRestore ?? 75,
      executionMode: (s.executionMode as ExecMode) ?? 'duration',
      etDeficitThreshold: s.etDeficitThreshold ?? 8,
      rainfallOffset: s.rainfallOffset ?? 0.8,
      replenishRatio: s.replenishRatio ?? 0.9,
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const saveStrategy = () => {
    if (!form.name || !form.fieldId) return;
    const data: Omit<Strategy, 'id'> = {
      name: form.name, fieldId: form.fieldId, type: form.type, mode: form.mode,
      scope: form.scope, zoneIds: form.zoneIds, enabled: form.enabled,
      rainLock: form.rainLock, minInterval: form.minInterval, maxDuration: form.maxDuration,
      ...(form.type === 'threshold' ? {
        moistureLow: form.moistureLow, moistureRestore: form.moistureRestore, executionMode: form.executionMode,
      } : {
        etDeficitThreshold: form.etDeficitThreshold, rainfallOffset: form.rainfallOffset, replenishRatio: form.replenishRatio,
      }),
    };
    if (editingId) {
      setStrategies(prev => prev.map(s => s.id === editingId ? { ...data, id: editingId } : s));
    } else {
      setStrategies(prev => [...prev, { ...data, id: `s${Date.now()}` }]);
    }
    setShowForm(false);
  };

  const deleteStrategy = (id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
    setDeleteConfirm(null);
  };

  const toggleEnabled = (id: string) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const getFieldName = (fieldId: string) => fields.find(f => f.id === fieldId)?.name ?? '—';

  const toggleZone = (zoneId: string) => {
    setForm(prev => ({
      ...prev,
      zoneIds: prev.zoneIds.includes(zoneId)
        ? prev.zoneIds.filter(z => z !== zoneId)
        : [...prev.zoneIds, zoneId],
    }));
  };

  const setField = <K extends keyof StrategyFormState>(key: K, value: StrategyFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#f0f4f8' }}>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#0f172a', fontSize: 20, fontWeight: 700 }}>自动策略</h1>
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
                {strategies.length} 个策略 · {strategies.filter(s => s.enabled).length} 个启用
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
              style={{ background: '#8b5cf6', color: '#ffffff', fontSize: 14 }}
            >
              <Plus size={18} /> 新增策略
            </button>
          </div>
        </div>

        {/* Strategy list */}
        <div className="flex-1 overflow-y-auto p-6">
          {strategies.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#94a3b8' }}>
              <Zap size={48} className="mb-4 opacity-30" />
              <p style={{ fontSize: 16 }}>暂无自动策略</p>
              <button onClick={openCreate} style={{ color: '#8b5cf6', marginTop: 8, fontSize: 14 }}>+ 新增第一个策略</button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {strategies.map(s => (
              <div
                key={s.id}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: '#ffffff',
                  border: `1px solid ${s.enabled ? '#e2e8f0' : '#f1f5f9'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  opacity: s.enabled ? 1 : 0.75
                }}
              >
                <div className="p-5">
                  {/* Header row */}
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className="flex items-center justify-center rounded-xl shrink-0"
                      style={{
                        width: 44, height: 44,
                        background: s.type === 'threshold' ? '#fef3c7' : '#ede9fe',
                        border: `1px solid ${s.type === 'threshold' ? '#fde68a' : '#ddd6fe'}`
                      }}
                    >
                      {s.type === 'threshold'
                        ? <Droplets size={22} color="#f59e0b" />
                        : <TrendingUp size={22} color="#8b5cf6" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>{s.name}</h3>
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{ background: s.type === 'threshold' ? '#fffbeb' : '#f5f3ff', color: s.type === 'threshold' ? '#d97706' : '#7c3aed', fontSize: 11 }}
                        >
                          {s.type === 'threshold' ? '阈值灌溉' : 'ETc灌溉'}
                        </span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>
                        {getFieldName(s.fieldId)} · {s.scope === 'all' ? '整块地块' : `${s.zoneIds.length}个分区`}
                      </div>
                    </div>
                    <button onClick={() => toggleEnabled(s.id)} className="shrink-0">
                      {s.enabled
                        ? <ToggleRight size={28} color="#16a34a" />
                        : <ToggleLeft size={28} color="#94a3b8" />}
                    </button>
                  </div>

                  {/* Key params */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>
                        {s.type === 'threshold' ? '触发阈值' : 'ET缺水阈值'}
                      </div>
                      <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 600 }}>
                        {s.type === 'threshold'
                          ? `${s.moistureLow}% → ${s.moistureRestore}%`
                          : `≥ ${s.etDeficitThreshold} mm`}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>执行模式</div>
                      <div style={{ color: MODE_COLORS[s.mode], fontSize: 13, fontWeight: 600 }}>
                        {MODE_LABELS[s.mode]}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>最短间隔</div>
                      <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{s.minInterval} 小时</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>单次最长</div>
                      <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{s.maxDuration} 分钟</div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{ background: MODE_BG[s.mode], color: MODE_COLORS[s.mode], fontSize: 11 }}
                    >
                      {MODE_LABELS[s.mode]}
                    </span>
                    {s.rainLock && (
                      <span className="px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#3b82f6', fontSize: 11 }}>
                        雨天锁定
                      </span>
                    )}
                    {s.type === 'threshold' && (
                      <span className="px-2 py-0.5 rounded-full" style={{ background: '#f8fafc', color: '#64748b', fontSize: 11 }}>
                        {s.executionMode === 'duration' ? '按时长' : '按定量'}
                      </span>
                    )}
                    {!s.enabled && (
                      <span className="px-2 py-0.5 rounded-full" style={{ background: '#f8fafc', color: '#94a3b8', fontSize: 11 }}>
                        已停用
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid #f1f5f9' }}>
                    <button
                      onClick={() => openEdit(s)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl flex-1 justify-center"
                      style={{ background: '#eff6ff', color: '#3b82f6', fontSize: 13 }}
                    >
                      <Edit3 size={14} /> 编辑
                    </button>
                    <button
                      onClick={() => toggleEnabled(s.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl flex-1 justify-center"
                      style={{
                        background: s.enabled ? '#fef2f2' : '#f0fdf4',
                        color: s.enabled ? '#ef4444' : '#16a34a',
                        fontSize: 13
                      }}
                    >
                      {s.enabled ? '停用' : '启用'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(s.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl justify-center"
                      style={{ background: '#fef2f2', color: '#ef4444', fontSize: 13 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowForm(false)} />
          <div
            className="flex flex-col overflow-hidden h-full"
            style={{ width: 540, background: '#ffffff', borderLeft: '1px solid #e2e8f0' }}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ color: '#0f172a', fontSize: 18, fontWeight: 600 }}>
                {editingId ? '编辑策略' : '新增自动策略'}
              </h2>
              <button onClick={() => setShowForm(false)}><X size={20} color="#64748b" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* Strategy type selector */}
              <section>
                <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>策略类型</h3>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['threshold', '阈值灌溉', '基于土壤湿度下限和恢复阈值触发', '#f59e0b', '#fffbeb'],
                    ['etc', 'ETc灌溉', '基于ET缺水量、有效降雨逻辑触发', '#8b5cf6', '#f5f3ff'],
                  ] as [StrategyType, string, string, string, string][]).map(([type, label, desc, color, bg]) => (
                    <button
                      key={type}
                      onClick={() => setField('type', type)}
                      className="p-4 rounded-xl text-left transition-all"
                      style={{
                        border: `2px solid ${form.type === type ? color : '#e2e8f0'}`,
                        background: form.type === type ? bg : '#f8fafc',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {type === 'threshold' ? <Droplets size={18} color={color} /> : <TrendingUp size={18} color={color} />}
                        <span style={{ color: form.type === type ? color : '#374151', fontSize: 14, fontWeight: 600 }}>{label}</span>
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: 12 }}>{desc}</p>
                    </button>
                  ))}
                </div>
              </section>

              {/* Basic info */}
              <section>
                <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>基础配置</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>策略名称 *</label>
                    <input
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      placeholder="请填写策略名称"
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a', background: '#f8fafc' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>所属地块 *</label>
                    <select
                      value={form.fieldId}
                      onChange={e => setForm(p => ({ ...p, fieldId: e.target.value, zoneIds: [] }))}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a', background: '#f8fafc' }}
                    >
                      <option value="">请选择地块</option>
                      {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 6 }}>执行模式</label>
                    <div className="grid grid-cols-3 gap-2">
                      {MODE_OPTIONS.map(m => (
                        <button
                          key={m}
                          onClick={() => setField('mode', m)}
                          className="py-2 px-3 rounded-xl transition-all"
                          style={{
                            border: `1px solid ${form.mode === m ? MODE_COLORS[m] : '#e2e8f0'}`,
                            background: form.mode === m ? MODE_BG[m] : '#f8fafc',
                            color: form.mode === m ? MODE_COLORS[m] : '#64748b',
                            fontSize: 12,
                          }}
                        >
                          {MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 p-3 rounded-xl flex items-start gap-2" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <Info size={14} color="#94a3b8" className="mt-0.5 shrink-0" />
                      <p style={{ color: '#94a3b8', fontSize: 12 }}>
                        {form.mode === 'suggest' ? '策略仅生成建议，不自动执行'
                          : form.mode === 'confirm' ? '生成决策后需人工确认再执行'
                          : '满足条件后自动触发灌溉，无需确认'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Scope */}
              <section>
                <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>作用范围</h3>
                <div className="flex gap-3 mb-3">
                  {SCOPE_OPTIONS.map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setForm(p => ({ ...p, scope: v, zoneIds: [] }))}
                      className="flex-1 py-2 rounded-xl"
                      style={{
                        border: `1px solid ${form.scope === v ? '#16a34a' : '#e2e8f0'}`,
                        background: form.scope === v ? '#f0fdf4' : '#f8fafc',
                        color: form.scope === v ? '#16a34a' : '#64748b',
                        fontSize: 14,
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {form.scope === 'zones' && form.fieldId && selectedField && (
                  <div className="flex flex-col gap-2">
                    {selectedField.zones.map(zone => (
                      <button
                        key={zone.id}
                        onClick={() => toggleZone(zone.id)}
                        className="flex items-center gap-3 p-3 rounded-xl text-left w-full"
                        style={{
                          border: `1px solid ${form.zoneIds.includes(zone.id) ? '#16a34a' : '#e2e8f0'}`,
                          background: form.zoneIds.includes(zone.id) ? '#f0fdf4' : '#f8fafc',
                        }}
                      >
                        <CheckCircle size={18} color={form.zoneIds.includes(zone.id) ? '#16a34a' : '#e2e8f0'} />
                        <span style={{ color: '#0f172a', fontSize: 14 }}>{zone.name}</span>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>站点 {zone.stationNo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Type-specific params */}
              {form.type === 'threshold' ? (
                <section>
                  <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>阈值参数</h3>
                  <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>当土壤湿度低于下限时触发灌溉，灌至恢复阈值后停止</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>湿度下限 (%)</label>
                      <input
                        type="number" min={10} max={90}
                        value={form.moistureLow}
                        onChange={e => setField('moistureLow', Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl outline-none"
                        style={{ border: '1px solid #e2e8f0', fontSize: 14, background: '#f8fafc' }}
                      />
                    </div>
                    <div>
                      <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>恢复阈值 (%)</label>
                      <input
                        type="number" min={10} max={100}
                        value={form.moistureRestore}
                        onChange={e => setField('moistureRestore', Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl outline-none"
                        style={{ border: '1px solid #e2e8f0', fontSize: 14, background: '#f8fafc' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 6 }}>灌溉方式</label>
                    <div className="flex gap-3">
                      {EXEC_OPTIONS.map(([v, l]) => (
                        <button
                          key={v}
                          onClick={() => setField('executionMode', v)}
                          className="flex-1 py-2 rounded-xl"
                          style={{
                            border: `1px solid ${form.executionMode === v ? '#16a34a' : '#e2e8f0'}`,
                            background: form.executionMode === v ? '#f0fdf4' : '#f8fafc',
                            color: form.executionMode === v ? '#16a34a' : '#64748b',
                            fontSize: 13,
                          }}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              ) : (
                <section>
                  <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>ETc 参数</h3>
                  <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>根据ETc累计缺水量和有效降雨计算补水量</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'ET缺水阈值 (mm)', key: 'etDeficitThreshold' as const },
                      { label: '有效降雨系数', key: 'rainfallOffset' as const },
                      { label: '补水比例', key: 'replenishRatio' as const },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</label>
                        <input
                          type="number" step={0.1}
                          value={form[key]}
                          onChange={e => setField(key, Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl outline-none"
                          style={{ border: '1px solid #e2e8f0', fontSize: 13, background: '#f8fafc' }}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Common constraints */}
              <section>
                <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>约束条件</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>最短触发间隔 (h)</label>
                    <input
                      type="number" min={1}
                      value={form.minInterval}
                      onChange={e => setField('minInterval', Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 14, background: '#f8fafc' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>单次最长时长 (min)</label>
                    <input
                      type="number" min={10}
                      value={form.maxDuration}
                      onChange={e => setField('maxDuration', Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 14, background: '#f8fafc' }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {([
                    { key: 'rainLock' as const, label: '雨天锁定（降雨期间不触发策略）' },
                    { key: 'enabled' as const, label: '启用策略' },
                  ]).map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={form[key] as boolean}
                        onChange={e => setField(key, e.target.checked)}
                        id={key}
                      />
                      <label htmlFor={key} style={{ fontSize: 14, color: '#374151' }}>{label}</label>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 14 }}>取消</button>
              <button onClick={saveStrategy} className="flex-1 py-3 rounded-xl" style={{ background: '#8b5cf6', color: '#ffffff', fontSize: 14 }}>
                {editingId ? '保存修改' : '创建策略'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 shadow-2xl" style={{ background: '#ffffff', width: 360 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: '#fef2f2' }}>
                <AlertTriangle size={24} color="#ef4444" />
              </div>
              <div>
                <div style={{ color: '#0f172a', fontSize: 16, fontWeight: 600 }}>确认删除策略？</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>删除后将无法恢复</div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 14 }}>取消</button>
              <button onClick={() => deleteStrategy(deleteConfirm)} className="flex-1 py-2.5 rounded-xl" style={{ background: '#ef4444', color: '#ffffff', fontSize: 14 }}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
