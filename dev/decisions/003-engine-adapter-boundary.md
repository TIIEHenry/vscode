---
title: "ADR-003 引擎 adapter 边界：platform 传输 vs roster token"
type: decision
status: accepted
phase: M6
updated: 2026-09-02
summary: "UA gRPC 客户端落 platform/universeAgent（common 含 vendored sessionView，node 含 sessionCore Actor；宿主 = electron-main @2026-09-02）；IConversationRosterService 同 token 投影；AHP 非权威；不改 conversationStubService decorator id；2026-09-02 签收 accepted"
---

# ADR-003 引擎 adapter 边界

## Context

[PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) 要把默认窗 Conversation 从本地 stub 接到 UniverseAgent。HEAD 事实：

- 产品会话契约是 `IConversationRosterService`，`createDecorator` id **`'conversationStubService'`**，实现类 `ConversationStubService` 在 `contrib/conversation`（[page-access B11](../plans/page-access-schemes.md)）。
- vscode 侧已有 **Agent Host Protocol**：`IAgentHostService` ⊂ `IAgentConnection`，进程在 `platform/agentHost`。[agent-host overview](../../docs/systems/agent-host/overview.md) 写明 AHP **不是** UA session-core。
- Engine / Connection 产品面是 Preferences pane（`ua.engine` / `ua.connection`），与 Conversation 透镜同属默认窗，但 **不得** import `contrib/` 内部以外的上帝接口去扫 catalog。
- 沙箱 renderer 不能直接持 HTTP/2 gRPC；UA 权威面是 `SystemService.Connect`、`SessionService`、`AgentService.Chat`、`PermissionService`、`ToolService`、`McpService`。
- M5 曾写「不迁 ADR-003 token」：本 ADR 就是那条预留决策，用来钉 **落层 + token**，不是改名运动。

候选：

1. **整包放 `workbench/services/universeAgent`**：工作台 ambient 服务，contrib 注入。
2. **整包放 `contrib/conversation`**：在 stub 旁长出 gRPC。
3. **传输与探测放 `platform/universeAgent`，roster 投影留 contrib、同 token**（对照 agentHost：platform 协议 + 上层 facade）。
4. **扩展 `IAgentHostService` / 实现 `IAgentConnection`**，把 UA 假装成另一种 harness。

实施方案：[m6-engine-wave.md](../plans/m6-engine-wave.md)（`accepted`）；时间线专章 [conversation-stream-timeline.md](../plans/conversation-stream-timeline.md)（`accepted`）。

## Decision

选形态 3。

1. **新 platform 服务域** `src/vs/platform/universeAgent/`（名字不得含 `agentHost`）：
   - `common`：`IUniverseAgentConnection`（或同等）— Connect 生命周期、能力三态快照、session/chat/permission/catalog 的 **TS 契约**；另含 Desktop `session-core` 的 **`view/**` vendored 树**（`common/sessionView/**`）与 renderer 帧契约 `conversationViewFrame.ts`（[stream-timeline §1 / §3](../plans/conversation-stream-timeline.md)）。不出现 DOM，不出现 Conversation 零件。
   - `node`：gRPC channel 与生成/手写 stub（`@grpc/grpc-js` 客户端）；另含 `session-core` 的 **Actor / mailbox / fold**（`node/sessionCore/**`）。renderer **禁止** import 此子树。
   - `electron-browser`（及需要时 `electron-main` / shared）：**ProxyChannel 代理**到 renderer，装配方式可对表 `LocalAgentHostServiceClient`。**不得**把 UA gRPC 塞进 agentHost UtilityProcess / `agentHostMain` 子进程。
2. **AHP 隔离：** 禁止 UA adapter 继承 `IAgentHostService` 或实现 `IAgentConnection`。`IAgentHostService` 已连接 ≠ UA 已连接。**Agents Window** Chat 可继续走 AHP；**默认 Code 窗口** Conversation **只**走 UA。
3. **一窗一 UA session（接通后）：** 默认窗在 UA Connect 成功后，**一个窗口对应一个 UA `SessionService` session**（roster 投影与 `getActiveSessionId` 单源）。Agents Window 仍按 AHP「一窗一 AH session」；两套 id 空间 **禁止**互填。
4. **Roster 同 token：** 公开类型保持 `IConversationRosterService`；decorator id **保持 `'conversationStubService'`**。`IConversationStubService` 继续是 type alias。引擎实现 **替换** `registerSingleton` 的类，不注册第二 token。View / SessionBar / StatusBar 注入点不变。
5. **Catalog 不进 roster：** `ToolService` / `ListAgentProfiles` / `McpService` 定义面挂在 platform 连接上，由 `ua.engine` 消费。禁止把 Skills 列表塞进 `getSessions()`。
6. **`workbench/services`：** 允许日后增加极薄的窗口生命周期装配（仿 `WorkbenchAgentHostService`），**禁止**把 gRPC 面或 roster 接口定义在该层。v1 可无此目录。
7. **连接态：** 生产 `isEngineConnected()` = 非空 `session_token` + 活 channel；**pairing-pending 不算 connected**。已连接时首次 `SessionService.List` 完成前 **不得**把 stub 种子（`untitled` / `visualize`）投影进 UA catalog。
8. **断连：** 从未连接 = stub 种子（`untitled` / `visualize`）诚实占位；已连接后断连 = 保留 UA 快照只读 + Engine 页空，不回填 stub 种子 id。已连接时 `deleteSession` 末条 **不得**再创建 stub id。细则见 M6 方案 §6。

## Consequences

- 分层：`contrib/conversation` 只依赖 `platform/universeAgent/common`（经 electron-browser 代理）。**门禁（2026-09-02 更正）：** ESLint `local/code-layering`（对 `platform/universeAgent/**` 提为 error）+ platform 级 boundary 测（`src/vs/workbench/**`、`src/vs/sessions/**` 生产文件禁 import `platform/universeAgent/node/**`；stream-timeline S1 落）。`valid-layers-check` 是 API / lib 检查，不查 path，不承担此职。
- sessions 层将来若要 UA，只注入 platform 契约，**不得** import `contrib/conversation`。
- 不推翻 [ADR-001](001-chat-compare-form.md) / [ADR-002](002-conversation-session-windows.md)。ADR-002 里「一张 session 窗口 = 一个 AH session」在 **无引擎** 时仍是 stub session；**UA Connect 成功后**默认窗改为 **一窗一 UA `SessionService` session**（Agents Window 仍 AHP）。AHP `createChat` fork 不是默认窗权威。
- token 全仓替换 **永久不做**（零收益、非 extension API）。M5「不迁 ADR-003 token」与本决策一致：保留 id。
- 规则 16 已跑并全部改入；**2026-09-02 与 [m6-engine-wave.md](../plans/m6-engine-wave.md) 同批签收 `accepted`**（用户委托裁决）。M6-A1 可开；M6-A2 实施时须把「宿主进程（main / shared / 新 utility）」与「权限应答走 Chat 臂还是 `PermissionService.Respond`」两项选定补进本 ADR 审查记录，不另开 ADR。

## Alternatives

- **形态 1（workbench/services 整包）：** 能被 contrib 注入，但 sessions 与 `code` 入口拿不到无 workbench 依赖的协议客户端；gRPC node 实现塞进 services 违反「platform = 跨进程基础服务」。拒绝作为主边界。
- **形态 2（只在 contrib/conversation）：** Engine pane 虽同 contrib，但把 HTTP/2 客户端和 Conversation UI 绑死；sessions 无法复用；测试与 layers 更脏。拒绝。
- **形态 4（挤进 AHP）：** 直接违反 agent-host overview 与 PRD-008「禁止用内置 Chat 会话模型顶替引擎权威」。否决。
- **改 decorator id 为 `conversationRosterService`：** page-access B11 已拒绝；本 ADR 确认。

## 审查记录

- 2026-09-02：规则 16 只读审查 **Approve with changes**（工位 B @ `bfe24b48`）。与 [m6-engine-wave.md](../plans/m6-engine-wave.md) 同期改稿。
- 2026-09-02：并入 [conversation-stream-timeline §9](../plans/conversation-stream-timeline.md) 增量：Decision 1 `common` / `node` 补 vendored `sessionView` / `sessionCore` 归属；Consequences 分层门禁由 `valid-layers-check` 更正为 `code-layering` + boundary 测。编号 Decision 1–8 语义不变。
- 2026-09-02：R5 签收 @ 工位 B（loop 波内与 M6 方案同升 `accepted`，合入 `agent-ide` @ `5b10e789`）。
- 2026-09-02：**主仓裁决确认 `accepted`**（用户委托「分析 loop 阻塞、解禁后续」）。与 M6 方案同批。
- 2026-09-02：**宿主进程选定（Consequences 预留项之一，用户委托「架构你定」）：UA gRPC 宿主 = electron-main**；[connection-hub-client](../plans/connection-hub-client.md) §3.2 给出理由（`safeStorage` 原生宿主、Desktop 同款、ProxyChannel 最短）与迁 UtilityProcess 的阈值。附加约束：Connection Hub 客户端（HTTP / TLS pin / Ed25519 / 密钥）**与 gRPC channel 同宿主**，`platform/universeAgent/node/**` 保持进程无关。权限应答臂仍待 M6-A2。
