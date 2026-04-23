import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Map, Plus, Layers, Move, Trash2, Edit3, Eye, ChevronRight,
  AlertTriangle, CheckCircle, Clock, Crosshair, X, Save, Cpu,
  ArrowRight, Info, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Field, Zone, Device } from '../data/mockData';

type MapMode = 'browse' | 'draw-field' | 'draw-zone' | 'move-device';
type DrawStep = 'drawing' | 'info' | 'devices';

const FIELD_COLORS = ['#16a34a', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const ZONE_ALPHA = '60';
const SVG_W = 900;
const SVG_H = 520;

const STATUS_COLORS: Record<string, string> = { normal: '#22c55e', warning: '#f59e0b', alarm: '#ef4444' };
const ZONE_STATUS_COLORS: Record<string, string> = { idle: '#94a3b8', running: '#22c55e', alarm: '#ef4444' };

function polygonToStr(pts: [number, number][]) {
  return pts.map(p => p.join(',')).join(' ');
}

function centroid(pts: [number, number][]): [number, number] {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [x, y];
}

export function FieldMap() {
  const { fields, setFields, devices, setDevices } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState<MapMode>('browse');
  const [drawStep, setDrawStep] = useState<DrawStep>('drawing');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [mousePos, setMousePos] = useState<[number, number] | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // New field form
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldCode, setNewFieldCode] = useState('');
  const [newFieldCrop, setNewFieldCrop] = useState('玉米');
  const [newFieldStage, setNewFieldStage] = useState('苗期');
  const [newFieldKc, setNewFieldKc] = useState('1.0');
  const [newFieldEff, setNewFieldEff] = useState('0.85');

  // New zone form
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneStation, setNewZoneStation] = useState('');
  const [newZoneDeviceType, setNewZoneDeviceType] = useState('valve');

  const svgRef = useRef<SVGSVGElement>(null);

  const selectedField = fields.find(f => f.id === selectedFieldId) || null;
  const selectedZone = selectedField?.zones.find(z => z.id === selectedZoneId) || null;

  const getSVGCoords = useCallback((e: React.MouseEvent<SVGElement>): [number, number] => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SVG_W;
    const y = ((e.clientY - rect.top) / rect.height) * SVG_H;
    return [Math.round(x), Math.round(y)];
  }, []);

  const handleSVGClick = (e: React.MouseEvent<SVGElement>) => {
    if (mode === 'browse') return;
    if (mode === 'draw-field' || mode === 'draw-zone') {
      const pt = getSVGCoords(e);
      setDrawPoints(prev => [...prev, pt]);
    }
  };

  const handleSVGMouseMove = (e: React.MouseEvent<SVGElement>) => {
    if (mode !== 'browse') {
      setMousePos(getSVGCoords(e));
    }
  };

  const handleSVGDblClick = (e: React.MouseEvent<SVGElement>) => {
    e.preventDefault();
    if ((mode === 'draw-field' || mode === 'draw-zone') && drawPoints.length >= 3) {
      setDrawStep('info');
    }
  };

  const finishDrawing = () => {
    if (drawPoints.length < 3) return;
    setDrawStep('info');
  };

  const cancelDrawing = () => {
    setMode('browse');
    setDrawStep('drawing');
    setDrawPoints([]);
    setMousePos(null);
    setNewFieldName(''); setNewFieldCode(''); setNewFieldCrop('玉米'); setNewFieldStage('苗期');
    setNewZoneName(''); setNewZoneStation('');
  };

  const saveNewField = () => {
    if (!newFieldName) return;
    const color = FIELD_COLORS[fields.length % FIELD_COLORS.length];
    const area = Number((drawPoints.length * 1.2 + Math.random() * 3).toFixed(1));
    const newField: Field = {
      id: `f${Date.now()}`,
      name: newFieldName,
      code: newFieldCode || `FA-${String(fields.length + 1).padStart(3, '0')}`,
      crop: newFieldCrop,
      growthStage: newFieldStage,
      area,
      kc: Number(newFieldKc),
      irrigationEfficiency: Number(newFieldEff),
      status: 'normal',
      soilMoisture: 60,
      soilTemperature: 22,
      flowRate: 10,
      pressure: 0.3,
      lastIrrigation: '—',
      recommendedDuration: 60,
      rainfall24h: 0,
      et0: 4.2,
      etc: Number(newFieldKc) * 4.2,
      kcUpdateTime: new Date().toLocaleString('zh-CN'),
      polygon: drawPoints,
      center: centroid(drawPoints),
      zones: [],
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
    cancelDrawing();
    // Suggest drawing zone
    setTimeout(() => {
      setMode('draw-zone');
      setDrawStep('drawing');
    }, 300);
  };

  const saveNewZone = () => {
    if (!newZoneName || !selectedFieldId) return;
    const newZone: Zone = {
      id: `z${Date.now()}`,
      fieldId: selectedFieldId,
      name: newZoneName,
      stationNo: newZoneStation || `S${String(Date.now()).slice(-2)}`,
      status: 'idle',
      duration: 45,
      soilMoisture: 60,
      polygon: drawPoints,
      center: centroid(drawPoints),
      deviceIds: [],
    };
    const newDev: Device = {
      id: `d${Date.now()}`,
      name: `${newZoneName}电磁阀`,
      model: 'HV-200',
      type: 'valve' as any,
      status: 'online',
      position: centroid(drawPoints),
      zoneId: newZone.id,
      fieldId: selectedFieldId,
      stationNo: newZoneStation,
      lastSeen: '刚刚',
      signalStrength: 88,
    };
    newZone.deviceIds = [newDev.id];
    setDevices(prev => [...prev, newDev]);
    setFields(prev => prev.map(f =>
      f.id === selectedFieldId ? { ...f, zones: [...f.zones, newZone] } : f
    ));
    cancelDrawing();
  };

  const deleteField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
    setDeleteConfirm(null);
  };

  const fieldDevices = (field: Field) => {
    const zoneIds = field.zones.map(z => z.id);
    return devices.filter(d => d.fieldId === field.id || zoneIds.includes(d.zoneId));
  };

  const getFieldColor = (index: number) => FIELD_COLORS[index % FIELD_COLORS.length];

  const modeButtons = [
    { mode: 'browse' as MapMode, label: '浏览', icon: Eye },
    { mode: 'draw-field' as MapMode, label: '新建地块', icon: Plus },
    { mode: 'draw-zone' as MapMode, label: '新建分区', icon: Layers },
  ];

  const isDrawing = mode === 'draw-field' || mode === 'draw-zone';
  const previewPoints = mousePos && drawPoints.length > 0
    ? [...drawPoints, mousePos]
    : drawPoints;

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#f0f4f8' }}>
      {/* Left: Field List Panel */}
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{ width: 260, background: '#ffffff', borderRight: '1px solid #e2e8f0' }}
      >
        <div className="px-4 py-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 style={{ color: '#0f172a', fontSize: 16, fontWeight: 600 }}>地块列表</h2>
            <button
              onClick={() => { setMode('draw-field'); setSelectedFieldId(null); setDrawStep('drawing'); setDrawPoints([]); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all"
              style={{ background: '#16a34a', color: '#ffffff', fontSize: 12 }}
            >
              <Plus size={14} /> 新建
            </button>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 12 }}>{fields.length} 个地块 · {fields.reduce((s, f) => s + f.zones.length, 0)} 个分区</p>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {fields.map((field, idx) => (
            <div
              key={field.id}
              onClick={() => { setSelectedFieldId(field.id); setSelectedZoneId(null); }}
              className="mx-2 mb-1.5 rounded-xl cursor-pointer transition-all"
              style={{
                border: `1.5px solid ${selectedFieldId === field.id ? getFieldColor(idx) : '#e2e8f0'}`,
                background: selectedFieldId === field.id ? `${getFieldColor(idx)}10` : '#ffffff',
                padding: '10px 12px',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded shrink-0" style={{ width: 10, height: 10, background: getFieldColor(idx) }} />
                <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 500, flex: 1 }} className="truncate">{field.name}</span>
                <span
                  className="rounded-full px-1.5"
                  style={{
                    background: STATUS_COLORS[field.status] + '20',
                    color: STATUS_COLORS[field.status],
                    fontSize: 10, fontWeight: 500,
                  }}
                >
                  {field.status === 'normal' ? '正常' : field.status === 'warning' ? '预警' : '告警'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  [field.code, '编号'],
                  [field.crop, '作物'],
                  [`${field.soilMoisture}%`, '湿度'],
                  [`${field.zones.length}区`, '分区'],
                ].map(([v, l]) => (
                  <div key={l} style={{ fontSize: 11 }}>
                    <span style={{ color: '#94a3b8' }}>{l}：</span>
                    <span style={{ color: '#374151' }}>{v}</span>
                  </div>
                ))}
              </div>
              {selectedFieldId === field.id && (
                <div className="flex items-center gap-1.5 mt-2 pt-2" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/field/${field.id}`); }}
                    className="flex-1 py-1 rounded text-center transition-all"
                    style={{ background: '#eff6ff', color: '#3b82f6', fontSize: 11 }}
                  >
                    查看详情
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setMode('draw-zone'); setDrawStep('drawing'); setDrawPoints([]); }}
                    className="flex-1 py-1 rounded text-center transition-all"
                    style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 11 }}
                  >
                    新增分区
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(field.id); }}
                    className="py-1 px-2 rounded transition-all"
                    style={{ background: '#fef2f2', color: '#ef4444', fontSize: 11 }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main: Map Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', zIndex: 10 }}>
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#f1f5f9' }}>
            {modeButtons.map(({ mode: m, label, icon: Icon }) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setDrawStep('drawing');
                  setDrawPoints([]);
                  if (m === 'draw-zone' && !selectedFieldId) return;
                }}
                disabled={m === 'draw-zone' && !selectedFieldId}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                style={{
                  background: mode === m ? '#16a34a' : 'transparent',
                  color: mode === m ? '#ffffff' : m === 'draw-zone' && !selectedFieldId ? '#cbd5e1' : '#64748b',
                  fontSize: 13,
                  cursor: m === 'draw-zone' && !selectedFieldId ? 'not-allowed' : 'pointer',
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Step indicator while drawing */}
          {isDrawing && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
              <Crosshair size={14} color="#92400e" />
              <span style={{ color: '#92400e', fontSize: 13 }}>
                {drawStep === 'drawing'
                  ? `已标记 ${drawPoints.length} 个顶点，双击或点击"完成绘制"关闭多边形`
                  : drawStep === 'info' ? '填写基本信息' : '添加设备'}
              </span>
              {drawStep === 'drawing' && drawPoints.length >= 3 && (
                <button
                  onClick={finishDrawing}
                  className="px-2 py-0.5 rounded"
                  style={{ background: '#92400e', color: '#ffffff', fontSize: 11 }}
                >
                  完成绘制
                </button>
              )}
              <button onClick={cancelDrawing} style={{ color: '#92400e' }}>
                <X size={14} />
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-3 text-xs" style={{ color: '#94a3b8' }}>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#22c55e' }} />正常</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#f59e0b' }} />预警</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#ef4444' }} />告警</span>
            </div>
          </div>
        </div>

        {/* SVG Map */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-full"
            style={{
              cursor: isDrawing ? 'crosshair' : 'default',
              background: 'linear-gradient(160deg, #2d5a27 0%, #3a6b32 30%, #4a7c3f 60%, #3d6e35 100%)',
            }}
            onClick={handleSVGClick}
            onMouseMove={handleSVGMouseMove}
            onDoubleClick={handleSVGDblClick}
          >
            {/* Grid pattern */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
              </pattern>
              <pattern id="rows" width="0" height="12" patternUnits="userSpaceOnUse">
                <line x1="0" y1="6" x2={SVG_W} y2="6" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

            {/* Field crop row texture within polygons */}
            {fields.map((field, idx) => {
              const color = getFieldColor(idx);
              const isSelected = selectedFieldId === field.id;
              const isHovered = hoveredFieldId === field.id;
              return (
                <g key={field.id}>
                  {/* Field polygon */}
                  <polygon
                    points={polygonToStr(field.polygon)}
                    fill={`${color}${isSelected ? '55' : isHovered ? '40' : '30'}`}
                    stroke={STATUS_COLORS[field.status]}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeDasharray={isSelected ? 'none' : '6,3'}
                    className="transition-all cursor-pointer"
                    onClick={() => { if (mode === 'browse') { setSelectedFieldId(field.id); setSelectedZoneId(null); } }}
                    onMouseEnter={() => setHoveredFieldId(field.id)}
                    onMouseLeave={() => setHoveredFieldId(null)}
                  />

                  {/* Zone polygons */}
                  {field.zones.map((zone, zi) => (
                    <g key={zone.id}>
                      <polygon
                        points={polygonToStr(zone.polygon)}
                        fill={`${color}${selectedZoneId === zone.id ? '40' : '20'}`}
                        stroke={ZONE_STATUS_COLORS[zone.status]}
                        strokeWidth={selectedZoneId === zone.id ? 2 : 1}
                        strokeDasharray="4,2"
                        className="cursor-pointer"
                        onClick={e => { e.stopPropagation(); setSelectedFieldId(field.id); setSelectedZoneId(zone.id); }}
                      />
                      <text
                        x={zone.center[0]}
                        y={zone.center[1]}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize={10}
                        style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                      >
                        {zone.name}
                      </text>
                    </g>
                  ))}

                  {/* Field center label */}
                  <circle
                    cx={field.center[0]} cy={field.center[1]}
                    r={isSelected ? 10 : 8}
                    fill={STATUS_COLORS[field.status]}
                    stroke="white" strokeWidth="2"
                    className="cursor-pointer transition-all"
                    onClick={() => { if (mode === 'browse') { setSelectedFieldId(field.id); setSelectedZoneId(null); } }}
                  />
                  <text
                    x={field.center[0]} y={field.center[1] + 18}
                    textAnchor="middle"
                    fill="white"
                    fontSize={11}
                    fontWeight="600"
                    style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    {field.name}
                  </text>
                </g>
              );
            })}

            {/* Device dots */}
            {devices.filter(d => d.fieldId && d.zoneId).map(d => (
              <g key={d.id}>
                <circle
                  cx={d.position[0]} cy={d.position[1]}
                  r={5}
                  fill={d.status === 'online' ? '#22c55e' : d.status === 'alarm' ? '#ef4444' : '#94a3b8'}
                  stroke="white" strokeWidth="1.5"
                />
              </g>
            ))}

            {/* Drawing preview */}
            {isDrawing && drawStep === 'drawing' && previewPoints.length > 1 && (
              <g>
                <polyline
                  points={polygonToStr(previewPoints)}
                  fill="rgba(14,165,233,0.2)"
                  stroke="#0ea5e9"
                  strokeWidth="2"
                  strokeDasharray="6,3"
                />
                {drawPoints.map((pt, i) => (
                  <circle key={i} cx={pt[0]} cy={pt[1]} r={5} fill="#0ea5e9" stroke="white" strokeWidth="2" />
                ))}
                {mousePos && <circle cx={mousePos[0]} cy={mousePos[1]} r={4} fill="#0ea5e9" opacity={0.6} />}
              </g>
            )}
          </svg>

          {/* Drawing info form (overlaid) */}
          {isDrawing && drawStep === 'info' && (
            <div
              className="absolute right-4 top-4 rounded-2xl shadow-xl p-5"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', width: 300, zIndex: 20 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>
                  {mode === 'draw-field' ? '填写地块信息' : '填写分区信息'}
                </h3>
                <button onClick={cancelDrawing}><X size={18} color="#64748b" /></button>
              </div>

              {mode === 'draw-field' ? (
                <div className="flex flex-col gap-3">
                  {[
                    { label: '地块名称 *', val: newFieldName, set: setNewFieldName, ph: '如：北区一号田' },
                    { label: '编号', val: newFieldCode, set: setNewFieldCode, ph: '如：FA-001' },
                    { label: '作物品种', val: newFieldCrop, set: setNewFieldCrop, ph: '如：玉米' },
                    { label: '生育期', val: newFieldStage, set: setNewFieldStage, ph: '如：拔节期' },
                    { label: 'Kc系数', val: newFieldKc, set: setNewFieldKc, ph: '0.00~1.50' },
                    { label: '灌溉效率', val: newFieldEff, set: setNewFieldEff, ph: '0.00~1.00' },
                  ].map(({ label, val, set, ph }) => (
                    <div key={label}>
                      <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 3 }}>{label}</label>
                      <input
                        value={val}
                        onChange={e => set(e.target.value)}
                        placeholder={ph}
                        className="w-full px-3 py-2 rounded-lg outline-none"
                        style={{ border: '1px solid #e2e8f0', fontSize: 13, background: '#f8fafc', color: '#0f172a' }}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <button onClick={cancelDrawing} className="flex-1 py-2 rounded-lg" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 13 }}>取消</button>
                    <button onClick={saveNewField} className="flex-1 py-2 rounded-lg" style={{ background: '#16a34a', color: '#ffffff', fontSize: 13 }}>保存地块</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 3 }}>所属地块</label>
                    <div className="px-3 py-2 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a' }}>
                      {selectedField?.name || '—'}
                    </div>
                  </div>
                  {[
                    { label: '分区名称 *', val: newZoneName, set: setNewZoneName, ph: '如：A-1区' },
                    { label: '站点号', val: newZoneStation, set: setNewZoneStation, ph: '如：S01' },
                  ].map(({ label, val, set, ph }) => (
                    <div key={label}>
                      <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 3 }}>{label}</label>
                      <input
                        value={val}
                        onChange={e => set(e.target.value)}
                        placeholder={ph}
                        className="w-full px-3 py-2 rounded-lg outline-none"
                        style={{ border: '1px solid #e2e8f0', fontSize: 13, background: '#f8fafc', color: '#0f172a' }}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 3 }}>自动添加设备类型</label>
                    <div className="flex gap-2">
                      {['valve', 'sensor'].map(t => (
                        <button
                          key={t}
                          onClick={() => setNewZoneDeviceType(t)}
                          className="flex-1 py-1.5 rounded-lg"
                          style={{
                            border: `1px solid ${newZoneDeviceType === t ? '#16a34a' : '#e2e8f0'}`,
                            background: newZoneDeviceType === t ? '#f0fdf4' : '#f8fafc',
                            color: newZoneDeviceType === t ? '#16a34a' : '#64748b',
                            fontSize: 12
                          }}
                        >
                          {t === 'valve' ? '电磁阀' : '传感器'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={cancelDrawing} className="flex-1 py-2 rounded-lg" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 13 }}>取消</button>
                    <button onClick={saveNewZone} className="flex-1 py-2 rounded-lg" style={{ background: '#16a34a', color: '#ffffff', fontSize: 13 }}>保存分区</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Selected field/zone detail panel */}
      {selectedField && mode === 'browse' && (
        <div
          className="flex flex-col shrink-0 overflow-hidden"
          style={{ width: 280, background: '#ffffff', borderLeft: '1px solid #e2e8f0' }}
        >
          <div className="px-4 py-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 style={{ color: '#0f172a', fontSize: 15, fontWeight: 600 }}>{selectedField.name}</h3>
              <button onClick={() => setSelectedFieldId(null)}><X size={16} color="#94a3b8" /></button>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                style={{ background: STATUS_COLORS[selectedField.status] + '20', color: STATUS_COLORS[selectedField.status] }}
              >
                {selectedField.status === 'normal' ? '正常' : selectedField.status === 'warning' ? '预警' : '告警'}
              </span>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{selectedField.code}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-2">
              {[
                ['作物', selectedField.crop], ['生育期', selectedField.growthStage],
                ['面积', `${selectedField.area} ha`], ['Kc系数', selectedField.kc],
                ['土壤湿度', `${selectedField.soilMoisture}%`], ['ET0', `${selectedField.et0} mm/d`],
              ].map(([l, v]) => (
                <div key={l as string} className="p-2 rounded-lg" style={{ background: '#f8fafc' }}>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>{l}</div>
                  <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Zones */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>分区列表</span>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{selectedField.zones.length} 个分区</span>
              </div>
              {selectedField.zones.length === 0 ? (
                <div className="text-center py-4 rounded-xl" style={{ background: '#f8fafc', border: '1px dashed #e2e8f0' }}>
                  <p style={{ color: '#94a3b8', fontSize: 12 }}>暂无分区，点击"新增分区"</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedField.zones.map(zone => (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedZoneId(selectedZoneId === zone.id ? null : zone.id)}
                      className="p-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        border: `1px solid ${selectedZoneId === zone.id ? '#0ea5e9' : '#e2e8f0'}`,
                        background: selectedZoneId === zone.id ? '#eff6ff' : '#f8fafc',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{zone.name}</span>
                        <span
                          className="px-1.5 py-0.5 rounded-full text-xs"
                          style={{ background: ZONE_STATUS_COLORS[zone.status] + '20', color: ZONE_STATUS_COLORS[zone.status] }}
                        >
                          {zone.status === 'idle' ? '待机' : zone.status === 'running' ? '运行中' : '告警'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3" style={{ fontSize: 11 }}>
                        <span style={{ color: '#94a3b8' }}>站点：{zone.stationNo}</span>
                        <span style={{ color: '#94a3b8' }}>湿度：{zone.soilMoisture}%</span>
                        <span style={{ color: '#94a3b8' }}>设备：{zone.deviceIds.length}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Devices in field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>设备点位</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {fieldDevices(selectedField).slice(0, 4).map(d => (
                  <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#f8fafc' }}>
                    <div
                      className="rounded-full shrink-0"
                      style={{ width: 8, height: 8, background: d.status === 'online' ? '#22c55e' : d.status === 'alarm' ? '#ef4444' : '#94a3b8' }}
                    />
                    <span style={{ color: '#374151', fontSize: 12, flex: 1 }} className="truncate">{d.name}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{d.model}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 mt-auto">
              <button
                onClick={() => navigate(`/field/${selectedField.id}`)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl w-full"
                style={{ background: '#16a34a', color: '#ffffff', fontSize: 14 }}
              >
                查看地块详情 <ArrowRight size={16} />
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setMode('draw-zone'); setDrawStep('drawing'); setDrawPoints([]); }}
                  className="flex-1 py-2 rounded-xl"
                  style={{ background: '#eff6ff', color: '#3b82f6', fontSize: 13 }}
                >
                  新增分区
                </button>
                <button
                  onClick={() => setDeleteConfirm(selectedField.id)}
                  className="py-2 px-4 rounded-xl"
                  style={{ background: '#fef2f2', color: '#ef4444', fontSize: 13 }}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 shadow-2xl" style={{ background: '#ffffff', width: 360 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: '#fef2f2' }}>
                <AlertTriangle size={24} color="#ef4444" />
              </div>
              <div>
                <div style={{ color: '#0f172a', fontSize: 16, fontWeight: 600 }}>确认删除地块？</div>
                <div style={{ color: '#64748b', fontSize: 13 }}>删除后将无法恢复</div>
              </div>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              将同时删除该地块下的所有分区和绑定设备信息。
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl" style={{ border: '1px solid #e2e8f0', color: '#64748b', fontSize: 14 }}>取消</button>
              <button onClick={() => deleteField(deleteConfirm)} className="flex-1 py-2.5 rounded-xl" style={{ background: '#ef4444', color: '#ffffff', fontSize: 14 }}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
