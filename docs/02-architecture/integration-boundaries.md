# 集成边界

## 端侧边界

| 调用方 | 当前边界 | 目标边界 |
| --- | --- | --- |
| Web | Supabase Auth + 部分 Supabase 直连 + 服务端计划接口 | 全部业务写操作收敛到服务端 API |
| 小程序 | 统一走 `execution-service /mini/*` | 保持统一 API 网关 |
| MCP | 复用 mini API | 复用安全受控平台 API |

## 外部服务边界

| 服务 | 当前用途 | 生产化要求 |
| --- | --- | --- |
| Supabase | Auth、Postgres、REST | 权限、迁移、备份、RLS 策略明确 |
| Dify | AI 助手问答 | API key 隔离、错误审计、上下文治理 |
| MQTT broker | 演示设备控制 | 多设备、安全凭证、ACK、事件落库 |
| 高德地图 | Web 地图展示 | key 管理、降级策略 |
| Open-Meteo | 天气/ET 数据 | 数据源可靠性和缓存策略 |

## demo 与正式边界

- demo 设备只能出现在调试页或显式标记场景。
- 正式设备列表默认不混入 demo 设备。
- demo MQTT 网关不得决定正式设备模型。
- demo seed 数据不得在生产环境自动执行。

## API 边界

- 小程序 API 以 `packages/irrigation-api` 为契约。
- 服务端内部 REST 调 Supabase 不直接暴露给端侧。
- Web 计划相关写操作统一通过 `POST /web/auth/exchange` + `/mini/plans*` 完成，不再直接改 `irrigation_plans` / `irrigation_plan_zones`。
- AI 和 MQTT 上游错误要转换为业务可理解错误，不泄露密钥和敏感配置。
