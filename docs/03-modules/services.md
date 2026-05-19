# 服务端模块

## 服务列表

| 服务 | 作用 |
| --- | --- |
| `execution-service` | mini API、计划执行、Supabase REST、AI/MQTT 聚合 |
| `assistant-service` | mini token 校验、Dify 流式代理 |
| `mqtt-gateway-service` | 固定演示设备 HTTP 到 MQTT 网关 |
| `mcp-server` | 将平台能力暴露为 MCP tools |
| `services/shared` | mini auth/session 共享逻辑 |

## 当前能力

- 小程序登录、会话和业务读取。
- 计划创建、更新、启动、停止。
- 计划执行 run/step 事件驱动状态机（`event_driven` 引擎）。
- 演示设备控制转发。
- 设备命令与设备事件落库（`device_commands` / `device_events`）。
- AI 助手流式代理。
- MCP 查询和控制工具。

新增内部执行接口：

- `POST /internal/plans/:planId/dispatch`：供 `pg_cron` 触发计划执行。
- `POST /internal/commands/:commandId/dispatch`：命令分发入口。
- `POST /internal/device-events/ack`：MQTT 网关 ACK 回传入口。
- `POST /internal/steps/:stepId/timeout`：step 超时任务回调入口。

以上接口由 `x-internal-token` 保护，不对端侧开放。

双轨切流策略：

- `EXECUTION_ENGINE_MODE`：选择 `legacy` 或 `event_driven` 默认引擎。
- `EXECUTION_ENGINE_ROLLOUT_MODE`：`shadow` / `canary` / `full`。
- `EXECUTION_ENGINE_CANARY_PLAN_IDS`：在 `canary` 模式下按计划 ID 白名单切流。
- `EXECUTION_ROLLOUT_AUTO_ROLLBACK_ENABLED` + `EXECUTION_ROLLOUT_*`：按窗口失败率自动回落到 `legacy`。

## 当前不标准点

- `execution-service` 同时承担 API、执行、聚合，后续可能需要拆分边界。
- 策略写入和动作未完成。
- 端到端场景（跨服务 E2E、容量压测）仍需继续扩充。
- 告警当前采用“服务内日志 + `/health` 指标”模式，尚未引入外部告警平台集成。

## 后续标准做法

- 服务端成为业务写入口。
- 操作必须写审计或事件日志。
- 计划执行和设备命令必须可追溯。
- 外部上游错误必须统一转换和记录。
- Cron 生命周期统一治理：计划创建/更新触发 `sync_plan_schedule_job`，停用/切换为 manual/删除触发 `unsync_plan_schedule_job` 或孤儿清理任务。

