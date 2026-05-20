# Web Dev 模块

## 定位

`web-dev` 是当前主要 Web 管理端，承担复杂配置、地图管理、设备绑定、计划编排、策略配置和演示设备调试。

## 当前能力

- Supabase Auth 登录/注册。
- 调用 `POST /web/auth/exchange` 换取 execution token。
- 地块和分区管理。
- 设备管理和绑定。
- 灌溉计划管理、启停和手动执行入口。
- 自动策略页面和端侧表单。
- AI 助手入口。
- Wi-Fi 演示设备调试页。
- 高德地图和天气数据集成。
- 已接入 Supabase Realtime 订阅执行态（`plan_runs` / `plan_run_steps` / `device_events`），自动刷新计划视图。

当前计划相关链路：

- 登录态仍由 Supabase Auth 维护。
- Web 保存计划前通过 `/api/execution/web/auth/exchange` 交换 execution token。
- 计划 create/update/delete/start 统一调用 `execution-service /mini/plans*`。
- 计划读取当前仍以 Supabase 查询 + Realtime 订阅为主。

## 当前不标准点

- 多数业务写操作仍由浏览器直连 Supabase。
- 设备 seed 逻辑适合演示，不适合生产。
- `web` 与 `web-dev` 职责未明确。
- 部分页面仍存在 mock 或集成过渡逻辑。

## 后续标准做法

- 新业务写操作优先设计服务端 API。
- 延续灌溉计划做法，把高风险业务写路径逐步迁移到 `execution-service`。
- 业务 DTO 与小程序共享。
- demo 设备调试入口保持独立，不混入正式设备流程。
- 新增页面必须同步模块文档、缺口追踪和测试策略。
