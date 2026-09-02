---
title: "M6 引擎波：UniverseAgent adapter 与活数据接线"
type: plan
status: draft
phase: M6
updated: 2026-09-02
summary: "R5 草案：platform 传输 adapter + 同 token roster 投影；AHP 非权威；能力三态；切片 adapter → page-access 5 → E1 → T4"
---

# M6 引擎波

> **研究入口：** [research-queue R5](../progress/research-queue.md)。  
> **产品：** [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) 今天 `blocked`；活数据还解锁 PRD-002/003/004、page-access 切片 5、customizations E1、trajectory T4。  
> **边界 ADR：** [ADR-003](../decisions/003-engine-adapter-boundary.md)（本稿同期 `draft`）。  
> **能力矩阵 SSOT：** [customizations-engine.md](customizations-engine.md) §2 / §3.7。本稿不重开 catalog 权威。  
> **AHP：** [agent-host overview](../../docs/systems/agent-host/overview.md) — `IAgentHostService` 不是 UA session-core。

本稿 `status: draft`。**不得**标 `accepted` / ReadyToImplement，直到规则 16 只读审查改稿。本稿 **不改** `src/`。

---

## 1. 目标

把默认 Code 窗口的 Conversation 从「本地 stub 占位」接到 **UniverseAgent gRPC**，使：

1. 会话列表、当前会话、发送、权限座位来自引擎诚实枚举与流，而不是 stub 种子 id（`untitled` / `visualize`）或 stub echo 冒充已接通。
2. Engine 页（`ua.engine`）能按能力三态显隐 catalog；无连接时仍是诚实空 + Test（PRD-007）。
3. 轨迹透镜能用引擎 Event fold 替换 fixture（T4），且不经过 AHP / `IChatModel`。

**M6 完成线（签收后实施）：** adapter 同 token 替换 stub 实现 → page-access 切片 5 UI 状态机 → E1 Skills list/toggle → trajectory T4。PRD-008 仍须启动冒烟证据才升 `implemented`。

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
| 时间线 | `getTurns` 同步数组 | `SessionService.GetHistory`（`cursor_seq`）+ `SessionEventStream` | stub 是闭集 `user/assistant/confirmation/thinking/tool/visualization`；UA 是信封流。接通后 `appendStubEchoAssistant` **禁止**再写助手回合 |
| 发送 | `appendUserTurn` 本地 push | `AgentService.Chat` 双向流（`session_id` + payload） | 发送链 = UA adapter，**禁止** `IChatService.sendRequest`（page-access 已钉） |
| 权限 | `appendConfirmationTurn` / `resolveConfirmation` 本地状态 | 流内权限事件 + `PermissionService.Respond` | 无引擎时只改本地（PRD-004）；接通后必须打到引擎，禁止「已授权」文案在 Respond 失败时出现 |
| 轨迹 | `getTrajectoryRecords` = turns 投影 ∪ Stub fixture | 同一 Event 窗口 fold（trajectory T4） | T1–T3 fixture 带 `Stub`；接通后替换，断连不得把 fixture 混进 UA session id |
| 队列 / AutoDrive | `getMessageQueueState` / `setMessageQueueFixture` / `getAutoDriveTasks` | `AgentService.EnqueueQueueItem` 等队列 RPC；Goal 走 `PermissionService.SetSessionGoal` | HEAD 是 fixture。本波 adapter **保留接口**；活队列可在切片 5 后跟随，不得用 fixture 冒充引擎队列 |
| 变更事件 | `onDidChangeSession` / `onDidChangeEngineConnection` | stream + capability revision | 投影层继续发这两事件，让 View / SessionBar / StatusBar 零改注入点 |
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

官方顺序（串行依赖；后刀不得早于前刀合入）：

```text
M6-A adapter
  → M6-B page-access 切片 5
    → M6-C customizations E1
      → M6-D trajectory T4
```

### M6-A — adapter（本波新建）

**做什么：** `platform/universeAgent`（`node` gRPC 客户端 + `electron-browser` ProxyChannel，**非** agentHost UtilityProcess）连接 + Connect + `GrpcCapabilityProbe` + `SessionService.List/Create/Delete` + `GetHistory` 只读投影到 roster；实现类替换 stub；`isEngineConnected` = `session_token` + 活 channel（pairing-pending → false）。**发送链（本刀必改）：**

- `conversationLens.submitDraft`：**未连接** → 现有 stub echo；**已连接** → fail-closed（拒发 + 诚实句），**不得**调用 `appendStubEchoAssistant`。
- `IConversationRosterService.appendStubEchoAssistant`：**已连接时 service 层 reject/throw**（或 no-op + 断言），禁止写入助手回合。
- `deleteSession`：**已连接时**删最后一条 UA 会话 **不得**再创建 `untitled`/`visualize` stub id 回填 catalog；应走 UA `Create` 或诚实空态。

首次 `List` 完成前 roster 不展示 stub 种子为 UA 行。`AgentService.Chat` 发送实现可在 A 末 fail-closed 或 B 前接通；切片 5 只验 UI 合同。

**不做什么：** Engine catalog UI、StatusBar 改开 Engine pane、轨迹 fold、Device pairing 完整 UX（loopback 无 pairing 即可；需要 pairing 则 Connection pane 诚实待配对 — **pairing-pending 不算 connected** — 不静默跳过）。

**验证：** platform 单测 mock channel：Connect 成功 + token + 活 channel → `isEngineConnected===true`；pairing-pending → false；`GrpcCapabilityProbe` UNIMPLEMENTED on skills → `UNSUPPORTED`（非 methods 命中 alone）；断连 / 已连接 `deleteSession` 不回填 stub 种子到 UA catalog；已连接 `appendStubEchoAssistant` 被拒。`valid-layers-check`：`contrib/conversation` 不得 import `platform/universeAgent/node`。

### M6-B — page-access 切片 5（**仅 UI 合同**）

父方案 [page-access-schemes §10 切片 5](page-access-schemes.md)：**adapter 同 token 与发送/ roster 行为已在 M6-A 落地**；本刀 **只改 UI 状态机与验收**，不重开 gRPC / roster 实现。

- StatusBar B10：connected → `openEnginePreferences`，否则 Connection。
- roster listed id 与 SessionBar 标题一致；`getActiveSessionId` 单源。
- Send **不**调用 `IChatService.sendRequest`（负向 mock）；已连接路径走 `AgentService.Chat`（实现归属 M6-A）。
- Dock 控件集 3b 按各页分阶段，本刀 **不接**新引擎实现。
- SessionBar 去 SelectBox 仍 Deferred。

**验证：** 父方案切片 5 Tests + 负向 send 测（断言 UI 合同，不断言 adapter 内部）。

### M6-C — customizations E1

[customizations-engine §8.3](customizations-engine.md) 六条产品验收。依赖 A 的 `skills` 三态。H0–H3 donor 已落，禁止改扫描根到 `{AgentHome}`。

### M6-D — trajectory T4

[conversation-trajectory-lens](conversation-trajectory-lens.md) T4：Event fold 替换 fixture（含真 tool 树）。依赖 A 的 history/stream 与 B 的活 turns。`compacted` 仍预留、折外。visualize T4（PRD-014）**不**绑死本刀，可在 D 后跟随。

---

## 9. 风险

| 风险 | 缓解 |
|------|------|
| 把 AHP session 填进 roster | import 扫描：`contrib/conversation` 生产文件禁 `agentHost` / `IChatService` 发送路径（可扩现有 boundary 测） |
| gRPC 包体进 workbench | stubs 与 channel 留 platform `node`；renderer 只见 TS 接口 |
| UNKNOWN 画假 Skills | E1 验收第 6 条；probe 单测 |
| 断连回 stub 种子造成「会话消失又冒出 Untitled」 | §6；测：UA id 在 `onDidChangeEngineConnection(false)` 后仍在 `getSessions()`；已连接 `deleteSession` 末条不回填 `untitled`/`visualize` |
| 已连接仍 stub echo | M6-A：`submitDraft` fail-closed + `appendStubEchoAssistant` service 拒写 |
| 首次 List 前 stub 种子冒充 UA catalog | M6-A：List 完成前 roster 不含 stub 种子行 |
| 规则 16 未过就开实施 | 本稿保持 `draft` |

---

## 10. 知识层（实施 commit 时，不在本草案）

签收并落地后：`docs/systems/agent-host` 加一句「UA adapter 在 `platform/universeAgent`，AHP 仍非权威」；`docs/product/traceability.md` PRD-008 方案列改本文件；`docs/systems/chat/agent-ui.md` StatusBar 状态机改切片 5 事实。

---

## 相关文档

- [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级) · [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威)
- [page-access-schemes.md](page-access-schemes.md) §10 切片 5 · B10 · B11
- [customizations-engine.md](customizations-engine.md)
- [conversation-trajectory-lens.md](conversation-trajectory-lens.md)
- [agent-host overview](../../docs/systems/agent-host/overview.md)
- 外仓只读：`UniverseAgent/grpc-api/src/main/proto/{system,session,agent,tool,mcp}_service.proto` · Singularity `GrpcCapabilityProbe`

## 审查记录

- 2026-09-02：R5 发现稿 `draft`（工位 B @ `01dee834`）。规则 16 **未跑**；不得实施。
- 2026-09-02：规则 16 只读审查 **Approve with changes**（工位 B @ `bfe24b48`）。已钉：`isEngineConnected` = token + 活 channel；pairing-pending 非 connected；stub 种子 `untitled`/`visualize`；首次 List 前不投影 stub；M6-A `submitDraft`/echo fail-closed；`deleteSession` 已连接不回填 stub；SUPPORTED 须 `GrpcCapabilityProbe` 非 UNIMPLEMENTED；gRPC 宿主 node + ProxyChannel；切片 5 UI-only；ADR-003 一窗一 UA session。本稿 **仍 `draft`**，待人类签收后升 `accepted`。
