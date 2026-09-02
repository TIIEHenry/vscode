---
title: "Navigator 引擎段：Projects / Agents / Team 活数据与 Inspect 详情"
type: plan
status: accepted
phase: N/A
updated: 2026-09-02
summary: "PRD-022 实施方案（规则 16 三轮 Cursor CLI Grok 审查后签收）：Navigator 三段从诚实空接到 UA 活数据——Projects = Engine → work_dir → Session 只读树（roster 同一份数据）；Agents Hierarchy 只读会话视图 lease 的 liveAgentTree（Tree 拉取含首拉归 M6-A2 host，contrib 零 RPC）；Activity = lease timeline ∪ overlay 的 tool 项；Team = 从同一棵树发现 manager → connection 三个 team unary（对 m6 的增量修订 §9）；Inspect 经 IAgentInspectService 选中总线；无引擎三段与 HEAD 一致；v1 只读；根 chatId 仍 'default'、非根逐字 ≡ agent_id；切片 N1–N5 全排 M6-A2 后；缺口 G-NAV-1 / G-NAV-2"
---

# Navigator 引擎段：Projects / Agents / Team

> **需求**：[PRD-022](../../docs/product/requirements.md#prd-022-navigator-引擎段)（`accepted` @2026-09-02，随本稿签收）。  
> **基线**：本稿相对 **commit HEAD**：HEAD 已有 vendored `platform/universeAgent/common/sessionView`（含 `IConversationSessionViewLease` 类型、`liveAgentTree` / `liveTeamId` 槽）与 `node/sessionCore`；`IConversationRosterService.acquireSessionView` 与 contrib 侧投影是 stream-timeline **S1 主仓增量**，HEAD roster 尚无。N2 / N3 / N4 的硬前置是「该增量已合入」，本稿切片**不改** roster 接口、不动 `conversationStubService.ts`（S1–S3 冲突域）。不以未 checkout 的工作树为准。  
> **上游**：[PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) `blocked`；全部切片排在 [m6-engine-wave](m6-engine-wave.md) **M6-A2** 合入之后。本稿 §9 对 m6 A2 有**增量修订**（host 拉 Agent 树、connection 暴露 team unary 与一个 IDE 侧事件），须随本稿同批签收。  
> **不推翻**：[page-access-schemes §5.4](page-access-schemes.md)（Navigator 四段 = Sidebar 发现面；inspect 只进 Panel；Engines 不进 Activity；不升格 L1；Projects 不做第二份 flat roster；Agents 不用 `AICustomizationManagementEditor` / `IChatAgentService`）；[ADR-003](../decisions/003-engine-adapter-boundary.md)（`contrib/**` 禁 import `platform/universeAgent/node/**`；同 token 演进）；[conversation-stream-timeline](conversation-stream-timeline.md)（lease 是显示写源；不改 session-core 类型）；[ADR-006](../decisions/006-shell-invariants.md)。  
> **权威**：RPC 名与字段以外仓 `grpc-api/src/main/proto` 为准（§2 只写消息名与字段，不写行号）；签收后回填 [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) §1 / §2 / §4。  
> **审查记录**：见文末。规则 16 三轮已过（第三轮无 Critical，Important 全部改入），2026-09-02 用户授权「用 Cursor CLI Grok 审查、架构由本会话裁定」，据此 `accepted`。**ReadyToImplement：无**——N1–N5 全部硬依赖 M6-A2（含 §9 增量）合入；A2 之前只能做 §8 知识层准备。

## 0. 目标与非目标

**目标**：引擎接通后，Navigator 的 Projects / Agents / Team 三段与底部 Inspect Panel 显示来自当前引擎的真实数据；无引擎、能力不支持、传输失败三种情形各有各的诚实文案，互不冒充。用户在这三段里能**发现与定位**（切会话、看层级、看成员与任务、在 Conversation 里定位到某个子代理），不能在这里**指挥**引擎。

**非目标**（本稿不做）：

| 不做 | 原因 |
|------|------|
| Kill / Fork / StartMember / KillMember / MessageMember / TaskUpdate / TaskCancel / SwitchWorkDir 等写操作 | [product-requirements-layer](product-requirements-layer.md)「多 Agent 操作者」不在当前产品壳交付；写操作要先有 PRD 与权限座位设计。RPC 名记在 §7 供 v2 |
| Engines 进 Activity rail / Projects 里的引擎设置 | page-access 已拍板：连接面在 Preferences Connection pane |
| Projects 树替代 Sessions roster | Sessions 是 roster 权威（[m3 切片 2](m3-shell-closeout.md)）；Projects 只按 work_dir 分组同一份数据 |
| Agent Detail 开成 Preview tab 或 Conversation tab；Agents 段列 `IChatAgentService` participant 或 Customizations 文件型 Agents | PC-NAV；page-access §5.4 Agents 禁止表 |
| contrib 自己打 gRPC、自己订 `SessionEventStream`、自己存第二棵 Agent 树 | ADR-003；stream-timeline「lease 是显示写源」；HEAD 快照已有 `liveAgentTree` / `liveTeamId` 槽 |
| 消费 `AgentService.List`（扁平 roster）或 `SessionInfoResponse.root_agent` 当第二 / 第三份树 | 单源 = `liveAgentTree` |
| 轮询 | 刷新只由 lease 帧、connection 事件、会话切换、用户手动刷新触发 |
| 无引擎时 Activity 显示 stub fixture 工具行 | PRD-022 验收 1：无引擎三段与 HEAD 一致（规则 16 C2 选定 A） |

## 1. HEAD 事实（实施起点）

| 事实 | 位置 |
|------|------|
| 三段容器 `workbench.view.navigator.{projects,agents,team}`，`hideIfEmpty: false`，唯一叶 `canToggleVisibility: false`，order 11–13 | `contrib/navigator/browser/navigator.contribution.ts` |
| Projects 叶 = **本地 Recent + Current 文件夹列表**（`IWorkspacesService.getRecentlyOpened` + `IWorkspaceContextService`），行点击 `IHostService.openWindow`；welcome「No projects yet」+ Open Folder / Open Recent。contribution 以 `navigatorProjectsList.ts` 的 `NavigatorProjectsView` 为准；`navigatorStubView.ts` 里同名 stub 类只被 `navigatorStubViews.test.ts` 反向断言引用，N1 不得接到它 | `navigatorProjectsList.ts` · `navigatorStubView.ts` |
| Agents 叶 = **Hierarchy**（`WorkbenchObjectTree`）/ **Activity**（`WorkbenchList`）两子视图 + 标题动作切换 + inline filter；entries 恒空，空文案「No agents — no engine.」「No tool activity — no engine.」；标题动作「Inspect」= `OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID` 只 `openView(AGENT_INSPECT_VIEW_ID)`，**没有选中传递** | `navigatorStubView.ts`（`NavigatorAgentsView`） |
| Team 叶 = **Members** / **Tasks** 两节 + inline filter；entries 恒空；「Inspect」同上 | `navigatorTeamList.ts`（`NavigatorTeamView`） |
| Inspect = Panel 容器 `workbench.panel.agentInspect`（`hideIfEmpty: true`）+ 单叶 `workbench.panel.agentInspect.view`（`AgentInspectView`，`WorkbenchList<{id,label}>`，`setEntries` private，welcome「No inspect target yet」） | `agentInspect.contribution.ts` · `agentInspectView.ts` · `agentInspectIds.ts` |
| 子代理进 Conversation：`IConversationSessionChatService.openSubAgent(sessionKey, chatId, title?)`——按 `chatId` 查 catalog，未命中则 `registerSubAgentChat`；已有延伸 tab 时 `findOpenTabForChat` 聚焦；overlay 未挂载会抛 `Sub-agent overlay … is not mounted` | `contrib/conversation/browser/conversationSessionChatService.ts` |
| roster / 当前会话单源：`IConversationRosterService`（token `'conversationStubService'`），M6-A2 后同 token 引擎实现 | [m6 §7](m6-engine-wave.md) |
| 会话视图类型（HEAD 已 vendor）：`SessionViewSnapshot` 含 `timeline[]`（`TimelineItemView.summary: TimelineItemSummary{kind ∈ text\|reasoning\|tool\|…}`）、`overlay.blocks[]`（流式块，亦带 `summary`）、**`liveAgentTree?: LiveAgentTreeNodeView{agentId, name, type, status, model, turnCount, createdAt, children[]}`**（只在 admitted `agentTreeBound` 后出现，never invented）、**`liveTeamId?: number`**；view patch `setLiveAgentTree` / `setLiveTeamId`；Actor localFact `agentTreeBound` / `teamIdBound`。`acquireSessionView` → `ConversationViewFrame { frame, attribution }` 是 S1 增量（合同见 [stream-timeline §3](conversation-stream-timeline.md)），HEAD roster 尚无 | `platform/universeAgent/common/sessionView/types.ts` · `node/sessionCore/session-actor.ts` · `local-fact.ts` · `common/conversationViewFrame.ts` |
| 根 chat id：本仓根 tab `chatId === 'default'`（`getDefaultConversationChatResource` / `isDefaultRoot`）；`navigateAgentBreadcrumb` / `registerSubAgentChat(..., parentChatId = 'default')` 都以 `'default'` 为根；引擎根 `agent_id` 是 `"root"` | `contrib/conversation/browser/conversationChatInput.ts` · `conversationSessionChatService.ts` · 外仓 `agent_service.proto` `ForkRequest.parent_agent_id` 注释 |
| lease 生命周期：多 lease 共享订阅，末 lease 释放后 linger；`lease.post` 是写路径 | [stream-timeline §3.2](conversation-stream-timeline.md) |
| M6-A1 传输原语清单**没有** `AgentService.Tree` / `TeamService.*`；host 侧谁 post `agentTreeBound` 未定 | [m6 §8 M6-A1 / A2](m6-engine-wave.md) → 本稿 §9 |
| 现有单测锁：三段 `hideIfEmpty === false`、叶 `canToggleVisibility === false`；inspect 容器在 `PANEL_PART` 且非 `EditorInput` | `contrib/navigator/test/browser/navigatorStubViews.test.ts` · `agentInspectPanel.test.ts` |

## 2. 引擎面对照（每段一张表）

统一约定：contrib/navigator 只碰三个 IDE 侧接口——`IConversationRosterService`（会话）、`acquireSessionView` lease（Agent 树 / 工具活动 / team_id）、`IUniverseAgentConnection`（§9 新增的 team unary 与事件）。**contrib 不出现任何 proto 臂名**；proto 名只在本节「引擎事实」列，供 M6-A2 host 实施对照。枚举显示用短名（ROOT / GENERATING），wire 用 proto 枚举名（`AGENT_TYPE_ROOT` / `AGENT_STATUS_GENERATING`），`AGENT_STATUS_UNKNOWN`（0）显示「状态未知」，不映射成 IDLE。

### 2.1 Projects — Engine → work_dir → Session 只读树

| 项 | 事实 / 选定 |
|----|-------------|
| 树形 | 根 = 引擎连接（一个 `IUniverseAgentConnection` 一个根；v1 只有一个）；二级 = **work_dir**；叶 = 会话（与 Sessions roster 同一份 `getSessions()`，不另存） |
| 引擎事实 | `SessionService.List(ListSessionsRequest{limit, offset, filter}`；legacy `include_completed` v1 不依赖）→ `SessionSummary{session_id, status, created_at, last_accessed_at, turn_count, model, title, visibility}`；`SessionInfoResponse{session_id, root_agent, created_at, last_accessed_at, provider, model}`。**两者都没有 `work_dir`** → 缺口 **G-NAV-1**。`ConnectResponse.work_dir` 是服务器工作目录（连接级）；`AgentService.SwitchWorkDir` 是写 RPC，v1 不用它探测 |
| work_dir 来源（G-NAV-1 未补前） | connection 快照里的 `workDir`（M6-A1 从 `ConnectResponse.work_dir` 填）作为**唯一**分组；所有会话挂在它下面。不画「已切目录」标记 |
| G-NAV-1 补齐后 | 按每会话 `work_dir` 分组；与当前 vscode 工作区根一致的组置顶并标「当前工作区」。只改分组函数 |
| 本地组 | HEAD 的 Recent / Current 文件夹列表保留为独立一组「本地文件夹」，排在引擎根之下（无引擎时只有这一组，即 HEAD 行为）；行点击仍 `openWindow`。不把本地文件夹与引擎 work_dir 自动合并（路径相同时只在引擎组加「当前工作区」标记，不隐藏本地行） |
| 会话行点击 | `IConversationRosterService.switchSession(id)`（与 Sessions roster 同一条路径），Conversation 隐藏时按 [M5 H5](m5-ui-shell-hardening.md) 模式显示并聚焦；**不** `openEditor`，**不**开新窗 |
| 刷新 | roster `onDidChangeSessions` + connection 状态变化；无独立拉取 |
| `sessionList` 能力 `UNSUPPORTED` 时 | 引擎根下写「当前引擎不提供会话列表」，**不**把 stub 种子画成 UA 会话（ADR-003 §7） |
| 零件 | `WorkbenchObjectTree`（roster 快照同步可得，不需要 `WorkbenchAsyncDataTree`；覆盖 page-access §5.4 的零件建议）；filter 复用 `navigatorProjectsInlineFilterBox`，匹配标题 / work_dir 尾段 |

### 2.2 Agents · Hierarchy — 当前会话的 Agent 树（读 lease，不拉 RPC）

| 项 | 事实 / 选定 |
|----|-------------|
| 数据源（选定 A） | 当前会话 lease 快照的 **`snapshot.liveAgentTree`**（`LiveAgentTreeNodeView` 递归）。contrib **零** `AgentService.Tree` 调用 |
| 谁填 `liveAgentTree` | **M6-A2 host**（session Actor 所在进程）拉 `AgentService.Tree` 并 post `agentTreeBound`；**首次**拉取在会话订阅建立 / 首个 lease / 切会话时立即发生（不等 L3 事件），随后按 L3 事件重拉。触发面、合并、去重、`UNIMPLEMENTED` 停拉全部写在 §9，contrib 不见 |
| 刷新（contrib 侧） | 只有一个输入：lease `onDidApplyFrame` 且 `liveAgentTree` 引用变化 → 重建树；会话切换 → 换 lease。标题动作「Refresh」→ `connection.requestAgentTreeRefresh(sessionId)`（§9 新增；**不是** `lease.post`，也**不是** `lease.requestResync()`——resync 补事件流缺口，不拉 Tree） |
| lease 所有权 | Agents 叶**可见**时持有 1 个 lease（Hierarchy / Activity 共用），隐藏 / dispose 时释放；同 session 与 Conversation / Team 的 lease 共享订阅（stream-timeline §3.2）。**禁止** `lease.post` |
| `modelInfo` | `LiveAgentTreeNodeView` 无 `model_info` 展开字段；Inspect 只显示 `model` 字串。不为此改 session-core 类型 |
| 类型 / 状态 | `type` / `status` 是 wire 枚举名字串；显示映射表在 contrib（四类型图标、八状态 glyph + aria） |
| 会话范围 | 只画 `getActiveSessionId()` 对应会话；无活动会话 → 空态「当前没有会话」 |
| 行动作 | **Inspect** → §2.5 选中总线；**Reveal in Conversation** → §2.6 |
| 零件 | HEAD `WorkbenchObjectTree<INavigatorAgentsHierarchyNode>`；节点接口加 `agentId / type / status / model / turnCount`（可选字段，无引擎为空） |

### 2.3 Agents · Activity — 当前会话的工具活动（读 lease）

| 项 | 事实 / 选定 |
|----|-------------|
| 数据源 | 当前会话 lease 快照：**`timeline[].summary` ∪ `overlay.blocks[].summary`** 中 `kind === 'tool'` 的项，按 `itemId` / `overlay:${blockId}` 去重（只扫 `timeline[]` 会丢 S4 活工具）。归属来自 `attribution.get(itemId).agentId / agentPath` |
| lease 生命周期 | 与 Hierarchy 共用 Agents 叶的那 1 个 lease（§2.2）；N3 测试用 fake 计数断言 dispose 后无残留 lease、无 `post` 调用 |
| 无引擎 | **保持 HEAD 空态**「No tool activity — no engine.」（`!isEngineConnected()` 时不读 stub lease 的 tool 行）。C2 选定 A |
| 排序 / 上限 | 最新在上；默认最近 200 条，超出写「仅显示最近 200 条」（PRD-020 口径） |
| 行动作 | 点击 → §2.6 `conversation.revealItem({ itemId })`；**Inspect** → §2.5（模板：工具名 / 归属 / 状态 / itemId） |
| 零件 | HEAD `WorkbenchList<INavigatorAgentsActivityItem>`，接口加 `toolName / agentId / status / itemId` |

### 2.4 Team — Members 与 Tasks

| 项 | 事实 / 选定 |
|----|-------------|
| 发现 manager | 从 **同一棵 `liveAgentTree`** 取「有 `type === 'AGENT_TYPE_MEMBER'` 子节点」的节点作 manager 候选。**不**另拉树 |
| lease 所有权 | Team 叶**可见**时自己持有 1 个 lease（独立计数，与 Agents 叶互不借用；同 session 共享订阅），隐藏 / dispose 时释放。Agents 叶已 dispose、只有 Team 可见时仍能从自己的 lease 读树。**禁止** `lease.post`；Refresh 团队 = 重调 unary，不走 lease |
| 引擎事实 | `TeamService.MemberStatus(MemberStatusRequest{session_id, agent_id})` → `MemberInfo{member_name, member_agent_id, status, preset, dynamic, turn_count}`；`TaskList(TaskListRequest{session_id, agent_id})` → `BlackboardTask{task_id, owner, description, status, blocked_by, last_message, subject}`；`TeamInfo(TeamInfoRequest{session_id, agent_id, team_id})` → `{team_id, members, tasks, status}`。引擎**没有** `ListTeams`；`team_id` 只在 L3 `multi_agent_status.team_created / team_aborted / team_completed`、Chat 流 `TeamCreatedEvent`、`CreateTeamResponse` / `AbortTeamRequest` 出现，**均不落库** → 缺口 **G-NAV-2** |
| Members / Tasks（contrib 调用） | `IUniverseAgentConnection.team.memberStatus(sessionId, agentId)` / `team.taskList(sessionId, agentId)`（§9 新增 unary，A1/A2 实现）；只要 manager `agent_id`，不依赖 `team_id` |
| TeamInfo | 仅当 lease 快照 **`liveTeamId` 有值**时调 `team.teamInfo(sessionId, agentId, liveTeamId)` 取整体 `status`（ACTIVE / COMPLETED / ABORTED）作节标题；`liveTeamId` 为空（G-NAV-2：重连后槽空）→ 节标题只写 manager 名，不猜团队状态 |
| status 字面 | Member `WORKING / IDLE / WAITING / SHUTTING_DOWN / ERROR / DONE`、Task `PENDING / IN_PROGRESS / BLOCKED / COMPLETED / FAILED / CANCELLED` 原样显示；`BLOCKED` 行附 `blocked_by`；**不**与 `AgentStatus` 合并成一套枚举 |
| 刷新触发（contrib 侧） | ① `liveAgentTree` 变化（manager 集合可能变）；② `IUniverseAgentConnection.onDidChangeTeamRuntime({ sessionId })`（§9 新增 IDE 侧事件，唯一生产者 = A2 demux，源是 L3 `multi_agent_status` 任一臂；contrib 不见臂名）；③ 会话切换；④ 手动 Refresh。250 ms 合并。**不轮询** |
| 行动作 | Member 行 **Inspect**（§2.5）+ **Reveal in Conversation**（`member_agent_id` → §2.6）；Task 行 **Inspect** 只读 |
| 多 manager | 每个 manager 一组 Members + 一组 Tasks，组头为 manager 名；单 manager 时省略组头（HEAD 两节形态） |
| 零件 | HEAD `NavigatorTeamView` 两节 `WorkbenchList`，条目接口按上表加字段 |

### 2.5 Inspect Panel — 选中总线与详情模板

| 项 | 选定 |
|----|------|
| 选中总线 | 新 `IAgentInspectService`（`contrib/navigator/common/agentInspect.ts`，仅 contrib/navigator 注册与消费）：`setTarget(target: AgentInspectTarget \| undefined)`、`onDidChangeTarget`；`AgentInspectTarget` 是判别联合 `{ kind: 'agent', node: LiveAgentTreeNodeView-shaped } \| { kind: 'member', info } \| { kind: 'task', task } \| { kind: 'activity', item }`。行 action「Inspect」与行**单击**都写入 target 再 `openView(AGENT_INSPECT_VIEW_ID)`；标题栏「Inspect」只 `openView`（保留 HEAD） |
| 叶 | 沿用 v1 单叶 `workbench.panel.agentInspect.view`；不新增第二叶（page-access 留白项关闭为「不需要」） |
| 内容 | `AgentInspectView` 订阅 `onDidChangeTarget`，键值列表（复用 HEAD `WorkbenchList<{id,label}>`，行 `key: value`），四模板：**agent**（agent_id / name / type / status / model / turn_count / created_at）；**member**（member_name / member_agent_id / status / preset / dynamic / turn_count）；**task**（task_id / subject / owner / status / blocked_by / last_message / description）；**activity**（tool / agent / status / itemId） |
| 标题 / 空态 | 叶标题「Inspect: {name}」；无 target → 「Inspect」+ 空态「在 Agents 或 Team 里选择一项」（替换 HEAD welcome「No inspect target yet」） |
| 跟随 | target 所属会话切走或节点从树上消失 → 详情保留并在顶部加「已不在当前树中」note，不清空、不报错。跟随依赖 Agents / Team 至少一叶仍持 lease；两叶均隐藏、linger 到期后**不保证跟随**，只保留上次 target（不给 Inspect 单独 lease） |
| 禁止 | 任何会改引擎状态的按钮；渲染时间线；`openEditor`；为传对象而 `openEditor` |

### 2.6 Reveal 与 id 约定

| 项 | 选定（产品约定，不是实现细节） |
|----|------|
| **根：例外** | 引擎根 `agent_id === 'root'`（即 `liveAgentTree` 根节点）对应本仓根 tab **`chatId === 'default'` / `isDefaultRoot`**，不改 URI / 面包屑 / 不可关根 tab。Reveal 根 = 聚焦根 tab + 关闭 overlay；**禁止** `openSubAgent(sessionKey, 'root')`，禁止为根登记 catalog 项 |
| **非根：chatId 逐字 ≡ agent_id** | `AGENT_TYPE_SUB / MEMBER / ADVISE` 节点的 `chatId` **逐字等于** `AgentInfo.agent_id`（含 `sub:…` / `member:…` 等引擎字面）。Navigator 只把该字面传入 `openSubAgent`；`openSubAgent` 未命中时的惰性 `registerSubAgentChat(sessionKey, agentId, name)` 也用同一字面。**禁止**本段、roster 或 A2 再做第三张对照表。§9 只约束「一旦登记非根 catalog 项，id ≡ agent_id」，**不**交付活 fork 列表 / 预同步 catalog（m6 非目标不动） |
| Reveal 分支 | 根 → 见上；该 chatId 已有延伸 tab → 聚焦该 tab（HEAD `findOpenTabForChat`）；否则 → 居中子代理对话框（PRD-016 验收 4 形态）。Conversation 隐藏或 overlay 未挂载 → 先按 M5 H5 模式 `setPartHidden(false, CONVERSATION_PART)` + 聚焦，再调用；**禁止**让「overlay is not mounted」冒到用户面。N2 测试：根行 Reveal **不**调用 `openSubAgent`；`openSubAgent` mock 不被 `'root'` 打中 |
| Activity 行 reveal | 新命令 `conversation.revealItem({ itemId })`（归 `contrib/conversation`，与 [sources-review-progress §2.3](sources-review-progress.md) 共用同一条；Conversation 隐藏时同上先显示再 `revealTurn`）。N3 依赖该命令存在 |

## 3. 能力三态与文案矩阵

能力键 **IDE 本地推导**（[engine-protocol-surface §2](../../docs/reference/universe-agent/engine-protocol-surface.md)：禁止为 IDE 显隐扩 proto），N5 登记进 §2：

| 键 | 推导（在 A2 host / connection 内，contrib 只读三态） |
|----|------|
| `agentTree` | host 首次 `AgentService.Tree` 返回 `UNIMPLEMENTED` → `UNSUPPORTED`；成功 → `SUPPORTED`；未调用 → `UNKNOWN` |
| `team` | `team.memberStatus` 首次 `UNIMPLEMENTED` → `UNSUPPORTED`；其余同上 |
| `sessionList` | 已由 M6-A2 roster 推导，Projects 直接复用 |
| **非 `UNIMPLEMENTED` 的失败**（`NOT_FOUND` / `DEADLINE` / `UNAVAILABLE` / 未知 status） | **不**改三态；记传输失败态，保留上次快照 + note |

| 情形 | Projects | Agents · Hierarchy | Agents · Activity | Team | Inspect |
|------|----------|--------------------|-------------------|------|---------|
| 未连接（PRD-008 未接通 / 从未连接） | 只有「本地文件夹」组（HEAD） | 「No agents — no engine.」（HEAD） | 「No tool activity — no engine.」（HEAD） | 「No team members yet」（HEAD） | 空态 |
| 已连接，`UNKNOWN`（首拉未回） | 引擎根 + 「正在读取…」 | 「正在读取 Agent 树…」 | lease 快照即时可用 | 「正在读取…」 | — |
| 已连接，`sessionList` `UNSUPPORTED` | 引擎根 + 「当前引擎不提供会话列表」；本地组不变 | **不受该键影响**（仍跟 `getActiveSessionId()` + `agentTree`） | 不受该键影响 | 不受该键影响 | — |
| 已连接，`agentTree` `UNSUPPORTED` | 不受影响 | 「当前引擎不提供 Agent 树」 | 不受影响 | 无法发现 manager → 「当前引擎不提供 Agent 树，无法列出团队」 | 仍可显示 Activity 选中项 |
| 已连接，树里**无 MEMBER 子节点** | 不受影响 | 正常 | 正常 | 「当前会话没有团队」（**先于** `team` 三态判定；此时不 probe `team`，键停 `UNKNOWN` 也不画「正在读取」） | 正常 |
| 已连接，有 manager，`team` `UNSUPPORTED` | 不受影响 | 不受影响 | 不受影响 | 「当前引擎不提供 Team」 | agent 模板可用 |
| 已连接，`SUPPORTED`，当前会话只有根 Agent | 正常 | 一行根节点 + 空态句「**只有根 Agent**」（与 PRD-022 验收 4 同字） | 正常 | 「当前会话没有团队」 | 正常 |
| 传输失败（非 UNIMPLEMENTED；含**首拉**就失败） | 引擎根标「连接失败 · 显示为断开前快照」，保留上次树只读；无上次树 → 引擎根下只有失败 note | 有上次树 → 保留 + 「显示为断开前快照」；**无上次树 → 失败 note，禁止空列表、禁止停在「正在读取」** | 同 lease 断开态 | 同 Hierarchy 规则 | 保留 |
| 已连接后断开 | 同上一行 | 同上 | 同上 | 同上 | 保留 |

判定优先级（从上到下第一个命中者生效；三态与传输态是两个轴，传输失败先于 UNKNOWN）：

- **Hierarchy**：未连接 HEAD → `agentTree` UNSUPPORTED → 传输失败（有 / 无上次树两种 note）→ 拉取中 UNKNOWN → 正常 / 只有根 Agent。
- **Team**：未连接 HEAD → `agentTree` UNSUPPORTED → 树无 MEMBER → 有 manager 且 `team` UNSUPPORTED → 传输失败 → 拉取中 UNKNOWN → 正常。
- **Projects**：未连接 HEAD → `sessionList` UNSUPPORTED → 传输失败 / 断开（「显示为断开前快照」，与 PRD-022 验收 5 同字）→ 拉取中 UNKNOWN → 正常。

禁止：`catch → []` 当成「0 个 agent」；用 `UNKNOWN` 画 Stub；断开后仍写「已同步」；非 UNIMPLEMENTED 失败升 `UNSUPPORTED`；首拉失败后停在「正在读取」。

## 4. 切片与硬依赖

| 切片 | 做什么 | 硬依赖 | 测试 / Exit |
|------|--------|--------|-------------|
| **N1 Projects 树** | `NavigatorProjectsView` 改三层树；引擎根 + 唯一 work_dir 组（G-NAV-1 未补）+ 本地文件夹组；会话行 `switchSession`；能力 / 传输态文案 | M6-A2 roster 同 token（`getSessions` / `switchSession` / `onDidChangeSessions`）+ connection 快照 `workDir` | 新 `navigatorProjectsTree.test.ts`：无引擎只剩本地组且行为同 HEAD；有引擎三层结构、切会话只调 roster 一次、`sessionList` UNSUPPORTED 文案、断连保留快照；HEAD `navigatorProjectsList.test.ts` 不回归 |
| **N2 Agents Hierarchy + Inspect 总线** | 读 `liveAgentTree`；节点字段；`IAgentInspectService` + 四模板 + 空态改口；Reveal 分支 | M6-A2（host 填 `liveAgentTree` 含首拉；§9 `requestAgentTreeRefresh`；§2.6 id 约定：根 `'default'` 例外 + 非根惰性 `registerSubAgentChat` 用 `agent_id`，**禁止预同步 catalog**） | 新 `navigatorAgentsHierarchy.test.ts`：fake lease 快照三层 `liveAgentTree` → 树三层、类型图标、状态 glyph、`UNKNOWN` 状态文案；`agentTree` UNSUPPORTED 文案；只有根 → 「只有根 Agent」；`agentInspectPanel.test.ts` 增 `setTarget` 四模板与空态断言；Reveal 三分支 mock `IConversationSessionChatService` |
| **N3 Agents Activity** | `timeline ∪ overlay` tool 项；lease 生命周期；reveal；200 条上限 | S1 `acquireSessionView` 已合入（A2 之后已是事实，不是独立闸门）+ `conversation.revealItem` 命令；引擎活数据随 M6-A2（S4 已含于 A2） | 新 `navigatorAgentsActivity.test.ts`：只有 overlay 工具行时列表非空；去重；排序；超 200 条截断文案；`!isEngineConnected` → HEAD 空态；视图 dispose 后 fake lease 计数归零；无 `post` 调用（负向 mock） |
| **N4 Team** | manager 发现（同一棵树）→ `team.memberStatus` / `taskList`；`liveTeamId` 有值才 `teamInfo`；`onDidChangeTeamRuntime` 刷新；多 manager 分组 | N2 + §9 connection team unary 与事件（A1/A2） | 新 `navigatorTeam.test.ts`：树含 MEMBER 子节点 → 各调一次；无 MEMBER → 「当前会话没有团队」；`liveTeamId` 空 → 不调 `teamInfo`；事件后 250 ms 内重取一次；`team` UNSUPPORTED 文案；**仅 Team 可见、Agents lease 计数为 0 时**，fake lease 仍读到含 MEMBER 的树并各调一次 unary（不借用 Agents 叶） |
| **N5 隔离 profile 验收 + 知识层** | §5 V-N1–V-N6；§8 知识层；engine-protocol-surface §1 / §2 / §4 回填 | N1–N4 | 证据目录 `dev/progress/dN-evidence/`；`check-docs-health` 0 warning |

冲突域：N1–N4 只改 `contrib/navigator/**` 与其测试，外加 `contrib/conversation` 的一条新命令 `conversation.revealItem`（N3，与 sources-review 共用，谁先落谁建）。**不**改 `platform/universeAgent/**`——§9 所列 connection / host 增量归 **M6-A2 切片**实施，是本稿对 m6 的修订，不是本稿切片；N2 / N4 的硬前置就是那些增量已合入。

## 5. 验收（产品语言；勿提前勾）

| ID | 场景 | 通过标准 |
|----|------|----------|
| V-N1 | 无引擎启动 | 三段与 HEAD 一致：Projects 只有本地文件夹，Agents / Team 诚实空；无「正在读取」；Activity 无任何行 |
| V-N2 | 接通引擎、两个会话 | Projects 出现引擎根 → work_dir → 两会话；点会话 B → SessionBar 标题变 B、Sessions roster 高亮同步（单源） |
| V-N3 | 引擎会话 fork 出子代理 | Agents Hierarchy 在事件后 ≤ 1 s 出现子节点；Reveal：无 tab → 居中对话框；已有延伸 tab → 聚焦该 tab；根 → 聚焦根 tab；Conversation 隐藏时先显示再定位 |
| V-N4 | 引擎创建团队 | Team 出现 manager 名下 Members / Tasks；任务状态变化后列表更新；点 Member 行 → Panel 显示 MemberInfo 六字段 |
| V-N5 | 引擎不实现 Tree / Team | 对应段显示「当前引擎不提供 …」；不出现空列表冒充「无 agent」 |
| V-N6 | 拔掉引擎 | 三段保留上次内容 + 断开 note；无「已同步」；重连后自动刷新 |

「`UNIMPLEMENTED` ≤ 1 次 / 连接、无重试风暴」不是用户可观察项，放 N2 / N4 Exit。

## 6. 风险

| 风险 | 缓解 |
|------|------|
| G-NAV-1 不补 → Projects 树单 work_dir，与 Desktop「Engine → Project → Session」承诺有落差 | 树结构一次建对，补齐只改分组函数；PRD-022 陈述已按「引擎提供工作目录时按它分组」写 |
| G-NAV-2 不补 → 重连后 `liveTeamId` 空、`TeamInfo` 不可用 | Members / Tasks 不依赖 team_id；节标题诚实省略团队状态 |
| M6-A2 不按 chatId ≡ agent_id 注册 catalog | §9 写入 m6 A2 做什么 + A2 验证项；N2 前置检查 |
| `liveAgentTree` 无 `model_info` | Inspect 只显示 `model`；不改 session-core |
| 高频工具调用下树 / team 刷新抖动 | host 250 ms 合并 + in-flight 去重；contrib 只响应引用变化 |
| Activity 与 Conversation 轨迹重复造第二份工具列表 | 只读同一 lease 快照；不自建投影、不落库 |

## 7. 协议缺口与 v2（回填 engine-protocol-surface §4）

| ID | 缺口 | 阻塞 | 建议 |
|----|------|------|------|
| **G-NAV-1** | `SessionSummary` / `SessionInfoResponse` 无 `work_dir` | Projects 按项目分组 | 引擎仓加字段；IDE 不用 `SwitchWorkDir` 探测 |
| **G-NAV-2** | 无 `ListTeams(session_id)`；`team_id` 只在不落库事件 / 写响应出现 | 重连后 `TeamInfo` | 引擎仓加 `ListTeams` 或在 `AgentInfo` 上带 `team_id` |
| v2 写操作（非缺口） | `AgentService.Kill / Fork / SwitchWorkDir`、`TeamService.StartMember / KillMember / MessageMember / TaskUpdate / TaskCancel` | — | 先有 PRD + 权限座位 |

缺口 ID 带 `NAV` 前缀，避免与 stream-timeline G1–G5、sources-review G-REV-* 撞名。

## 8. 知识层落点（N5，不在本稿）

- [navigator-tabs-access](../../docs/reference/code-oss-b2/navigator-tabs-access.md)：三段「honest empty」改为现在时数据源。
- [page-access-schemes §5.4](page-access-schemes.md) Projects / Agents / Team 三小节：「有引擎」行指向本稿；零件 `WorkbenchAsyncDataTree` 改 `WorkbenchObjectTree`；inspect 第二叶留白关闭为「不需要」。
- [activity-and-sidebar](../../docs/systems/workbench/activity-and-sidebar.md) §5：Navigator 对照表加数据来源列。
- [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md)：§1 加 `AgentService.Tree`（host 消费）、`TeamService.MemberStatus / TaskList / TeamInfo`；§2 加 IDE 键 `agentTree` / `team`；§4 加 G-NAV-1 / G-NAV-2。
- [traceability](../../docs/product/traceability.md) PRD-022 行。

## 9. 对 m6-engine-wave 的增量修订（随本稿同批签收）

| m6 位置 | 增量 |
|---------|------|
| §8 M6-A1 `IUniverseAgentConnection` 与 node 客户端 | renderer 面加 `team.memberStatus(sessionId, agentId)` / `team.taskList(sessionId, agentId)` / `team.teamInfo(sessionId, agentId, teamId)` 三个 unary；加 `requestAgentTreeRefresh(sessionId)`（只读刷新请求，转给 host）；加事件 `onDidChangeTeamRuntime: Event<{ sessionId }>`；connection 快照暴露 `workDir`。**node 客户端**（仅 host 调用，**不进** renderer 面）加 `AgentService.Tree(AgentTreeRequest{session_id})` 传输原语，否则 A2「必拉 Tree」没有合法客户端 |
| §8 M6-A2 host | 拉 `AgentService.Tree(AgentTreeRequest{session_id})` → `AgentTreeResponse{root: AgentInfo}` 并 post `agentTreeBound`（写入 `LiveAgentTreeNodeView.type / status` 必须是 proto 枚举名字串如 `AGENT_TYPE_MEMBER`，禁止数字或短名）。**必拉**：`SessionEventStream` 订阅成功（或该 session 首个 lease）立即拉一次；`switchSession` / 新 session 同理；**禁止**用 `SessionInfo.root_agent` 充当初拉。**再拉**：L3 `sub_agent_activity.set_status` / `sub_agent_completed` / `detached_child_phase` / `multi_agent_status` / `turn_lifecycle`、L2 `branch_topology_notified`（Fork 可能只发拓扑通知）+ `requestAgentTreeRefresh`；250 ms 合并、in-flight 去重；`UNIMPLEMENTED` → `agentTree=UNSUPPORTED` 且本连接不再重试。观察到 `team_created` 时 post `teamIdBound`；demux 把 L3 `multi_agent_status` 任一臂折成 `onDidChangeTeamRuntime`。**catalog**：不改根（仍 `'default'`）；一旦登记非根 catalog 项，id ≡ `AgentInfo.agent_id`；**不**交付活 fork 列表（m6 §2 非目标不动） |
| §8 M6-A2 验证 | 加：假连接、无任何 L3 → 快照仍有一层根 `liveAgentTree`，Tree 调用 ≥ 1；fake 流推 `sub_agent_completed` → `liveAgentTree` 更新一次；`UNIMPLEMENTED` 后 Tree 调用计数不增；非根 catalog id 与 `agent_id` 逐字相等；根 catalog 仍为 `'default'` |
| §5 能力三态 | 加 `agentTree` / `team` 两键（IDE 推导） |

## 相关

- [m6-engine-wave](m6-engine-wave.md) · [ADR-003](../decisions/003-engine-adapter-boundary.md) · [conversation-stream-timeline](conversation-stream-timeline.md)
- [page-access-schemes](page-access-schemes.md) · [m3-shell-closeout 切片 2](m3-shell-closeout.md) · [conversation-session-windows](conversation-session-windows.md) · [sources-review-progress](sources-review-progress.md)（共用 `conversation.revealItem`）
- 外仓：UniverseAgent `grpc-api/src/main/proto/{agent_service,team_service,session_service,common,message_envelope}.proto`；Desktop [information-architecture §2](../../../UniverseAgentDesktop/docs/product/information-architecture.md)（Projects / Agents / Team 在 Desktop 亦为 not-wired 空 chrome，本稿是首个接线方案）

## 审查记录（规则 16）

**2026-09-02 第一轮：** Cursor CLI `cursor-grok-4.6-high`（`--mode ask` 只读）。**Approve with changes**（2 Critical + 5 Important + 7 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 contrib 自拉 Tree = 第二棵树；L3 臂名到不了 renderer；A1 无原语 | **选定 A**：Hierarchy 只读 lease `liveAgentTree`；Tree 拉取 / `agentTreeBound` 归 A2 host；Team unary 与 `onDidChangeTeamRuntime` 事件加进 connection（§9 增量修订 m6）；`AgentService.List` / `root_agent` 写入非目标 |
| C2 无引擎 Activity 两套验收互斥 | **选定 A**：无引擎保持 HEAD 空态；§2.3 / §3 / V-N1 改齐 |
| I1 chatId ↔ agent_id 须钉死；Reveal 分支 | §2.6：chatId ≡ agent_id 为产品约定，写入 m6 A2；Reveal 三分支 + H5 模式 |
| I2 Inspect 无选中总线 | §2.5 `IAgentInspectService.setTarget` + 四模板 + 空态改口 |
| I3 Activity union / lease 生命周期 / 禁 post | §2.3 补齐；N3 测试加计数与负向 mock |
| I4 矩阵漏格；「只有根 Agent」不一致 | §3 补 `sessionList` UNSUPPORTED、非 UNIMPLEMENTED 失败、断开行；文案与 PRD 同字 |
| I5 依赖表；§2 键登记 | §4 重写为硬依赖列；N5 加 engine-protocol-surface §2 |
| Minor（行号、G2 来源、AsyncDataTree、禁止表、枚举名、V-N5、stub 类） | 全部改入：§2 去行号、§0 / §1 / §2.1 / §5 补句、缺口改 `G-NAV-*` 前缀 |

**2026-09-02 第二轮：** 同一 reviewer 配置。**Approve with changes**（2 Critical + 4 Important + 5 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 host 只在 L3 上拉树，安静会话永远「正在读取」 | §9 加「必拉」：订阅成功 / 首个 lease / 切会话立即拉一次；禁用 `root_agent` 充当初拉；A2 验证加无 L3 仍有根树 |
| C2 根 `root` vs 本仓 `default` 对撞 | §2.6 钉死例外：根 = `'default'` / `isDefaultRoot`，禁止 `openSubAgent('root')`；非根逐字 ≡ `agent_id`；§9 catalog 句收缩；N2 测试加根行负向断言 |
| I1 PRD-022 依赖段说「团队也来自会话视图」 | PRD-022 改为：树只读 lease；Members / Tasks 经 connection 三个只读 unary |
| I2 Team / Inspect 无 lease 所有者 | §2.2 / §2.4 各写 lease 所有权：Agents 叶、Team 叶各持 1 个，独立计数，不借用 |
| I3 矩阵优先级；`sessionList` 行误伤 | §3 加「树无 MEMBER」行与 Team 判定优先级；`sessionList` 行改「不受该键影响」 |
| I4 基线把 `acquireSessionView` 当 HEAD；§9 塞活 catalog | 基线句重写（HEAD = vendor 类型 + 槽；`acquireSessionView` 是 S1 增量）；§9 不交付活 fork 列表 |
| Minor（Refresh 措辞、§2.2 臂名、枚举名字串、PRD-022 验收 3、`include_completed`） | 全部改入 |

**2026-09-02 第三轮：** 同一 reviewer 配置。**Approve with changes，无 Critical**（4 Important + 4 Minor；reviewer 注明改入后可签收、不必第四轮）。处理：

| 意见 | 处理 |
|------|------|
| I1 §4 N2 仍写「写入 catalog」 | N2 硬依赖改为 id 约定 + 惰性登记 + 禁止预同步 catalog |
| I2 A1 node 客户端无 `AgentService.Tree` | §9 A1 行加 node 原语（仅 host 调用，不进 renderer 面） |
| I3 Hierarchy 首拉失败与 UNKNOWN 对撞；Projects 断开文案；优先级句切表 | §3 传输失败行补「无上次树 → 失败 note」；Projects 加「显示为断开前快照」；优先级移到表后并补 Hierarchy / Projects 两条 |
| I4 N4 测试缺「仅 Team 可见」 | N4 Exit 加该断言 |
| Minor（N3 依赖句、frontmatter、`branch_topology_notified`、Inspect 跟随边界） | 全部改入 |

**签收：** 2026-09-02，用户授权「用 Cursor CLI Grok 审查、架构由本会话裁定」。三轮意见全部核验属实并改入；`status: accepted`。同批：PRD-022 `proposed → accepted`；m6 §5 / §8 按本稿 §9 修订（记入 m6 增量修订节）。
