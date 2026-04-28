import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Activity, ArrowLeft, ArrowUpDown, CircleDot, Power, RefreshCcw, Signal, Wifi, WifiOff } from 'lucide-react';
import { wifiDemoMqttClient } from '../../lib/wifiDemoMqtt';
import { getWifiDemoMissingConfig, getWifiDemoTopics, wifiDemoDevice } from '../../lib/wifiDemoConfig';
import type { WifiDemoDeviceState } from '../../lib/wifiDemoTypes';

const initialState: WifiDemoDeviceState = {
  connectionStatus: 'idle',
  online: false,
  rssi: null,
  firmware: '',
  lastMessageAt: null,
  valveStatus: [],
  controlReply: null,
  errorMessage: '',
};

function formatReply(code: number | null) {
  if (code === null) return '暂无';
  if (code === 0) return '控制成功';
  if (code === -1) return '设备异常或未装配';
  if (code === -2) return '站点被禁用';
  if (code === -3) return '时长参数错误';
  if (code === -4) return '站点已开启';
  return `未知返回码 ${code}`;
}

function signalLabel(rssi: number | null) {
  if (rssi === null) return '未上报';
  if (rssi >= -50) return '强';
  if (rssi >= -70) return '中';
  if (rssi >= -90) return '弱';
  return '很弱';
}

function valveStatusLabel(status: string) {
  if (status === 'on') return '开启';
  if (status === 'off') return '关闭';
  return '未同步';
}

export function WifiDeviceDemo() {
  const [state, setState] = useState<WifiDemoDeviceState>(initialState);
  const [durationByStation, setDurationByStation] = useState<Record<number, string>>({});

  useEffect(() => {
    const unsubscribe = wifiDemoMqttClient.subscribe(setState);
    wifiDemoMqttClient.start();
    return () => {
      unsubscribe();
      wifiDemoMqttClient.stop();
    };
  }, []);

  const missingConfig = useMemo(() => getWifiDemoMissingConfig(), []);
  const topics = useMemo(() => getWifiDemoTopics(), []);

  return (
    <div className="flex flex-col h-full overflow-auto" style={{ background: '#f0f4f8' }}>
      <div className="px-6 py-5" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              to="/devices"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 mb-3"
              style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 500 }}
            >
              <ArrowLeft size={14} />
              返回设备列表
            </Link>
            <h1 style={{ color: '#0f172a', fontSize: 20, fontWeight: 700 }}>Wi-Fi 设备 Demo</h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              固定接入单个 Wi-Fi 设备，展示 MQTT 实时状态并支持按时长开关站点。
            </p>
          </div>
          <button
            onClick={() => wifiDemoMqttClient.requestDeviceInfo()}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2"
            style={{ background: '#0f172a', color: '#ffffff' }}
          >
            <RefreshCcw size={15} />
            刷新状态
          </button>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6">
        {missingConfig.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: '#fff7ed', border: '1px solid #fdba74' }}>
            <div style={{ color: '#9a3412', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>待补充配置</div>
            <div style={{ color: '#9a3412', fontSize: 13, lineHeight: 1.7 }}>
              {missingConfig.join('、')}
            </div>
          </div>
        )}

        {state.errorMessage && (
          <div className="rounded-2xl p-5" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
            <div style={{ color: '#b91c1c', fontSize: 14, fontWeight: 700 }}>连接提示</div>
            <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 6 }}>{state.errorMessage}</div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: 12 }}>连接状态</div>
            <div className="flex items-center gap-2 mt-3" style={{ color: '#0f172a', fontSize: 22, fontWeight: 700 }}>
              {state.online ? <Wifi size={22} color="#16a34a" /> : <WifiOff size={22} color="#94a3b8" />}
              {state.connectionStatus}
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: 12 }}>信号强度</div>
            <div className="flex items-center gap-2 mt-3" style={{ color: '#0f172a', fontSize: 22, fontWeight: 700 }}>
              <Signal size={22} color="#0ea5e9" />
              {state.rssi === null ? '—' : `${state.rssi} dBm`}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{signalLabel(state.rssi)}</div>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: 12 }}>固件版本</div>
            <div className="flex items-center gap-2 mt-3" style={{ color: '#0f172a', fontSize: 22, fontWeight: 700 }}>
              <Activity size={22} color="#22c55e" />
              {state.firmware || '未上报'}
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: 12 }}>控制回执</div>
            <div className="flex items-center gap-2 mt-3" style={{ color: '#0f172a', fontSize: 18, fontWeight: 700 }}>
              <ArrowUpDown size={20} color="#f59e0b" />
              {formatReply(state.controlReply)}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-3xl p-6" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
              <div>
                <div style={{ color: '#0f172a', fontSize: 18, fontWeight: 700 }}>{wifiDemoDevice.deviceName}</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                  {wifiDemoDevice.model} · {wifiDemoDevice.fieldName}
                </div>
              </div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: state.online ? '#f0fdf4' : '#f8fafc',
                  color: state.online ? '#15803d' : '#64748b',
                  border: `1px solid ${state.online ? '#bbf7d0' : '#e2e8f0'}`,
                }}
              >
                <CircleDot size={12} />
                {state.online ? '在线' : '离线'}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl p-4" style={{ background: '#f8fafc' }}>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>设备 ID</div>
                <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>
                  {wifiDemoDevice.deviceId || '待补充'}
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: '#f8fafc' }}>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>最后消息时间</div>
                <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>
                  {state.lastMessageAt || '暂无'}
                </div>
              </div>
            </div>

            <div className="mt-6" style={{ color: '#0f172a', fontSize: 15, fontWeight: 700 }}>站点控制</div>
            <div className="mt-4 flex flex-col gap-3">
              {wifiDemoDevice.stationList.map((station) => {
                const status = state.valveStatus.find((item) => item.nb === station.index)?.status || 'unknown';
                const durationValue = durationByStation[station.index] || '60';

                return (
                  <div
                    key={station.index}
                    className="rounded-2xl p-4"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 700 }}>
                          站点 {station.index} · {station.name}
                        </div>
                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                          当前状态：{valveStatusLabel(status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          value={durationValue}
                          onChange={(event) =>
                            setDurationByStation((current) => ({ ...current, [station.index]: event.target.value }))
                          }
                          type="number"
                          min="1"
                          max="7200"
                          className="rounded-xl px-3 py-2"
                          style={{ width: 120, background: '#ffffff', border: '1px solid #cbd5e1' }}
                        />
                        <button
                          onClick={() =>
                            wifiDemoMqttClient.sendValveCommand({
                              stationIndex: station.index,
                              type: 'on',
                              durationSeconds: Math.max(1, Number(durationValue || 0)),
                            })
                          }
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-2"
                          style={{ background: '#16a34a', color: '#ffffff' }}
                        >
                          <Power size={14} />
                          开启
                        </button>
                        <button
                          onClick={() =>
                            wifiDemoMqttClient.sendValveCommand({
                              stationIndex: station.index,
                              type: 'off',
                              durationSeconds: Math.max(1, Number(durationValue || 0)),
                            })
                          }
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-2"
                          style={{ background: '#0f172a', color: '#ffffff' }}
                        >
                          关闭
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl p-6" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#0f172a', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>接入定义</div>
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl p-4" style={{ background: '#f8fafc' }}>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>设备网关</div>
                <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>
                  {import.meta.env.VITE_MQTT_GATEWAY_URL || 'http://127.0.0.1:4320'}
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: '#f8fafc' }}>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>订阅 Topics</div>
                <div style={{ color: '#0f172a', fontSize: 12, lineHeight: 1.8, wordBreak: 'break-all' }}>
                  <div>{topics.deviceInfoReplySubscribe}</div>
                  <div>{topics.deviceControlReplySubscribe}</div>
                  <div>{topics.deviceInfoUpdateSubscribe}</div>
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: '#f8fafc' }}>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>发布 Topics</div>
                <div style={{ color: '#0f172a', fontSize: 12, lineHeight: 1.8, wordBreak: 'break-all' }}>
                  <div>{topics.deviceInfoPublish}</div>
                  <div>{topics.deviceControlPublish}</div>
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: '#f8fafc' }}>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>已按 iOS 固化的协议字段</div>
                <div style={{ color: '#0f172a', fontSize: 12, lineHeight: 1.8 }}>
                  设备信息请求：`wifi`、`valveStatus`、`switchSensor`、`firmware`
                  <br />
                  控制字段：`valveCtl.valveChanel`、`type`、`time`
                  <br />
                  控制回执：`valveCtlReply`
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
