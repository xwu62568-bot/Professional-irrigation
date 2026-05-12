# irrigation-mcp-server

面向灌溉平台的 MCP Server 第一版骨架。

当前能力：

- 通过 `stdio` 暴露 MCP tools
- 通过 `Streamable HTTP` 部署远程 MCP endpoint
- 复用 `execution-service` 的 mini API
- 支持只读查询与少量写操作
- 使用固定平台账号密码自动登录

## 已实现工具

- `get_overview`
- `list_fields`
- `get_field_detail`
- `list_devices`
- `get_device_detail`
- `list_plans`
- `get_plan_detail`
- `start_plan`
- `stop_plan`
- `control_device`

## 环境变量

```bash
IRRIGATION_EXECUTION_BASE_URL=http://127.0.0.1:4310

IRRIGATION_MCP_EMAIL=
IRRIGATION_MCP_PASSWORD=

# HTTP 部署模式
MCP_SERVER_HOST=0.0.0.0
MCP_SERVER_PORT=4330

# 给远程 MCP 客户端访问时建议开启
MCP_SERVER_AUTH_TOKEN=

# 可选，限制 Host 头，逗号分隔
MCP_SERVER_ALLOWED_HOSTS=
```

## 本地启动

```bash
npm install
npm run dev
```

HTTP 部署模式本地启动：

```bash
npm run dev:http
```

## 在 MCP 客户端中接入

以 `stdio` 模式为例，命令可配置为：

```json
{
  "command": "node",
  "args": ["dist/index.js"],
  "cwd": "/Users/a511/Desktop/irrigation2.0/services/mcp-server",
  "env": {
    "IRRIGATION_EXECUTION_BASE_URL": "http://127.0.0.1:4310",
    "IRRIGATION_MCP_EMAIL": "operator@example.com",
    "IRRIGATION_MCP_PASSWORD": "your-password"
  }
}
```

## 远程 HTTP 部署

当前推荐模式是：`mcp-server` 固定持有一组平台账号密码，并在服务端自动换取 session token。不要把平台登录 token 长期写死到环境变量里。

启动：

```bash
MCP_SERVER_HOST=0.0.0.0 \
MCP_SERVER_PORT=4330 \
MCP_SERVER_AUTH_TOKEN=replace-with-a-long-random-token \
IRRIGATION_EXECUTION_BASE_URL=https://api.ssdsdeeefd.xyz/api/execution \
IRRIGATION_MCP_EMAIL=operator@example.com \
IRRIGATION_MCP_PASSWORD=your-password \
npm run start:http
```

健康检查：

```bash
curl http://127.0.0.1:4330/health
```

MCP endpoint：

```text
POST /mcp
```

如果配置了 `MCP_SERVER_AUTH_TOKEN`，客户端请求时要带：

```text
Authorization: Bearer <MCP_SERVER_AUTH_TOKEN>
```

## Docker 部署

构建镜像：

```bash
docker build -t irrigation-mcp-server ./services/mcp-server
```

运行：

```bash
docker run -d \
  --name irrigation-mcp-server \
  -p 4330:4330 \
  -e MCP_SERVER_HOST=0.0.0.0 \
  -e MCP_SERVER_PORT=4330 \
  -e MCP_SERVER_AUTH_TOKEN=replace-with-a-long-random-token \
  -e IRRIGATION_EXECUTION_BASE_URL=https://api.ssdsdeeefd.xyz/api/execution \
  -e IRRIGATION_MCP_EMAIL=operator@example.com \
  -e IRRIGATION_MCP_PASSWORD=your-password \
  irrigation-mcp-server
```

开发模式也可以直接用：

```json
{
  "command": "npx",
  "args": ["tsx", "src/index.ts"],
  "cwd": "/Users/a511/Desktop/irrigation2.0/services/mcp-server",
  "env": {
    "IRRIGATION_EXECUTION_BASE_URL": "http://127.0.0.1:4310",
    "IRRIGATION_MCP_EMAIL": "operator@example.com",
    "IRRIGATION_MCP_PASSWORD": "your-password"
  }
}
```

## 后续建议

- 增加 `resources`，补 `irrigation://plans/{id}` 这类上下文资源
- 给写操作增加 RBAC 和审计日志
- 第二阶段再补 `Streamable HTTP`
