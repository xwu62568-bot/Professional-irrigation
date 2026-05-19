# API 契约规范

## 契约来源

- 小程序 API 契约以 `packages/irrigation-api` 为准。
- 领域模型以 `packages/irrigation-domain` 为准。
- 服务端实际响应必须与共享类型保持一致。

## 命名规范

- mini API 路径集中维护在 `packages/irrigation-api/src/endpoints.ts`。
- 端侧本地 endpoint 如需保留，必须与共享 endpoint 对齐。
- 请求/响应类型按业务域拆分：auth、overview、fields、devices、plans、strategies、assistant、runtime。

## 响应规范

成功：

```json
{ "data": {} }
```

失败：

```json
{ "error": "错误信息", "code": "ERROR_CODE" }
```

## 变更流程

1. 更新共享类型。
2. 更新服务端实现。
3. 更新 Web/小程序调用。
4. 更新模块文档和排障说明。
5. 增加或更新契约测试。

## 高风险 API

- 设备控制。
- 计划启动/停止。
- 策略自动执行。
- 权限和项目切换。

这些 API 必须显式记录操作人、目标对象、输入和结果。

