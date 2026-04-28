# mqtt-gateway-service

第一版职责：

- 对执行服务暴露统一设备命令接口
- 后续维护 MQTT 长连接
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
WIFI_DEMO_MQTT_USER_ID=... \
WIFI_DEMO_MQTT_PASSWORD=... \
WIFI_DEMO_DEVICE_ID=... \
WIFI_DEMO_CA_CERT_PATH=IOS/WiseWater/Resource/hyecosmart-ca.der \
WIFI_DEMO_CLIENT_CERT_PATH=IOS/WiseWater/Resource/hyecosmart-client.p12 \
WIFI_DEMO_CLIENT_CERT_PASSPHRASE=... \
node src/index.mjs
```
