import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  CloudRain,
  Cpu,
  Droplets,
  Leaf,
  RefreshCw,
  TrendingUp,
  Waves,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import {
  etHistory,
  rainfallHistory,
  soilMoistureHistory,
} from '../data/mockData';
import {
  buildDashboardSnapshot,
  buildDecisionSummary,
  buildDuePlans,
  buildFieldRisks,
  buildSensorOverview,
  buildStrategyState,
  buildSupplyOverview,
  buildWeatherOverview,
} from '../data/workspaceMock';

const STATUS_COLORS = { normal: '#22c55e', warning: '#f59e0b', alarm: '#ef4444' };
const STATUS_LABELS = { normal: '正常', warning: '预警', alarm: '告警' };
const FIELD_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#8b5cf6'];
const ZONE_STATUS_COLORS: Record<string, string> = { idle: '#94a3b8', running: '#22c55e', alarm: '#ef4444' };
const SVG_W = 900;
const SVG_H = 520;

function polygonToStr(pts: [number, number][]) {
  return pts.map((p) => p.join(',')).join(' ');
}

function InsightCard({
  title,
  chip,
  hero,
  sub,
  children,
}: {
  title: string;
  chip: string;
  hero: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className="rounded-2xl p-5"
      style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>{title}</h3>
        <span
          className="px-2.5 py-1 rounded-full"
          style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600 }}
        >
          {chip}
        </span>
      </div>
      <div className="mb-4">
        <div style={{ color: '#0f172a', fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{hero}</div>
        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{sub}</div>
      </div>
      {children}
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#f8fafc' }}>
      <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function PanelTitle({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>{title}</h3>
      {action && (
        <button
          onClick={onClick}
          style={{ color: '#2563eb', fontSize: 12, fontWeight: 500 }}
          className="flex items-center gap-1"
        >
          {action} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

export function Overview() {
  const { fields, plans, strategies, devices } = useApp();
  const navigate = useNavigate();
  const [refreshed, setRefreshed] = useState(false);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  const dashboard = buildDashboardSnapshot(fields, devices);
  const fieldRisks = buildFieldRisks(fields);
  const duePlans = buildDuePlans(fields, plans);
  const decision = buildDecisionSummary(fieldRisks, duePlans, strategies);
  const weather = buildWeatherOverview(fields);
  const sensorOverview = buildSensorOverview(fields, devices);
  const supplyOverview = buildSupplyOverview(devices, duePlans);
  const strategyState = buildStrategyState(strategies);

  return (
    <div className="flex flex-col h-full overflow-auto" style={{ background: '#f0f4f8' }}>
      <div className="px-6 pt-6 pb-4" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ color: '#0f172a', fontSize: 22, fontWeight: 700 }}>灌溉总览</h1>
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
              {dateStr} · {timeStr} · 当前基于模拟业务数据运行
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dashboard.attentionFields > 0 && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
              >
                <AlertTriangle size={16} color="#ef4444" />
                <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
                  {dashboard.attentionFields} 个关注地块
                </span>
              </div>
            )}
            <button
              onClick={() => {
                setRefreshed(true);
                setTimeout(() => setRefreshed(false), 1200);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontSize: 13 }}
            >
              <RefreshCw size={14} className={refreshed ? 'animate-spin' : ''} />
              刷新态势
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-5">
        <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <InsightCard
            title="天气与雨量"
            chip="天气影响"
            hero={`${weather.next24hRainMm.toFixed(1)} mm`}
            sub="未来 24 小时预计降雨"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="今日累计雨量" value={`${weather.todayRainMm.toFixed(1)} mm`} />
              <MiniMetric label="降雨概率" value={`${weather.rainProbability}%`} />
            </div>
            <div className="mt-4 flex items-center gap-2" style={{ color: '#64748b', fontSize: 12 }}>
              <CloudRain size={14} color="#0ea5e9" />
              {weather.recommendation}
            </div>
          </InsightCard>

          <InsightCard
            title="土壤与传感"
            chip="传感聚合"
            hero={`${sensorOverview.averageSoilMoisture.toFixed(0)}%`}
            sub="全场平均土壤湿度"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric
                label="最低湿度地块"
                value={
                  sensorOverview.driestField
                    ? `${sensorOverview.driestField.name} · ${sensorOverview.driestField.soilMoisture}%`
                    : '暂无'
                }
              />
              <MiniMetric label="链路异常" value={`${sensorOverview.connectivityAlerts} 项`} />
            </div>
            <div className="mt-4 flex items-center gap-2" style={{ color: '#64748b', fontSize: 12 }}>
              <Droplets size={14} color="#16a34a" />
              重点关注南区低湿度与弱信号点位
            </div>
          </InsightCard>

          <InsightCard
            title="ET / 水量平衡"
            chip="蒸散趋势"
            hero={`${(dashboard.averageEtc - weather.todayRainMm * 0.8).toFixed(1)} mm`}
            sub="平均净需水量"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="平均 ET0" value={`${dashboard.averageEt0.toFixed(1)} mm`} />
              <MiniMetric label="平均 ETc" value={`${dashboard.averageEtc.toFixed(1)} mm`} />
            </div>
            <div className="mt-4 flex items-center gap-2" style={{ color: '#64748b', fontSize: 12 }}>
              <Leaf size={14} color="#16a34a" />
              ETc 较高地块优先按作物阶段补水
            </div>
          </InsightCard>

          <InsightCard
            title="供水执行健康"
            chip="系统健康"
            hero={`${supplyOverview.scheduledFlowM3h.toFixed(1)} m³/h`}
            sub="近期待执行总流量"
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="在线设备" value={`${dashboard.onlineDevices}/${dashboard.totalDevices}`} />
              <MiniMetric label="系统风险" value={`${supplyOverview.systemRiskCount} 项`} />
            </div>
            <div className="mt-4 flex items-center gap-4" style={{ color: '#64748b', fontSize: 12 }}>
              <span>自动策略 {strategyState.autoEnabled}</span>
              <span>运行分区 {dashboard.runningZones}</span>
              <span>平均电量 {dashboard.averageBatteryLevel.toFixed(0)}%</span>
            </div>
          </InsightCard>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] 2xl:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)_minmax(260px,1fr)] gap-4 items-start xl:items-stretch">
          <div className="order-3 xl:col-span-2 2xl:order-1 2xl:col-span-1 flex flex-col gap-4">
            <article
              className="rounded-2xl p-3"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <PanelTitle title="环境趋势" />
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>近 7 日降雨量</div>
                  <ResponsiveContainer width="100%" height={90}>
                    <BarChart data={rainfallHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip formatter={(value: number) => [`${value} mm`, '降雨量']} />
                      <Bar dataKey="rain" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>今日土壤湿度趋势</div>
                  <ResponsiveContainer width="100%" height={90}>
                    <AreaChart data={soilMoistureHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis domain={[20, 90]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="f1" stroke="#22c55e" fill="#dcfce7" strokeWidth={2} name="北区" />
                      <Area type="monotone" dataKey="f2" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} name="东区" />
                      <Area type="monotone" dataKey="f3" stroke="#ef4444" fill="#fee2e2" strokeWidth={2} name="南区" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>ET0 / ETc 趋势</div>
                  <ResponsiveContainer width="100%" height={90}>
                    <LineChart data={etHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis domain={[2, 6]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="et0" stroke="#0ea5e9" strokeWidth={2} dot={false} name="ET0" />
                      <Line type="monotone" dataKey="etc_avg" stroke="#16a34a" strokeWidth={2} dot={false} name="ETc均值" />
                      <Legend iconType="line" iconSize={12} wrapperStyle={{ fontSize: 11 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </article>

            <article
              className="rounded-2xl p-3 2xl:flex-1"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <PanelTitle title="计划与策略概况" />
              <div className="flex flex-col gap-3">
                <div className="rounded-xl p-4" style={{ background: '#f8fafc' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Waves size={14} color="#0ea5e9" />
                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>轮灌计划</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {duePlans.length} 个启用计划，今日预计覆盖 {dashboard.runningZones + duePlans.length} 个分区动作
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: '#f8fafc' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={14} color="#16a34a" />
                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>自动策略</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {strategyState.enabled} 个启用，其中 {strategyState.autoEnabled} 个自动执行，{strategyState.rainLocked} 个带雨锁
                  </div>
                </div>
                <div className="rounded-xl p-4" style={{ background: '#f8fafc' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu size={14} color="#8b5cf6" />
                    <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>设备健康</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    离线 {supplyOverview.offlineDeviceCount} 台，低电量 {supplyOverview.lowBatteryCount} 台，需巡检 {supplyOverview.alarmDeviceCount} 项
                  </div>
                </div>
              </div>
            </article>
          </div>

          <article
            className="order-1 xl:order-1 2xl:order-2 rounded-2xl overflow-hidden xl:h-full"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>地块态势地图</h3>
                <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                  地块状态主视图，分区运行和告警作为辅助图层
                </p>
              </div>
              <button
                onClick={() => navigate('/field-map')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ background: '#16a34a', color: '#ffffff', fontSize: 12 }}
              >
                前往地图 <ArrowRight size={12} />
              </button>
            </div>
            <div style={{ minHeight: 440, height: 'calc(100% - 53px)' }}>
              <div
                className="relative overflow-hidden flex items-center justify-center"
                style={{ minHeight: 440, height: '100%' }}
                ref={mapContainerRef}
              >
                <svg
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  className="w-full h-full"
                  style={{
                    background: 'linear-gradient(160deg, #2f5d2b 0%, #45723f 52%, #3d6a36 100%)',
                    display: 'block',
                    margin: '0 auto',
                  }}
                >
                  <defs>
                    <pattern id="overview-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width={SVG_W} height={SVG_H} fill="url(#overview-grid)" />

                  {fields.map((field, idx) => {
                    const color = FIELD_COLORS[idx % FIELD_COLORS.length];
                    const isHovered = hoveredFieldId === field.id;
                    const runningZones = field.zones.filter((zone) => zone.status === 'running');
                    const alarmZones = field.zones.filter((zone) => zone.status === 'alarm');

                    return (
                      <g key={field.id}>
                        <polygon
                          points={polygonToStr(field.polygon)}
                          fill={`${color}${isHovered ? '58' : '24'}`}
                          stroke={STATUS_COLORS[field.status]}
                          strokeWidth={isHovered ? 3 : 1.5}
                          strokeDasharray={isHovered ? 'none' : '8,3'}
                          style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                          onClick={() => navigate(`/field/${field.id}`)}
                          onMouseEnter={(event) => {
                            setHoveredFieldId(field.id);
                            const rect = mapContainerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setTooltipPos({ x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 10 });
                            }
                          }}
                          onMouseMove={(event) => {
                            const rect = mapContainerRef.current?.getBoundingClientRect();
                            if (rect) {
                              setTooltipPos({ x: event.clientX - rect.left + 14, y: event.clientY - rect.top - 10 });
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredFieldId(null);
                            setTooltipPos(null);
                          }}
                        />

                        {field.zones.map((zone) => (
                          <g key={zone.id}>
                            <polygon
                              points={polygonToStr(zone.polygon)}
                              fill={zone.status === 'running' ? `${color}20` : 'transparent'}
                              stroke={ZONE_STATUS_COLORS[zone.status]}
                              strokeWidth={zone.status !== 'idle' ? 1.4 : 0.9}
                              strokeDasharray="4,2"
                              style={{ pointerEvents: 'none' }}
                            />
                            <text
                              x={zone.center[0]}
                              y={zone.center[1]}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="rgba(255,255,255,0.88)"
                              fontSize={9}
                              style={{ pointerEvents: 'none', fontWeight: 500 }}
                            >
                              {zone.name}
                            </text>
                          </g>
                        ))}

                        <circle
                          cx={field.center[0]}
                          cy={field.center[1]}
                          r={isHovered ? 12 : 10}
                          fill={STATUS_COLORS[field.status]}
                          stroke="white"
                          strokeWidth="2.5"
                          onClick={() => navigate(`/field/${field.id}`)}
                          style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                        />
                        <text
                          x={field.center[0]}
                          y={field.center[1] + 22}
                          textAnchor="middle"
                          fill="white"
                          fontSize={11}
                          fontWeight="600"
                          style={{ pointerEvents: 'none', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
                        >
                          {field.name}
                        </text>

                        {(runningZones.length > 0 || alarmZones.length > 0) && (
                          <g style={{ pointerEvents: 'none' }}>
                            <rect
                              x={field.center[0] - 24}
                              y={field.center[1] + 29}
                              width={48}
                              height={13}
                              rx={6}
                              fill={alarmZones.length > 0 ? '#ef4444' : '#22c55e'}
                              opacity={0.92}
                            />
                            <text
                              x={field.center[0]}
                              y={field.center[1] + 36}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="white"
                              fontSize={8}
                              fontWeight="700"
                            >
                              {alarmZones.length > 0 ? `${alarmZones.length}区告警` : `${runningZones.length}区运行`}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {devices.filter((device) => device.fieldId && device.zoneId).map((device) => (
                    <circle
                      key={device.id}
                      cx={device.position[0]}
                      cy={device.position[1]}
                      r={4}
                      fill={device.status === 'online' ? '#22c55e' : device.status === 'alarm' ? '#ef4444' : '#94a3b8'}
                      stroke="rgba(255,255,255,0.88)"
                      strokeWidth="1.5"
                      style={{ pointerEvents: 'none' }}
                    />
                  ))}
                </svg>

                {hoveredFieldId && tooltipPos && (() => {
                  const field = fields.find((item) => item.id === hoveredFieldId);
                  if (!field) return null;
                  return (
                    <div
                      className="absolute rounded-2xl p-4 pointer-events-none"
                      style={{
                        left: tooltipPos.x,
                        top: Math.max(8, tooltipPos.y),
                        width: 208,
                        background: 'rgba(11, 20, 35, 0.94)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 18px 40px rgba(15,23,42,0.28)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[field.status] }} />
                        <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 600 }}>{field.name}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between">
                          <span style={{ color: '#64748b', fontSize: 10 }}>作物 / 生育期</span>
                          <span style={{ color: '#cbd5e1', fontSize: 10 }}>{field.crop} · {field.growthStage}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: '#64748b', fontSize: 10 }}>土壤湿度</span>
                          <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>{field.soilMoisture}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: '#64748b', fontSize: 10 }}>建议灌溉</span>
                          <span style={{ color: '#cbd5e1', fontSize: 10 }}>{field.recommendedDuration} 分钟</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: '#64748b', fontSize: 10 }}>ETc</span>
                          <span style={{ color: '#cbd5e1', fontSize: 10 }}>{field.etc} mm/d</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </article>

          <div className="order-2 xl:order-2 2xl:order-3 flex flex-col gap-4 xl:h-full">
            <article
              className="rounded-2xl p-3"
              style={{
                background:
                  decision.level === 'high'
                    ? 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)'
                    : decision.level === 'medium'
                      ? 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)'
                      : '#ffffff',
                border: `1px solid ${
                  decision.level === 'high' ? '#fdba74' : decision.level === 'medium' ? '#bfdbfe' : '#e2e8f0'
                }`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <PanelTitle title="今日灌溉决策" />
              <div style={{ color: '#0f172a', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{decision.title}</div>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>{decision.reason}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <MiniMetric label="待执行计划" value={`${duePlans.length} 个`} />
                <MiniMetric label="预计时长" value={`${decision.durationMinutes} 分钟`} />
                <MiniMetric label="自动策略" value={`${strategyState.autoEnabled} 个`} />
                <MiniMetric label="雨天锁定" value={`${strategyState.rainLocked} 个`} />
              </div>
            </article>

            <div className="grid grid-cols-1 gap-4 xl:flex-1">
              <article
                className="rounded-2xl p-3"
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              >
                <PanelTitle title="风险列表" action="查看地块" onClick={() => navigate('/field-map')} />
                <div className="flex flex-col gap-3">
                  {fieldRisks.slice(0, 4).map((risk) => (
                    <button
                      key={risk.id}
                      onClick={() => navigate(`/field/${risk.id}`)}
                      className="text-left rounded-xl p-3"
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{risk.name}</span>
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{
                            background: risk.riskLevel === '高' ? '#fef2f2' : risk.riskLevel === '中' ? '#fffbeb' : '#f0fdf4',
                            color: risk.riskLevel === '高' ? '#ef4444' : risk.riskLevel === '中' ? '#d97706' : '#16a34a',
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {risk.riskLevel}
                        </span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{risk.riskReason}</div>
                      <div className="flex items-center gap-3 mt-2" style={{ color: '#94a3b8', fontSize: 11 }}>
                        <span>湿度 {risk.soilMoisture}%</span>
                        <span>ETc {risk.etc} mm/d</span>
                      </div>
                    </button>
                  ))}
                </div>
              </article>

              <div className="xl:flex-1" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
