# 数据模型

## 核心表

| 表 | 说明 | 当前状态 |
| --- | --- | --- |
| `profiles` | 用户资料 | 已有 |
| `fields` | 地块 | 已有 |
| `field_zones` | 地块分区 | 已有 |
| `irrigation_devices` | 设备台账 | 已有 |
| `zone_device_bindings` | 分区与设备站点绑定 | 已有 |
| `irrigation_plans` | 灌溉计划 | 已有 |
| `irrigation_plan_zones` | 计划分区顺序和时长 | 已有 |
| `plan_runs` | 计划执行实例 | 已有 |
| `plan_run_steps` | 执行步骤 | 已有 |
| `device_command_logs` | 设备命令日志 | 已有 |
| `automation_strategies` | 自动策略 | 已有但写入闭环不足 |
| `field_et_configs` | 地块 ET 配置 | 已有 |
| `field_et_daily` | 每日 ET 数据 | 已有 |
| `mini_sessions` | 小程序服务端 session | 已有 |

## 当前对象关系

```text
profiles
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
```

## 需要补齐的数据能力

- 项目/组织表：承载多项目和多用户协作。
- 角色/权限表：替代单用户所有权假设。
- 设备状态表：保存在线、阀门、信号、电量、最后回执。
- 设备事件表：保存 MQTT 上报、命令 ACK、异常。
- 策略评估记录表：保存策略输入、输出、触发原因。
- 审计日志表：保存关键写操作和人工确认动作。
- 告警表：保存设备、执行、墒情、服务异常。

## 模型演进要求

- 新增字段必须同步更新 Supabase migration、共享类型、服务端映射、Web 映射和小程序展示。
- 写入路径必须明确由 Web 直连 Supabase 还是由服务端 API 负责。
- 正式模型不应依赖 demo 设备字段。

