import { getWifiDemoMissingConfig, wifiDemoDevice } from './wifiDemoConfig';
import type { WifiDemoControlCommand, WifiDemoDeviceState } from './wifiDemoTypes';

type StateListener = (state: WifiDemoDeviceState) => void;

const baseState: WifiDemoDeviceState = {
  connectionStatus: 'idle',
  online: false,
  rssi: null,
  firmware: '',
  lastMessageAt: null,
  valveStatus: [],
  controlReply: null,
  errorMessage: '',
};

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:4320';

function hasWindow() {
  return typeof window !== 'undefined';
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

export class WifiDemoMqttClient {
  private listeners = new Set<StateListener>();
  private state: WifiDemoDeviceState = { ...baseState };
  private started = false;
  private pollTimer: number | null = null;

  subscribe(listener: StateListener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit(patch: Partial<WifiDemoDeviceState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private get gatewayUrl() {
    return import.meta.env.VITE_MQTT_GATEWAY_URL?.trim() || DEFAULT_GATEWAY_URL;
  }

  async start() {
    if (this.started) {
      return;
    }
    this.started = true;

    const missing = getWifiDemoMissingConfig();
    if (missing.length > 0) {
      this.emit({
        connectionStatus: 'config-missing',
        errorMessage: `缺少配置：${missing.join(', ')}`,
      });
      return;
    }

    if (!hasWindow()) {
      this.emit({
        connectionStatus: 'error',
        errorMessage: '当前环境不支持浏览器请求。',
      });
      return;
    }

    this.emit({
      connectionStatus: 'connecting',
      errorMessage: '',
    });

    await this.refreshState();
    this.startPolling();
  }

  stop() {
    this.started = false;
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.state = { ...baseState };
    this.emit({});
  }

  private startPolling() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
    }
    this.pollTimer = window.setInterval(() => {
      void this.refreshState();
    }, 3000);
  }

  async requestDeviceInfo() {
    try {
      const response = await fetch(`${this.gatewayUrl}/demo/request-device-info`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: wifiDemoDevice.deviceId }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        this.applyGatewayState(payload?.state);
        throw new Error(payload?.error || '刷新设备信息失败');
      }
      this.applyGatewayState(payload?.state);
    } catch (error) {
      this.emit({
        connectionStatus: 'error',
        errorMessage: error instanceof Error ? error.message : '刷新设备信息失败',
      });
    }
  }

  async sendValveCommand(command: WifiDemoControlCommand) {
    const commandPath = command.type === 'on' ? 'open' : 'close';

    try {
      const response = await fetch(
        `${this.gatewayUrl}/devices/${encodeURIComponent(wifiDemoDevice.deviceId)}/commands/${commandPath}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            stationIndex: command.stationIndex,
            durationSeconds: command.durationSeconds,
          }),
        },
      );
      const payload = await readJson(response);
      if (!response.ok) {
        this.applyGatewayState(payload?.state);
        throw new Error(payload?.error || '站点控制失败');
      }
      this.applyGatewayState(payload?.state);
    } catch (error) {
      this.emit({
        connectionStatus: 'error',
        errorMessage: error instanceof Error ? error.message : '站点控制失败',
      });
    }
  }

  private async refreshState() {
    try {
      const response = await fetch(`${this.gatewayUrl}/demo/state`);
      const payload = await readJson(response);
      if (!response.ok) {
        this.applyGatewayState(payload?.state);
        throw new Error(payload?.error || '读取设备状态失败');
      }
      this.applyGatewayState(payload?.state);
    } catch (error) {
      this.emit({
        connectionStatus: 'error',
        online: false,
        errorMessage: error instanceof Error ? error.message : '读取设备状态失败',
      });
    }
  }

  private applyGatewayState(payload: Partial<WifiDemoDeviceState> | undefined) {
    if (!payload) {
      return;
    }

    this.emit({
      ...payload,
      connectionStatus:
        payload.connectionStatus === 'idle'
          ? 'connected'
          : payload.connectionStatus ?? 'connected',
      errorMessage: payload.errorMessage ?? '',
    });
  }
}

export const wifiDemoMqttClient = new WifiDemoMqttClient();
