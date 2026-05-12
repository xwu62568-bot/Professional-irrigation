# services

当前按两个服务拆分：

- `execution-service`
  负责轮灌计划执行、状态推进、与 Supabase 交互

- `assistant-service`
  负责共享 mini session 校验、Dify 代理与 AI 聊天接口

- `mqtt-gateway-service`
  负责设备命令网关、后续 MQTT 长连接与 ACK 处理

- `mcp-server`
  负责把平台能力暴露为 MCP tools，供 IDE / Agent / AI 客户端调用

当前阶段只完成第一版骨架和手动触发相关接口占位，尚未接真实数据库与设备执行逻辑。
