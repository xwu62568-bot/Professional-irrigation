# 部署说明

当前部署目标：

- 前端 `web-dev` 部署到 `GitHub Pages`
- 后端 `execution-service` 与 `mqtt-gateway-service` 部署到 `阿里云 ECS`
- 入口代理使用 `Nginx + Docker Compose`

## 1. GitHub Pages

### 1.1 开启 Pages

在 GitHub 仓库设置里：

- `Settings`
- `Pages`
- `Build and deployment`
- `Source` 选择 `GitHub Actions`

### 1.2 配置仓库变量

在仓库里配置以下 `Repository variables / secrets`：

Variables:

- `VITE_SUPABASE_URL`
- `VITE_AMAP_KEY`
- `VITE_AMAP_SECURITY_JS_CODE`
- `VITE_EXECUTION_SERVICE_URL`
- `VITE_MQTT_GATEWAY_URL`
- `VITE_WIFI_DEMO_DEVICE_ID`
- `VITE_WIFI_DEMO_STATIONS`

Secrets:

- `VITE_SUPABASE_ANON_KEY`

推荐值示例：

- `VITE_EXECUTION_SERVICE_URL=https://api.example.com/api/execution`
- `VITE_MQTT_GATEWAY_URL=https://api.example.com/api/mqtt`

前端 workflow 已经在：

- `.github/workflows/deploy-web-dev-pages.yml`

## 2. 阿里云 ECS

当前生产 ECS：

- 公网 IP：`47.99.39.55`
- SSH 用户：`root`
- SSH 端口：`22`
- 服务器项目目录：`/opt/irrigation2.0`
- Docker Compose 文件：`/opt/irrigation2.0/deploy/docker-compose.aliyun.yml`
- Compose project：`irrigation20`
- 登录密码：不要写入仓库文档，查看本地密码管理/运维记录

建议：

- 系统：`Ubuntu 22.04`
- 预装应用：`Docker`
- 安全组放行：`22` `80` `443`

### 2.1 上传项目

当前服务器不是 git 工作区，采用本地打包上传部署。

本地打包：

```bash
tar --no-xattrs \
  --exclude='*/node_modules/*' \
  --exclude='web-dev/dist/*' \
  --exclude='web/dist/*' \
  -czf /tmp/irrigation-ecs-deploy.tgz \
  deploy services
```

上传到 ECS：

```bash
scp /tmp/irrigation-ecs-deploy.tgz root@47.99.39.55:/tmp/irrigation-ecs-deploy.tgz
```

登录 ECS：

```bash
ssh root@47.99.39.55
```

在 ECS 上解压到生产目录：

```bash
mkdir -p /opt/irrigation2.0
tar -xzf /tmp/irrigation-ecs-deploy.tgz -C /opt/irrigation2.0
```

注意：不要用本地 `services/.env` 覆盖线上 `services/.env.production`。线上密钥只维护在 ECS 的 `/opt/irrigation2.0/services/.env.production`。

### 2.2 准备生产环境文件

复制模板：

```bash
cp services/.env.production.example services/.env.production
```

填写：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WIFI_DEMO_MQTT_ACCOUNT`
- `WIFI_DEMO_MQTT_CLIENT_ID`，当前 Hyeco broker 建议与 `WIFI_DEMO_MQTT_ACCOUNT` 保持一致
- `WIFI_DEMO_MQTT_USER_ID`
- `WIFI_DEMO_MQTT_PASSWORD`
- `WIFI_DEMO_DEVICE_ID`
- `WIFI_DEMO_MQTT_IDLE_DISCONNECT_MS=6000`

### 2.3 准备 MQTT 证书

把以下文件放到：

- `services/certs/hyecosmart-ca.der`
- `services/certs/hyecosmart-client.p12`

当前仓库本地已有一份，可随仓库一起上传；如果后续你不想放仓库，也可以在服务器手动覆盖。

### 2.4 配置 Nginx 反向代理域名

编辑：

- `deploy/nginx/irrigation.conf`

把：

```nginx
server_name api.example.com;
```

改成你的真实 API 域名。

如果启用 HTTPS，把下面注释掉的 `443` server 段打开，并放置证书到：

- `deploy/nginx/certs/fullchain.pem`
- `deploy/nginx/certs/privkey.pem`

### 2.5 启动服务

```bash
cd /opt/irrigation2.0
docker compose \
  --project-directory /opt/irrigation2.0 \
  -f /opt/irrigation2.0/deploy/docker-compose.aliyun.yml \
  up -d --build
```

如果只重建了 `mqtt-gateway-service` / `execution-service`，需要重启一次 Nginx，让它重新解析容器 IP，否则可能出现 `502 Bad Gateway`：

```bash
docker compose \
  --project-directory /opt/irrigation2.0 \
  -f /opt/irrigation2.0/deploy/docker-compose.aliyun.yml \
  restart nginx
```

查看状态：

```bash
docker compose \
  --project-directory /opt/irrigation2.0 \
  -f /opt/irrigation2.0/deploy/docker-compose.aliyun.yml \
  ps

docker logs -f irrigation-execution-service
docker logs -f irrigation-mqtt-gateway-service
```

绕过 Nginx 直接检查容器健康状态：

```bash
MQTT_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' irrigation-mqtt-gateway-service)
EXEC_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' irrigation-execution-service)

curl -s "http://$MQTT_IP:4320/health"
curl -s "http://$EXEC_IP:4310/health"
```

## 3. 域名

建议拆分：

- GitHub Pages 前端域名：
  - `https://yourname.github.io/repo`
  - 或自定义 `https://app.example.com`

- 阿里云 API 域名：
  - `https://api.example.com`

前端访问后端：

- `https://api.example.com/api/execution`
- `https://api.example.com/api/mqtt`

## 4. 发布顺序

1. 先把 ECS 后端起起来
2. 确认：
   - `/api/execution/health`
   - `/api/mqtt/health`
3. 再推送前端到 GitHub
4. 等 GitHub Actions 自动发 Pages

## 5. 常用命令

重启：

```bash
docker compose \
  --project-directory /opt/irrigation2.0 \
  -f /opt/irrigation2.0/deploy/docker-compose.aliyun.yml \
  restart
```

更新代码并重新发布：

```bash
# 本地
tar --no-xattrs \
  --exclude='*/node_modules/*' \
  --exclude='web-dev/dist/*' \
  --exclude='web/dist/*' \
  -czf /tmp/irrigation-ecs-deploy.tgz \
  deploy services
scp /tmp/irrigation-ecs-deploy.tgz root@47.99.39.55:/tmp/irrigation-ecs-deploy.tgz

# ECS
ssh root@47.99.39.55
cd /opt/irrigation2.0
tar -xzf /tmp/irrigation-ecs-deploy.tgz -C /opt/irrigation2.0
docker compose \
  --project-directory /opt/irrigation2.0 \
  -f /opt/irrigation2.0/deploy/docker-compose.aliyun.yml \
  up -d --build

docker compose \
  --project-directory /opt/irrigation2.0 \
  -f /opt/irrigation2.0/deploy/docker-compose.aliyun.yml \
  restart nginx
```

停止：

```bash
docker compose \
  --project-directory /opt/irrigation2.0 \
  -f /opt/irrigation2.0/deploy/docker-compose.aliyun.yml \
  down
```
用 expect 走密码登录
账号:root
密码:v6&&Rb/4*3@eqsn
