# 生产化检查清单

## 权限和数据隔离

- [ ] 支持项目/组织模型。
- [ ] 支持角色权限。
- [ ] RLS 或服务端权限检查覆盖核心表。
- [ ] 小程序、Web、MCP 权限边界清晰。

## 设备链路

- [ ] 正式设备入网流程完成。
- [ ] demo 设备与正式设备隔离。
- [ ] 命令下发日志落库。
- [ ] ACK 和状态事件落库。
- [ ] 支持超时、失败、重试和人工介入。
- [ ] ACK 回调签名与重放保护完成。

## 计划和策略

- [ ] 计划执行状态机测试完成。
- [ ] `event_driven` 与 `legacy` 双轨切流验证完成（shadow/canary/full）。
- [ ] 计划调度 job 生命周期治理（创建/更新/删除/孤儿清理）完成。
- [ ] 策略 CRUD 真实写库。
- [ ] 策略启停、确认、忽略真实写库。
- [ ] 策略自动执行有审计。

## 数据和算法

- [ ] ET 算法不再使用占位逻辑。
- [ ] 天气数据源有降级策略。
- [ ] 地块、设备、计划删除有约束。
- [ ] 关键历史记录可追溯。

## 运维

- [ ] 服务健康检查接入监控。
- [ ] API 错误和上游错误有日志。
- [ ] 数据库备份和恢复流程明确。
- [ ] 发布和回滚流程明确。
- [ ] 敏感环境变量不进入前端和仓库。

## 本次事件驱动改造上线执行清单（服务端）

- [ ] **推送数据库变更**：执行 `supabase db push`，确认包含最新时区调度修复 migration。
- [ ] **设置正式回调地址**：`EXECUTION_INTERNAL_API_BASE_URL` 指向公网可达的 execution-service 域名，不可使用本地 `127.0.0.1` 或临时隧道地址。
- [ ] **校验内部鉴权一致性**：`EXECUTION_INTERNAL_TOKEN` 与 `EXECUTION_EVENT_CALLBACK_TOKEN` 一致；`EXECUTION_ACK_SIGNATURE_SECRET` 在 execution/gateway 两侧一致。
- [ ] **重同步所有 auto 计划 cron**：在 `services/execution-service` 执行 `npm run ops:resync-auto-plans`，避免“计划已改但 cron 未更新”。
- [ ] **发布后 smoke**：验证 `GET /health`、手动执行一次、自动计划一次（2~3 分钟后触发）均成功。
- [ ] **核验执行收敛**：`plan_runs` 和 `plan_run_steps` 最新记录为 `success`，`device_commands` 的 `open/close` 都为 `acked`。
- [ ] **清理测试残留**：取消历史卡死 `running` 的 run，恢复测试计划到业务时间，关闭临时隧道。
- [ ] **回滚预案就绪**：确认可切回 `EXECUTION_ENGINE_MODE=legacy` 或 `shadow`，并保留故障窗口日志用于复盘。

