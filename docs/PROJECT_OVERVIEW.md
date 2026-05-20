# 智慧灌溉项目总览文档

> 归档说明：本文档保留为早期“代码现状盘点 + 业务逻辑备忘”。新的标准项目文档入口是 [docs/README.md](README.md)，当前代码现状已沉淀到 [reference/current-codebase-inventory.md](reference/current-codebase-inventory.md)。后续项目规划、缺口追踪和迭代管理不再继续堆叠到本文档。

本文档用于后续快速了解项目全貌、查找功能入口、定位问题和评估功能迭代影响范围。内容基于当前仓库代码整理，覆盖服务端、小程序、`web-dev` 端、共享包、Supabase 数据库和部署脚本。

## 1. 项目定位

本项目是一个智慧灌溉平台，核心目标是围绕地块、分区、设备、计划、策略和 AI 助手构建多端业务闭环。

主要端侧：

- `web-dev`：Web 管理端/设计原型落地端，面向地块地图、计划编排、策略配置、设备管理、演示设备调试和 AI 助手。
- `mini-program`：微信小程序移动工作台，面向现场查看、轻量调度、计划启停、设备巡检和 AI 咨询。
- `services`：Node 服务端微服务，承接小程序 API、计划执行、设备 MQTT 网关、Dify AI 代理和 MCP 工具能力。
- `supabase`：业务数据库 schema、RLS、视图、RPC 和 mini session 存储。
- `packages`：跨端共享领域模型、纯函数和 API 类型定义。

当前阶段特征：

- Web 端已接入 Supabase Auth，部分业务页仍保留 mock 兜底或集成过渡逻辑。
- 小程序原则上统一走 Node 服务，不直连 Supabase。
- 服务端已具备 mini API、计划执行、设备控制、AI 转发和 MCP server 骨架。
- 设备侧当前重点支持固定 Wi-Fi 演示设备和 MQTT 网关链路。

## 2. 顶层目录

| 路径 | 作用 |
| --- | --- |
| `web-dev/` | 当前主要 Web 开发端，Vite + React，包含管理端页面和 Supabase 集成 |
| `web/` | 另一份 Figma 导出/旧 Web 工程，结构与 `web-dev` 相近但集成程度较低 |
| `mini-program/` | Taro + React 微信小程序 |
| `services/execution-service/` | 小程序业务 API、计划执行、Supabase REST 访问、AI 代理入口 |
| `services/assistant-service/` | 小程序 AI 助手服务，校验 mini session 后代理 Dify 流式接口 |
| `services/mqtt-gateway-service/` | 固定 Wi-Fi 演示设备 MQTT 网关和 HTTP 控制接口 |
| `services/mcp-server/` | 将平台能力封装为 MCP tools，供 IDE/Agent/AI 客户端调用 |
| `services/shared/` | 服务端共享 mini auth/session 逻辑 |
| `packages/irrigation-domain/` | 领域模型、仪表盘计算、天气/地理纯函数 |
| `packages/irrigation-api/` | 小程序 API endpoint 和请求/响应类型 |
| `supabase/migrations/` | Supabase 业务表、执行表、设备绑定、mini session 等迁移 |
| `deploy/` | 阿里云 Docker Compose 和 Nginx 部署配置 |
| `scripts/` | 本地联调脚本和 SSH/SCP 辅助脚本 |

## 3. 总体架构

```text
Web 管理端 web-dev
  |-- Supabase Auth / REST 直连
  |-- execution-service /runs 手动执行
  |-- mqtt-gateway-service 演示设备调试
  |-- 外部 Open-Meteo / 高德地图

微信小程序 mini-program
  |-- execution-service /mini/*
        |-- Supabase Auth / REST
        |-- Supabase mini_sessions
        |-- run-service 计划执行
        |-- assistant-service /mini/assistant/messages
        |-- mqtt-gateway-service /devices/*/commands/*

assistant-service
  |-- 校验 mini session
  |-- Dify /chat-messages streaming

mqtt-gateway-service
  |-- MQTT over TLS
  |-- Wi-Fi 控制器设备

mcp-server
  |-- execution-service /mini/*
  |-- MCP tools: overview/fields/devices/plans/control
```

关键边界：

- 小程序只依赖 `execution-service` 的 `/mini/*` API，鉴权 token 由 mini auth 维护。
- `execution-service` 使用 `SUPABASE_SERVICE_ROLE_KEY` 通过 Supabase REST 读写业务表和执行表。
- `assistant-service` 也使用共享 mini auth 逻辑校验 token，再代理 Dify。
- `mqtt-gateway-service` 不直接理解业务计划，只接收设备控制 HTTP 请求并转 MQTT。
- `packages/irrigation-domain` 应保持纯函数/类型，不放端侧 I/O。

## 4. 共享包

### `packages/irrigation-domain`

核心文件：

- `src/models.ts`：领域模型，包含 `Field`、`Zone`、`Device`、`Plan`、`PlanZone`、`Strategy`。
- `src/dashboard.ts`：总览快照、风险地块、待执行计划、天气/传感器/供水概览等计算函数。
- `src/geo.ts`：地块/分区边界解析、中心点计算、经纬度到视觉坐标转换。
- `src/weather.ts`：降雨建议和天气位置推导。

典型用途：

- 小程序 `dataService.ts` 在 mock 模式下直接调用仪表盘纯函数。
- Web 端和服务端共享领域类型，避免重复定义业务结构。

### `packages/irrigation-api`

核心文件：

- `src/endpoints.ts`：`miniApi` 路径常量。
- `src/auth.ts`：小程序登录/登出响应。
- `src/overview.ts`：小程序总览响应。
- `src/fields.ts`：地块列表和详情响应。
- `src/devices.ts`：设备列表、详情和控制响应。
- `src/plans.ts`：计划列表、详情、创建和动作类型。
- `src/strategies.ts`：策略列表、详情、创建和动作类型。
- `src/assistant.ts`：AI 助手消息类型。
- `src/runtime.ts`：`/mini/me` 和 `/mini/runtime` 类型。

维护原则：

- 新增小程序 API 时，先在 `packages/irrigation-api/src/endpoints.ts` 和对应类型文件补齐类型，再改服务端和端侧。
- API envelope 统一为 `{ data: T }`，错误统一为 `{ error, code? }`。

## 5. 服务端

### 5.1 `execution-service`

定位：小程序业务 API 主入口、计划执行服务、Supabase REST 适配层、AI 和 MQTT 网关聚合层。

入口：

- `src/index.mjs`：加载配置，创建 auth、run、mini service，启动 HTTP server。
- `src/config.mjs`：读取 `HOST`、`PORT`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`MQTT_GATEWAY_BASE_URL`、`ASSISTANT_SERVICE_BASE_URL`、调度配置等。
- `src/app.mjs`：HTTP 路由。

主要 API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 服务健康检查 |
| `POST` | `/mini/auth/login` | 小程序登录，返回 mini accessToken |
| `POST` | `/mini/auth/logout` | 小程序登出 |
| `GET` | `/mini/me` | 当前用户和项目 |
| `GET` | `/mini/runtime` | 运行信息 |
| `GET` | `/mini/overview` | 小程序总览 |
| `GET` | `/mini/fields` | 地块列表 |
| `GET` | `/mini/fields/:id` | 地块详情 |
| `GET` | `/mini/devices` | 设备列表，支持 `includeDemo=true` |
| `GET` | `/mini/devices/:id` | 设备详情 |
| `POST` | `/mini/devices/:id/control` | 演示设备开关阀 |
| `GET` | `/mini/plans` | 计划列表 |
| `GET` | `/mini/plans/:id` | 计划详情 |
| `POST` | `/mini/plans` | 创建计划 |
| `PATCH` | `/mini/plans/:id` | 更新计划 |
| `POST` | `/mini/plans/:id/start` | 启动计划 |
| `POST` | `/mini/plans/:id/pause` | 暂停请求 |
| `POST` | `/mini/plans/:id/stop` | 停止请求 |
| `GET` | `/mini/strategies` | 策略列表 |
| `GET` | `/mini/strategies/:id` | 策略详情 |
| `POST` | `/mini/strategies` | 当前返回 501，尚未实现 |
| `POST` | `/mini/strategies/:id/(enable|disable|confirm|ignore)` | 当前返回 accepted 占位 |
| `POST` | `/mini/assistant/messages` | 代理到 `assistant-service`，保留流式响应 |
| `POST` | `/runs/manual-start` | Web 端手动启动计划 |
| `POST` | `/runs/:runId/stop` | 停止执行 |
| `GET` | `/runs/:runId` | 执行详情 |

内部模块：

- `src/mini-service.mjs`：将 Supabase 行数据组装成小程序 view model，负责地块、设备、计划、策略、总览、计划创建/更新。
- `src/run-service.mjs`：计划执行状态机，创建 `plan_runs` 和 `plan_run_steps`，按分区绑定下发 MQTT 开/关阀命令。
- `src/supabase-rest.mjs`：Supabase REST 封装，读写 mini sessions、plans、plan zones、runs、run steps、device command logs 等。
- `src/auth-service.mjs`：复用 `services/shared/mini-auth-service.mjs`。

计划执行逻辑：

1. `startManualRun(planId)` 或调度器触发 `startScheduledRun(planId)`。
2. 读取计划、计划分区、分区设备绑定、设备信息。
3. 创建 `plan_runs`，为每个分区创建 `plan_run_steps`。
4. 对当前分区绑定设备下发开阀命令，写入 `device_command_logs`。
5. 按分区时长等待，期间轮询是否请求取消。
6. 分区结束后下发关阀命令，更新 step 状态。
7. 全部完成后更新 run 为 completed；异常则更新为 failed；停止请求通过 `cancel_requested` 协调。

调度器逻辑：

- `EXECUTION_SCHEDULER_ENABLED=true` 时启用。
- 根据计划的 `daily`、`weekly`、`interval` 和 `start_at` 判断当前分钟是否应执行。
- 通过 `recentlyScheduled` 和已有 run 窗口避免重复调度。

### 5.2 `assistant-service`

定位：小程序 AI 助手服务，校验 mini token 后代理 Dify streaming chat API。

入口：

- `src/index.mjs`：加载配置、创建 auth service 和 assistant service。
- `src/app.mjs`：HTTP 路由和 NDJSON 流式输出。
- `src/assistant-service.mjs`：Dify SSE 解析和转 NDJSON。

主要 API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `POST` | `/mini/auth/login` | 兼容 mini 登录 |
| `POST` | `/mini/auth/logout` | 兼容 mini 登出 |
| `POST` | `/mini/assistant/messages` | 校验 token，调用 Dify `/chat-messages`，输出 NDJSON |

流式协议：

- 上游 Dify 返回 SSE。
- 服务解析 `answer`、`conversation_id`、`message_id`、`created_at`。
- 下游输出逐行 JSON：`delta`、`done`、`error`。

关键环境变量：

- `ASSISTANT_SERVICE_HOST`
- `ASSISTANT_SERVICE_PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `DIFY_BASE_URL`
- `DIFY_API_KEY`

### 5.3 `mqtt-gateway-service`

定位：固定 Wi-Fi 演示设备的 HTTP 到 MQTT 网关。

入口：

- `src/index.mjs`：加载配置、创建 gateway、启动 HTTP server。
- `src/app.mjs`：HTTP API。
- `src/mqtt-manager.mjs`：MQTT TLS 连接、topic 拼接、消息解析、状态缓存、自动断开。

主要 API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查，返回 broker 和当前 state |
| `GET` | `/demo/state` | 当前演示设备状态 |
| `POST` | `/demo/request-device-info` | 请求设备信息 |
| `POST` | `/devices/:deviceId/commands/open` | 开阀 |
| `POST` | `/devices/:deviceId/commands/close` | 关阀 |
| `GET` | `/devices/:deviceId/status` | 设备状态 |

关键状态：

- `connectionStatus`：`idle`、`connecting`、`connected`、`error` 等。
- `online`、`rssi`、`firmware`、`lastMessageAt`。
- `valveStatus`：阀门状态数组。
- `controlReply`：设备控制回执。
- `mqttConnected`：底层 MQTT 连接状态。

关键环境变量：

- `WIFI_DEMO_MQTT_HOST`
- `WIFI_DEMO_MQTT_PORT`
- `WIFI_DEMO_MQTT_ACCOUNT`
- `WIFI_DEMO_MQTT_USER_ID`
- `WIFI_DEMO_MQTT_PASSWORD`
- `WIFI_DEMO_DEVICE_ID`
- `WIFI_DEMO_TOPIC_*`
- `WIFI_DEMO_CA_CERT_PATH`
- `WIFI_DEMO_CLIENT_CERT_PATH`
- `WIFI_DEMO_CLIENT_CERT_PASSPHRASE`

### 5.4 `mcp-server`

定位：将灌溉平台能力暴露为 MCP tools，供 IDE、Agent 或 AI 客户端调用。

入口：

- `src/index.ts`：stdio transport。
- `src/http.ts`：Streamable HTTP transport，路径 `/mcp`。
- `src/server.ts`：注册 MCP tools。
- `src/platform-client.ts`：登录 execution-service，调用 `/mini/*`。

MCP tools：

- `get_overview`
- `list_fields`
- `get_field_detail`
- `list_devices`
- `get_device_detail`
- `list_plans`
- `get_plan_detail`
- `start_plan`
- `stop_plan`
- `control_device`

关键环境变量：

- `IRRIGATION_EXECUTION_BASE_URL`
- `IRRIGATION_MCP_EMAIL`
- `IRRIGATION_MCP_PASSWORD`
- `MCP_SERVER_HOST`
- `MCP_SERVER_PORT`
- `MCP_SERVER_AUTH_TOKEN`
- `MCP_SERVER_ALLOWED_HOSTS`

## 6. 小程序

技术栈：Taro 4 + React 18 + TypeScript。

入口：

- `mini-program/src/app.config.ts`：页面和 tabBar 配置。
- `mini-program/src/app.tsx`：应用根组件。
- `mini-program/src/services/config.ts`：编译期注入运行配置。
- `mini-program/config/*.js`：不同 profile 的配置来源。

页面结构：

| 页面 | 路径 | 功能 |
| --- | --- | --- |
| 登录 | `pages/login/index` | 邮箱密码登录，保存 mini accessToken |
| 总览 | `pages/index/index` | 总览指标、地图字段、高风险地块、建议和即将执行 |
| 地块列表 | `pages/fields/index` | 地块状态、作物、面积、墒情 |
| 地块详情 | `pages/fields/detail/index` | 地块、分区、关联设备 |
| 计划策略 | `pages/plans/index` | 计划和策略双 tab，支持计划启停 |
| 计划详情 | `pages/plans/plan-detail/index` | 计划参数、分区顺序、动作 |
| 计划创建/编辑 | `pages/plans/plan-create/index` | 创建/更新计划，选择地块和分区 |
| 策略详情 | `pages/plans/strategy-detail/index` | 查看策略 |
| 策略创建 | `pages/plans/strategy-create/index` | 端侧表单已具备，服务端创建仍未实现 |
| 设备列表 | `pages/devices/index` | 设备巡检列表和筛选 |
| 设备详情 | `pages/devices/detail/index` | 设备状态和演示设备控制 |
| 我的 | `pages/account/index` | 用户、项目、运行环境和登出 |
| AI 助手 | `pages/assistant/index` | 流式对话、conversationId 续聊 |

服务封装：

- `src/services/endpoints.ts`：小程序 API 路径，与 `packages/irrigation-api` 基本对应。
- `src/services/auth.ts`：登录、登出、token 存储、自动配置账号登录。
- `src/services/http.ts`：`apiGet`、`apiPost`、`apiPatch`，统一加 `Authorization: Bearer <token>`。
- `src/services/dataService.ts`：页面级业务函数，负责在 mock 和真实 API 之间切换、将 API 响应转换为页面 view model。

鉴权流程：

1. 登录页调用 `loginWithCredentials(email, password)`。
2. 请求 `execution-service /mini/auth/login`。
3. 服务端用 Supabase Auth 验证账号密码，创建 mini session。
4. 小程序本地存储 `mini_access_token` 和过期时间。
5. 后续请求 `apiGet/apiPost/apiPatch` 自动附带 Bearer token。
6. 401 时清理本地 session，提示重新登录。

AI 助手流程：

1. 页面调用 `sendAssistantMessageStream`。
2. 请求 `execution-service /mini/assistant/messages`。
3. `execution-service` 转发到 `assistant-service`。
4. `assistant-service` 校验 token 后调用 Dify。
5. 小程序解析 NDJSON 增量事件并更新消息。

## 7. Web 开发端 `web-dev`

技术栈：Vite + React 18 + React Router 7 + Supabase JS + MUI/Radix/shadcn 风格组件 + 高德地图 + Open-Meteo。

入口：

- `web-dev/src/main.tsx`
- `web-dev/src/app/App.tsx`
- `web-dev/src/app/routes.tsx`
- `web-dev/src/app/context/AppContext.tsx`

路由：

| 路由 | 页面 | 功能 |
| --- | --- | --- |
| `/login` | `Login` | Supabase Auth 登录 |
| `/register` | `Register` | 注册 |
| `/overview` | `Overview` | 平台总览 |
| `/field-map` | `FieldMap` | 地块地图、地块/分区编辑和地图可视化 |
| `/field/:id` | `FieldDetail` | 地块详情 |
| `/irrigation-plan` | `IrrigationPlan` | 计划列表、创建编辑、手动执行 |
| `/auto-strategy` | `AutoStrategy` | 自动策略管理 |
| `/devices` | `Devices` | 设备管理和绑定 |
| `/ai-assistant` | `AiAssistant` | Web AI 助手入口 |
| `/wifi-device-demo` | `WifiDeviceDemo` | 固定 Wi-Fi 演示设备 MQTT 调试 |
| `/account` | `Account` | 账号信息 |
| `__WEB_AI_ASSISTANT_MINI_PAGE_ROUTE__` | `MiniAiAssistant` | Web 内嵌/小程序样式 AI 页面 |

全局状态：

- `AppContext.tsx` 管理认证态、当前用户、地块、设备、计划、策略和选中地块。
- Supabase 未配置时，部分数据回退 mock。
- 登录态来自 `supabase.auth.getSession()` 和 `onAuthStateChange()`。
- 地块每 5 秒刷新一次，设备和计划在认证变化后刷新。

核心服务：

- `src/lib/supabase.ts`：Supabase client，依赖 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
- `src/lib/fieldService.ts`：地块/分区 CRUD，ET 和状态映射，地理边界转换。
- `src/lib/deviceService.ts`：设备 seed、查询、分区设备绑定、清理绑定。
- `src/lib/planService.ts`：计划 CRUD，计划分区映射。
- `src/lib/weatherEtService.ts`：Open-Meteo 天气/ET 数据。
- `src/lib/amap.ts`：高德 JS API 加载。
- `src/lib/wifiDemoGateway.ts`：调用 `mqtt-gateway-service` 演示设备接口。
- `src/lib/wifiDemoConfig.ts`：前端演示设备配置。
- `src/lib/aiAssistant.ts`：AI 助手 URL 配置。

Web 与服务端关系：

- Web 登录和大部分业务 CRUD 直接访问 Supabase。
- `IrrigationPlan` 手动执行通过 `VITE_EXECUTION_SERVICE_URL` 调用 `execution-service /runs/manual-start`。
- `WifiDeviceDemo` 通过 `VITE_MQTT_GATEWAY_URL` 调用 MQTT 网关。
- 地图依赖 `VITE_AMAP_KEY` 和可选 `VITE_AMAP_SECURITY_JS_CODE`。

`web/` 说明：

- `web/` 是另一份 Vite React 工程，README 显示仍偏 Figma 代码包形态。
- 后续若只维护一套 Web，建议以 `web-dev/` 为主，并明确 `web/` 是历史快照、生产端还是待合并分支。

## 8. 数据库和业务对象

Supabase 迁移位于 `supabase/migrations/`。

主要业务表：

| 表 | 说明 |
| --- | --- |
| `profiles` | 用户资料，由 auth user 触发创建 |
| `fields` | 地块，包含作物、面积、边界、ET 参数等 |
| `field_zones` | 地块分区，包含边界、优先级、站号等 |
| `irrigation_plans` | 灌溉计划，周期、模式、执行方式、雨锁等 |
| `irrigation_plan_zones` | 计划与分区顺序、时长 |
| `automation_strategies` | 自动策略，阈值/ET、模式、范围、雨锁等 |
| `field_et_configs` | 地块 ET 配置 |
| `field_et_daily` | 每日 ET 数据 |
| `irrigation_devices` | 控制器/传感器设备 |
| `zone_device_bindings` | 分区与设备通道/站点绑定 |
| `plan_runs` | 计划执行实例 |
| `plan_run_steps` | 执行步骤，每个分区一条 |
| `device_command_logs` | 设备命令日志 |
| `mini_sessions` | 小程序 token 会话 |

视图和 RPC：

- `field_summary_view`：地块摘要视图。
- `dashboard_overview_view`：仪表盘摘要视图。
- `recalculate_field_et(p_field_id uuid, p_date date)`：ET 重算函数，当前算法仍是占位计算。

RLS：

- 业务表启用 RLS。
- 现有策略以单用户所有权为主，尚未引入组织、角色和权限矩阵。
- 服务端通过 service role 访问，Web 端通过 Supabase Auth 和 RLS 访问。

## 9. 核心业务流

### 9.1 地块和分区

Web 端：

1. 用户登录 Supabase。
2. `fieldService` 读取 `fields`、`field_zones`、`field_et_configs`。
3. 页面展示地图、边界、分区、墒情、ET 和状态。
4. 创建/更新/删除地块时直接写 Supabase。

小程序：

1. 请求 `/mini/fields` 或 `/mini/fields/:id`。
2. `execution-service mini-service` 从 Supabase 读取地块、分区、设备绑定、执行状态。
3. 服务端组装适合移动端的列表/详情 view model。

### 9.2 设备和绑定

Web 端：

1. `deviceService` seed 或读取 `irrigation_devices`。
2. 设备可以绑定到 `zone_device_bindings`。
3. 绑定关系影响计划执行时的设备命令下发。

小程序：

1. `/mini/devices` 返回真实设备，可选包含固定 demo 设备。
2. `/mini/devices/:id` 返回详情和控制能力。
3. 只有 `source=demo` 的设备支持直接控制。

设备控制：

1. 小程序或 Web 调用 HTTP 控制接口。
2. `execution-service` 或 Web demo client 转到 `mqtt-gateway-service`。
3. MQTT 网关拼接 topic，发送设备控制 payload。
4. 收到回执后更新内存状态，并通过 HTTP state 返回。

### 9.3 灌溉计划

计划配置：

- Web 端通过 `POST /web/auth/exchange` 换取 execution token 后，调用 `/mini/plans*` 完成计划 create/update/delete/start。
- 小程序通过 `/mini/plans*` 创建/更新/启动计划。
- 计划包含周期、开始时间、模式、执行模式、雨锁、目标水量、分区顺序和分区时长。

计划执行：

1. 用户手动启动或调度器自动触发。
2. `run-service` 校验计划和绑定。
3. 写入 `plan_runs` 和 `plan_run_steps`。
4. 按分区顺序发送开阀/关阀命令。
5. 更新执行状态和命令日志。

### 9.4 自动策略

当前状态：

- 数据模型和列表/详情读取已存在。
- 小程序端策略创建表单已存在。
- `execution-service /mini/strategies` 创建接口仍返回 501。
- 策略动作接口当前是 accepted 占位，不会真正改数据库或触发执行。

后续迭代策略时，需要同时补：

- `packages/irrigation-api/src/strategies.ts`
- `mini-program/src/pages/plans/strategy-create/index.tsx`
- `mini-program/src/services/dataService.ts`
- `services/execution-service/src/app.mjs`
- `services/execution-service/src/mini-service.mjs`
- Supabase `automation_strategies` 写入逻辑

### 9.5 AI 助手

小程序链路：

```text
assistant page
  -> dataService.sendAssistantMessageStream
  -> execution-service /mini/assistant/messages
  -> assistant-service /mini/assistant/messages
  -> Dify /chat-messages
  -> NDJSON delta/done/error
```

定位问题时优先检查：

- 小程序 token 是否有效。
- `ASSISTANT_SERVICE_BASE_URL` 是否指向可访问的 assistant-service。
- `DIFY_API_KEY` 是否配置。
- `assistant-service` 日志中 Dify 上游错误。
- 小程序是否正确解析 NDJSON。

## 10. 启动、构建和部署

### 本地 Web

```bash
cd web-dev
npm install
npm run dev
```

### 本地小程序

```bash
cd mini-program
npm install
npm run dev:local
```

构建产物在 `mini-program/dist`，由微信开发者工具打开。

### 本地全栈联调

```bash
./scripts/start-irrigation-dev.sh
```

该脚本会：

- 读取 `web-dev/.env` 和 `services/.env`。
- 检查 Supabase 和 Wi-Fi demo MQTT 必要变量。
- 清理并启动端口 `4310`、`4311`、`4320`、`5173`。
- 启动 `mqtt-gateway-service`、`execution-service`、`assistant-service`、`web-dev`。

默认端口：

| 服务 | 默认地址 |
| --- | --- |
| Web | `http://127.0.0.1:5173` |
| execution-service | `http://127.0.0.1:4310` |
| assistant-service | `http://127.0.0.1:4311` |
| mqtt-gateway-service | `http://127.0.0.1:4320` |
| mcp-server | `http://127.0.0.1:4330` |

### 服务端单独启动

```bash
cd services/execution-service
npm run start

cd services/assistant-service
npm run start

cd services/mqtt-gateway-service
npm run start

cd services/mcp-server
npm run build
npm run start:http
```

### GitHub Pages

`.github/workflows/deploy-web-dev-pages.yml` 会在 `main` 分支且 `web-dev/**` 变更时构建并部署 `web-dev/dist` 到 GitHub Pages。

关键构建变量：

- `VITE_USE_HASH_ROUTER=true`
- `VITE_PUBLIC_BASE=/<repo>/`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AMAP_KEY`
- `VITE_AMAP_SECURITY_JS_CODE`
- `VITE_EXECUTION_SERVICE_URL`
- `VITE_MQTT_GATEWAY_URL`
- `VITE_WIFI_DEMO_DEVICE_ID`
- `VITE_WIFI_DEMO_STATIONS`

### 阿里云 Docker Compose

`deploy/docker-compose.aliyun.yml` 定义：

- `nginx`
- `execution-service`
- `assistant-service`
- `mqtt-gateway-service`
- `mcp-server`

服务端统一读取 `services/.env.production`。Nginx 配置位于 `deploy/nginx/`。

## 11. 环境变量索引

### Web `web-dev`

| 变量 | 说明 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_AMAP_KEY` | 高德地图 key |
| `VITE_AMAP_SECURITY_JS_CODE` | 高德安全密钥，可选 |
| `VITE_EXECUTION_SERVICE_URL` | execution-service 地址 |
| `VITE_MQTT_GATEWAY_URL` | mqtt-gateway-service 地址 |
| `VITE_USE_HASH_ROUTER` | GitHub Pages 等静态部署场景用 hash router |
| `VITE_WIFI_DEMO_*` | Web 端演示设备配置 |

### 小程序编译常量

| 常量 | 说明 |
| --- | --- |
| `__MINI_PROGRAM_PROFILE__` | `local` 或 `test` |
| `__MINI_USE_MOCK_DATA__` | 是否使用 mock |
| `__MINI_EXECUTION_SERVICE_URL__` | execution-service 地址 |
| `__MINI_ASSISTANT_SERVICE_URL__` | assistant-service 地址 |
| `__MINI_MQTT_GATEWAY_URL__` | mqtt-gateway-service 地址 |
| `__MINI_AI_ASSISTANT_URL__` | AI 助手 URL |
| `__MINI_AUTH_EMAIL__` | 调试默认账号 |
| `__MINI_AUTH_PASSWORD__` | 调试默认密码 |

### 服务端

| 变量 | 服务 | 说明 |
| --- | --- | --- |
| `SUPABASE_URL` | execution/assistant | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | execution/assistant | 服务端访问 Supabase |
| `SUPABASE_ANON_KEY` | execution/assistant | Supabase auth fallback |
| `MINI_SESSION_TTL_HOURS` | execution/assistant | mini token 过期小时数 |
| `MINI_AUTH_UPSTREAM_TIMEOUT_MS` | execution/assistant | Supabase Auth 超时 |
| `MQTT_GATEWAY_BASE_URL` | execution | MQTT 网关地址 |
| `ASSISTANT_SERVICE_BASE_URL` | execution | AI 服务地址 |
| `EXECUTION_DURATION_SCALE` | execution | 执行时长缩放，便于测试 |
| `EXECUTION_STATUS_POLL_MS` | execution | 执行轮询间隔 |
| `EXECUTION_SCHEDULER_ENABLED` | execution | 是否启用自动调度 |
| `EXECUTION_SCHEDULER_POLL_MS` | execution | 调度轮询间隔 |
| `DIFY_BASE_URL` | assistant | Dify API 地址 |
| `DIFY_API_KEY` | assistant | Dify app key |
| `WIFI_DEMO_*` | mqtt gateway | MQTT 账号、topic、设备和证书 |
| `IRRIGATION_EXECUTION_BASE_URL` | mcp | execution-service 地址 |
| `IRRIGATION_MCP_EMAIL` | mcp | MCP 登录账号 |
| `IRRIGATION_MCP_PASSWORD` | mcp | MCP 登录密码 |
| `MCP_SERVER_AUTH_TOKEN` | mcp | HTTP MCP Bearer token，可选 |

## 12. 功能迭代定位索引

新增或调整地块能力：

- Web 页面：`web-dev/src/app/pages/FieldMap.tsx`、`FieldDetail.tsx`
- Web 服务：`web-dev/src/lib/fieldService.ts`
- 小程序页面：`mini-program/src/pages/fields/*`
- 小程序服务：`mini-program/src/services/dataService.ts`
- 服务端：`services/execution-service/src/mini-service.mjs`
- 数据库：`supabase/migrations/*fields*`、`field_zones`
- 类型：`packages/irrigation-domain/src/models.ts`、`packages/irrigation-api/src/fields.ts`

新增或调整设备能力：

- Web 页面：`web-dev/src/app/pages/Devices.tsx`、`WifiDeviceDemo.tsx`
- Web 服务：`web-dev/src/lib/deviceService.ts`、`wifiDemoGateway.ts`
- 小程序页面：`mini-program/src/pages/devices/*`
- 服务端：`execution-service/src/app.mjs`、`mini-service.mjs`、`mqtt-gateway-service/src/*`
- 数据库：`irrigation_devices`、`zone_device_bindings`、`device_command_logs`
- 类型：`packages/irrigation-api/src/devices.ts`

新增或调整计划能力：

- Web 页面：`web-dev/src/app/pages/IrrigationPlan.tsx`
- Web 服务：`web-dev/src/lib/planService.ts`
- 小程序页面：`mini-program/src/pages/plans/*`
- 服务端 API：`services/execution-service/src/app.mjs`
- 服务端执行：`services/execution-service/src/run-service.mjs`
- Supabase REST：`services/execution-service/src/supabase-rest.mjs`
- 数据库：`irrigation_plans`、`irrigation_plan_zones`、`plan_runs`、`plan_run_steps`
- 类型：`packages/irrigation-api/src/plans.ts`

新增或调整策略能力：

- Web 页面：`web-dev/src/app/pages/AutoStrategy.tsx`
- 小程序页面：`mini-program/src/pages/plans/strategy-*`
- 服务端：`execution-service/src/app.mjs`、`mini-service.mjs`
- 数据库：`automation_strategies`
- 类型：`packages/irrigation-api/src/strategies.ts`
- 注意：策略创建和动作目前服务端仍是未完成/占位状态。

新增或调整 AI 助手：

- 小程序页面：`mini-program/src/pages/assistant/index.tsx`
- 小程序流式请求：`mini-program/src/services/dataService.ts`
- 服务端代理：`execution-service/src/app.mjs`
- AI 服务：`assistant-service/src/app.mjs`、`assistant-service/src/assistant-service.mjs`
- 类型：`packages/irrigation-api/src/assistant.ts`
- 外部依赖：Dify。

新增或调整 MCP 能力：

- Tool 定义：`services/mcp-server/src/server.ts`
- 平台 API client：`services/mcp-server/src/platform-client.ts`
- 服务端 API：优先复用 `execution-service /mini/*`

## 13. 常见问题排查

登录失败：

- Web：检查 `web-dev/.env` 的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
- 小程序：检查 `__MINI_EXECUTION_SERVICE_URL__` 是否可访问。
- 服务端：检查 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、Supabase Auth 用户是否存在。
- mini session：检查 `mini_sessions` 表迁移是否已推送。

小程序接口 401：

- 本地 token 过期或服务端 session 丢失。
- 小程序会清理 session，需要重新登录。
- 检查 `mini_sessions` 记录、TTL 和服务端时间。

小程序请求失败或超时：

- 检查 `execution-service /health`。
- 手机或开发者工具网络是否能访问配置的服务地址。
- 本地不要使用小程序无法访问的 `127.0.0.1`，真机需要局域网 IP 或公网地址。

Web 地图不显示：

- 检查 `VITE_AMAP_KEY`。
- 如开启高德安全密钥，检查 `VITE_AMAP_SECURITY_JS_CODE`。
- `FieldMap.tsx` 页面内也会提示缺少高德 key。

计划启动失败：

- 检查计划是否有分区。
- 检查分区是否存在 `zone_device_bindings`。
- 检查绑定设备是否有 `client_key`。
- 检查 `mqtt-gateway-service /health`。
- 检查 `plan_runs`、`plan_run_steps`、`device_command_logs`。

设备控制失败：

- 只有 demo 设备支持小程序直接控制。
- 检查 `WIFI_DEMO_DEVICE_ID` 是否一致。
- 检查 MQTT 账号、证书路径和 topic 配置。
- 查看 `mqtt-gateway-service` 日志中的 `mqtt:connecting`、`mqtt:message`、`mqtt:error`。

AI 助手无回复：

- 检查 `assistant-service /health`。
- 检查 `execution-service` 的 `ASSISTANT_SERVICE_BASE_URL`。
- 检查 `DIFY_API_KEY` 和 `DIFY_BASE_URL`。
- 检查 Dify 上游是否返回非 2xx。
- 检查小程序 NDJSON 流式解析是否收到 `error` 事件。

GitHub Pages 登录失败：

- 检查 workflow 中使用的是 repo variables/secrets。
- `VITE_SUPABASE_URL` 用 vars，`VITE_SUPABASE_ANON_KEY` 用 secrets。
- 检查 Supabase Auth redirect/site URL 是否允许 GitHub Pages 域名。

## 14. 当前明显待完善项

- `automation_strategies` 的创建、启停、确认、忽略仍需服务端真实实现。
- Web 和小程序对策略能力的写入链路未完全闭环。
- `web/` 与 `web-dev/` 的职责需要明确，避免双工程长期分叉。
- Supabase 权限模型当前以单用户所有权为主，后续项目/组织/角色权限需要重新设计。
- ET 计算函数当前仍是占位算法，需要接入真实气象和作物参数。
- MQTT 网关当前围绕固定演示设备实现，通用多设备接入、ACK 可靠性和命令重试仍需完善。
- 服务端测试覆盖较少，仅 `assistant-service` 有基础测试。

## 15. 详细业务逻辑附录

本章按真实业务对象展开，重点说明“数据从哪里来、在哪一层转换、由谁写入、状态如何变化、出问题时查哪里”。

### 15.1 业务对象关系

核心对象关系：

```text
auth.users
  -> profiles
  -> fields
      -> field_zones
          -> zone_device_bindings
              -> irrigation_devices
      -> irrigation_plans
          -> irrigation_plan_zones
          -> plan_runs
              -> plan_run_steps
              -> device_command_logs
      -> automation_strategies
      -> field_et_configs
      -> field_et_daily

mini_sessions
  -> user_id
```

业务含义：

- 用户是当前权限边界，`fields.user_id`、`irrigation_plans.user_id`、`irrigation_devices.user_id` 等字段决定数据归属。
- 地块是经营和调度的基本单位，分区是执行单位。
- 设备可以是控制器或传感器；只有控制器绑定到分区后，计划执行才能下发阀门命令。
- 计划描述“何时、以什么模式、按什么顺序执行哪些分区”。
- 执行实例 `plan_runs` 是计划的一次运行，`plan_run_steps` 是这次运行中的每个分区步骤。
- 策略当前主要是读取展示，尚未形成真实自动决策闭环。
- 小程序不直接使用 Supabase session，而是使用服务端生成的 `mini_sessions.token`。

### 15.2 用户、登录和会话逻辑

Web 登录：

```text
Login.tsx
  -> AppContext.login()
  -> supabase.auth.signInWithPassword()
  -> Supabase session
  -> AppContext 监听 onAuthStateChange
  -> 加载 fields/devices/plans
```

Web 端直接持有 Supabase session，因此业务 CRUD 大多由浏览器调用 Supabase JS 完成。RLS 策略决定用户能访问哪些数据。

小程序登录：

```text
pages/login/index.tsx
  -> loginWithCredentials()
  -> POST /mini/auth/login
  -> shared mini-auth-service
  -> Supabase Auth password grant
  -> create mini_sessions row
  -> 返回 accessToken/expiresAt/user/project
  -> Taro storage 保存 token 和过期时间
```

小程序请求鉴权：

- `apiGet`、`apiPost`、`apiPatch` 每次先调用 `ensureAuthenticated()`。
- 如果本地 token 未过期，直接使用。
- 如果本地 token 不存在或过期，尝试用配置账号自动登录。
- 请求头统一带 `authorization: Bearer <token>`。
- 服务端通过 `authService.getSession(req)` 查 `mini_sessions`。
- session 无效时返回 `401` 和 `AUTH_SESSION_INVALID`，端侧清理本地 token。

服务端 session 存储：

- `mini_sessions.token` 是服务端生成的 mini token。
- `mini_sessions.user_id` 关联 Supabase user。
- `mini_sessions.expires_at` 控制过期。
- `MINI_SESSION_TTL_HOURS` 控制默认有效期。

排障要点：

- Web 登录失败优先查 Supabase Auth 配置和 `VITE_SUPABASE_*`。
- 小程序登录失败优先查 `execution-service` 是否能访问 Supabase Auth。
- 小程序 401 优先查 `mini_sessions` 是否存在、是否过期、服务端时间是否正确。
- `SUPABASE_SERVICE_ROLE_KEY` 错误会导致服务端 session 创建/读取失败。

### 15.3 地块业务逻辑

地块字段的业务含义：

| 字段 | 业务含义 |
| --- | --- |
| `name`、`code` | 地块展示名称和编号 |
| `crop`、`growth_stage` | 作物和生育期，用于 ET/Kc 和建议展示 |
| `area_mu` | 面积，单位亩 |
| `boundary` | 地块经纬度边界 |
| `irrigation_efficiency` | 灌溉效率，水量模式计算用 |
| `soil_moisture` | 当前墒情，当前多由估算或传感器数据映射 |
| `et0`、`etc` | 参考蒸散和作物需水 |
| `rainfall_24h` | 近 24 小时降雨 |

Web 地块读取：

```text
AppContext.refreshFields()
  -> fetchFieldsFromSupabase()
  -> fields / field_zones / field_et_configs
  -> toField()
  -> 页面消费 Field[]
```

Web 地块写入：

- `createFieldInSupabase()` 写 `fields`。
- `createZoneInSupabase()` 写 `field_zones`。
- `updateFieldInSupabase()` 更新地块基础字段、边界和 ET 参数。
- `updateZoneInSupabase()` 更新分区名称、边界、站号等。
- `deleteZonesByFieldInSupabase()` 删除地块分区。
- `deleteFieldInSupabase()` 删除地块。

小程序地块读取：

```text
GET /mini/fields
  -> miniService.listFields()
  -> fetchFieldBundle()
  -> fields + field_zones + et configs + active runs
  -> MiniFieldListItem[]

GET /mini/fields/:id
  -> miniService.getFieldDetail()
  -> field detail + related devices
```

状态推导：

- `deriveFieldStatus(netNeed, etc)`：根据净需水和 ETc 推导 `normal`、`warning`、`alarm`。
- `estimateSoilMoisture(netNeed)`：基于净需水估算墒情。
- `zoneStatusFor(fieldStatus, priority, activeRun, zoneId)`：结合当前执行步骤和地块风险推导分区状态。
- 如果当前执行中的 run 指向某分区，则该分区为 `running`。
- 如果 run 中还有待执行 step，则对应分区可为 `pending`。
- 如果地块告警且分区优先级高，则分区可为 `alarm`。

地图坐标逻辑：

- 数据库保存经纬度边界。
- `packages/irrigation-domain/src/geo.ts` 的 `computeGeoCenter()` 计算中心点。
- Web 页面需要视觉坐标时，使用 `applyVisualGeometryFromGeo()` 将经纬度缩放到画布坐标。
- `FieldMap.tsx` 还会优先加载高德地图；未配置 key 时使用提示和降级展示。

新增地块字段时的影响范围：

- 数据库迁移新增字段。
- `web-dev/src/lib/fieldService.ts` 补 row type、读写映射。
- `packages/irrigation-domain/src/models.ts` 补领域类型。
- `services/execution-service/src/mini-service.mjs` 补服务端映射。
- `packages/irrigation-api/src/fields.ts` 补小程序 API 类型。
- 小程序页面按需展示。

### 15.4 分区业务逻辑

分区是计划执行和设备绑定的最小业务单位。

关键字段：

| 字段 | 业务含义 |
| --- | --- |
| `field_id` | 所属地块 |
| `name` | 分区名称 |
| `site_number` | 站点编号，常用于显示和执行步骤 |
| `station_no` | 站号/通道标识 |
| `boundary` | 分区边界 |
| `priority` | 风险/调度排序参考 |
| `duration_minutes` | 默认灌溉时长 |

执行相关逻辑：

- 计划创建时，端侧选择地块后读取该地块分区。
- `resolvePlanZoneRows(fields, input.zones)` 会校验输入 zone 是否存在于用户地块中。
- 计划分区写入 `irrigation_plan_zones`，保存 `sort_order`、`duration_minutes`、`enabled`。
- 执行时只按计划分区顺序执行，不直接遍历地块所有分区。

设备绑定相关逻辑：

- 分区通过 `zone_device_bindings` 绑定设备和站点。
- 执行服务读取当前计划涉及的 zoneIds，再查询绑定。
- 当前执行逻辑对每个 zone 只保留第一个 controller 绑定，多余 controller 会跳过并写日志。
- 非 controller 设备不会参与开关阀。

### 15.5 设备业务逻辑

设备类型：

- `controller`：控制器，可开关阀，参与计划执行。
- `sensor`：传感器，用于展示状态、墒情、雨量、温度等，当前不参与开关阀执行。

设备来源：

- `real`：来自 Supabase `irrigation_devices`。
- `demo`：由配置生成的固定演示设备，不一定存在于数据库。

Web 设备逻辑：

```text
AppContext.refreshDevices()
  -> seedDevicesInSupabase(user.id)
  -> fetchDevicesFromSupabase()
  -> withWifiDemoDevice()
  -> Devices / FieldMap / WifiDeviceDemo
```

`seedDevicesInSupabase()` 的作用是将 mock 或内置设备种子补入 Supabase，便于集成阶段有可用设备数据。真实生产环境应谨慎使用 seed，避免覆盖或污染正式设备台账。

设备绑定逻辑：

- `saveZoneDeviceBindingsInSupabase()` 写 `zone_device_bindings`。
- 绑定保存 field、zone、device、station/channel 等信息。
- `clearDeviceAssignmentsForFieldInSupabase()` 可清理某地块相关绑定。

小程序设备列表：

```text
GET /mini/devices?includeDemo=true
  -> miniService.listDevices()
  -> fetchRealDevices()
  -> 可选 append getDemoDevices()
  -> MiniDeviceListItem[]
```

小程序设备详情：

```text
GET /mini/devices/:id
  -> miniService.getDeviceDetail()
  -> device + fieldName + source + control capability
```

控制能力：

- controller 返回 `{ canOpen: true, canClose: true, canPause: true }`。
- sensor 返回不可控制。
- 但 `/mini/devices/:id/control` 当前只允许 `source=demo`，真实设备直控未开放。

演示设备控制链路：

```text
小程序设备详情页
  -> controlDevice()
  -> POST /mini/devices/:id/control
  -> 校验 source=demo
  -> POST mqtt-gateway /devices/:deviceId/commands/open|close
  -> MQTT publish
  -> 设备回执
  -> gateway state
```

计划执行设备控制链路：

```text
run-service executeRun()
  -> 当前 step 的 zone_id
  -> bindingsByZoneId.get(zone_id)
  -> deviceById.get(binding.device_id)
  -> POST mqtt-gateway /devices/:client_key/commands/open
  -> step 时长结束或取消
  -> POST mqtt-gateway /devices/:client_key/commands/close
```

设备状态来源：

- Web 和小程序列表状态主要来自数据库字段映射。
- 演示设备实时状态来自 `mqtt-gateway-service` 内存 state。
- MQTT 回执更新 `valveStatus`，但当前不会自动回写 Supabase 设备表。

### 15.6 MQTT 网关业务逻辑

MQTT 网关的职责是“协议适配”，不是业务编排。

连接逻辑：

1. HTTP 控制接口被调用。
2. `ensureConnected()` 检查是否已有 MQTT 连接。
3. 如果未连接，读取证书和账号，建立 `mqtts` 连接。
4. 连接成功后订阅设备信息回执、控制回执、设备状态上报 topic。
5. publish 指令 topic。
6. 空闲一段时间后自动断开，避免长期占用连接。

topic 组成：

- `topicPrefix` 默认 `wc800wf`。
- 请求设备信息 topic：`topicPrefix + topicDeviceInfo + deviceId`。
- 设备信息回执 topic：`topicPrefix + topicDeviceInfoReply + mqttUserId`。
- 控制命令 topic：`topicPrefix + topicDeviceControl + deviceId`。
- 控制回执 topic：`topicPrefix + topicDeviceControlReply + mqttUserId`。
- 状态主动上报 topic：`topicPrefix + topicDeviceInfoUpdate + deviceId`。

状态更新逻辑：

- 收到设备信息回执：更新 `online`、`rssi`、`firmware`、`valveStatus`、`lastMessageAt`。
- 收到控制回执：记录 `controlReply`；如果回执成功且存在 `lastControlCommand`，同步更新对应阀门状态。
- 收到设备主动上报：更新在线状态和阀门状态。

当前限制：

- `ensureDevice(deviceId)` 要求传入设备必须等于配置的 `WIFI_DEMO_DEVICE_ID`。
- 多设备、多租户、多 topic 连接池未实现。
- 命令状态没有持久化到数据库，计划执行只写 `device_command_logs` 的 pending/sent 级日志。

### 15.7 计划配置业务逻辑

计划模型：

| 字段 | 含义 |
| --- | --- |
| `fieldId` | 计划作用地块 |
| `mode` | `manual` 手动、`confirm` 半自动确认、`auto` 自动 |
| `cycle` | `daily`、`weekly`、`interval` |
| `cycleValue` | 周期附加值，周计划为星期数组，间隔计划为天数 |
| `startTime` | 开始时间，格式通常为 `HH:mm` |
| `executionMode` | `duration` 按时长，`quantity` 按水量 |
| `rainPolicy` | `skip`、`continue`、`delay` |
| `zones` | 分区执行顺序和时长 |
| `enabled` | 是否启用 |

Web 计划 CRUD：

```text
IrrigationPlan.tsx
  -> planService.fetchPlansFromSupabase()
  -> createPlanViaExecutionApi()
  -> updatePlanViaExecutionApi()
  -> deletePlanViaExecutionApi()
```

小程序计划创建/编辑：

```text
plan-create/index.tsx
  -> loadFields()
  -> 选择 field
  -> loadFieldDetail(fieldId)
  -> 用 field.zones 初始化 zones 表单
  -> submitPlan()
  -> createPlan() 或 updatePlan()
  -> POST /mini/plans 或 PATCH /mini/plans/:id
```

服务端计划写入：

- `toPlanPayload(userId, input)` 将端侧字段转换为数据库字段。
- `confirm` 模式入库为 `semi_auto`。
- `quantity` 执行模式入库为 `quota`。
- `rainPolicy=skip` 入库为 `skip_if_rain=true`。
- `targetWater`、`irrigationEfficiencyRate`、`maxDurationPerZone`、`allowSplit` 仅水量模式有业务意义。
- 更新计划时先更新 `irrigation_plans`，再删除旧 `irrigation_plan_zones`，最后插入新分区。

计划列表展示：

- 小程序 `/mini/plans` 返回 `DuePlan[]` 形态，只包含列表所需摘要。
- `nextRunLabel` 由 `cycle` 和 `startTime` 组合生成。
- `totalDuration` 来自所有启用分区时长求和。
- `zoneCount` 来自启用分区数量。

### 15.8 计划执行状态机

执行触发入口：

- 小程序：`POST /mini/plans/:id/start`。
- Web：`POST /runs/manual-start`，body 包含 `planId`。
- 自动调度：`EXECUTION_SCHEDULER_ENABLED=true` 后由 `schedulerTick()` 触发。

启动校验：

1. `fetchPlan(planId)` 必须存在。
2. `plan.enabled` 必须为 true。
3. `fetchPlanZones(planId)` 必须至少有一个可执行分区。
4. 分区绑定可以为空；为空时 step 仍会跑，但不会下发设备命令。

执行数据创建：

```text
createPlanRun()
  status=pending
  trigger_type=manual|schedule

createPlanRunSteps()
  每个 plan zone 一条 step
  status=pending
  target_duration_minutes=zone.duration_minutes
```

执行过程：

```text
executeRun(runId)
  -> run.status = running
  -> 按 sort_order 遍历 steps
      -> step.status = running
      -> 打开当前分区绑定 controller
      -> 等待 target_duration_minutes * EXECUTION_DURATION_SCALE
      -> 等待过程中轮询 run 是否 cancel_requested
      -> 关闭当前分区绑定 controller
      -> step.status = completed 或 cancelled
  -> run.status = completed 或 cancelled
```

取消逻辑：

- `stopRun(runId)` 将 `plan_runs.status` 更新为 `cancel_requested`。
- `stopPlan(planId)` 查该计划 active runs，并对每个 run 调 `stopRun()`。
- `executeRun()` 周期性调用 `isCancelRequested()`。
- 如果发现取消请求，当前 step 会结束并关闭绑定阀门，后续 step 不再继续。

失败逻辑：

- 执行过程中异常会进入 catch。
- run 更新为 `failed`。
- 已开始的 step 根据实际情况可能保留 running/failed/cancelled，需要结合代码和数据库状态排查。
- 单个关阀失败会记录日志但不会阻止整体流程继续尝试后续关闭。

调度逻辑：

- 仅 `plan.enabled=true` 且 `plan.mode=auto` 的计划会自动调度。
- `daily`：每天 `start_at` 匹配当前分钟时执行。
- `weekly`：当前星期在 `weekdays` 内且时间匹配时执行。
- `interval`：从 `created_at` 起按 `interval_days` 取模，且时间匹配时执行。
- 同一分钟内使用 `recentlyScheduled` 去重。
- 同时检查已有 active run 和当前分钟窗口已创建的 scheduled run，避免重复执行。

执行排障：

- 计划没有执行：查 `enabled`、`mode`、`start_at`、`weekdays`、`interval_days`、`EXECUTION_SCHEDULER_ENABLED`。
- 启动报“计划未配置可执行分区”：查 `irrigation_plan_zones`。
- 没有设备动作：查 `zone_device_bindings` 和 `irrigation_devices.type=controller`。
- 设备动作失败：查 `device.client_key`、MQTT 网关日志和 `device_command_logs`。

### 15.9 总览和风险计算逻辑

总览数据源：

```text
GET /mini/overview
  -> miniService.getOverview()
  -> fetchFieldBundle()
  -> fetchRealDevices()
  -> fetchRealPlans()
  -> fetchRealStrategies()
  -> buildOverview()
```

`buildOverview()` 组合：

- `snapshot`：总地块数、设备数、在线设备数、运行分区数、需关注地块数、平均电量、平均 ET。
- `decision`：当前建议，基于最高风险地块、待执行计划和自动策略数量。
- `fieldRisks`：按风险分排序的地块。
- `duePlans`：启用计划摘要。
- `mapFields`：地图展示所需地块状态和边界。
- `supplyOverview`：供水负载、系统风险、低电、离线、告警设备数。

风险计算：

- 干旱差值：`65 - soilMoisture`，低于 65 认为存在干旱压力。
- ET 压力：`etc - 3.5` 超出部分放大计算。
- 告警惩罚：地块 `alarm` 比 `warning` 权重更高。
- 风险等级：风险分大于等于 55 为高，大于等于 30 为中，否则低。
- 风险原因按墒情、告警、ETc 等条件生成。

移动端展示原则：

- 总览页不做复杂编辑，只做快速判断。
- 高风险地块、即将执行和调度建议优先展示。
- 地图是只读预览，详细编辑留给 Web。

### 15.10 自动策略业务逻辑

策略类型：

- `threshold`：墒情阈值策略，关注 `moistureLow` 和 `moistureRestore`。
- `etc`：ET 缺水策略，关注 `etDeficitThreshold`、`rainfallOffset`、`replenishRatio`。

策略模式：

- `suggest`：只给建议。
- `confirm`：需要人工确认。
- `auto`：自动执行。

策略范围：

- `all`：整块地。
- `zones`：指定分区集合。

当前实现边界：

- Supabase 表和领域模型已经存在。
- Web 和小程序能读取策略列表/详情。
- 小程序策略创建页能组装 payload。
- `POST /mini/strategies` 当前返回 501。
- 策略 enable/disable/confirm/ignore 当前只返回 accepted，不写数据库，不触发计划。

如果要实现真实策略闭环，建议拆成四步：

1. 策略 CRUD：实现创建、更新、启停，写 `automation_strategies`。
2. 策略评估：根据地块墒情、ET、雨量、最小间隔生成建议。
3. 策略动作：`suggest` 只写建议记录，`confirm` 等待人工确认，`auto` 创建计划执行或临时 run。
4. 审计和可回溯：保存策略评估输入、输出、触发原因和执行结果。

### 15.11 AI 助手业务逻辑

小程序页面状态：

- `messages`：本地消息列表。
- `conversationId`：Dify 会话 ID，用于续聊。
- `sending`：防重复提交。
- `scrollIntoView`：控制滚动到底部。
- `keyboardHeight`：适配微信键盘高度。

发送逻辑：

1. 用户输入 query。
2. 页面先插入用户消息和空的 assistant 消息。
3. 调用 `sendAssistantMessageStream({ query, conversationId })`。
4. 收到 `delta` 时持续拼接 assistant 文本。
5. 收到 `done` 时保存新的 `conversationId` 和完整回答。
6. 收到 `error` 或请求失败时，将 assistant 消息更新为错误提示。

服务端代理逻辑：

- `execution-service` 不解析 AI 内容，只转发请求和流。
- `assistant-service` 校验 mini session 后调用 Dify。
- Dify SSE 中的 `answer` 会转成下游 NDJSON 的 `delta`。
- Dify 返回非 2xx 时，服务端解析 JSON 或 text 错误并输出日志。

设计原因：

- 小程序不直接暴露 Dify API key。
- AI 服务可以独立部署、限流、审计。
- `execution-service` 保持小程序唯一 API 网关，减少端侧配置复杂度。

### 15.12 Web 与小程序业务分工

Web 适合承载：

- 地块绘制、边界编辑、分区编辑。
- 批量设备管理和绑定。
- 复杂计划编排。
- 自动策略参数管理。
- 演示设备调试和可视化。
- 管理端报表和运维诊断。

小程序适合承载：

- 当天总览和异常判断。
- 地块、分区、设备快速查看。
- 计划启停、确认、停止。
- 现场设备巡检和演示设备控制。
- AI 助手问答。

不建议放到小程序的一期能力：

- 复杂地图绘制。
- 大批量计划编排。
- 完整策略设计器。
- 系统级权限、角色、组织治理。

### 15.13 数据一致性和边界

当前存在的双路径：

- Web 业务 CRUD 直接写 Supabase。
- 小程序业务写入走 `execution-service`。
- 计划执行走 `execution-service`。
- 设备实时控制走 `mqtt-gateway-service`。

一致性风险：

- Web 直接修改计划后，小程序读取会立即看到数据库结果，但正在执行的 run 不会自动重算。
- Web 修改设备绑定后，新启动的 run 会使用新绑定；已启动 run 的执行上下文已在启动时读取。
- MQTT 网关内存状态不会自动回写 Supabase，因此列表状态和实时阀门状态可能不一致。
- seed 设备逻辑可能在开发阶段自动补数据，正式环境要明确关闭或替换为设备入网流程。

建议的长期边界：

- 管理端写操作也逐步走后端 API，减少 Web 和小程序两套写入逻辑。
- 设备状态建立持久化表或事件表，MQTT 回执落库。
- 计划执行需要更明确的状态枚举和审计日志。
- 策略评估结果需要独立表保存，避免只靠当前字段推断。

### 15.14 端到端问题定位路径

地块数据不对：

1. 查 `fields`、`field_zones`、`field_et_configs`。
2. Web 查 `fieldService.toField()` 映射。
3. 小程序查 `mini-service.fetchFieldBundle()` 和 `listFields/getFieldDetail()`。
4. 总览风险查 `packages/irrigation-domain/src/dashboard.ts`。

计划列表不对：

1. 查 `irrigation_plans`。
2. 查 `irrigation_plan_zones` 是否有分区。
3. Web 查 `planService.toPlan()`。
4. 小程序查 `mini-service.fetchRealPlans()` 和 `listPlans()`。

计划执行不对：

1. 查 `plan_runs.status`。
2. 查 `plan_run_steps.status` 和排序。
3. 查 `zone_device_bindings`。
4. 查 `irrigation_devices.client_key` 和 `type`。
5. 查 `device_command_logs`。
6. 查 `mqtt-gateway-service` 日志和 `/demo/state`。

设备状态不对：

1. 列表状态查 `irrigation_devices`。
2. 绑定状态查 `zone_device_bindings`。
3. 演示设备实时状态查 `mqtt-gateway-service /demo/state`。
4. 阀门状态查 MQTT 回执是否到达。

AI 助手不对：

1. 小程序查 token 是否有效。
2. `execution-service` 查 `/mini/assistant/messages` 转发日志。
3. `assistant-service` 查 Dify 请求错误。
4. Dify 后台查 app key、应用配置和额度。
5. 小程序查 NDJSON 解析和 UI 增量更新。

小程序和 Web 表现不一致：

1. 判断是否 Web 直连 Supabase、小程序走 Node 导致映射不同。
2. 对比 `web-dev/src/lib/*Service.ts` 和 `services/execution-service/src/mini-service.mjs` 的字段转换。
3. 对比 `packages/irrigation-domain/src/models.ts` 是否已同步新增字段。
4. 对比 `packages/irrigation-api/src/*` 和小程序页面使用的类型。

### 15.15 后续功能迭代建议顺序

建议优先级：

1. 明确 `web-dev` 为主 Web 工程，冻结或删除 `web` 的业务迭代入口。
2. 补齐策略 CRUD 和策略动作真实写库。
3. 统一 Web 写操作到服务端 API，减少双写路径。
4. 完善计划执行状态机测试，覆盖启动、取消、无绑定、MQTT 失败。
5. 设备 MQTT 回执落库，建立真实设备状态表或事件表。
6. 引入项目/组织/角色权限模型，替换当前单用户所有权假设。
7. 替换 ET 占位算法，接入真实天气、作物系数、生育期参数。
8. 为小程序和服务端 API 增加契约测试，保证 `packages/irrigation-api` 类型和真实响应一致。
