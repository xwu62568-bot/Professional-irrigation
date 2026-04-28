export interface WifiDemoStationDefinition {
  index: number;
  name: string;
}

export interface WifiDemoDeviceDefinition {
  deviceId: string;
  deviceName: string;
  model: string;
  fieldName: string;
  stationList: WifiDemoStationDefinition[];
}

export interface WifiDemoValveStatus {
  nb: number;
  status: string;
}

export interface WifiDemoDeviceState {
  connectionStatus: 'idle' | 'config-missing' | 'connecting' | 'connected' | 'error';
  online: boolean;
  rssi: number | null;
  firmware: string;
  lastMessageAt: string | null;
  valveStatus: WifiDemoValveStatus[];
  controlReply: number | null;
  errorMessage: string;
}

export interface WifiDemoProxyState {
  proxyStatus: 'idle' | 'connecting' | 'connected' | 'error';
  mqttConnected: boolean;
  state: WifiDemoDeviceState;
}

export interface WifiDemoControlCommand {
  stationIndex: number;
  type: 'on' | 'off';
  durationSeconds: number;
}

export interface WifiDemoTopicSet {
  deviceInfoPublish: string;
  deviceInfoReplySubscribe: string;
  deviceControlPublish: string;
  deviceControlReplySubscribe: string;
  deviceInfoUpdateSubscribe: string;
}
