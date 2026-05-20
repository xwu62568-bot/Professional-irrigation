# 排障手册

## 登录失败

- Web：检查 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
- 小程序：检查 `__MINI_EXECUTION_SERVICE_URL__` 是否可访问。
- 服务端：检查 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。
- mini session：检查 `mini_sessions` 是否存在、是否过期。

## 计划执行失败

- 查 `irrigation_plans.enabled` 和计划分区。
- 查 `irrigation_plan_zones` 是否有可执行分区。
- 查 `plan_runs` 和 `plan_run_steps` 状态。
- 查 `device_commands` 的 `status`、`attempt_count`、`error_message`。
- 查 `device_events` 是否有 `command_ack` 或 `command_nack`。
- 查 `zone_device_bindings`。
- 查 `irrigation_devices.type` 是否为 `controller`。
- 查 `device_command_logs`。
- 查 `mqtt-gateway-service /health` 和服务日志。
- 查 `execution-service /health` 中 `runtimeMetrics`：`dispatchFailed`、`ackFailure`、`rollbackTriggered`。
- 若处于 canary，检查失败率是否触发自动回滚阈值（`EXECUTION_ROLLOUT_*`）。

### 自动计划到点未触发

- 先查 `irrigation_plans.start_at`、`mode`、`enabled`、`updated_at`。
- 再查 `plan_schedule_jobs.cron_expression`、`next_run_at`、`updated_at`。
- 若计划表时间已变但 `plan_schedule_jobs` 未更新：
  - 确认本次保存是否走了 `execution-service /mini/plans*`。
  - 确认线上 Web 是否已发布到 GitHub Pages；ECS 部署不会更新 `web-dev`。
  - 必要时执行 `resync-auto-plan-jobs`。
- 若 `plan_schedule_jobs` 已更新但到点仍未触发：
  - 查 `cron.job` 与 `cron.job_run_details`，确认 `pg_cron` 是否执行。
  - 查 `net._http_response`，确认 `pg_net` 是否超时、握手失败或返回非 `202`。
  - 查 `nginx` access log，确认 `/api/execution/internal/plans/:id/dispatch` 是否真正收到请求。
  - 手动调用 `/api/execution/internal/plans/:id/dispatch` 验证 `execution-service` 本体是否能起跑。
- 若 `net._http_response` 显示 TCP/SSL handshake 超时：
  - 检查 `EXECUTION_INTERNAL_API_BASE_URL` 是否仍指向裸 IP 的 `http://...`。
  - 生产应改为 Supabase `pg_net` 可达的 HTTPS 域名。
  - 修改 `.env.production` 后需要 `docker compose up -d --force-recreate execution-service`，再重跑 `resync-auto-plan-jobs`。

### 执行链路 SLI/SLO 与告警阈值

- `dispatch_success_rate`（5 分钟窗口）目标 >= `99%`，低于 `97%` 连续 3 个窗口触发 P1 告警。
- `ack_success_rate`（5 分钟窗口）目标 >= `98%`，低于 `95%` 连续 3 个窗口触发 P1 告警。
- `timeout_rate`（15 分钟窗口）目标 <= `2%`，高于 `5%` 连续 2 个窗口触发 P1 告警。
- `rollback_trigger_count`（30 分钟窗口）目标为 `0`，大于 `0` 立即触发 P0 告警并暂停 canary 扩容。

### 告警后补偿动作

- `dispatch` 失败激增：先检查 `mqtt-gateway-service` 健康，再重放 `device_commands` 中 `status='queued'` 或 `failed` 且可重试的数据。
- ACK 失败激增：优先核对 `EXECUTION_ACK_SIGNATURE_SECRET`、时间偏差和 nonce 冲突，再从 `device_command_logs` 对账缺失 ACK。
- 超时率激增：检查设备在线率和 `EXECUTION_COMMAND_DEADLINE_MS` 是否过小，并执行低频补偿任务修复悬挂 step。
- 触发回滚：将 `EXECUTION_ENGINE_ROLLOUT_MODE` 切回 `shadow` 或 `full(legacy)`，保留事件日志用于根因分析。
- 目前告警仅在 `execution-service` 内部日志与 `/health.runtimeMetrics.sloBreachAlerts` 统计，不依赖外部告警平台。

## 设备控制失败

- 确认是否 demo 设备。
- 检查 `WIFI_DEMO_DEVICE_ID`。
- 检查 MQTT 账号、密码、证书路径。
- 检查 topic 配置。
- 查 `/demo/state` 是否有回执。
- 检查 `EXECUTION_EVENT_CALLBACK_URL` 与 `EXECUTION_EVENT_CALLBACK_TOKEN` 是否正确。
- 检查 `EXECUTION_ACK_SIGNATURE_SECRET` 在 execution 与 gateway 两侧是否一致。
- 检查 `EXECUTION_ACK_SIGNATURE_SKEW_MS` 是否覆盖时钟偏差。
- 检查 execution-service `/internal/device-events/ack` 返回是否为 202。

## 策略不生效

- 当前策略创建和动作仍未完整生产化。
- 查 `automation_strategies` 是否有记录。
- 查 `/mini/strategies` 是否只是读取。
- 查服务端 `/mini/strategies` 创建是否仍返回 501。

## AI 助手无回复

- 检查 `assistant-service /health`。
- 检查 `ASSISTANT_SERVICE_BASE_URL`。
- 检查 `DIFY_BASE_URL` 和 `DIFY_API_KEY`。
- 查 assistant-service 日志中的 Dify 上游错误。
- 查小程序 NDJSON 解析是否收到 `error`。

## Web 和小程序数据不一致

- 判断 Web 是否直接写 Supabase，小程序是否走 Node API。
- 对比 `web-dev/src/lib/*Service.ts` 和 `services/execution-service/src/mini-service.mjs`。
- 对比共享类型是否同步。
