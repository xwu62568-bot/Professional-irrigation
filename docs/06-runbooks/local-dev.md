# 本地开发手册

## Web

```bash
cd web-dev
npm install
npm run dev
```

需要配置：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AMAP_KEY`
- `VITE_EXECUTION_SERVICE_URL`
- `VITE_MQTT_GATEWAY_URL`

## 小程序

```bash
cd mini-program
npm install
npm run dev:local
```

构建产物在 `mini-program/dist`，用微信开发者工具打开。

## 全栈联调

```bash
./scripts/start-irrigation-dev.sh
```

默认服务：

| 服务 | 地址 |
| --- | --- |
| Web | `http://127.0.0.1:5173` |
| execution-service | `http://127.0.0.1:4310` |
| assistant-service | `http://127.0.0.1:4311` |
| mqtt-gateway-service | `http://127.0.0.1:4320` |

注意：

- 真机小程序不能访问开发机自己的 `127.0.0.1`，需要局域网 IP 或公网地址。
- `services/.env` 是本地敏感配置，不应提交。
- Wi-Fi demo MQTT 变量不完整时，全栈脚本会直接退出。

## 事件驱动执行引擎新增环境变量

`execution-service`:

- `EXECUTION_ENGINE_MODE=event_driven|legacy`
- `EXECUTION_ENGINE_ROLLOUT_MODE=shadow|canary|full`
- `EXECUTION_ENGINE_CANARY_PLAN_IDS=plan-id-1,plan-id-2`
- `EXECUTION_ROLLOUT_AUTO_ROLLBACK_ENABLED=true|false`
- `EXECUTION_ROLLOUT_WINDOW_MINUTES`
- `EXECUTION_ROLLOUT_MIN_SAMPLES`
- `EXECUTION_ROLLOUT_FAIL_RATE_THRESHOLD`
- `EXECUTION_SLO_DISPATCH_SUCCESS_RATE`
- `EXECUTION_SLO_ACK_SUCCESS_RATE`
- `EXECUTION_SLO_TIMEOUT_RATE`
- `EXECUTION_ALERT_COOLDOWN_MS`
- `EXECUTION_INTERNAL_TOKEN`
- `EXECUTION_INTERNAL_API_BASE_URL`
- `EXECUTION_PROJECT_TIMEZONE`
- `EXECUTION_COMMAND_RETRY_MS`
- `EXECUTION_COMMAND_DEADLINE_MS`
- `EXECUTION_COMMAND_MAX_ATTEMPTS`
- `EXECUTION_ACK_SIGNATURE_SECRET`
- `EXECUTION_ACK_SIGNATURE_SKEW_MS`
- `EXECUTION_RECONCILE_ENABLED`
- `EXECUTION_RECONCILE_MS`

`mqtt-gateway-service`:

- `EXECUTION_EVENT_CALLBACK_URL`
- `EXECUTION_EVENT_CALLBACK_TOKEN`
- `EXECUTION_ACK_SIGNATURE_SECRET`

说明：

- `EXECUTION_ACK_SIGNATURE_SECRET` 需要在 `execution-service` 与 `mqtt-gateway-service` 保持一致，用于 ACK 签名校验。
- ACK 请求会附带一次性 `nonce`，重复 nonce 会被拒绝（防重放）。

