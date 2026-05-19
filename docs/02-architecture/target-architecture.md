# 目标架构

## 目标原则

- API-first：业务写操作优先走服务端 API。
- 类型共享：跨端请求/响应使用 `packages/irrigation-api` 管理。
- 领域纯函数共享：计算逻辑放在 `packages/irrigation-domain`。
- demo/production 隔离：演示设备和正式设备不能混用状态和模型。
- 可追溯：计划、策略、设备命令和人工动作都要能审计。

## 目标架构

```text
Web / 小程序 / MCP
  -> platform-api
      -> auth / project / permission
      -> field / zone / device / plan / strategy APIs
      -> execution engine
      -> device gateway adapter
      -> assistant adapter
      -> audit and event logs
  -> Supabase/Postgres
  -> MQTT broker / device providers
  -> Dify or AI provider
```

## 关键建设项

统一后端 API：

- Web 和小程序逐步收敛到同一业务 API。
- Supabase 作为数据库和 Auth 基础设施，而不是让所有端直接写业务表。

设备状态持久化：

- 建立设备状态事件或最新状态表。
- MQTT 回执、在线状态、阀门状态、错误都落库。

策略引擎：

- 独立策略评估流程。
- 支持建议、确认、自动执行三种模式。
- 保存评估上下文、结果和动作。

权限模型：

- 引入 project/organization。
- 定义管理员、调度员、巡检员、只读用户等角色。
- 数据表按项目隔离，操作按角色授权。

监控审计：

- 服务健康、API 错误、计划失败、设备失败、AI 上游失败都应有日志和告警。
- 关键动作保存操作人、时间、输入、结果。

