# AI 助手模块

## 当前定位

AI 助手当前通过 `assistant-service` 代理 Dify，支持小程序流式问答，避免小程序直接持有 Dify API key。

## 当前链路

```text
mini-program assistant page
  -> execution-service /mini/assistant/messages
  -> assistant-service /mini/assistant/messages
  -> Dify /chat-messages
  -> NDJSON delta/done/error
```

## 当前能力

- mini token 校验。
- Dify SSE 转 NDJSON。
- conversationId 续聊。
- 错误事件下发。

## 当前不标准点

- AI 回复未结合项目业务数据权限做上下文注入。
- 对话记录未落库。
- 缺少限流、审计、敏感信息治理。

## 生产化方向

- 按用户和项目隔离上下文。
- 保存对话摘要、请求、响应和错误。
- 引入知识库和运维手册。
- 对可执行动作使用显式确认，不允许 AI 直接触发高风险设备控制。

