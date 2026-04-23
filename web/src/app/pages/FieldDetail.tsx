import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft, Droplets, Thermometer, Gauge, Activity, Leaf, CloudRain,
  Clock, CheckCircle, AlertTriangle, Cpu, Edit3, Map, TrendingUp
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../context/AppContext';

const ZONE_STATUS_COLORS: Record<string, string> = { idle: '#94a3b8', running: '#22c55e', alarm: '#ef4444' };
const ZONE_STATUS_LABELS: Record<string, string> = { idle: '待机', running: '运行中', alarm: '告警' };
const STATUS_COLORS: Record<string, string> = { normal: '#22c55e', warning: '#f59e0b', alarm: '#ef4444' };
const STATUS_LABELS: Record<string, string> = { normal: '正常', warning: '预警', alarm: '告警' };

const soilTrendData = [
  { t: '00:00', v: 72 }, { t: '04:00', v: 70 }, { t: '08:00', v: 67 },
  { t: '12:00', v: 64 }, { t: '16:00', v: 61 }, { t: '20:00', v: 65 }, { t: '24:00', v: 68 },
];

function InfoCard({ label, value, unit, icon: Icon, color = '#16a34a', sub }: {
  label: string; value: string | number; unit?: string; icon: any; color?: string; sub?: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} color={color} />
        <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ color: '#94a3b8', fontSize: 12 }}>{unit}</span>}
      </div>
      {sub && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function FieldDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fields, devices, plans, strategies } = useApp();

  const field = fields.find(f => f.id === id);
  if (!field) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: '#94a3b8' }}>
        <p style={{ fontSize: 16 }}>地块不存在</p>
        <button onClick={() => navigate('/field-map')} style={{ color: '#16a34a', fontSize: 14, marginTop: 8 }}>返回地图</button>
      </div>
    );
  }

  const fieldDevices = devices.filter(d => d.fieldId === field.id || field.zones.some(z => z.id === d.zoneId));
  const fieldPlans = plans.filter(p => p.fieldId === field.id);
  const fieldStrategies = strategies.filter(s => s.fieldId === field.id);
  const soilProgress = Math.min(100, Math.max(0, field.soilMoisture));
  const moistureColor = field.soilMoisture < 40 ? '#ef4444' : field.soilMoisture < 55 ? '#f59e0b' : '#22c55e';

  return (
    <div className="flex flex-col h-full overflow-auto" style={{ background: '#f0f4f8' }}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/field-map')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 13 }}
          >
            <ArrowLeft size={16} /> 返回地图
          </button>
          <div className="h-5 w-px" style={{ background: '#e2e8f0' }} />
          <div>
            <div className="flex items-center gap-3">
              <h1 style={{ color: '#0f172a', fontSize: 20, fontWeight: 700 }}>{field.name}</h1>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>{field.code}</span>
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: STATUS_COLORS[field.status] + '20', color: STATUS_COLORS[field.status], fontWeight: 500 }}
              >
                {STATUS_LABELS[field.status]}
              </span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
              {field.crop} · {field.growthStage} · {field.area} ha · 上次灌溉：{field.lastIrrigation}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => navigate('/field-map')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: '#eff6ff', color: '#3b82f6', fontSize: 13 }}
            >
              <Map size={16} /> 地图编辑
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Droplets size={16} color={moistureColor} />
            <span style={{ fontSize: 13, color: '#64748b' }}>土壤湿度</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: moistureColor }}>{field.soilMoisture}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} color="#3b82f6" />
            <span style={{ fontSize: 13, color: '#64748b' }}>建议灌溉</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#3b82f6' }}>{field.recommendedDuration} 分钟</span>
          </div>
          <div className="flex items-center gap-2">
            <CloudRain size={16} color="#60a5fa" />
            <span style={{ fontSize: 13, color: '#64748b' }}>今日降雨</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{field.rainfall24h} mm</span>
          </div>
          <div className="flex items-center gap-2">
            <Leaf size={16} color="#16a34a" />
            <span style={{ fontSize: 13, color: '#64748b' }}>ETc</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>{field.etc} mm/d</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 flex flex-col gap-5">
        {/* Row 1: Sensor metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <InfoCard icon={Droplets} label="土壤湿度" value={field.soilMoisture} unit="%" color={moistureColor} sub="体积含水率" />
          <InfoCard icon={Thermometer} label="土壤温度" value={field.soilTemperature} unit="°C" color="#f59e0b" sub="20cm深度" />
          <InfoCard icon={Activity} label="瞬时流量" value={field.flowRate} unit="m³/h" color="#0ea5e9" sub="主管道" />
          <InfoCard icon={Gauge} label="管道压力" value={field.pressure} unit="MPa" color="#8b5cf6" sub="工作压力" />
          <InfoCard icon={Leaf} label="ETc" value={field.etc} unit="mm/d" color="#16a34a" sub={`Kc=${field.kc}`} />
        </div>

        {/* Row 2: Charts + ET info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Soil moisture trend */}
          <div className="lg:col-span-2 rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>今日土壤湿度变化</h3>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>更新时间：10分钟前</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={soilTrendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis domain={[40, 90]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}
                  formatter={(v: any) => [`${v}%`, '土壤湿度']}
                />
                {/* Threshold line at 55% */}
                <Area type="monotone" dataKey="v" stroke={moistureColor} fill={`${moistureColor}20`} strokeWidth={2} name="土壤湿度" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="rounded-full" style={{ width: 8, height: 8, background: '#f59e0b' }} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>预警阈值 55%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="rounded-full" style={{ width: 8, height: 8, background: '#ef4444' }} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>告警阈值 40%</span>
              </div>
            </div>
          </div>

          {/* ET water balance */}
          <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>ET 水量平衡</h3>
            <div className="flex flex-col gap-4">
              {[
                { label: 'ET0（参考蒸散）', value: `${field.et0} mm/d`, color: '#0ea5e9', w: (field.et0 / 6) * 100 },
                { label: `ETc（作物需水）Kc=${field.kc}`, value: `${field.etc} mm/d`, color: '#16a34a', w: (field.etc / 6) * 100 },
                { label: '有效降雨', value: `${field.rainfall24h} mm`, color: '#60a5fa', w: Math.max(2, (field.rainfall24h / 10) * 100) },
                { label: '灌溉补水量', value: `${(field.etc - field.rainfall24h * 0.8).toFixed(1)} mm`, color: '#f59e0b', w: ((field.etc - field.rainfall24h * 0.8) / 6) * 100 },
              ].map(({ label, value, color, w }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{value}</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#f1f5f9' }}>
                    <div className="rounded-full h-full transition-all" style={{ width: `${Math.min(100, w)}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b', fontSize: 12 }}>Kc 更新时间</span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{field.kcUpdateTime}</span>
            </div>
          </div>
        </div>

        {/* Row 3: Zones */}
        <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>分区/站点状态</h3>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{field.zones.length} 个分区</span>
          </div>
          {field.zones.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#94a3b8' }}>
              <p>该地块暂无分区，请前往地图页创建分区</p>
              <button onClick={() => navigate('/field-map')} style={{ color: '#16a34a', fontSize: 14, marginTop: 8 }} className="flex items-center gap-1 mx-auto">
                前往地图 <ArrowLeft size={14} className="rotate-180" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {field.zones.map(zone => {
                const zoneDev = devices.filter(d => d.zoneId === zone.id);
                return (
                  <div
                    key={zone.id}
                    className="p-4 rounded-xl"
                    style={{ border: `1px solid ${ZONE_STATUS_COLORS[zone.status]}40`, background: `${ZONE_STATUS_COLORS[zone.status]}08` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span style={{ color: '#0f172a', fontSize: 14, fontWeight: 600 }}>{zone.name}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: ZONE_STATUS_COLORS[zone.status] + '20', color: ZONE_STATUS_COLORS[zone.status] }}
                      >
                        {ZONE_STATUS_LABELS[zone.status]}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        ['站点号', zone.stationNo],
                        ['灌水时长', `${zone.duration} min`],
                        ['土壤湿度', `${zone.soilMoisture}%`],
                        ['设备数', `${zone.deviceIds.length} 台`],
                      ].map(([l, v]) => (
                        <div key={l}>
                          <div style={{ color: '#94a3b8', fontSize: 11 }}>{l}</div>
                          <div style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>土壤湿度</span>
                        <span style={{ color: '#374151', fontSize: 11 }}>{zone.soilMoisture}%</span>
                      </div>
                      <div className="rounded-full overflow-hidden" style={{ height: 5, background: '#f1f5f9' }}>
                        <div
                          className="rounded-full h-full"
                          style={{
                            width: `${zone.soilMoisture}%`,
                            background: zone.soilMoisture < 40 ? '#ef4444' : zone.soilMoisture < 55 ? '#f59e0b' : '#22c55e'
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {zoneDev.map(d => (
                        <div key={d.id} className="flex items-center gap-2">
                          <div className="rounded-full shrink-0" style={{ width: 6, height: 6, background: d.status === 'online' ? '#22c55e' : d.status === 'alarm' ? '#ef4444' : '#94a3b8' }} />
                          <span style={{ color: '#64748b', fontSize: 11 }} className="truncate">{d.name}</span>
                          <span style={{ color: '#94a3b8', fontSize: 10, marginLeft: 'auto' }}>{d.model}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Row 4: Related plans and strategies */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>关联轮灌计划</h3>
              <button onClick={() => navigate('/irrigation-plan')} style={{ color: '#3b82f6', fontSize: 12 }}>管理计划</button>
            </div>
            {fieldPlans.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>暂无计划</p>
            ) : (
              <div className="flex flex-col gap-2">
                {fieldPlans.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Clock size={18} color={p.enabled ? '#16a34a' : '#94a3b8'} />
                    <div className="flex-1">
                      <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{p.startTime} · {p.zoneCount}区 · {p.totalDuration}分钟</div>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: p.enabled ? '#f0fdf4' : '#f8fafc', color: p.enabled ? '#16a34a' : '#94a3b8' }}
                    >
                      {p.enabled ? '启用' : '停用'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>关联自动策略</h3>
              <button onClick={() => navigate('/auto-strategy')} style={{ color: '#3b82f6', fontSize: 12 }}>管理策略</button>
            </div>
            {fieldStrategies.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>暂无策略</p>
            ) : (
              <div className="flex flex-col gap-2">
                {fieldStrategies.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <TrendingUp size={18} color={s.enabled ? '#8b5cf6' : '#94a3b8'} />
                    <div className="flex-1">
                      <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>
                        {s.type === 'threshold' ? `阈值 ${s.moistureLow}%~${s.moistureRestore}%` : `ETc缺水 >=${s.etDeficitThreshold}mm`}
                        {' · '}{s.mode === 'suggest' ? '建议' : s.mode === 'confirm' ? '确认后执行' : '自动'}
                      </div>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: s.enabled ? '#f5f3ff' : '#f8fafc', color: s.enabled ? '#8b5cf6' : '#94a3b8' }}
                    >
                      {s.enabled ? '启用' : '停用'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
