# 测试策略

## 当前判断

当前测试覆盖不足，尤其是计划执行、策略动作、设备控制和小程序 API 契约。后续生产化前必须补齐分层测试。

## 新增执行引擎测试要求

- `execution-service` 必须覆盖 `event_driven` 引擎基础行为：
  - run/step 状态流转
  - 命令分发失败重试
  - ACK 回调落库
  - 停止事件收敛
- CI 至少提供 `test:p0`（阻断发布）和 `test:p1`（迭代门槛）两级入口。
- `test:p0` 对应 `src/*.test.mjs`（状态机/幂等/安全校验）。
- `test:p1` 对应 `src/*.p1-*.mjs`（切流回滚、SLO 与故障演练场景）。
- 当前已覆盖：
  - ACK 签名与 nonce 防重放校验（`app.test.mjs`）
  - 调度语义时区测试（`schedule-semantics.test.mjs`）
  - canary 切流回滚与混沌场景（`run-service.p1-scenarios.mjs`）

## 必补测试层级

| 层级 | 范围 | 示例 |
| --- | --- | --- |
| 领域纯函数测试 | `packages/irrigation-domain` | 风险计算、天气建议、地理边界 |
| API 契约测试 | `packages/irrigation-api` + services | mini API 响应结构 |
| 服务端状态机测试 | `execution-service` | 启动、取消、失败、无绑定 |
| MQTT 网关测试 | `mqtt-gateway-service` | 非法设备、断连、回执解析 |
| 小程序服务测试 | `mini-program/src/services` | token 过期、401、流式 AI |
| Web 核心流程测试 | `web-dev` | 登录、地块、计划、设备绑定 |

## 计划执行测试场景

- 计划不存在。
- 计划停用。
- 无可执行分区。
- 分区无设备绑定。
- 绑定非 controller。
- 启动后正常完成。
- 启动后取消。
- MQTT 开阀失败。
- MQTT 关阀失败。
- 调度器同一分钟去重。

## 验收门槛

- P0 业务能力必须有服务端测试。
- 高风险设备控制必须有失败场景测试。
- API 修改必须有契约测试或至少有 smoke test。
- 文档变更至少通过链接和关键词检查。

