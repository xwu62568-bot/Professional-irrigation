# 当前代码现状盘点

本文件是当前仓库真实实现状态的索引，来源于早期 `docs/PROJECT_OVERVIEW.md` 的梳理。完整历史细节仍保留在 [../PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md)，后续主线规划请以 [../README.md](../README.md) 为入口。

## 当前已具备

- `web-dev`：Vite + React 管理端，包含登录、总览、地块地图、计划、策略、设备、AI、Wi-Fi demo 页面。
- `mini-program`：Taro 小程序，包含登录、总览、地块、计划策略、设备、我的、AI 助手。
- `execution-service`：mini API、Supabase REST、计划执行、AI 和 MQTT 聚合。
- `assistant-service`：Dify 流式代理。
- `mqtt-gateway-service`：固定 Wi-Fi 演示设备控制。
- `mcp-server`：平台能力 MCP tools。
- `packages/irrigation-domain`：领域模型、风险和仪表盘计算。
- `packages/irrigation-api`：mini API 类型和 endpoint。
- `supabase/migrations`：业务表、设备表、执行表、mini session 表。

## 当前重点实现文件

| 范围 | 关键文件 |
| --- | --- |
| Web 全局状态 | `web-dev/src/app/context/AppContext.tsx` |
| Web 路由 | `web-dev/src/app/routes.tsx` |
| Web 地块 | `web-dev/src/lib/fieldService.ts` |
| Web 设备 | `web-dev/src/lib/deviceService.ts` |
| Web 计划 | `web-dev/src/lib/planService.ts` |
| 小程序 API | `mini-program/src/services/dataService.ts` |
| 小程序鉴权 | `mini-program/src/services/auth.ts` |
| mini API 路由 | `services/execution-service/src/app.mjs` |
| mini view model | `services/execution-service/src/mini-service.mjs` |
| 执行状态机 | `services/execution-service/src/run-service.mjs` |
| Supabase REST | `services/execution-service/src/supabase-rest.mjs` |
| AI 代理 | `services/assistant-service/src/assistant-service.mjs` |
| MQTT 网关 | `services/mqtt-gateway-service/src/mqtt-manager.mjs` |

## 当前明确缺口

- 策略创建和动作接口未闭环。
- demo 设备和正式设备边界需要继续隔离。
- Web 直连 Supabase 写业务导致规则重复。
- 设备状态和 ACK 未落库。
- 权限模型仍是单用户所有权。
- ET 计算仍是占位。
- 测试覆盖不足。
- `web` 与 `web-dev` 的长期职责未定。

## 关键词索引

- `automation_strategies`：策略表，当前读取多于写入。
- `mini_sessions`：小程序服务端 token 表。
- `zone_device_bindings`：分区设备绑定，计划执行依赖。
- `device_command_logs`：设备命令日志。
- `Dify`：AI 助手上游。
- `MQTT`：设备控制链路。

