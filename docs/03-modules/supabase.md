# Supabase 模块

## 定位

Supabase 当前承担 Auth、Postgres、REST 和 RLS 基础能力。服务端通过 service role 访问，Web 通过 Supabase JS 和用户 session 访问。

## 当前能力

- 用户资料、地块、分区、计划、策略、ET、设备、执行、命令日志、mini session 表。
- 业务表启用 RLS。
- 基础视图和 ET 重算 RPC。
- 新增事件驱动执行相关模型：
  - `device_commands`
  - `device_events`
  - `plan_control_events`
  - `plan_schedule_jobs`
- 新增计划调度函数：
  - `sync_plan_schedule_job(...)`
  - `unsync_plan_schedule_job(...)`
  - `compute_plan_next_run_at(...)`

## 当前不标准点

- 权限以单用户所有权为主。
- 尚无项目/组织模型。
- 策略评估、设备事件、告警和审计表缺失。
- ET 计算仍是占位逻辑。

## 后续标准做法

- 所有 schema 变更必须走 migration。
- 数据模型变更必须同步共享类型和端侧映射。
- 生产环境需要备份、恢复、迁移验证和 RLS 测试。
- Realtime 采用云托管能力，明确将 `plan_runs`、`plan_run_steps`、`device_events` 加入 `supabase_realtime` publication。
- 执行边界要求：仅 `execution-service` 使用 service role 调用 `SECURITY DEFINER` 函数，客户端只读自身授权数据，不直接调用调度/超时 RPC。

