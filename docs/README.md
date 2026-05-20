# 智慧灌溉项目文档中心

本文档中心面向产品、开发和后续维护人员，目标是把当前演示阶段项目逐步推进为可持续迭代、可排障、可生产化交付的标准项目。

## 如何阅读

| 目的 | 入口 |
| --- | --- |
| 快速了解项目做什么 | [产品范围](01-product-and-business/product-scope.md) |
| 理解完整业务闭环 | [业务流程](01-product-and-business/business-processes.md) |
| 区分演示态和生产态 | [演示与生产边界](01-product-and-business/demo-vs-production.md) |
| 看当前系统真实架构 | [当前架构](02-architecture/current-architecture.md) |
| 看目标架构和生产化方向 | [目标架构](02-architecture/target-architecture.md) |
| 查数据表和核心对象 | [数据模型](02-architecture/data-model.md) |
| 查某一端怎么实现 | [模块文档](03-modules/) |
| 看还缺什么 | [缺口分析](04-roadmap/gap-analysis.md) |
| 看后续迭代安排 | [路线图](04-roadmap/roadmap.md) 和 [迭代追踪](04-roadmap/iteration-tracking.md) |
| Web 计划 API 统一（待实施） | [Web 计划 API 统一](04-roadmap/web-plan-api-unification.md) |
| 看以后按什么标准开发 | [开发规范](05-engineering/development-standards.md) |
| 查本地启动和排障 | [本地开发](06-runbooks/local-dev.md) 和 [排障手册](06-runbooks/troubleshooting.md) |
| 查历史代码盘点 | [当前代码现状盘点](reference/current-codebase-inventory.md) |

## 文档分层

- `01-product-and-business/`：回答“做什么、为什么、业务流程是什么”。
- `02-architecture/`：回答“系统怎么组成、目标架构是什么、边界在哪里”。
- `03-modules/`：回答“各端和各服务当前怎么实现、后续怎么演进”。
- `04-roadmap/`：回答“还差什么、按什么顺序做、如何追踪迭代”。
- `05-engineering/`：回答“以后按什么工程标准开发和验收”。
- `06-runbooks/`：回答“怎么启动、怎么部署、怎么排问题、怎么判断能否生产化”。
- `reference/`：保留当前代码现状、历史盘点和不适合放在主线文档里的资料。
- `templates/`：用于后续需求、迭代和问题排查的标准模板。

## 当前阶段判断

项目当前处于“演示可用 + 局部真实数据接入 + 生产化能力待补齐”的阶段。已有 Web、小程序、Node 服务、Supabase、MQTT 演示设备和 AI 代理链路，但策略闭环、权限模型、设备回执落库、统一后端写入口、测试体系和发布治理仍需按标准做法补齐。

后续所有功能迭代应同时更新：

- 对应模块文档。
- [缺口分析](04-roadmap/gap-analysis.md)。
- [迭代追踪](04-roadmap/iteration-tracking.md)。
- 必要时更新 API 类型、数据模型和测试策略文档。

