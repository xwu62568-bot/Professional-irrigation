# services

当前按两个服务拆分：

- `execution-service`
  负责轮灌计划执行、状态推进、与 Supabase 交互

- `mqtt-gateway-service`
  负责设备命令网关、后续 MQTT 长连接与 ACK 处理

当前阶段只完成第一版骨架和手动触发相关接口占位，尚未接真实数据库与设备执行逻辑。
