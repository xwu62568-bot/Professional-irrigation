import fs from 'node:fs';
import path from 'node:path';
import mqtt from 'mqtt';

function resolveProjectFile(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

function readRequiredFile(filePath) {
  const absolutePath = resolveProjectFile(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  return fs.readFileSync(absolutePath);
}

function validateConfig(config) {
  const missing = [];
  if (!config.mqttAccount) missing.push('WIFI_DEMO_MQTT_ACCOUNT');
  if (!config.mqttUserId) missing.push('WIFI_DEMO_MQTT_USER_ID');
  if (!config.mqttPassword) missing.push('WIFI_DEMO_MQTT_PASSWORD');
  if (!config.deviceId) missing.push('WIFI_DEMO_DEVICE_ID');
  if (missing.length > 0) {
    throw new Error(`缺少配置: ${missing.join(', ')}`);
  }
}

function buildClientId(config) {
  const configured = String(config.mqttClientId ?? '').trim();
  if (configured) {
    return configured;
  }

  return config.mqttAccount;
}

function getTopics(config) {
  return {
    deviceInfoPublish: `${config.topicPrefix}${config.topicDeviceInfo}${config.deviceId}`,
    deviceInfoReplySubscribe: `${config.topicPrefix}${config.topicDeviceInfoReply}${config.mqttUserId}`,
    deviceControlPublish: `${config.topicPrefix}${config.topicDeviceControl}${config.deviceId}`,
    deviceControlReplySubscribe: `${config.topicPrefix}${config.topicDeviceControlReply}${config.mqttUserId}`,
    deviceInfoUpdateSubscribe: `${config.topicPrefix}${config.topicDeviceInfoUpdate}${config.deviceId}`,
  };
}

export function createMqttGateway(config, logger = console) {
  const state = {
    connectionStatus: 'idle',
    online: false,
    rssi: null,
    firmware: '',
    lastMessageAt: null,
    valveStatus: [],
    controlReply: null,
    errorMessage: '',
    mqttConnected: false,
  };

  let mqttClient = null;
  let lastControlCommand = null;
  let connectPromise = null;
  let intentionalDisconnect = false;
  let idleDisconnectTimer = null;

  function log(event, payload) {
    logger.log(`[mqtt-gateway-service] ${event}`, payload ?? '');
  }

  function setState(patch) {
    Object.assign(state, patch);
  }

  function mergeValveStatusItem(stationIndex, status) {
    const next = [...state.valveStatus];
    const index = next.findIndex((item) => item?.nb === stationIndex);
    const valveItem = { nb: stationIndex, status };
    if (index >= 0) {
      next[index] = { ...next[index], ...valveItem };
      return next;
    }
    next.push(valveItem);
    return next;
  }

  function handleMessage(topic, payloadText) {
    const topics = getTopics(config);
    const message = JSON.parse(payloadText);
    const lastMessageAt = new Date().toISOString();
    log('mqtt:message', { topic, payload: message });

    if (topic === topics.deviceInfoReplySubscribe) {
      setState({
        online: true,
        rssi: typeof message?.wifi?.rssi === 'number' ? message.wifi.rssi : null,
        firmware: typeof message?.firmware === 'string' ? message.firmware : state.firmware,
        valveStatus: Array.isArray(message?.valveStatus) ? message.valveStatus : state.valveStatus,
        lastMessageAt,
      });
      return;
    }

    if (topic === topics.deviceControlReplySubscribe) {
      const controlReply = typeof message?.valveCtlReply === 'number' ? message.valveCtlReply : null;
      const nextPatch = { controlReply, lastMessageAt };
      if (controlReply === 0 && lastControlCommand) {
        nextPatch.valveStatus = mergeValveStatusItem(lastControlCommand.stationIndex, lastControlCommand.type);
      }
      setState(nextPatch);
      return;
    }

    if (topic === topics.deviceInfoUpdateSubscribe) {
      setState({
        online: true,
        valveStatus: Array.isArray(message?.valveStatus) ? message.valveStatus : state.valveStatus,
        lastMessageAt,
      });
    }
  }

  function ensureDevice(deviceId) {
    if (deviceId !== config.deviceId) {
      throw new Error(`当前只支持固定演示设备 ${config.deviceId}，收到 ${deviceId}`);
    }
  }

  function clearIdleDisconnectTimer() {
    if (idleDisconnectTimer) {
      clearTimeout(idleDisconnectTimer);
      idleDisconnectTimer = null;
    }
  }

  function disconnectMqtt(reason = 'idle') {
    clearIdleDisconnectTimer();
    if (!mqttClient) {
      state.mqttConnected = false;
      setState({ connectionStatus: 'idle' });
      return;
    }

    intentionalDisconnect = true;
    const client = mqttClient;
    mqttClient = null;
    state.mqttConnected = false;
    lastControlCommand = null;
    setState({ connectionStatus: 'idle' });
    log('mqtt:disconnect', { reason });
    client.end(true, () => {
      intentionalDisconnect = false;
    });
  }

  function scheduleIdleDisconnect(reason) {
    clearIdleDisconnectTimer();
    idleDisconnectTimer = setTimeout(() => {
      disconnectMqtt(reason);
    }, Number(config.idleDisconnectMs ?? 6000));
  }

  async function ensureConnected() {
    if (state.mqttConnected) {
      clearIdleDisconnectTimer();
      return;
    }
    if (connectPromise) {
      return connectPromise;
    }

    validateConfig(config);
    const clientId = buildClientId(config);

    connectPromise = new Promise((resolve, reject) => {
      disconnectMqtt('replace-client');

      mqttClient = mqtt.connect({
        host: config.brokerUrl,
        port: config.brokerPort,
        protocol: 'mqtts',
        clientId,
        username: config.mqttAccount,
        password: config.mqttPassword,
        ca: readRequiredFile(config.caCertPath),
        pfx: readRequiredFile(config.clientCertPath),
        passphrase: config.clientCertPassphrase,
        rejectUnauthorized: false,
        reconnectPeriod: 0,
        connectTimeout: 10000,
      });

      setState({ connectionStatus: 'connecting', errorMessage: '' });
      log('mqtt:connecting', {
        host: config.brokerUrl,
        port: config.brokerPort,
        clientId,
        username: config.mqttAccount,
      });

      mqttClient.once('connect', () => {
        const topics = getTopics(config);
        state.mqttConnected = true;
        lastControlCommand = null;
        mqttClient.subscribe([
          topics.deviceInfoReplySubscribe,
          topics.deviceControlReplySubscribe,
          topics.deviceInfoUpdateSubscribe,
        ]);
        setState({ connectionStatus: 'connected', errorMessage: '' });
        log('mqtt:connected', { topics });
        resolve();
      });

      mqttClient.on('close', () => {
        state.mqttConnected = false;
        lastControlCommand = null;
        if (intentionalDisconnect) {
          return;
        }
        setState({
          connectionStatus: 'idle',
          errorMessage: state.errorMessage,
        });
      });

      mqttClient.on('reconnect', () => {
        state.mqttConnected = false;
        setState({
          connectionStatus: 'connecting',
          errorMessage: '',
        });
      });

      mqttClient.on('error', (error) => {
        state.mqttConnected = false;
        lastControlCommand = null;
        setState({
          connectionStatus: 'error',
          errorMessage: error.message || 'MQTT 连接失败',
        });
        if (connectPromise) {
          reject(error);
        }
      });

      mqttClient.on('message', (topic, payload) => {
        try {
          handleMessage(topic, payload.toString('utf8'));
        } catch (error) {
          setState({
            errorMessage: error instanceof Error ? error.message : 'MQTT 消息解析失败',
          });
        }
      });
    }).finally(() => {
      connectPromise = null;
    });

    return connectPromise;
  }

  async function requestDeviceInfo(deviceId) {
    ensureDevice(deviceId);
    await ensureConnected();
    const topics = getTopics(config);
    const payload = {
      version: '1.0',
      deviceId: config.mqttUserId,
      wifi: true,
      valveStatus: true,
      switchSensor: true,
      firmware: true,
    };
    mqttClient.publish(topics.deviceInfoPublish, JSON.stringify(payload));
    log('mqtt:publish:device-info', { topic: topics.deviceInfoPublish, payload });
    scheduleIdleDisconnect('device-info-request-complete');
    return { ok: true };
  }

  async function sendControl(deviceId, command) {
    ensureDevice(deviceId);
    await ensureConnected();
    const topics = getTopics(config);
    lastControlCommand = command;
    setState({ controlReply: null, lastMessageAt: new Date().toISOString() });

    const payload = {
      version: '1.0',
      deviceId: config.mqttUserId,
      valveCtl: {
        valveChanel: command.stationIndex,
        type: command.type,
        time: command.durationSeconds,
      },
    };
    mqttClient.publish(topics.deviceControlPublish, JSON.stringify(payload));
    log('mqtt:publish:control', { topic: topics.deviceControlPublish, payload });
    scheduleIdleDisconnect('control-command-complete');
    return { ok: true, topic: topics.deviceControlPublish, payload };
  }

  return {
    getState() {
      return {
        ...state,
        configured: Boolean(config.deviceId && config.mqttAccount && config.mqttUserId && config.mqttPassword),
        deviceId: config.deviceId,
      };
    },
    ensureConnected,
    requestDeviceInfo,
    sendControl,
    disconnectMqtt,
  };
}
