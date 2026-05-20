# 发布与部署

## 当前部署方式

- `web-dev` 可通过 GitHub Pages workflow 部署。
- 服务端可通过 `deploy/docker-compose.aliyun.yml` 部署到阿里云环境。
- Supabase schema 通过 migrations 管理。

当前发布链拆分说明：

- `web-dev` 与 ECS 服务端不是同一次发布。
- `./deploy/deploy-ecs.sh` 只打包并发布 `deploy/` 和 `services/`，不会发布 `web-dev`。
- 灌溉计划相关改动若同时涉及 Web 和 `execution-service`，必须分别完成 GitHub Pages 与 ECS 发布。

## 发布前检查

- 环境变量是否完整。
- Supabase migrations 是否已执行。
- Web 构建变量是否正确。
- 服务端 `/health` 是否通过。
- MQTT 证书和设备配置是否正确。
- Dify API key 是否配置。
- 缺口和迭代文档是否更新。
- 涉及计划调度改动时，确认 `EXECUTION_INTERNAL_API_BASE_URL` 使用公网 HTTPS 域名，且已计划执行一次 `resync-auto-plan-jobs`。

## 回滚要求

- Web 发布需保留上一版本 artifact 或可回滚 commit。
- 服务端 Docker 镜像需有版本标签。
- 数据库 migration 必须评估回滚策略。
- 设备控制相关发布需准备手动关闭阀门预案。

## 生产配置原则

- 不使用 demo seed。
- 不暴露 service role key 到前端。
- 不把 Dify API key 放到小程序或 Web。
- 不用本地 `127.0.0.1` 地址配置真机小程序。
- 不用裸 IP 的 `http://<server-ip>/api/execution` 作为 `pg_cron` 回调地址；生产统一使用可达的 HTTPS 域名。
