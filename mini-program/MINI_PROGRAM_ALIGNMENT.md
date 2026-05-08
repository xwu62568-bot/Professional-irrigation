# Web 到小程序功能对齐清单

## 目标

在接真实接口之前，先锁定小程序要承接的 Web 能力范围，避免页面和接口反复返工。

这里对齐的是：

- 模块范围
- 页面闭环
- 核心操作
- 状态流转

这里不对齐的是：

- Web 端完整后台能力
- 桌面化编辑器
- 长周期分析报表

## Web 现有模块

当前 Web 路由见 [web-dev/src/app/routes.tsx](/Users/a511/Desktop/irrigation2.0/web-dev/src/app/routes.tsx:1)：

- `overview`
- `field-map`
- `field/:id`
- `irrigation-plan`
- `auto-strategy`
- `devices`
- `wifi-device-demo`
- `account`

## 小程序目标模块

当前小程序按 5 个模块收口：

1. 总览
2. 地块
3. 计划策略
4. 设备
5. 我的

## 对齐原则

1. 小程序承接高频查看、轻量操作、现场协同
2. Web 保留复杂编辑、批量编排、系统治理
3. 小程序优先做查看闭环，再做轻操作闭环
4. 接口按页面 view model 设计，不按数据库表设计

## 模块对齐

### 1. 总览

对应 Web：

- `Overview.tsx`

小程序一期必须对齐：

- 总指标：地块数、在线设备、待执行计划、告警数、供水负荷
- 今日灌溉建议
- 地图分布预览
- 高风险地块
- 即将执行计划

小程序二期可补：

- 告警中心入口
- 地图筛选
- 按项目/农场切换视角

保留在 Web：

- 大屏式运营摘要
- 复杂统计组合
- 长周期经营分析

### 2. 地块

对应 Web：

- `FieldMap.tsx`
- `FieldDetail.tsx`

小程序一期必须对齐：

- 地块列表
- 地块详情
- 地块地图只读展示
- 分区列表/状态
- 当前状态摘要
- 关联设备

小程序二期可补：

- 最近执行记录
- 临时灌溉入口
- 分区详情页

明确不做：

- 地块绘制
- 分区边界编辑
- 多边形精细修边
- 批量设备绑定

### 3. 计划策略

对应 Web：

- `IrrigationPlan.tsx`
- `AutoStrategy.tsx`

小程序一期必须对齐：

- 计划列表
- 计划详情
- 策略列表
- 策略详情
- 启停计划
- 启停策略
- 确认执行
- 忽略本次建议

小程序二期可补：

- 快速新建简单计划
- 阈值微调
- 最近执行日志

保留在 Web：

- 复杂计划创建
- 多分区轮灌编排
- 完整策略设计器
- 大量参数编辑

### 4. 设备

对应 Web：

- `Devices.tsx`
- `WifiDeviceDemo.tsx`

小程序一期必须对齐：

- 设备列表
- 设备详情
- 在线 / 离线 / 告警筛选
- 信号 / 电量 / 最后在线
- 所属地块
- 控制器通道状态

小程序二期可补：

- 设备控制入口
- 扫码识别
- 调试入口
- 设备事件/回执

保留在 Web 或开发环境：

- 重调试能力
- 开发联调用 Demo 流程
- 非现场角色使用的诊断工具

### 5. 我的

对应 Web：

- `Account.tsx`
- `Login.tsx`
- `Register.tsx`

小程序一期必须对齐：

- 用户信息
- 当前项目/农场
- 通知设置
- 版本信息
- 运行环境信息
- 退出登录

小程序二期可补：

- 项目切换
- 消息中心
- 接口诊断

保留在 Web：

- 注册流程（如果改成微信登录可不保留）
- 复杂账号治理

## 页面闭环要求

在接真实数据前，小程序至少要把这些闭环定清楚：

### 已完成或已拆路由

- 总览
- 地块列表 -> 地块详情
- 设备列表 -> 设备详情
- 我的

### 下一步必须补齐

- 计划列表 -> 计划详情
- 策略列表 -> 策略详情
- 计划/策略详情里的轻操作入口
- 计划创建页
- 策略创建页

## 一期操作清单

这些是小程序一期建议必须支持的动作：

- 查看地块详情
- 查看设备详情
- 查看计划详情
- 查看策略详情
- 创建计划
- 创建策略
- 启停计划
- 启停策略
- 确认本次执行
- 忽略本次建议

这些动作先不做：

- 创建地块
- 编辑分区
- 复杂策略编辑
- 复杂计划编排
- 批量设备绑定

## 结论

当前建议锁定为：

- 小程序先做 5 个模块的“查看 + 轻操作”闭环
- Web 保留复杂配置和重编辑能力
- 在 `计划详情`、`策略详情` 二级页补齐之前，不进入真实接口阶段

## 下一步

按这份清单继续推进时，建议顺序是：

1. 补齐 `计划详情` 和 `策略详情` 二级页
2. 补齐轻操作入口
3. 再开始补 Node 聚合接口和真实数据接入

## 字段与接口对齐表

这一部分用于约束后续 Node 接口和小程序页面字段，避免直接暴露 Supabase 表结构。

### 总览

页面：

- 首页工作台

页面字段：

- `snapshot.totalFields`
- `snapshot.onlineDevices`
- `supplyOverview.systemRiskCount`
- `supplyOverview.scheduledFlowM3h`
- `decision.title`
- `decision.level`
- `decision.reason`
- `fieldRisks[]`
- `duePlans[]`
- `fields[].geoCenter`
- `fields[].status`

建议接口：

- `GET /mini/overview`

返回模型建议：

```ts
interface MiniOverviewResponse {
  snapshot: DashboardSnapshot
  decision: DecisionSummary
  fieldRisks: FieldRisk[]
  duePlans: DuePlan[]
  mapFields: Array<{
    id: string
    name: string
    status: Field['status']
    geoCenter?: [number, number]
    geoBoundary?: [number, number][]
  }>
  supplyOverview: SupplyOverview
}
```

### 地块

页面：

- 地块列表
- 地块详情

列表页字段：

- `id`
- `name`
- `code`
- `crop`
- `growthStage`
- `area`
- `status`
- `soilMoisture`
- `zones.length`

详情页字段：

- 列表页字段全部
- `et0`
- `etc`
- `lastIrrigation`
- `recommendedDuration`
- `geoCenter`
- `geoBoundary`
- `zones[]`
- `relatedDevices[]`

建议接口：

- `GET /mini/fields`
- `GET /mini/fields/:id`

返回模型建议：

```ts
interface MiniFieldListItem {
  id: string
  name: string
  code: string
  crop: string
  growthStage: string
  area: number
  status: Field['status']
  soilMoisture: number
  zoneCount: number
  geoCenter?: [number, number]
}

interface MiniFieldDetailResponse {
  field: Field
  devices: Array<{
    id: string
    name: string
    type: Device['type']
    status: Device['status']
    signalStrength?: number
    batteryLevel?: number
    geoPosition?: [number, number]
  }>
}
```

### 计划

页面：

- 计划列表
- 计划详情
- 新建计划

列表页字段：

- `DuePlan.id`
- `DuePlan.name`
- `DuePlan.fieldId`
- `DuePlan.fieldName`
- `DuePlan.startTime`
- `DuePlan.totalDuration`
- `DuePlan.zoneCount`
- `DuePlan.mode`

详情页字段：

- `Plan.id`
- `Plan.name`
- `Plan.fieldId`
- `Plan.mode`
- `Plan.cycle`
- `Plan.startTime`
- `Plan.executionMode`
- `Plan.rainPolicy`
- `Plan.enabled`
- `Plan.totalDuration`
- `Plan.zoneCount`
- `Plan.zones[]`

创建页提交字段：

- `name`
- `fieldId`
- `mode`
- `cycle`
- `startTime`
- `executionMode`
- `rainPolicy`
- `zones[]`

建议接口：

- `GET /mini/plans`
- `GET /mini/plans/:id`
- `POST /mini/plans`
- `POST /mini/plans/:id/start`
- `POST /mini/plans/:id/pause`
- `POST /mini/plans/:id/stop`

### 策略

页面：

- 策略列表
- 策略详情
- 新建策略

列表页字段：

- `id`
- `name`
- `fieldId`
- `type`
- `mode`
- `enabled`
- `rainLock`
- `minInterval`
- `scope`

详情页字段：

- 列表页字段全部
- `maxDuration`
- `moistureLow`
- `moistureRestore`
- `executionMode`
- `zoneIds[]`

创建页提交字段：

- `name`
- `fieldId`
- `type`
- `mode`
- `scope`
- `rainLock`
- `minInterval`
- `maxDuration`
- `moistureLow`
- `moistureRestore`

建议接口：

- `GET /mini/strategies`
- `GET /mini/strategies/:id`
- `POST /mini/strategies`
- `POST /mini/strategies/:id/enable`
- `POST /mini/strategies/:id/disable`
- `POST /mini/strategies/:id/confirm`
- `POST /mini/strategies/:id/ignore`

### 设备

页面：

- 设备列表
- 设备详情

列表页字段：

- `id`
- `name`
- `model`
- `type`
- `status`
- `fieldId`
- `signalStrength`
- `batteryLevel`
- `lastSeen`

详情页字段：

- 列表页字段全部
- `channelCount`
- `stations[]`
- `bindings[]`
- `geoPosition`

建议接口：

- `GET /mini/devices`
- `GET /mini/devices/:id`

返回模型建议：

```ts
interface MiniDeviceListItem {
  id: string
  name: string
  model: string
  type: Device['type']
  status: Device['status']
  fieldId: string
  fieldName?: string
  signalStrength?: number
  batteryLevel?: number
  lastSeen: string
  geoPosition?: [number, number]
  source: 'real' | 'demo'
}
```

设备模块特别规则：

- 正式业务接口默认只返回 `source = 'real'`
- 演示设备只在开发/演示模式返回
- `WifiDeviceDemo` 不应混入正式设备列表默认视图
- 如果必须共存，前端必须明确显示 `演示设备` 标识

### 我的

页面：

- 账号页

页面字段：

- `user.id`
- `user.name`
- `user.role`
- `project.id`
- `project.name`
- `app.version`
- `runtime.apiBaseUrl`
- `runtime.dataSource`

建议接口：

- `GET /mini/me`
- `GET /mini/runtime`

## 接口设计约束

后续 Node 服务按下面的规则设计：

1. 不让小程序直连 Supabase
2. 不直接返回数据库原始表结构
3. 一个页面优先一个聚合接口
4. 设备模块的 demo 数据必须和 real 数据显式区分
5. 创建接口先满足小程序字段，不反向暴露 Web 表单复杂度

## 可抽取共用方法边界

后续接 Node 服务和真实数据时，必须避免 Web 和小程序各自重复写一套业务规则。

### 应该抽到共享层的

建议继续放在 `packages/irrigation-domain`，或者拆出 `packages/irrigation-api`：

#### 1. 领域类型

当前已适合共享：

- `Field`
- `Zone`
- `Device`
- `Plan`
- `PlanZone`
- `Strategy`

后续建议补充共享 DTO：

- `MiniOverviewResponse`
- `MiniFieldListItem`
- `MiniFieldDetailResponse`
- `MiniDeviceListItem`
- `MiniDeviceDetailResponse`
- `MiniPlanCreateInput`
- `MiniStrategyCreateInput`

#### 2. 纯业务映射规则

这些规则不应该留在 Web 独占：

- 计划模式映射
  - `manual / confirm / auto`
  - `duration / quantity`
- 策略模式映射
  - `suggest / confirm / auto`
- 雨天策略映射
  - `skip / continue / delay`
- 设备状态映射
  - `online / offline / alarm`

当前 Web 中值得抽离的典型逻辑：

- [web-dev/src/lib/planService.ts](/Users/a511/Desktop/irrigation2.0/web-dev/src/lib/planService.ts:36)
  - `toPlanMode`
  - `toDbPlanMode`
  - `toExecutionMode`
  - `toDbExecutionMode`
  - `toRainPolicy`
  - `toSkipIfRain`

#### 3. 页面聚合与派生计算

已经适合共享，继续沿用：

- `buildDashboardSnapshot`
- `buildFieldRisks`
- `buildDuePlans`
- `buildDecisionSummary`
- `buildSensorOverview`
- `buildSupplyOverview`
- `buildStrategyState`

文件：

- [packages/irrigation-domain/src/dashboard.ts](/Users/a511/Desktop/irrigation2.0/packages/irrigation-domain/src/dashboard.ts:1)

#### 4. 几何与地图数据适配中的纯函数

适合共享：

- `parseBoundary`
- `boundaryToJson`
- `computeGeoCenter`
- `getForecastLocation`

当前适合继续共享或后续抽共享的地图纯函数：

- 字段中心点推导
- polygon 补全规则
- zone/field 边界标准化

#### 5. 创建页表单校验

后续建议抽共享校验函数，不要 Web/小程序各写一份：

- `validatePlanDraft`
- `validateStrategyDraft`
- `normalizePlanInput`
- `normalizeStrategyInput`

### 不应该抽到共享层的

#### 1. Supabase 访问实现

这些不该复用到小程序：

- [web-dev/src/lib/supabase.ts](/Users/a511/Desktop/irrigation2.0/web-dev/src/lib/supabase.ts:1)
- `fieldService.ts` 里的 `.from(...).select(...)`
- `deviceService.ts` 里的 `.from(...).select(...)`
- `planService.ts` 里的 Supabase CRUD

原因：

- 小程序后续统一走 Node API
- 直接共享数据库访问实现会把前端和存储结构绑死

#### 2. 地图 SDK 适配

不能共享：

- Web 高德地图实现
- 小程序微信 `map` 组件适配

原因：

- 平台能力不同
- 事件模型不同
- SDK 完全不同

#### 3. 页面级 UI 逻辑

不能共享：

- React Router 路由逻辑
- Taro 页面导航逻辑
- 页面样式与布局
- 二级页顶部栏组件行为

#### 4. 演示设备接入实现

不能直接并入正式共享业务层：

- `wifiDemoGateway`
- `wifiDemoConfig`
- `wifiDemoTypes`

这些要单独作为 demo/integration 层存在，而不是正式设备域模型的一部分。

## 建议的共享结构

后续建议收成 3 层：

### 1. `packages/irrigation-domain`

放：

- 领域模型
- 纯函数
- 聚合计算
- 输入校验
- 枚举与状态映射

### 2. `packages/irrigation-api`

已开始落地，放：

- 接口 path 常量
- request/response DTO
- query 参数类型
- create/update input 类型

### 3. 各端 adapter

- `web-dev/src/lib/*Service.ts`
- `mini-program/src/services/dataService.ts`
- `services/*` Node BFF

这层只负责：

- 调接口
- 拿数据
- 调用共享层做转换

## 当前最值得优先抽离的下一批内容

1. 计划创建/详情输入输出 DTO
2. 策略创建/详情输入输出 DTO
3. 计划/策略表单校验与归一化
4. 设备列表项和详情项 DTO
5. demo 设备和 real 设备的统一类型边界

## 当前进入真实数据前的阻塞项

在正式接接口前，仍需注意：

- 计划创建页和策略创建页现在只是前端演示提交流程
- 地图当前部分边界仍是 mock 推导，不是正式业务边界
- 设备模块当前 mock 数据包含演示性质内容，接口阶段必须拆分 `real/demo`

## 功能细化清单

这一节继续收口 `计划 / 策略 / 设备` 三个模块，直到可以稳定进入 API 设计阶段。

---

## 计划模块细化

### 页面范围

- 计划列表页
- 计划详情页
- 新建计划页

一期先不做：

- 计划编辑页
- 计划删除确认页
- 执行日志详情页

### 计划列表页必须有

- 计划名称
- 所属地块
- 开始时间
- 总时长
- 分区数
- 执行模式
- 启用状态

允许操作：

- 进入详情
- 快速启动
- 快速暂停
- 快速停止
- 新建计划

一期不做：

- 列表页直接编辑
- 批量启停
- 批量删除

### 计划详情页必须有

- 计划名称
- 所属地块
- 执行周期
- 开始时间
- 执行模式
- 雨天策略
- 总时长
- 分区编排列表
- 启用状态

允许操作：

- 启动
- 暂停
- 停止

二期可补：

- 查看最近执行记录
- 查看执行日志
- 跳转分区详情

一期不做：

- 复杂编排编辑
- 多分区拖拽排序
- 按量灌溉高级参数编辑

### 新建计划页一期允许字段

必填：

- `name`
- `fieldId`
- `mode`
- `startTime`

一期按 Web 端能力对齐，必须补上：

- `cycle`
- `rainPolicy`
- `executionMode`
- `zones[]`

二期再补：

- `targetWater`
- `irrigationEfficiencyRate`
- `maxDurationPerZone`
- `allowSplit`

### 计划模块一期明确不做

- 计划复制
- 计划删除
- 复杂轮灌编排
- 批量调整分区时长
- Web 级完整计划编辑器

---

## 策略模块细化

### 页面范围

- 策略列表页
- 策略详情页
- 新建策略页

一期先不做：

- 策略编辑页
- 历史触发记录详情页

### 策略列表页必须有

- 策略名称
- 作用地块
- 策略类型
- 执行模式
- 启用状态
- 雨锁状态
- 最小间隔
- 作用范围

允许操作：

- 进入详情
- 新建策略

二期可补：

- 列表页快速启停
- 最近一次触发结果

### 策略详情页必须有

- 策略名称
- 所属地块
- 策略类型
- 执行模式
- 启用状态
- 作用范围
- 雨锁状态
- 最小间隔
- 最大执行时长
- 阈值类关键参数

允许操作：

- 确认本次建议
- 忽略本次建议
- 启用/停用

说明：

- 一期这里按 Web 端能力对齐，策略详情页正式支持启停

二期可补：

- 最近建议记录
- 最近触发记录
- 快速阈值微调

一期不做：

- 多条件策略编辑器
- 图形化规则组合
- 批量策略发布

### 新建策略页一期允许字段

必填：

- `name`
- `fieldId`
- `type`
- `mode`

建议一期补上：

- `scope`
- `rainLock`
- `minInterval`
- `maxDuration`

阈值策略一期可选：

- `moistureLow`
- `moistureRestore`

ET 策略二期再补：

- `etDeficitThreshold`
- `rainfallOffset`
- `replenishRatio`

### 策略模块一期明确不做

- 复杂策略编辑
- 分区级批量配置
- 历史版本管理
- 可视化规则编排

---

## 设备模块细化

### 页面范围

- 设备列表页
- 设备详情页

一期先不做：

- 设备编辑页
- 设备绑定页
- 扫码页
- 调试页

### 设备列表页必须有

- 设备名称
- 设备型号
- 设备类型
- 在线状态
- 所属地块
- 信号强度
- 电量
- 最后在线时间

允许操作：

- 按状态筛选
- 进入详情

二期可补：

- 按类型筛选
- 按地块筛选
- 扫码入口

### 设备详情页必须有

- 设备名称
- 设备型号
- 设备类型
- 在线状态
- 信号强度
- 电量
- 最后在线时间
- 所属地块
- 通道状态（控制器）
- 最近上报数据

允许操作：

- 查看通道状态
- 查看关联地块

说明：

- 一期这里按 Web 端能力对齐，设备详情页正式支持控制能力
- 但控制入口只针对正式设备，不针对 demo 设备

二期可补：

- 手动控制
- 查看控制回执
- 查看设备告警记录
- 地图定位

### 设备模块 demo / real 规则

这是设备模块最重要的边界：

#### 正式业务设备

进入正式对齐范围：

- 控制器
- 传感器
- 绑定关系
- 通道状态
- 设备健康度

#### 演示设备

仅作为开发/联调能力存在：

- `WifiDeviceDemo`
- 演示网关
- 演示控制链路
- mock 控制器行为

规则：

- 正式设备列表默认不展示 demo 设备
- 如果要展示 demo，必须显式标记 `演示设备`
- demo 设备字段不能反向决定正式接口模型

### 设备模块一期明确不做

- 设备创建
- 设备绑定编辑
- 复杂调试入口
- 开发演示页并入正式设备流程

---

## 进入 API 设计前的最后确认项

当下面这些问题都能明确回答时，就可以进入 API 阶段：

### 计划

- 已确定：计划创建页按 Web 端能力对齐，提交字段至少包含 `name / fieldId / mode / startTime / cycle / rainPolicy / executionMode / zones[]`
- 已确定：计划详情里的启动 / 暂停 / 停止进入正式接口
- 是否一期支持计划编辑：暂未开放，保留到下一轮确认

### 策略

- 一期创建策略允许 `name / fieldId / type / mode / scope / rainLock / minInterval / maxDuration`，阈值类补 `moistureLow / moistureRestore`
- 已确定：策略详情页正式支持启停
- 已确定：确认 / 忽略动作进入正式接口

### 设备

- 正式设备列表默认排除 demo 设备
- 已确定：设备详情页一期支持控制能力，并与 Web 端对齐
- 控制器通道状态进入正式接口，但 demo 设备的控制链路单独隔离

## 当前建议结论

按现在的对齐结果：

- 计划：可进入详情和创建，一期创建字段按 Web 对齐，支持启动 / 暂停 / 停止，不支持复杂编辑器
- 策略：可进入详情和创建，一期正式支持启停、确认、忽略，不支持复杂编辑器
- 设备：正式支持设备控制，但 demo 链路单独隔离，不混入正式设备流程

当这三块不再变动时，再进入 `packages/irrigation-api` 和 Node 接口设计。
