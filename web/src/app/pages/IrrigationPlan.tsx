import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Plus, Clock, Edit3, Trash2, Play, ChevronDown, ChevronUp, AlertTriangle,
  X, CalendarClock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Plan, PlanZone } from '../data/mockData';

type CycleType = 'daily' | 'weekly' | 'interval';
type ExecMode = 'duration' | 'quantity';
type PlanMode = 'manual' | 'confirm' | 'auto';
type RainPolicy = 'skip' | 'continue' | 'delay';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MODE_LABELS: Record<PlanMode, string> = { manual: '手动执行', confirm: '确认后执行', auto: '允许策略执行' };
const MODE_COLORS: Record<PlanMode, string> = { manual: '#64748b', confirm: '#f59e0b', auto: '#16a34a' };
const RAIN_LABELS: Record<RainPolicy, string> = { skip: '雨天跳过', continue: '雨天继续', delay: '雨天延迟' };

function Badge({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: bg, color }}>{children}</span>
  );
}

interface PlanFormState {
  name: string;
  fieldId: string;
  mode: PlanMode;
  cycle: CycleType;
  cycleInterval: number;
  weekdays: number[];
  startTime: string;
  executionMode: ExecMode;
  rainPolicy: RainPolicy;
  enabled: boolean;
  zones: PlanZone[];
  targetWater: string;
  irrigationEfficiencyRate: string;
  maxDurationPerZone: string;
  allowSplit: boolean;
}

const defaultForm = (): PlanFormState => ({
  name: '', fieldId: '', mode: 'confirm', cycle: 'daily', cycleInterval: 3,
  weekdays: [1, 3, 5], startTime: '06:00', executionMode: 'duration',
  rainPolicy: 'skip', enabled: true, zones: [],
  targetWater: '25', irrigationEfficiencyRate: '0.85', maxDurationPerZone: '60', allowSplit: false,
});

export function IrrigationPlan() {
  const { fields, plans, setPlans } = useApp();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanFormState>(defaultForm());
  const [executeConfirm, setExecuteConfirm] = useState<string | null>(null);

  const selectedField = fields.find(f => f.id === form.fieldId);

  const openCreate = () => {
    setForm(defaultForm());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      fieldId: plan.fieldId,
      mode: plan.mode,
      cycle: plan.cycle,
      cycleInterval: typeof plan.cycleValue === 'number' ? plan.cycleValue : 3,
      weekdays: Array.isArray(plan.cycleValue) ? plan.cycleValue as number[] : [1, 3, 5],
      startTime: plan.startTime,
      executionMode: plan.executionMode,
      rainPolicy: plan.rainPolicy,
      enabled: plan.enabled,
      zones: [...plan.zones],
      targetWater: String(plan.targetWater ?? '25'),
      irrigationEfficiencyRate: String(plan.irrigationEfficiencyRate ?? '0.85'),
      maxDurationPerZone: String(plan.maxDurationPerZone ?? '60'),
      allowSplit: plan.allowSplit ?? false,
    });
    setEditingId(plan.id);
    setShowForm(true);
  };

  const handleFieldChange = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    const zones: PlanZone[] = field?.zones.map((z, i) => ({
      zoneId: z.id, order: i + 1, duration: z.duration, enabled: true
    })) ?? [];
    setForm(prev => ({ ...prev, fieldId, zones }));
  };

  const savePlan = () => {
    if (!form.name || !form.fieldId) return;
    const field = fields.find(f => f.id === form.fieldId)!;
    const totalDuration = form.zones.filter(z => z.enabled).reduce((s, z) => s + z.duration, 0);
    const cycleValue = form.cycle === 'weekly' ? form.weekdays : form.cycle === 'interval' ? form.cycleInterval : undefined;

    const planData: Omit<Plan, 'id'> = {
      name: form.name,
      fieldId: form.fieldId,
      mode: form.mode,
      cycle: form.cycle,
      cycleValue,
      startTime: form.startTime,
      executionMode: form.executionMode,
      rainPolicy: form.rainPolicy,
      enabled: form.enabled,
      totalDuration,
      zoneCount: form.zones.filter(z => z.enabled).length,
      zones: form.zones,
      targetWater: form.executionMode === 'quantity' ? Number(form.targetWater) : undefined,
      irrigationEfficiencyRate: form.executionMode === 'quantity' ? Number(form.irrigationEfficiencyRate) : undefined,
      maxDurationPerZone: form.executionMode === 'quantity' ? Number(form.maxDurationPerZone) : undefined,
      allowSplit: form.executionMode === 'quantity' ? form.allowSplit : undefined,
    };

    if (editingId) {
      setPlans(prev => prev.map(p => p.id === editingId ? { ...planData, id: editingId } : p));
    } else {
      setPlans(prev => [...prev, { ...planData, id: `p${Date.now()}` }]);
    }
    setShowForm(false);
  };

  const deletePlan = (id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
    setDeleteConfirm(null);
  };

  const toggleMode = (id: string) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== id) return p;
      const modes: PlanMode[] = ['manual', 'confirm', 'auto'];
      const next = modes[(modes.indexOf(p.mode) + 1) % 3];
      return { ...p, mode: next };
    }));
  };

  const toggleEnabled = (id: string) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const getFieldName = (fieldId: string) => fields.find(f => f.id === fieldId)?.name ?? '—';

  const updateZone = (zoneId: string, updates: Partial<PlanZone>) => {
    setForm(prev => ({ ...prev, zones: prev.zones.map(z => z.zoneId === zoneId ? { ...z, ...updates } : z) }));
  };

  const moveZone = (zoneId: string, dir: -1 | 1) => {
    setForm(prev => {
      const zones = [...prev.zones];
      const idx = zones.findIndex(z => z.zoneId === zoneId);
      const target = idx + dir;
      if (target < 0 || target >= zones.length) return prev;
      [zones[idx], zones[target]] = [zones[target], zones[idx]];
      return { ...prev, zones: zones.map((z, i) => ({ ...z, order: i + 1 })) };
    });
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#f0f4f8' }}>
      {/* List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#0f172a', fontSize: 20, fontWeight: 700 }}>轮灌计划</h1>
              <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>{plans.length} 个计划 · {plans.filter(p => p.enabled).length} 个启用</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
              style={{ background: '#16a34a', color: '#ffffff', fontSize: 14 }}
            >
              <Plus size={18} /> 新增计划
            </button>
          </div>
        </div>

        {/* Plan list */}
        <div className="flex-1 overflow-y-auto p-6">
          {plans.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: '#94a3b8' }}>
              <CalendarClock size={48} className="mb-4 opacity-40" />
              <p style={{ fontSize: 16 }}>暂无轮灌计划</p>
              <button onClick={openCreate} style={{ color: '#16a34a', marginTop: 8, fontSize: 14 }}>+ 新增第一个计划</button>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {plans.map(plan => (
              <div
                key={plan.id}
                className="rounded-2xl overflow-hidden flex flex-col"
                style={{
                  background: '#ffffff',
                  border: `1.5px solid ${plan.enabled ? '#bbf7d0' : '#e2e8f0'}`,
                  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
                }}
              >
                {/* Card top color bar */}
                <div style={{ height: 4, background: plan.enabled ? `${MODE_COLORS[plan.mode]}` : '#e2e8f0' }} />

                {/* Card header */}
                <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <div className="flex items-start gap-3">
                    <div
                      className="flex items-center justify-center rounded-xl shrink-0"
                      style={{ width: 42, height: 42, background: plan.enabled ? '#f0fdf4' : '#f8fafc', border: `1px solid ${plan.enabled ? '#bbf7d0' : '#e2e8f0'}` }}
                    >
                      <CalendarClock size={22} color={plan.enabled ? '#16a34a' : '#94a3b8'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="truncate" style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>{plan.name}</h3>
                        {!plan.enabled && <Badge color="#94a3b8" bg="#f1f5f9">已停用</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge color={MODE_COLORS[plan.mode]} bg={`${MODE_COLORS[plan.mode]}18`}>
                          {MODE_LABELS[plan.mode]}
                        </Badge>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>📍 {getFieldName(plan.fieldId)}</span>
                      </div>
                    </div>
                    {/* Enable toggle */}
                    <button
                      onClick={() => toggleEnabled(plan.id)}
                      className="shrink-0 px-2.5 py-1 rounded-lg transition-all"
                      style={{
                        background: plan.enabled ? '#fef2f2' : '#f0fdf4',
                        border: `1px solid ${plan.enabled ? '#fecaca' : '#bbf7d0'}`,
                        color: plan.enabled ? '#ef4444' : '#16a34a',
                        fontSize: 11,
                      }}
                    >
                      {plan.enabled ? '停用' : '启用'}
                    </button>
                  </div>
                </div>

                {/* Card body: info grid */}
                <div className="px-5 py-3 grid grid-cols-2 gap-y-2.5 gap-x-4 flex-1">
                  {[
                    { label: '分区数量', value: `${plan.zoneCount} 个分区` },
                    { label: '总时长', value: `${plan.totalDuration} 分钟` },
                    { label: '开始时间', value: plan.startTime },
                    { label: '执行方式', value: plan.executionMode === 'duration' ? '按时长' : '定量灌溉' },
                    {
                      label: '周期',
                      value: plan.cycle === 'daily'
                        ? '每天'
                        : plan.cycle === 'weekly'
                        ? `每周${Array.isArray(plan.cycleValue) ? (plan.cycleValue as number[]).map(d => WEEKDAYS[d - 1]).join('/') : ''}`
                        : `间隔${plan.cycleValue}天`,
                    },
                    { label: '雨天策略', value: RAIN_LABELS[plan.rainPolicy] },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 1 }}>{label}</div>
                      <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Expanded zone list */}
                {expandedId === plan.id && (
                  <div className="mx-5 mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                    <div className="px-3 py-2" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b', fontSize: 12, fontWeight: 500 }}>分区轮灌顺序</span>
                    </div>
                    <div className="flex flex-col">
                      {plan.zones.map((pz, idx) => {
                        const zone = fields.flatMap(f => f.zones).find(z => z.id === pz.zoneId);
                        return (
                          <div
                            key={pz.zoneId}
                            className="flex items-center gap-3 px-3 py-2"
                            style={{ borderBottom: idx < plan.zones.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                          >
                            <span
                              className="flex items-center justify-center rounded-full shrink-0"
                              style={{ width: 22, height: 22, background: pz.enabled ? '#16a34a' : '#e2e8f0', color: pz.enabled ? '#ffffff' : '#94a3b8', fontSize: 11, fontWeight: 600 }}
                            >
                              {pz.order}
                            </span>
                            <span style={{ color: '#0f172a', fontSize: 13, flex: 1 }}>{zone?.name ?? pz.zoneId}</span>
                            <span style={{ color: '#64748b', fontSize: 12 }}>{pz.duration} 分钟</span>
                            <span
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{ background: pz.enabled ? '#f0fdf4' : '#f8fafc', color: pz.enabled ? '#16a34a' : '#94a3b8' }}
                            >
                              {pz.enabled ? '参与' : '跳过'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Card footer: actions */}
                <div
                  className="flex items-center gap-2 px-5 py-3"
                  style={{ borderTop: '1px solid #f1f5f9', background: '#fafafa' }}
                >
                  {plan.mode === 'manual' && plan.enabled && (
                    <button
                      onClick={() => setExecuteConfirm(plan.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                      style={{ background: '#16a34a', color: '#ffffff', fontSize: 12 }}
                    >
                      <Play size={13} /> 执行
                    </button>
                  )}
                  <button
                    onClick={() => toggleMode(plan.id)}
                    className="px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: '#f1f5f9', color: '#64748b', fontSize: 12 }}
                  >
                    切换模式
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
                    className="p-1.5 rounded-lg"
                    style={{ background: '#f1f5f9', color: '#64748b' }}
                  >
                    {expandedId === plan.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button onClick={() => openEdit(plan)} className="p-1.5 rounded-lg" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => setDeleteConfirm(plan.id)} className="p-1.5 rounded-lg" style={{ background: '#fef2f2', color: '#ef4444' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Panel (slide in from right) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowForm(false)} />
          <div
            className="flex flex-col overflow-hidden h-full"
            style={{ width: 520, background: '#ffffff', borderLeft: '1px solid #e2e8f0' }}
          >
            {/* Form header */}
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ color: '#0f172a', fontSize: 18, fontWeight: 600 }}>
                {editingId ? '编辑计划' : '新增轮灌计划'}
              </h2>
              <button onClick={() => setShowForm(false)}><X size={20} color="#64748b" /></button>
            </div>

            {/* Form body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* 基础信息 */}
              <section>
                <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>基础信息</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>计划名称 *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="请填写计划名"
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a', background: '#f8fafc' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>所属地块 *</label>
                    <select
                      value={form.fieldId}
                      onChange={e => handleFieldChange(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a', background: '#f8fafc' }}
                    >
                      <option value="">请选择地块</option>
                      {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    {form.fieldId && selectedField?.zones.length === 0 && (
                      <div className="mt-2 p-3 rounded-xl flex items-center gap-2" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <AlertTriangle size={16} color="#f59e0b" />
                        <span style={{ color: '#92400e', fontSize: 12 }}>该地块暂无分区，请先前往地图页创建分区</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* 执行配置 */}
              <section>
                <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>执行配置</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>执行周期</label>
                    <select
                      value={form.cycle}
                      onChange={e => setForm(p => ({ ...p, cycle: e.target.value as CycleType }))}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a', background: '#f8fafc' }}
                    >
                      <option value="daily">每天</option>
                      <option value="weekly">每周指定</option>
                      <option value="interval">间隔天数</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>开始时间</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a', background: '#f8fafc' }}
                    />
                  </div>
                </div>

                {form.cycle === 'weekly' && (
                  <div className="mt-3">
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 6 }}>执行星期</label>
                    <div className="flex gap-2">
                      {WEEKDAYS.map((d, i) => (
                        <button
                          key={i}
                          onClick={() => setForm(p => ({
                            ...p,
                            weekdays: p.weekdays.includes(i + 1)
                              ? p.weekdays.filter(x => x !== i + 1)
                              : [...p.weekdays, i + 1]
                          }))}
                          className="w-9 h-9 rounded-xl text-sm"
                          style={{
                            background: form.weekdays.includes(i + 1) ? '#16a34a' : '#f8fafc',
                            border: `1px solid ${form.weekdays.includes(i + 1) ? '#16a34a' : '#e2e8f0'}`,
                            color: form.weekdays.includes(i + 1) ? '#ffffff' : '#64748b',
                          }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {form.cycle === 'interval' && (
                  <div className="mt-3">
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>间隔天数</label>
                    <input
                      type="number" min={1} max={30}
                      value={form.cycleInterval}
                      onChange={e => setForm(p => ({ ...p, cycleInterval: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 14, color: '#0f172a', background: '#f8fafc' }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>执行模式</label>
                    <select
                      value={form.mode}
                      onChange={e => setForm(p => ({ ...p, mode: e.target.value as PlanMode }))}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', background: '#f8fafc' }}
                    >
                      <option value="manual">手动执行</option>
                      <option value="confirm">确认后执行</option>
                      <option value="auto">允许策略执行</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>执行方式</label>
                    <select
                      value={form.executionMode}
                      onChange={e => setForm(p => ({ ...p, executionMode: e.target.value as ExecMode }))}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', background: '#f8fafc' }}
                    >
                      <option value="duration">按时长</option>
                      <option value="quantity">定量灌溉</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>雨天策略</label>
                    <select
                      value={form.rainPolicy}
                      onChange={e => setForm(p => ({ ...p, rainPolicy: e.target.value as RainPolicy }))}
                      className="w-full px-3 py-2.5 rounded-xl outline-none"
                      style={{ border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', background: '#f8fafc' }}
                    >
                      <option value="skip">雨天跳过</option>
                      <option value="continue">雨天继续</option>
                      <option value="delay">雨天延迟</option>
                    </select>
                  </div>
                </div>

                {/* Quantity mode extra config */}
                {form.executionMode === 'quantity' && (
                  <div className="mt-3 p-4 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>定量灌溉参数</div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: '目标水量 (mm)', key: 'targetWater' },
                        { label: '灌溉效率', key: 'irrigationEfficiencyRate' },
                        { label: '单区最长时长 (min)', key: 'maxDurationPerZone' },
                      ].map(({ label, key }) => (
                        <div key={key}>
                          <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 3 }}>{label}</label>
                          <input
                            value={(form as any)[key]}
                            onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg outline-none"
                            style={{ border: '1px solid #e2e8f0', fontSize: 13, background: '#ffffff' }}
                          />
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          checked={form.allowSplit}
                          onChange={e => setForm(p => ({ ...p, allowSplit: e.target.checked }))}
                          id="allowSplit"
                        />
                        <label htmlFor="allowSplit" style={{ fontSize: 13, color: '#64748b' }}>允许拆分多轮执行</label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-3">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
                    id="planEnabled"
                  />
                  <label htmlFor="planEnabled" style={{ fontSize: 14, color: '#374151' }}>启用计划</label>
                </div>
              </section>

              {/* 分区配置 */}
              {form.fieldId && (
                <section>
                  <h3 style={{ color: '#0f172a', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>分区轮灌配置</h3>
                  {form.zones.length === 0 ? (
                    <div className="p-4 rounded-xl text-center" style={{ background: '#f8fafc', border: '1px dashed #e2e8f0' }}>
                      <p style={{ color: '#94a3b8', fontSize: 13 }}>所选地块暂无分区</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {form.zones.map((pz, idx) => {
                        const zone = selectedField?.zones.find(z => z.id === pz.zoneId);
                        return (
                          <div key={pz.zoneId} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <span
                              className="flex items-center justify-center rounded-full shrink-0"
                              style={{ width: 28, height: 28, background: '#e2e8f0', fontSize: 13, fontWeight: 600, color: '#64748b' }}
                            >
                              {pz.order}
                            </span>
                            <span style={{ color: '#0f172a', fontSize: 14, flex: 1 }}>{zone?.name ?? pz.zoneId}</span>
                            <input
                              type="number" min={1} max={300}
                              value={pz.duration}
                              onChange={e => updateZone(pz.zoneId, { duration: Number(e.target.value) })}
                              className="w-16 px-2 py-1 rounded-lg outline-none text-center"
                              style={{ border: '1px solid #e2e8f0', fontSize: 13 }}
                            />
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>min</span>
                            <button onClick={() => moveZone(pz.zoneId, -1)} disabled={idx === 0} style={{ color: idx === 0 ? '#e2e8f0' : '#64748b' }}>
                              <ChevronUp size={16} />
                            </button>
                            <button onClick={() => moveZone(pz.zoneId, 1)} disabled={idx === form.zones.length - 1} style={{ color: idx === form.zones.length - 1 ? '#e2e8f0' : '#64748b' }}>
                              <ChevronDown size={16} />
                            </button>
                            <button
                              onClick={() => updateZone(pz.zoneId, { enabled: !pz.enabled })}
                              className="px-2 py-1 rounded text-xs"
                              style={{
                                background: pz.enabled ? '#f0fdf4' : '#f8fafc',
                                color: pz.enabled ? '#16a34a' : '#94a3b8',
                                border: `1px solid ${pz.enabled ? '#bbf7d0' : '#e2e8f0'}`
                              }}
                            >
                              {pz.enabled ? '参与' : '跳过'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* Form footer */}
            <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 14 }}>取消</button>
              <button onClick={savePlan} className="flex-1 py-3 rounded-xl" style={{ background: '#16a34a', color: '#ffffff', fontSize: 14 }}>
                {editingId ? '保存修改' : '创建计划'}
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
                <div style={{ color: '#0f172a', fontSize: 16, fontWeight: 600 }}>确认删除计划？</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>删除后将无法恢复</div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 14 }}>取消</button>
              <button onClick={() => deletePlan(deleteConfirm)} className="flex-1 py-2.5 rounded-xl" style={{ background: '#ef4444', color: '#ffffff', fontSize: 14 }}>确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Execute confirm */}
      {executeConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 shadow-2xl" style={{ background: '#ffffff', width: 360 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: '#f0fdf4' }}>
                <Play size={24} color="#16a34a" />
              </div>
              <div>
                <div style={{ color: '#0f172a', fontSize: 16, fontWeight: 600 }}>确认立即执行？</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>{plans.find(p => p.id === executeConfirm)?.name}</div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setExecuteConfirm(null)} className="flex-1 py-2.5 rounded-xl" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 14 }}>取消</button>
              <button onClick={() => setExecuteConfirm(null)} className="flex-1 py-2.5 rounded-xl" style={{ background: '#16a34a', color: '#ffffff', fontSize: 14 }}>确认执行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}