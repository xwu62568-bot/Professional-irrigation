# 当前架构

## 架构现状

```text
web-dev
  -> Supabase Auth / REST
  -> execution-service /runs
  -> mqtt-gateway-service /demo/*
  -> 高德地图 / Open-Meteo

mini-program
  -> execution-service /mini/*
      -> Supabase Auth / REST
      -> mini_sessions
      -> run-service
      -> assistant-service
      -> mqtt-gateway-service

assistant-service
  -> Dify streaming API

mqtt-gateway-service
  -> MQTT over TLS

mcp-server
  -> execution-service /mini/*
```

## 当前关键事实

- `web-dev` 是当前主要 Web 工程，`web` 更像旧导出/待明确工程。
- Web 登录和部分业务 CRUD 直接使用 Supabase JS。
- 小程序不直连 Supabase，统一走 `execution-service /mini/*`。
- `execution-service` 使用 Supabase service role 访问数据库。
- `assistant-service` 负责 Dify API key 隔离和流式转发。
- `mqtt-gateway-service` 当前服务固定演示设备。
- `mcp-server` 复用 mini API 暴露 AI/IDE 可调用工具。
- 计划调度使用 `pg_cron` + `compute_plan_next_run_at(...)` 按项目时区计算 `next_run_at`（`daily/weekly/interval`）。
- ACK 回调执行签名校验（HMAC-SHA256）与 nonce 防重放，执行入口受内部 token 保护。

## 当前风险

- Web 与小程序存在双业务写入路径。
- 设备实时状态未统一落库。
- 策略链路未闭环。
- 权限模型仍按单用户所有权设计。
- 测试覆盖不足，计划执行和 MQTT 失败路径风险高。

