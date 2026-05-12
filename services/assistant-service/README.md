# assistant-service

职责：

- 复用 `mini_sessions` 做共享 session 校验
- 代理 Dify `chat-messages`
- 聚合 Dify `streaming` SSE，返回给小程序

推荐部署方式：

- `assistant-service` 不直接暴露公网
- 仅在内网监听，由 `execution-service` 通过 `ASSISTANT_SERVICE_BASE_URL` 转发调用
- 小程序和其他客户端继续只访问 `execution-service` 的统一入口

## 启动

```bash
ASSISTANT_SERVICE_PORT=4311 \
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
SUPABASE_ANON_KEY=... \
DIFY_BASE_URL=https://dify.hyecosmart.com/v1 \
DIFY_API_KEY=your-dify-app-key \
node src/index.mjs
```
