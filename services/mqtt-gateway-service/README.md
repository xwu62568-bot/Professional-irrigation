# mqtt-gateway-service

第一版职责：

- 对执行服务暴露统一设备命令接口
- 按需建立 MQTT 短连接
- 后续下发开阀/关阀命令
- 后续回收设备 ACK

当前已完成：

- 固定演示设备 MQTTS 网关
- `/health`
- `GET /demo/state`
- `POST /demo/request-device-info`
- `POST /devices/:deviceId/commands/open`
- `POST /devices/:deviceId/commands/close`
- `GET /devices/:deviceId/status`

## 启动

```bash
PORT=4320 \
WIFI_DEMO_MQTT_HOST=broker.hyecosmart.com \
WIFI_DEMO_MQTT_PORT=9883 \
WIFI_DEMO_MQTT_ACCOUNT=... \
WIFI_DEMO_MQTT_CLIENT_ID=... \
WIFI_DEMO_MQTT_USER_ID=... \
WIFI_DEMO_MQTT_PASSWORD=... \
WIFI_DEMO_DEVICE_ID=... \
WIFI_DEMO_MQTT_IDLE_DISCONNECT_MS=6000 \
WIFI_DEMO_CA_CERT_PATH=IOS/WiseWater/Resource/hyecosmart-ca.der \
WIFI_DEMO_CLIENT_CERT_PATH=IOS/WiseWater/Resource/hyecosmart-client.p12 \
WIFI_DEMO_CLIENT_CERT_PASSPHRASE=... \
node src/index.mjs
```

说明：当前 Hyeco broker 要求 `clientId` 与 `WIFI_DEMO_MQTT_ACCOUNT` 保持一致；如无特殊要求，可以不配置 `WIFI_DEMO_MQTT_CLIENT_ID`。
网关会在查询状态或控制阀门时临时连接 MQTT，发布命令后默认保留 6 秒接收设备回复，然后主动断开，避免服务端长期占用同一个 MQTT 身份。
