import type { WifiDemoDeviceDefinition, WifiDemoTopicSet } from './wifiDemoTypes';
import type { Device } from '../app/data/mockData';

const topicPrefix = import.meta.env.VITE_WIFI_DEMO_TOPIC_PREFIX || 'wc800wf';
const topicDeviceInfo = import.meta.env.VITE_WIFI_DEMO_TOPIC_DEVICE_INFO || '/101/';
const topicDeviceInfoReply = import.meta.env.VITE_WIFI_DEMO_TOPIC_DEVICE_INFO_REPLY || '/101r/';
const topicDeviceControl = import.meta.env.VITE_WIFI_DEMO_TOPIC_DEVICE_CONTROL || '/104/';
const topicDeviceControlReply = import.meta.env.VITE_WIFI_DEMO_TOPIC_DEVICE_CONTROL_REPLY || '/104r/';
const topicDeviceInfoUpdate = import.meta.env.VITE_WIFI_DEMO_TOPIC_DEVICE_INFO_UPDATE || '/106/';
const mqttUserId = import.meta.env.VITE_WIFI_DEMO_MQTT_USER_ID || '';

const parseStationList = (value: string | undefined) => {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, idx) => {
      const [indexText, nameText] = item.split(':');
      const index = Number(indexText);

      return {
        index: Number.isFinite(index) ? index : idx,
        name: (nameText || `站点 ${indexText || idx}`).trim(),
      };
    });
};

export const wifiDemoDevice: WifiDemoDeviceDefinition = {
  deviceId: import.meta.env.VITE_WIFI_DEMO_DEVICE_ID || '',
  deviceName: import.meta.env.VITE_WIFI_DEMO_DEVICE_NAME || '固定演示 Wi-Fi 设备',
  model: import.meta.env.VITE_WIFI_DEMO_DEVICE_MODEL || 'WC800WF',
  fieldName: import.meta.env.VITE_WIFI_DEMO_FIELD_NAME || '演示地块',
  stationList: parseStationList(import.meta.env.VITE_WIFI_DEMO_STATIONS),
};

export function getWifiDemoTopics(): WifiDemoTopicSet {
  return {
    deviceInfoPublish: `${topicPrefix}${topicDeviceInfo}${wifiDemoDevice.deviceId}`,
    deviceInfoReplySubscribe: `${topicPrefix}${topicDeviceInfoReply}${mqttUserId || '{mqttUserId}'}`,
    deviceControlPublish: `${topicPrefix}${topicDeviceControl}${wifiDemoDevice.deviceId}`,
    deviceControlReplySubscribe: `${topicPrefix}${topicDeviceControlReply}${mqttUserId || '{mqttUserId}'}`,
    deviceInfoUpdateSubscribe: `${topicPrefix}${topicDeviceInfoUpdate}${wifiDemoDevice.deviceId}`,
  };
}

export function getWifiDemoMissingConfig() {
  const missing: string[] = [];

  if (!wifiDemoDevice.deviceId) missing.push('VITE_WIFI_DEMO_DEVICE_ID');
  if (wifiDemoDevice.stationList.length === 0) missing.push('VITE_WIFI_DEMO_STATIONS');

  return missing;
}

export function getWifiDemoAppDevice(): Device | null {
  if (!wifiDemoDevice.deviceId || wifiDemoDevice.stationList.length === 0) {
    return null;
  }

  return {
    id: wifiDemoDevice.deviceId,
    name: wifiDemoDevice.deviceName,
    model: wifiDemoDevice.model,
    type: 'controller',
    status: 'online',
    position: [0, 0],
    zoneId: '',
    fieldId: '',
    lastSeen: '演示设备',
    signalStrength: 100,
    stations: wifiDemoDevice.stationList.map((station) => ({
      id: String(station.index),
      name: station.name,
    })),
    bindings: [],
  };
}
