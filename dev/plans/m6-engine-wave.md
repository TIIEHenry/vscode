---
title: "M6 引擎波：UniverseAgent adapter 与活数据接线"
type: plan
status: accepted
phase: M6
updated: 2026-09-02
summary: "R5 签收：A1–A2/B/D 已落；C E1 部分（list/toggle @ 8bfc299e；List @ 4833c008；Save/CRUD/tools.json @ f49615a1/7f10e65c）；§8.3 冒烟未闭合；PRD-008 未升 implemented"
---

# M6 引擎波

> **研究入口：** [research-queue R5](../progress/research-queue.md)。  
> **产品：** [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) 今天 `blocked`；活数据还解锁 PRD-002/003/004、page-access 切片 5、customizations E1、trajectory T4。  
> **边界 ADR：** [ADR-003](../decisions/003-engine-adapter-boundary.md)（本稿同批 `accepted`）。  
> **时间线专章：** [conversation-stream-timeline.md](conversation-stream-timeline.md)（`accepted`）— 细化本稿 §3 时间线 / 发送 / 权限 / 变更事件四行与 M6-A 发送链、M6-D 轨迹 fold；其 §9 增量修订已于本次签收并入本稿。  
> **能力矩阵 SSOT：** [customizations-engine.md](customizations-engine.md) §2 / §3.7。本稿不重开 catalog 权威。  
> **AHP：** [agent-host overview](../../docs/systems/agent-host/overview.md) — `IAgentHostService` 不是 UA session-core。

**签收（2026-09-02）：** 规则 16 只读审查 Approve with changes 已全部改入（见文末审查记录）；用户委托裁决「分析 loop 阻塞、解禁后续」，据此本稿与 ADR-003 同批升 `accepted`。**代码已落：** **A1** @ `25ed2c28`、**A2** @ `fbce0d84`（含 stream-timeline S4/S5）、**B** @ `42d523f1`、**D** @ `5104678e`；**C E1 部分** @ `8bfc299e`/`4833c008`/`f49615a1`（Skills list/toggle；Agents/MCP/Tools **List** + MCP toggle；Agents Save/Delete/Reset、MCP Add·Update·Remove、Tools profile 启用集经 `SaveAgentProfile`/`engineToolProfile.ts` @ `7f10e65c`）。**未落：** `AGENTS.md` 全文编辑器、Skill 新建/正文 UI、MCP 运行态、Plugins；§8.3 六条产品验收与 PRD-008 隔离 profile 冒烟。PRD-008 仍须冒烟才升 `implemented`。

---

## 1. 目标

把默认 Code 窗口的 Conversation 从「本地 stub 占位」接到 **UniverseAgent gRPC**，使：

1. 会话列表、当前会话、发送、权限座位来自引擎诚实枚举与流，而不是 stub 种子 id（`untitled` / `visualize`）或 stub echo 冒充已接通。
2. Engine 页（`ua.engine`）能按能力三态显隐 catalog；无连接时仍是诚实空 + Test（PRD-007）。
3. 轨迹透镜能用引擎 Event fold 替换 fixture（T4），且不经过 AHP / `IChatModel`。

**M6 完成线（已签收，可实施）：** M6-A1 platform 传输 → M6-A2 adapter 同 token 替换 stub 实现（含 stream-timeline S4 / S5）→ page-access 切片 5 UI 状态机 → E1 Skills list/toggle → trajectory T4（S6）。**代码状态 @ HEAD（`5ecbece1`）：** A1–A2 / B / D **已落**；C **部分**（list/toggle + Agents/MCP/Tools 写路径 @ `f49615a1`/`7f10e65c`，非完整 E1 验收）。PRD-008 仍须启动冒烟证据才升 `implemented`。

---

## 2. 非目标（本波）

| 不做 | 去哪 |
|------|------|
| 用 AHP / Copilot CLI / `IChatService.sendRequest` 顶替 UA | 永久禁止（PRD-008 / INV-UA-TRUTH） |
| 移植外仓 `EngineSkillCatalogService` / `GrpcEngineBridge` / Kotlin catalog 类 | IDE 只消费 RPC |
| 改 `createDecorator` id `'conversationStubService'` | [§7](#7-token-演进) · ADR-003 |
| Diff owner（PRD-009） | [R6](../progress/research-queue.md) |
| 产品名 / 图标（UniverseAgentStudio） | [D12](../progress/deferred-gaps.md)；M6 闭后再改 |
| Device pairing 完整 UX、Galaxy / Gateway / Memory 浏览 | Engine 页已排除或延后 |
| Plugins 节、MCP 运行态、Rules Remote gRPC | customizations-engine 缺口；E1 不阻塞于它们 |
| thinkrail visualize T4、Inbox 活队列全 RPC、PRD-016 活 fork catalog | adapter 之后的跟随切片，不进本波四刀主序列 |
| 在 renderer 直接 `require('@grpc/grpc-js')` | 见 [§4](#4-adapter-落层) |
| 把 stub 种子会话 id（`untitled` / `visualize`）写成引擎 session id | 接通后换 UA id |

---

## 3. UA gRPC 面 vs stub 契约差距

HEAD 公开契约在 `IConversationRosterService`（`conversationStubService.ts`）。decorator id 仍是 `'conversationStubService'`。同步内存 CRUD + 两业务事件（另加连接事件）：

| 面 | HEAD stub | UA 权威 RPC（外仓 `grpc-api`） | 差距 |
|----|-----------|-------------------------------|------|
| 握手 | `isEngineConnected()` / `setEngineConnected`（测试可写布尔） | `SystemService.Connect` → `ConnectResponse`（`capabilities.methods` / `events`，**无** proto 字段 `supported_methods`；`session_token`；`work_dir`） | stub 无握手、无 token、无 methods 广告。生产 **`isEngineConnected()` = 非空 `session_token` + 活 channel**（Connect 成功且 transport 未死）；**pairing-pending 不算 connected**。禁止 UI 手拨 |
| 会话目录 | `getSessions` / `createSession` / `deleteSession` / `renameSession` | `SessionService.List` / `Create` / `Delete`；标题 `AgentService.Rename` | stub 两颗种子（`untitled` / `visualize`）；UA 分页 + `SessionListFilter` + shelve。**无** `SwitchSession` RPC。**已连接时**首次 `List` 完成前 **不得**把 stub 种子投影进 UA catalog |
| 当前会话 | `getActiveSessionId` / `switchSession` + `onDidChangeActiveSession` | 客户端投影：本地 active id + `Resume`/`GetHistory`/`SessionEventStream` | switch 是 IDE 选择，不是引擎命令。禁止第二份 active id（page-access B11 / navigator INV） |
| 时间线 | `getTurns` 同步数组 | `SessionService.GetHistory`（`cursor_seq`）+ `SessionEventStream`，**经 session-core fold**（L1–L4 demux → Actor → `ViewFrame`）；renderer 只吃 `ViewFrame`，细则见 [stream-timeline §3](conversation-stream-timeline.md#3-设计) | stub 是闭集 `user/assistant/confirmation/thinking/tool/visualization`；UA 是信封流。接通后 `appendStubEchoAssistant` **禁止**再写助手回合 |
| 发送 | `appendUserTurn` 本地 push | `AgentService.Chat` 双向流（`session_id` + payload）；**三键分立** `message_id` / `operation_id` / `originLeaseId`；outbox 沿 Desktop ADR-012 | 发送链 = UA adapter，**禁止** `IChatService.sendRequest`（page-access 已钉） |
| 权限 | `appendConfirmationTurn` / `resolveConfirmation` 本地状态 | 流内 L4 `permission_request` → session-core `pendingActions`；应答走 Chat 臂 `PermissionResponse` 或 `PermissionService.Respond`（**M6-A2 实施时定一条，不双写**） | 无引擎时只改本地（PRD-004）；接通后必须打到引擎，禁止「已授权」文案在 Respond 失败时出现 |
| 轨迹 | `getTrajectoryRecords` = turns 投影 ∪ Stub fixture | 同一 Event 窗口 fold（trajectory T4） | T1–T3 fixture 带 `Stub`；接通后替换，断连不得把 fixture 混进 UA session id |
| 队列 / AutoDrive | `getMessageQueueState` / `setMessageQueueFixture` / `getAutoDriveTasks` | `AgentService.EnqueueQueueItem` 等队列 RPC；Goal 走 `PermissionService.SetSessionGoal` | HEAD 是 fixture。本波 adapter **保留接口**；活队列可在切片 5 后跟随，不得用 fixture 冒充引擎队列 |
| 变更事件 | `onDidChangeSession` / `onDidChangeEngineConnection` | stream + capability revision | 投影层继续发这两事件，让 View / SessionBar / StatusBar 零改注入点；**同 token 增量加 `acquireSessionView(sessionId)`** 作细粒度帧通道（stream-timeline §3.2） |
| 多 agent / fork | 无 | `AgentService.List` / `Tree` / `Fork`；PRD-016 活 catalog | 本波不假装已 fork；窗口 chrome 已落，活数据跟随 |

**AgentService / ToolService / McpService 的 catalog RPC 不进 roster 接口。** 它们是 Engine 页与运行时 catalog，经 platform 连接服务调用，不塞进 `IConversationRosterService`（避免 Preferences pane 与 Conversation UI 抢同一上帝接口）。

**AHP 对照（禁止映射）：**

| AHP（`IAgentHostService`） | UA | 结论 |
|---------------------------|-----|------|
| `listSessions` / `createSession` / `createChat` | `SessionService.*` / `AgentService.Chat` | 两套 id 空间；禁止互填 |
| `initializeResult` 能力（`terminalCommandPrefix` 等） | `ConnectResponse.capabilities.methods` | 不是同一握手 |
| `IAgentHostService` 已连接 | UA `Connect` 成功 | **A 真 ≠ B 真**；StatusBar / Engine 页只看 UA |

---

## 4. Adapter 落层

候选与结论见 [ADR-003](../decisions/003-engine-adapter-boundary.md)。摘要：

```text
SystemService / SessionService / AgentService / PermissionService / ToolService / McpService
        ▲  @grpc/grpc-js（platform/universeAgent/node 客户端）
IUniverseAgentConnection（platform/universeAgent/common）
        │  electron-browser ProxyChannel（对标 LocalAgentHostServiceClient 装配）
        │  **不是** agentHost UtilityProcess / agentHostMain 子进程
        ├──── IConversationRosterService 实现（contrib/conversation，同 token）
        ├──── ua.engine / ua.connection panes（contrib/conversation Preferences）
        └──── （日后）sessions 若要 UA，只依赖 platform，不依赖 contrib/conversation
```

**选定：传输与探测在 `platform/universeAgent`；Conversation 投影仍在 `contrib/conversation`。不把整包 adapter 放进 `workbench/services/`。**

理由：

1. **进程：** 沙箱 renderer 不能直接持 HTTP/2 gRPC。UA gRPC **宿主 = `platform/universeAgent/node` 客户端** + **`electron-browser` ProxyChannel 代理**（装配方式可对表 `LocalAgentHostServiceClient`，但 **不得**复用 agentHost UtilityProcess / `agentHostMain` 子进程）。`common` 契约；renderer 只见代理接口。
2. **消费者不唯一：** Engine pane 与 roster 都要连接态；`workbench/services` 不得 import `contrib/`，catalog 若只挂在 contrib roster 上，Preferences 会被迫反向探内部，或把上帝接口抬到 services 再被 sessions 看见。platform 契约可被 workbench **和** sessions 注入。
3. **AHP 隔离：** 新目录 `universeAgent/`，禁止继承 `IAgentHostService`、禁止实现 `IAgentConnection`。命名不得含 `agentHost`。
4. **为何不是 workbench/services：** 该层是工作台核心服务（配置、远程、布局），不是跨进程协议客户端。把 gRPC channel 放进 services 会迫使 `code`/`server` 入口绕过 platform 惯例，且 sessions 将来仍要再包一层。

**contrib 职责：** `registerSingleton(IConversationRosterService, <EngineBackedRoster>, …)` **替换实现类**，不换 token。类内：未连接 → 现有 stub 种子（`untitled` / `visualize`，壳 UX）；已连接 → 等首次 `SessionService.List` 完成后再投影 UA catalog（**禁止**在此之前把 stub 种子当 UA 行）；断连后 → [§6](#6-断连回退与诚实空)。

**workbench/services 允许的薄装配：** 仅当桌面入口需要「窗口 ambient 连接」时，可仿 `WorkbenchAgentHostService` 在 `workbench/services/universeAgent/` 做 **选型/生命周期**（选 profile、拉起代理），**不得**在此重写 RPC 面或 roster 接口。v1 若连接只在 renderer 代理 + platform node 客户端，可暂不建该目录。

---

## 5. 能力三态映射

对齐 UA `CapabilitySupport` / `CapabilityStatus`：`SUPPORTED | UNSUPPORTED | UNKNOWN`，带 `reason`。vscode **实现等价探测**，禁止移植 `EngineSettingsCapabilities.kt`。

**两层输入：**

| 来源 | 键 | vscode 做法 |
|------|----|-------------|
| Connect `ServerCapabilities.methods` + **`GrpcCapabilityProbe` 运行时 probe** | UA 已有：`skills` / `mcp` / `plugins` / `globalRules`（以及 memory/token/… 本页不消费） | **仅 methods 命中 ≠ SUPPORTED**；须按 Singularity `GrpcCapabilityProbe` 对目标 RPC 发 probe，**仅当非 `UNIMPLEMENTED` 才可标 SUPPORTED**；probe 返回 `UNIMPLEMENTED` → UNSUPPORTED。**禁止**把空列表或 methods 命中 alone 当 SUPPORTED |
| IDE 本地推导（**不**扩 proto） | `agentProfiles` / `projectRules` / `tools` / `hooksMetadata` | ListAgentProfiles / ListTools 试探或 UNIMPLEMENTED；`hooksMetadata` 在 `ListHookPoints` 出现前恒 UNSUPPORTED/UNKNOWN |

**与 UA 公式的差异（勿混）：**

| 条件 | UA `deriveEngineSettingsCapabilities` | vscode M6 |
|------|----------------------------------------|-----------|
| 未选 profile / PRD-008 未接通 | 多键 `UNKNOWN`（「先选 profile」） | **一律按无列表渲染**（Engine 空 + Test）。不要用 Stub catalog 填 UNKNOWN |
| `!bridgeAvailable` | `UNSUPPORTED` | 同：无 Connect 成功 |
| 传输失败（DEADLINE / UNAVAILABLE） | 不是三态里的 `Failed` | **单独** `transport: ok \| failed`（或连接枚举 `disconnected/connecting/connected/error`）。禁止 `catch → emptyList()` 当成「引擎返回 0 条」 |

**Engine 页消费（customizations-engine §2 不重开）：**

| 探测键 | SUPPORTED | UNSUPPORTED | UNKNOWN | 无连接 |
|--------|-----------|-------------|---------|--------|
| `skills` | list/toggle/body 走 ToolService | 节在，诚实句，零假名 | 文案「正在确认引擎能力」 | 整页空 + Test |
| `agentProfiles` / `mcp` / `tools` / `hooksMetadata` / rules | 见引擎面表 | 节在可留，计数 0 | 不画假条目 | 同上 |

vscode `IMcpService` 已连 `.vscode/mcp.json` **不得**把 `mcp` 抬成 SUPPORTED。`IAgentHostService` 已连接 **不得**把任一 UA 键抬成 SUPPORTED。

**Conversation 壳：** `isEngineConnected()` **钉死** = 非空 `session_token` + 活 channel（Connect 成功且 transport 未死）。**pairing-pending / connecting 均不算 connected**。切片 5 StatusBar：connected → Engine pane，否则 Connection（page-access B10）。能力三态 **不**用来画会话列表假行；已连接时 roster **不得**在首次 `List` 完成前展示 stub 种子为 UA 行。

---

## 6. 断连回退与诚实空

PRD-007 + customizations-engine §4。

| 表面 | 从未连接 | 已连接后断连 |
|------|----------|----------------|
| Conversation roster / 时间线 | 继续 stub 种子（`untitled` / `visualize`）+ stub echo（PRD-003 诚实占位） | **保留**最后一次 UA 快照只读；标题/回合不换回 stub 种子 id；输入可拒发或明确「Engine not connected」；**禁止** stub echo 看起来像引擎回复 |
| Engine 页 | 空 + Test | 空 + Test；**丢掉**上次 RPC 缓存，禁止「已同步」 |
| StatusBar engine 芯片 | 「Engine not connected」→ Connection pane | 同文案；切片 5 前永远 Connection，切片 5 后仅 connected 才 Engine |
| 轨迹 | Stub fixture（带 `Stub`） | 已有 UA 记录可只读；新 fixture **不得**插入该 session id |
| 权限座位 | 本地 Allow/Skip | 已决的保持记录；pending 标断开，禁止再声称已向远端授权 |

`setEngineConnected` 仅测试保留；生产路径删除或变成 no-op 断言。

---

## 7. Token 演进

已拍板（page-access B11 / session-roster-reuse），M6 **执行、不重开**：

```ts
export const IConversationRosterService = createDecorator<IConversationRosterService>('conversationStubService');
export type IConversationStubService = IConversationRosterService;
export const IConversationStubService = IConversationRosterService;
```

| 做 | 不做 |
|----|------|
| 换 `registerSingleton` 的实现类 | 改 decorator id 为 `conversationRosterService` |
| 扩展方法（例如 async list、capability 订阅）挂在 **同一接口** 或 platform 连接服务 | 第二套 `IUniverseAgentRosterService` token 让 View 改注入点 |
| 测试继续可用 `ConversationStubService` 作内存 fake | 全仓重命名文件 `conversationStubService.ts`（可留文件名；类名可在切片内改为 `ConversationRosterService` 并保留 stub 类给测试） |

M5 写过「不迁 ADR-003 token」：那是预留本 ADR。本 ADR 的结论是 **保留 id**，不是「以后再迁」。

---

## 8. 切片顺序

官方顺序（串行依赖；后刀不得早于前刀合入）。**签收裁定（2026-09-02）：** M6-A 拆成 **A1（platform 独立域）** 与 **A2（contrib 接线）**。A1 与 [stream-timeline](conversation-stream-timeline.md) S1–S3 **不同冲突域、可并行**；A2 须等 S3 与 A1 都合入（同改 `conversationStubService.ts` / `conversationLens.ts`）。

```text
stream-timeline S1 → S2 → S3（工位 D，串行）      M6-A1 platform/universeAgent（工位 A，并行）
                        └────────────────┬──────────────────┘
                                 M6-A2 contrib 接线（含 stream-timeline S4 / S5）
                                   → M6-B page-access 切片 5
                                     → M6-C customizations E1
                                       → M6-D trajectory T4（= stream-timeline S6）
```

### M6-A1 — platform adapter **已落** @ `25ed2c28`

**做什么：** 新建 `src/vs/platform/universeAgent/`：`common` 契约 `IUniverseAgentConnection`（Connect 生命周期、能力三态快照、session / chat / permission / catalog TS 面）；`node` gRPC 客户端（`@grpc/grpc-js`；生成 / 手写 stub）+ `SystemService.Connect` + `GrpcCapabilityProbe` 等价探测 + `SessionService.List/Create/Delete` + `GetHistory` / `SessionEventStream` / `AgentService.Chat` 的传输原语；`electron-browser` ProxyChannel 代理（**非** agentHost UtilityProcess；宿主进程 main / shared / 新 utility 由本刀实施定并写入 ADR-003 审查记录）。`isEngineConnected` = `session_token` + 活 channel（pairing-pending → false）。**history / stream 不自建投影**：本刀只暴露传输与订阅端口，fold 归 S1 落下的 `node/sessionCore` Actor（`historyResult` → fold → baseline）。

**冲突域：** `platform/universeAgent/**`（S1 在其中只新建 `common/sessionView/**`、`node/sessionCore/**` 两棵 vendored 树与 `conversationViewFrame.ts`；A1 **不得**改这三处，只 import）、`package.json` 依赖、`build/` 打包配置。A1 若早于 S1 合入，对 sessionCore 的依赖以接口占位并在 A2 接线。

**验证：** platform 单测 mock channel：Connect 成功 + token + 活 channel → `isEngineConnected===true`；pairing-pending → false；`GrpcCapabilityProbe` UNIMPLEMENTED on skills → `UNSUPPORTED`（非 methods 命中 alone）；transport 失败 → `transport: failed` 而非空列表。`npm run compile` + `npm run eslint`（`local/code-layering` 对 `platform/universeAgent/**` 为 error）绿。

### M6-A2 — contrib 接线 **已落** @ `fbce0d84`（S3 与 A1 合入后）

**做什么：** 引擎实现类替换 `registerSingleton(IConversationRosterService, …)`，同 token；**`GetHistory` 经 session-core `historyResult` 进 Actor，由 fold 产 baseline 帧，不另写 roster 投影**（2026-09-02 按 [conversation-stream-timeline §9](conversation-stream-timeline.md) 替换原「`GetHistory` 只读投影到 roster」）；含该稿 **S4**（`SessionEventStream` 订阅 + demux + attribution + Actor + lease over ProxyChannel）与 **S5**（Chat 写路径 + outbox + `heartbeat_ack` + permission / question / clientTool respond）。**发送链（本刀必改）：**

- `conversationLens.submitDraft`：**未连接** → 现有 stub 帧源；**已连接** → `lease.post` → `AgentService.Chat`；接不通则 fail-closed（拒发 + 诚实句），**不得**调用 `appendStubEchoAssistant`。
- `IConversationRosterService.appendStubEchoAssistant`：**已连接时 service 层 reject/throw**（或 no-op + 断言），禁止写入助手回合。
- `deleteSession`：**已连接时**删最后一条 UA 会话 **不得**再创建 `untitled`/`visualize` stub id 回填 catalog；应走 UA `Create` 或诚实空态。
- 权限应答：Chat 臂 `PermissionResponse` 与 `PermissionService.Respond` **二选一**，选定写入 ADR-003 审查记录。

首次 `List` 完成前 roster 不展示 stub 种子为 UA 行。切片 5 只验 UI 合同。

**不做什么（A1 / A2 共同）：** Engine catalog UI、StatusBar 改开 Engine pane、轨迹 fold（S6 / M6-D）、Device pairing 完整 UX（loopback 无 pairing 即可；需要 pairing 则 Connection pane 诚实待配对 — **pairing-pending 不算 connected** — 不静默跳过）。

**验证：** 断连 / 已连接 `deleteSession` 不回填 stub 种子到 UA catalog；已连接 `appendStubEchoAssistant` 被拒；`conversationLens.test.ts` 全绿；S4 隔离 profile 冒烟（hello → live、gap → syncing → live、断连 → closed 快照）。**分层门：** ESLint `local/code-layering` + S1 的 platform 级 boundary 测（`src/vs/workbench/**`、`src/vs/sessions/**` 生产文件禁 import `platform/universeAgent/node/**`）；`valid-layers-check` 是 API / lib 检查，不承担此职（[D8](../progress/deferred-gaps.md) 豁免期内不作门禁）。

### M6-B — page-access 切片 5 **已落** @ `42d523f1`（**仅 UI 合同**）

父方案 [page-access-schemes §10 切片 5](page-access-schemes.md)：**adapter 同 token 与发送/ roster 行为已在 M6-A2 落地**；本刀 **只改 UI 状态机与验收**，不重开 gRPC / roster 实现。

- StatusBar B10：connected → `openEnginePreferences`，否则 Connection。
- roster listed id 与 SessionBar 标题一致；`getActiveSessionId` 单源。
- Send **不**调用 `IChatService.sendRequest`（负向 mock）；已连接路径走 `AgentService.Chat`（实现归属 M6-A2）。
- Dock 控件集 3b 按各页分阶段，本刀 **不接**新引擎实现。
- SessionBar 去 SelectBox 仍 Deferred。

**验证：** 父方案切片 5 Tests + 负向 send 测（断言 UI 合同，不断言 adapter 内部）。

### M6-C — customizations E1 **部分已落** @ `8bfc299e`/`4833c008`/`f49615a1`

[customizations-engine §8.3](customizations-engine.md) 六条产品验收仍待冒烟。**已落：** Skills list/toggle @ `8bfc299e`；Agents/MCP/Tools **List**（MCP toggle enablement）@ `4833c008`；Agents Save/Delete/Reset、MCP Add·Update·Remove、Tools profile 启用集（`SaveAgentProfile` + `engineToolProfile.ts`）@ `7f10e65c`/`f49615a1`。**未落：** `AGENTS.md` 全文编辑器、Skill 新建/正文 UI、MCP 运行态、Plugins 节；§8.3 产品验收与 PRD-008 隔离 profile 冒烟。H0–H3 donor 已落，禁止改扫描根到 `{AgentHome}`。

### M6-D — trajectory T4 **已落** @ `5104678e`（= stream-timeline S6）

[conversation-trajectory-lens](conversation-trajectory-lens.md) T4：Event fold 替换 fixture（含真 tool 树）= [conversation-stream-timeline](conversation-stream-timeline.md) S6（`projectSnapshotToTrajectory`；**G2/G3 仍 open**— DetailRef 全文 / `compacted` emit 未闭合）。依赖 A2 的 history/stream 与 B 的活 turns。`compacted` 仍预留、折外。visualize T4（PRD-014）**不**绑死本刀，可在 D 后跟随。

---

## 9. 风险

| 风险 | 缓解 |
|------|------|
| 把 AHP session 填进 roster | import 扫描：`contrib/conversation` 生产文件禁 `agentHost` / `IChatService` 发送路径（可扩现有 boundary 测） |
| gRPC 包体进 workbench | stubs 与 channel 留 platform `node`；renderer 只见 TS 接口 |
| UNKNOWN 画假 Skills | E1 验收第 6 条；probe 单测 |
| 断连回 stub 种子造成「会话消失又冒出 Untitled」 | §6；测：UA id 在 `onDidChangeEngineConnection(false)` 后仍在 `getSessions()`；已连接 `deleteSession` 末条不回填 `untitled`/`visualize` |
| 已连接仍 stub echo | M6-A2：`submitDraft` fail-closed + `appendStubEchoAssistant` service 拒写 |
| 首次 List 前 stub 种子冒充 UA catalog | M6-A2：List 完成前 roster 不含 stub 种子行 |
| A1 与 S1 同改 `platform/universeAgent/**` 冲突 | A1 不得改 `common/sessionView/**`、`node/sessionCore/**`、`conversationViewFrame.ts`；S1 不得改 A1 新建的连接 / gRPC 文件；两槽各自 rebase 到对方合入后的 `agent-ide` |
| A2 早于 S3 开工导致 `conversationStubService.ts` 双写者 | A2 入口条件 = S3 与 A1 均已合入 `agent-ide` |

---

## 10. 知识层（实施 commit 时，不在本稿）

落地后：`docs/systems/agent-host` 加一句「UA adapter 在 `platform/universeAgent`，AHP 仍非权威」；`docs/product/traceability.md` PRD-008 方案列改本文件；`docs/systems/chat/agent-ui.md` StatusBar 状态机改切片 5 事实；[engine-protocol-surface §1 / §5](../../docs/reference/universe-agent/engine-protocol-surface.md) 用 A1 / A2 实测的 RPC 名回填「须查明」列；[stub-and-fixtures §5](../../docs/systems/conversation/stub-and-fixtures.md) 回填连接态映射；[docs/modules/platform/overview.md](../../docs/modules/platform/overview.md) 加 `platform/universeAgent` 条目。

---

## 11. 增量修订：Navigator 引擎段 / Sources Review（2026-09-02 同批签收，A1 / A2 实施须并入）

来自 [navigator-engine-segments §9](navigator-engine-segments.md) 与 [sources-review-progress §8](sources-review-progress.md)（两稿 `accepted`）。**不改** §2 非目标（PRD-016 活 fork catalog 仍不进本波）、不改 session-core 类型、不改 A1「不自建投影」。

| 切片 | 增量 |
|------|------|
| **A1** renderer 面 `IUniverseAgentConnection` | `team.memberStatus(sessionId, agentId)` / `team.taskList(sessionId, agentId)` / `team.teamInfo(sessionId, agentId, teamId)` 三个只读 unary；`requestAgentTreeRefresh(sessionId)`（转 host）；事件 `onDidChangeTeamRuntime: Event<{ sessionId }>`；事件类型 `onDidFileMutation: Event<IFileMutationRecord>`（A1 实现 `Event.None`，禁止发未 join 的 L3 snapshot）；连接快照暴露 `workDir` 与「本次 Connect 是否发送 `shared_fs_root`」 |
| **A1** node 客户端 | 加 `AgentService.Tree(AgentTreeRequest{session_id})`（**仅 host 调用**，不进 renderer 面）；`TeamService.MemberStatus / TaskList / TeamInfo` |
| **A2** host：Agent 树 | 拉 `Tree` 并 post `agentTreeBound`（`type / status` 写 proto 枚举名字串）。**必拉**：`SessionEventStream` 订阅成功 / 首个 lease / `switchSession` 立即一次；禁止 `SessionInfo.root_agent` 充当初拉。**再拉**：L3 `sub_agent_activity.set_status` / `sub_agent_completed` / `detached_child_phase` / `multi_agent_status` / `turn_lifecycle`、L2 `branch_topology_notified`、`requestAgentTreeRefresh`；250 ms 合并、in-flight 去重；`UNIMPLEMENTED` → `agentTree=UNSUPPORTED` 且本连接不再重试。`team_created` → post `teamIdBound`；L3 `multi_agent_status` 任一臂 → `onDidChangeTeamRuntime` |
| **A2** host：文件改动 join（demux / fold 旁路，与 attribution 同层） | session 内 `tool_call_id → { turnId, agentId }` 表（`ToolCallLifecycleEvent` 写表）；`tool_runtime_snapshot.payload.file_mutation_payload` 查表产出 `IFileMutationRecord`，未命中进 pending；`RuntimeOverlaySnapshotEvent.tool_runtime_snapshots` 重播种只补 path / operation、查表回填、去重；`TurnCompletedChange.assistant_turn_id` 到达后 settle 该 turn 记录的 `turnId`；fold 产出帧时写 `ItemAttribution.toolCallId?`（`conversationViewFrame.ts`，vscode 类型；overlay 卸挂换成 L2 项时新 id 也写） |
| **A2** catalog | 根仍 `'default'`（不改 URI / 面包屑 / 不可关根 tab）；一旦登记非根 catalog 项（含惰性 `registerSubAgentChat`），id 逐字 ≡ `AgentInfo.agent_id`；**不**交付活 fork 列表 / 预同步 catalog |
| **A2** 验证 | 假连接、无 L3 → 快照有一层根 `liveAgentTree`、Tree ≥ 1；`sub_agent_completed` → 树更新一次；`UNIMPLEMENTED` 后 Tree 计数不增；lifecycle + snapshot → 一条完整记录；先 snapshot 后 lifecycle → 先 pending 再产出；`turn_completed` 后 turnId = `assistant_turn_id`；重播种不重复；帧 attribution 带 `toolCallId`；非根 catalog id ≡ `agent_id`、根仍 `'default'` |
| **§5** 能力三态 | 加 IDE 推导键 `agentTree`（`Tree` UNIMPLEMENTED → UNSUPPORTED）/ `team`（`MemberStatus` UNIMPLEMENTED → UNSUPPORTED）；非 UNIMPLEMENTED 失败不改三态 |

---

## 相关文档

- [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级) · [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威)
- [navigator-engine-segments.md](navigator-engine-segments.md) · [sources-review-progress.md](sources-review-progress.md)（§11 增量来源）
- [page-access-schemes.md](page-access-schemes.md) §10 切片 5 · B10 · B11
- [customizations-engine.md](customizations-engine.md)
- [conversation-stream-timeline.md](conversation-stream-timeline.md)（M6 时间线专章，`accepted`）
- [conversation-trajectory-lens.md](conversation-trajectory-lens.md)
- [agent-host overview](../../docs/systems/agent-host/overview.md)
- 外仓只读：`UniverseAgent/grpc-api/src/main/proto/{system,session,agent,tool,mcp}_service.proto` · Singularity `GrpcCapabilityProbe`

## 审查记录

- 2026-09-02：R5 发现稿 `draft`（工位 B @ `01dee834`）。规则 16 **未跑**；不得实施。
- 2026-09-02：并入 [conversation-stream-timeline](conversation-stream-timeline.md)（`accepted`）§9 增量修订：§3 时间线 / 发送 / 权限 / 变更事件四行；M6-A `GetHistory` 句**替换**；M6-D 指向其 S6。ADR-003 编号 Decision 不变。
- 2026-09-02：规则 16 只读审查 **Approve with changes**（工位 B @ `bfe24b48`）。已钉：`isEngineConnected` = token + 活 channel；pairing-pending 非 connected；stub 种子 `untitled`/`visualize`；首次 List 前不投影 stub；M6-A `submitDraft`/echo fail-closed；`deleteSession` 已连接不回填 stub；SUPPORTED 须 `GrpcCapabilityProbe` 非 UNIMPLEMENTED；gRPC 宿主 node + ProxyChannel；切片 5 UI-only；ADR-003 一窗一 UA session。
- 2026-09-02：R5 签收 @ 工位 B（loop 波内并入 §9 并升 `accepted`，合入 `agent-ide` @ `5b10e789`）。
- 2026-09-02：**主仓裁决确认 `accepted`**（用户委托「分析 loop 阻塞、解禁后续」；规则 16 已跑且全部改入，无未决 Critical）。同批裁定：M6-A 拆 **A1 platform**（与 stream-timeline S1–S3 并行）/ **A2 contrib 接线**（S3 + A1 合入后）；分层门 = `code-layering` + boundary 测，`valid-layers-check` 在 D8 豁免期内不作门禁；PRD-017 本地持久化落点见 [requirements PRD-017](../../docs/product/requirements.md#prd-017-本地会话持久化)（A2 接通后本地副本降为缓存）。ADR-003 同批 `accepted`。
- 2026-09-02：并入 §11 增量修订（navigator-engine-segments §9 + sources-review-progress §8，两稿规则 16 三轮后 `accepted`）：A1 team unary / `requestAgentTreeRefresh` / 两事件 / node `Tree`；A2 host 首拉 + 再拉 Agent 树、文件改动 join 表、catalog id 约定；§5 加 `agentTree` / `team` 键。非目标不变。
