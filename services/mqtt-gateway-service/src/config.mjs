export function loadConfig() {
  return {
    host: process.env.HOST ?? '127.0.0.1',
    port: Number(process.env.PORT ?? 4320),
    brokerUrl: process.env.WIFI_DEMO_MQTT_HOST ?? process.env.MQTT_BROKER_HOST ?? 'broker.hyecosmart.com',
    brokerPort: Number(process.env.WIFI_DEMO_MQTT_PORT ?? process.env.MQTT_BROKER_PORT ?? 9883),
    mqttAccount: process.env.WIFI_DEMO_MQTT_ACCOUNT ?? '',
    mqttUserId: process.env.WIFI_DEMO_MQTT_USER_ID ?? '',
    mqttPassword: process.env.WIFI_DEMO_MQTT_PASSWORD ?? '',
    deviceId: process.env.WIFI_DEMO_DEVICE_ID ?? '',
    topicPrefix: process.env.WIFI_DEMO_TOPIC_PREFIX ?? process.env.VITE_WIFI_DEMO_TOPIC_PREFIX ?? 'wc800wf',
    topicDeviceInfo: process.env.WIFI_DEMO_TOPIC_DEVICE_INFO ?? process.env.VITE_WIFI_DEMO_TOPIC_DEVICE_INFO ?? '/101/',
    topicDeviceInfoReply: process.env.WIFI_DEMO_TOPIC_DEVICE_INFO_REPLY ?? process.env.VITE_WIFI_DEMO_TOPIC_DEVICE_INFO_REPLY ?? '/101r/',
    topicDeviceControl: process.env.WIFI_DEMO_TOPIC_DEVICE_CONTROL ?? process.env.VITE_WIFI_DEMO_TOPIC_DEVICE_CONTROL ?? '/104/',
    topicDeviceControlReply: process.env.WIFI_DEMO_TOPIC_DEVICE_CONTROL_REPLY ?? process.env.VITE_WIFI_DEMO_TOPIC_DEVICE_CONTROL_REPLY ?? '/104r/',
    topicDeviceInfoUpdate: process.env.WIFI_DEMO_TOPIC_DEVICE_INFO_UPDATE ?? process.env.VITE_WIFI_DEMO_TOPIC_DEVICE_INFO_UPDATE ?? '/106/',
    caCertPath: process.env.WIFI_DEMO_CA_CERT_PATH ?? '../certs/hyecosmart-ca.der',
    clientCertPath: process.env.WIFI_DEMO_CLIENT_CERT_PATH ?? '../certs/hyecosmart-client.p12',
    clientCertPassphrase: process.env.WIFI_DEMO_CLIENT_CERT_PASSPHRASE ?? '',
    serviceName: 'mqtt-gateway-service',
  };
}
