# 设备与 MQTT 模块

## 当前定位

当前 MQTT 链路主要服务固定 Wi-Fi 演示设备，能请求设备信息、开阀、关阀、读取内存状态。

## 当前链路

```text
Web 或小程序
  -> execution-service 或 wifiDemoGatewayClient
  -> mqtt-gateway-service
  -> MQTT broker
  -> 固定 Wi-Fi 设备
  -> 回执 topic
  -> gateway 回调 execution-service internal ack API
  -> device_events 持久化
```

## 当前限制

- 只支持配置的单一 `WIFI_DEMO_DEVICE_ID`。
- 多设备、多租户、连接池未实现。
- 回执已支持写入 `device_events`，但仍需补全多设备关联与强一致校验。
- 正式设备控制和 demo 控制边界仍需强化。

## 生产化方向

- 建立正式设备入网流程。
- 设备命令、ACK、状态变化全部落库。
- 支持命令超时、重试、幂等和失败原因。
- 设备控制 API 必须区分操作人、项目、设备权限。

