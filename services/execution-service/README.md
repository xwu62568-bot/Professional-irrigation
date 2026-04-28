# execution-service

第一版职责：

- 接收前端手动触发轮灌计划请求
- 后续读取 Supabase 计划与分区
- 后续创建 `plan_runs` / `plan_run_steps`
- 后续调用 `mqtt-gateway-service` 执行开关阀

当前已完成：

- 手动执行最小链路
- 轮询版定时调度器
- `/health`
- `POST /runs/manual-start`
- `POST /runs/:runId/stop`
- `GET /runs/:runId`

定时调度当前规则：

- 只扫描 `enabled=true`
- 只自动执行 `mode=auto`
- 支持 `daily / weekly / interval`
- 同一分钟同一计划只触发一次
- 如果该计划已有 `pending / running / cancel_requested` 的 run，则跳过

## 启动

```bash
PORT=4310 \
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
MQTT_GATEWAY_BASE_URL=http://127.0.0.1:4320 \
EXECUTION_DURATION_SCALE=0.01 \
EXECUTION_STATUS_POLL_MS=2000 \
EXECUTION_SCHEDULER_ENABLED=true \
EXECUTION_SCHEDULER_POLL_MS=30000 \
node src/index.mjs
```
