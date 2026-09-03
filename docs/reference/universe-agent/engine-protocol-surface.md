---
title: "UniverseAgent 引擎协议面（本仓消费口径）"
type: reference
status: accepted
phase: N/A
updated: 2026-09-04
summary: "已知 gRPC 服务 / RPC 名与本仓用途；§4 含 G-CORE-1；§5 会话面含 onDynamicDidApplyFrame 首帧缓冲与 confirmPairing/cancelPairing/probeConnectionProfile；SessionEventStream onClosed 折 Actor streamClosed；ContinueGeneration / Rename / Cancel / CancelToolCall / SetSessionGoal / MessageQueue 族 / Fork / Kill / ToolInfo / PermissionService.Respond 已进 gRPC catalog；roster 接通后转发 Create / Rename / Cancel / SetSessionGoal / Fork / Kill / CancelToolCall / Respond / MessageQueue 五操作 + Edit（Inbox Stop 仅 connected+streaming；Inbox Goal 接通后可设/清；Fork 不造本地 catalog id；Kill 空 agent 不默认 root；时间线执行中工具行转 CancelToolCall；权限座接通后转 Respond，未接通仍 Chat 臂；队列无 GetQueue 显示空）；Enqueue 仍仅传输；未接通 Fork tab 仍本地 registerForkChat；Engine Tools 选中行拉 ToolInfo 只读详情（不画 schema 编辑器）；G-NAV-* / G-REV-* / G-ENG-*；G-CONV-1 已消费 attribution"
---

# UniverseAgent 引擎协议面（本仓消费口径）

> 导航：[索引](INDEX.md)。RPC 名以外仓 proto 为准。§1 **Conversation 传输**行来自 `platform/universeAgent/node/grpc/grpcTransport.ts`（`UniverseAgentGrpcServices`，A1/A2 @ HEAD）。§1 **Engine catalog** 与 §7 UI 口径来自 [customizations-engine](../../../dev/plans/customizations-engine.md) 与 [engine-catalog](../../systems/workbench/engine-catalog.md)（九节两栏 + 六态 @ HEAD；Skills 正文 + `saveSkillContent?` @ `f3f2d366`；Agents/MCP/Tools 写 @ `f49615a1`；GC-6 Overview Model @ `f583073b`；Overview Provider 行 G-ENG-1 前省略）。

## 1. 已知服务与 RPC

| 服务 | RPC | 本仓消费面 | 备注 |
|------|-----|-----------|------|
| `SystemService` | `GetAuthNonce` | `IUniverseAgentConnection.connect` / pairing orchestrator S2–S4 | 请求：`client_identity_id`、`client_public_key` → `auth_nonce` + `engine_cert_fingerprint`（**transcript 只用本地 TLS 观测指纹**，自述值不一致 fail-closed） |
| `SystemService` | `Connect` + `device_auth` | 同上；非 loopback 一律 DeviceAuth | `DeviceAuth{ client_identity_id, client_public_key, auth_nonce, signature }`；transcript = `engineIdentityId ‖ 观测 leaf 指纹 ‖ authNonce ‖ clientIdentityId ‖ protocolVersion`；`supported_tools=[]` 于 provisional 首配 |
| `SystemService` | `ConnectResponse` | `session_token` → `isEngineConnected()`；capabilities | 已 Grant：`session_token` 非空 → connected。**未配对**：`pairing_nonce` + `sas_code`（Crockford `XXXX-XXXX`），**无** `session_token`；pairing-pending ≠ connected（ADR-003 D7）。S4 意外 token → 丢弃、recoverTrust |
| `SessionService` | `List` / `Create` / `Delete` / `GetHistory` / `SessionEventStream` | Conversation roster + 时间线 fold 输入（`GetHistory` + 流 → session-core Actor → `ViewFrame`） | 无 `SwitchSession`；切换 = IDE 客户端投影。标题 proto 为 `AgentService.Rename`（catalog + node unary + **roster 接通后转 unary**）。`subscribeSessionEventStream` 第三参 `onClosed` 与 Chat bidi 同因（`remote` / `error`）；本地 dispose 不回调。宿主 `openStream` 把 remote/error 经 `postAndDrain` 折成 Actor `streamClosed` |
| `AgentService` | `Chat` | 发送 + 流内 question / clientTool 应答（Chat 双向流） | 权限座接通后改走 `PermissionService.Respond` unary（不双写 Chat 臂）；未接通仍 `permissionRespond`。question / clientTool 仍 Chat 臂 |
| `AgentService` | `ContinueGeneration` | 宿主 `openContinuationStream?`（ADR-028）；时间线仍走 `SessionEventStream` | **已进** `UniverseAgentGrpcServices.Agent` + node `openContinuationStream`（server-stream `ChatResponse`）。宿主 remote/error `onClosed` 拆句柄并 warn，**不** `postAndDrain(streamClosed)`（那条闸是 SessionEventStream）；断连 / 替换先本地 dispose。Web / 无 hook 仍计 `intent.unhandled` |
| `AgentService` | `Rename` | `IUniverseAgentConnection.renameSession`（unary） | **已进** `UniverseAgentGrpcServices.Agent` + node snake_case `session_id`/`title`；空 title 清自定义标题。Web stub `unsupported_environment`。**ConversationEngineRosterService** 接通后转发 unary（空/未变/未知 id 不发）；断连缓存只改本地标题。Lens / stub 未接通仍走本地 `renameSession` |
| `AgentService` | `Cancel` | `IUniverseAgentConnection.cancelGeneration`（unary） | **已进** `UniverseAgentGrpcServices.Agent` + node snake_case `session_id`/`agent_id`。会话回合 Stop（≠ `CancelToolCall`）。Web stub `unsupported_environment`。**ConversationEngineRosterService** 接通后转发 unary（未知 id / 断连缓存不发；未指定 `agentId` 用末条 streaming `agentId` 否则 `root`）。Inbox Stop 仅在已连接且有 streaming 行时启用并调用 roster |
| `AgentService` | `CancelToolCall` | `IUniverseAgentConnection.cancelToolCall?`（unary） | **已进** `UniverseAgentGrpcServices.Agent` + node snake_case `session_id`/`agent_id`/`tool_call_id`（空 agent id 线为 `root`）。响应 `success`/`message`。合同可选。**ConversationEngineRosterService.cancelToolCall** 接通后转发 unary（空 `toolCallId` / 未知 id / 断连缓存 / 无 hook 不发；未指定 agent 用末条 streaming 否则 `root`）。时间线 process-fold 执行中工具行「Cancel Tool」走该转发（`toolCallId` ≡ 行 id；≠ Inbox Stop / Kill） |
| `PermissionService` | `SetSessionGoal` / `CancelSessionGoal` | `IUniverseAgentConnection.setSessionGoal?` / `cancelSessionGoal?`（unary） | **已进** `UniverseAgentGrpcServices.Permission`（`universeagent.session.v1.PermissionService`，与 Session 同 proto）+ node snake_case `session_id`/`goal`。响应 `success`/`error`。Web / 测试可省略。**ConversationEngineRosterService** 接通后转发 unary（空/未变/未知 id / 断连缓存不发；无 hook 不发）。Inbox Goal 接通后启用；输入非空 → `setSessionGoal`，已有本地目标时清空 → `cancelSessionGoal`。无 `GetSessionGoal`，文案只反映本机上次成功 set |
| `PermissionService` | `Respond` | `IUniverseAgentConnection.respondPermission?`（unary） | **已进** `UniverseAgentGrpcServices.Permission` + node snake_case `session_id`/`request_id`/`granted`/`metadata_json`。响应 `success`/`error`。合同可选。**ConversationEngineRosterService.resolveConfirmation** 接通后转发 unary（空 `turnId` / 未知 id / 断连缓存 / 无 hook 不发；`granted` = allowed，skipped → false）。时间线权限座接通后走该转发，**不**再 post Chat 臂 `permissionRespond`。未接通仍 Chat 臂 |
| `AgentService` | `EnqueueQueueItem` / `PauseQueue` / `ResumeQueue` / `ClearQueue` / `HoldQueueItem` / `ReleaseQueueItemHold` / `EditQueueItem` | `IUniverseAgentConnection` 七个 queue unary（`enqueueQueueItem` … `editQueueItem`） | **已进** `UniverseAgentGrpcServices.Agent` + node snake_case `session_id`/`item_id`/`op_id`/`text` + hold `reason` / enqueue `priority` 枚举数。Web stub `unsupported_environment`。**ConversationEngineRosterService** 接通后转发 Pause / Resume / Clear / Hold / Release / Edit（未知 id / 空 item / 空正文 / 断连缓存不发）。`getMessageQueueState` 接通后诚实空（无 GetQueue，不把 fixture 冒充引擎队列）。`EnqueueQueueItem` 仍仅传输（roster 无 enqueue 面） |
| `AgentService` | `Fork` | `IUniverseAgentConnection.forkAgent?`（unary） | **已进** `UniverseAgentGrpcServices.Agent` + node snake_case `session_id`/`parent_agent_id`/`name`/`task`/`model_type`/`system_prompt`（空父 id 线为 `root`）。响应 `success`/`agent_id`。合同可选。**ConversationEngineRosterService.forkSubAgent** 接通后转发 unary（未知 id / 断连缓存 / 无 hook 不发；未指定 parent 用末条 streaming 否则 `root`）。接通后用户 Fork 动作走该转发，**不**开本地 Fork tab、不造 catalog id（catalog 仍 liveAgentTree）。未接通仍走 `registerForkChat` |
| `AgentService` | `Kill` | `IUniverseAgentConnection.killAgent?`（unary） | **已进** `UniverseAgentGrpcServices.Agent` + node snake_case `session_id`/`agent_id`/`force`。响应 `success`/`message`。合同可选。空 `agent_id` 原样上线（**不**默认 `root`）。**ConversationEngineRosterService.killSubAgent** 接通后转发 unary（未知 id / 断连缓存 / 无 hook 不发）。≠ Cancel / CancelToolCall。Navigator 仍只读，不挂 Kill 钮 |
| `AgentService` | `Tree` | Navigator Agent 树（**host-only**，不经 renderer `IUniverseAgentConnection`） | m6 §11；`UNIMPLEMENTED` → `agentTree=UNSUPPORTED` |
| `AgentService` | `FetchToolDetail` | Conversation DetailRef 按需通道（**host-only**，lease `requestDetail`） | **P2a**；见 §1b；`subscribe=false` |
| `TeamService` | `MemberStatus` / `TaskList` / `TeamInfo` | Navigator Team 段（renderer `IUniverseAgentConnection.team`） | m6 §11 A1 unary |
| L3 `tool_runtime_snapshot` | `payload.file_mutation_payload` + `ToolCallLifecycleEvent` join | Sources Review 归因 chip / `reviewNav` 物化（**host-only** demux；contrib 消费 `onDidFileMutation`） | m6 §11 A2；禁止解析 L2 `arguments_json`；历史见 **G-REV-1** |
| `ToolService` | `ListSkills` / `SkillInfo` / `SetSkillEnabled` | **@ HEAD** 传输 + `EngineSkillsSection` list/toggle + 正文 **读**（E1） | 无独立 Create RPC；写文件后 `ListSkills` 刷新 |
| `ToolService` | `SaveSkillContent` | **@ HEAD** node gRPC @ `45fa7a35`/`040c823d` + common 可选 `saveSkillContent?` @ `f3f2d366` + **UI** textarea/Save @ `f3f2d366`/`3e986bde` | USER/PROJECT 可编、BUNDLED 只读；断连/`UNSUPPORTED` 不渲染；probe/`UNIMPLEMENTED` 时 `saveSkillContent?` 缺席、Save 隐藏；运行时 `UNIMPLEMENTED` → `{ ok: false }` |
| `ToolService` | `ListTools` / `ToolInfo` | **@ HEAD** `listTools` → `EngineToolsSection` 目录 + profile 启用 checkbox。`IUniverseAgentConnection.getToolInfo?` **已进** `UniverseAgentGrpcServices.Tool` + node unary `getToolInfo`（snake_case `tool_name`；响应 name / description / category / `input_schema_json` / destructive / `requires_permission` / aliases）。合同可选。**Engine Tools 选中行**拉 `getToolInfo` 只读详情（aliases / Destructive / Requires permission；有 schema 只标「Has input schema」），**不**画 schema 编辑器；无 hook 不展示详情 | 无 `SetToolEnabled`；enablement 经 `SaveAgentProfile` → `{profileDir}/tools.json`（`engineToolProfile.ts` @ `f49615a1`） |
| `AgentService` | `ListAgentProfiles` / `SaveAgentProfile` / `DeleteAgentProfile` / `ResetAgentProfile` | **@ HEAD** list + 写 RPC → `EngineAgentsSection`（New/Delete/Reset 工具栏 + **`AGENTS.md` 全文编辑器** @ `9419f583`） | 选中 profile textarea + Save → `SaveAgentProfile`；断连/`UNSUPPORTED` 不渲染；built_in 只读；built_in 不可 Delete、仅 Reset |
| `McpService` | `ListMcpServers` / `ToggleMcpServer` / `AddMcpServer` / `UpdateMcpServer` / `RemoveMcpServer` | **@ HEAD** list + toggle + 定义 CRUD → `EngineMcpSection` | 运行态 RPC 见 §1b（M7 P1a / E2-4） |
| `PluginService` | `List` / `Info` / `Enable` / `Reload` / `Unload` / `ScanNew` | Plugins 节（M7 E2-5；见 §1b） | Local 模式 Singularity 标 UNSUPPORTED；IDE 以 `List` probe 决定三态 |
| `ConfigService` | `ListModels` | Engine 页 **Model** 组只读注册表（M7 E2-2；见 §1b） | **P1b** `listModels()`；恒 `include_disabled=true`。会话级 `SwitchModel` **未接** |
| Local `RulesBridge` | list / create / update / delete / preview / health × global / workDir（12）+ `defaultAgentHome()` | **本仓不可达**：`RulesBridge` 是 Desktop/Singularity 进程内接口，IDE 只经 gRPC | **Remote gRPC 不存在** → Engine 页 Rules 一律 `UNSUPPORTED`（见 §4 G-ENG-2） |
| `MemoryService` | — | 不在 Engine 页；未来独立 pane | 与 Instructions 分家 |

## 1b. M7 协议面（P0/P1a/P1b/P2a/P2b 已绑定）

非 RPC：`IUniverseAgentConnection` / `IUniverseAgentSessionView` / `IUniverseAgentHubService` 在 Web 以 **`registerSingleton`** 注册（**禁止** `registerMainProcessRemoteService`），实现位于 `platform/universeAgent/browser/`。`connectionHub.contribution.ts` **不再**静态 import electron-browser Hub；该注册仅在 `workbench.desktop.main.ts`。

| 服务 | Web 诚实断连（**P0 已落**） | 备注 |
|------|------------------------------|------|
| `IUniverseAgentConnection` | transport `idle`；capability 已有键全 `UNSUPPORTED` reason「Web 不支持本机 Engine 连接」；`connect()` 不 throw、无 token；`connectProfile` `{ ok:false, code:'unsupported_environment' }`；`getConnectionPhase` = `disconnected` | `workbench.web.main.ts` |
| `IUniverseAgentSessionView` | 空 lease；`onDynamicDidApplyFrame` 恒 `Event.None`；`requestDetail` 恒 `{ ok:false, reason:'unavailable' }` | 同上 |
| `IUniverseAgentHubService` | `getAuthStatus=unavailable`；mutating `ok:false`；不回显凭据 | 同上 |

| 服务 | RPC | 本仓消费面 | P 切片 | 状态 |
|------|-----|-----------|--------|------|
| `McpService` | `GetMcpServerStatuses` / `GetMcpServerTools` | Engine Runtime tab | **P1a** `getMcpServerStatuses` / `getMcpServerTools`；`mcpRuntime` | **已绑定** |
| `PluginService` | `List` / `Info` / `Enable` / `Reload` / `Unload` / `ScanNew` | Engine Plugins | **P1a** 八方法；`plugins` 由 `List` 真探测 | **已绑定** |
| `AgentService` | `FetchToolDetail(..., subscribe=false)` | Conversation DetailRef | **P2a** `requestDetail` + `DetailPatch.truncated/totalBytes`；browser 恒 unavailable；stub 源本地 `requestDetail` 已由 Q2 接通 | **已绑定** |
| `ConfigService` | `ListModels` | Engine Model 组 | **P1b** `listModels()`（`include_disabled=true`）；`models` | **已绑定** |
| `ConfigService` | `Get` / `Set` / `Watch` | Provider 候选 | `providerConfig` 固定 `UNSUPPORTED`（G-ENG-1） | **已登记** |
| L2 compact 事件 | `branch_reason` / `CompactedSpanBlock` / `RangeReplaced(COMPACT)` | 轨迹 compacted 归因 | **P2b** host demux → `ItemAttribution.branchReason:'compact'` + `compacted{anchorTurnId,foldedLeafTurnId,compactBranchTurnId,summary?}`；browser 不产出 | **已绑定** |

**不存在的 RPC：** Provider CRUD；Instructions Rules gRPC；`ListHookPoints`；Skill 独立 Create；Agent profile `model.json` 写路径。会话级 `SwitchModel` 不进 Engine 页。`SubscribeToolDetail` / `FetchToolUsageDetail` / `Compact` 手动触发 M7 不接。

## 2. 能力探测

UA 侧 `EngineSettingsCapabilities` / `CapabilitySupport`：`SUPPORTED | UNSUPPORTED | UNKNOWN` + `reason`。

| 键 | 来源 | IDE 处理（@ HEAD） |
|----|------|-------------------|
| `skills` | Connect 广告 `ToolService.ListSkills` + 运行时 probe | `grpcCapabilityProbe.ts` → `getCapabilitySnapshot()`；Engine Skills 节消费 |
| `mcp` | Connect 广告 + `McpService.ListMcpServers` probe | 同上 → MCP 节 |
| `agentProfiles` | Connect 广告 + `AgentService.ListAgentProfiles` probe | 同上 → Agents 节（IDE 三态，非 UA Boolean 直出） |
| `tools` | Connect 广告 + `ToolService.ListTools` probe | 同上 → Tools 节 |
| `agentTree` · `team` | IDE 推导（m6 §11） | `AgentService.Tree` / `TeamService.MemberStatus` probe |
| `mcpRuntime`（**M7 P1a**） | IDE 推导 | Connect 广告 `McpService.GetMcpServerStatuses` + probe；与 `mcp` 分开 |
| `plugins` | UA 侧键 | **P1a 已探测** `PluginService.List`；未广告 / `UNIMPLEMENTED` → 诚实 `UNSUPPORTED` |
| `models`（**M7 P1b**） | IDE 推导 | Connect 广告 `ConfigService.ListModels` + probe |
| `providerConfig`（**M7 P1b**） | IDE 推导 | 固定 `UNSUPPORTED`，reason「Provider 配置键合同未定」 |
| `globalRules` · `projectRules` | UA 侧键 / IDE 矩阵 | 固定 `UNSUPPORTED`（G-ENG-2） |
| `hooksMetadata` | UA 无握手字段 | 固定 `UNSUPPORTED` |
| IDE 传输失败 | 非 UA 概念 | list RPC `catch` → 传输失败文案，**不得**映射为 UNSUPPORTED 或「0 条」 |

**Web 形态（P0 已落）：** `workbench.web.main.ts` 以 `registerSingleton` 注册三者（`platform/universeAgent/browser/`）。Hub 的 electron-browser 注册只在 `workbench.desktop.main.ts`。后续 P 切片新增键或方法须同一提交同步 browser 断连。

Connect 后 `probeEngineCapabilities`：**仅**广告了 method 且 probe 非 `UNIMPLEMENTED` 才升 `SUPPORTED`。无连接：catalog 节 **disconnected**（E2-1 起节可达、零条目零写按钮），不用 Stub 填 `UNKNOWN`。

## 3. 引擎磁盘布局（进程内，IDE 断连时禁止扫）

| 面 | 路径 |
|----|------|
| AgentHome | `~/.universe-agent`（可被测试覆盖） |
| Skills | BUNDLED `resources/skills/{name}/SKILL.md`；USER `{AgentHome}/skills/`；PROJECT `{workDir}/.universe-agent/skills/` |
| Agents | `{AgentHome}/agents/{id}/`、`{workDir}/.universe-agent/agents/{id}/` |
| Rules | `{AgentHome}/rules/`、`{workDir}/.universe-agent/rules/` |
| Hooks | `{AgentHome}/hooks.json`；插件 `{AgentHome}/plugins/` |
| MCP | ConfigStore `mcp.servers`（`config.json`）；项目 `{workDir}/.universe-agent/mcp-servers.json` |

只有 **Engine-backed** 且能力 `SUPPORTED` 时，这些路径才经引擎的 Local 文件面被读写。

## 4. 已登记的协议缺口（由引擎仓 / 后续切片补）

| 缺口 | 阻塞 | 备注 |
|------|------|------|
| **G-NAV-1** | `SessionSummary` / `SessionInfoResponse` 无 `work_dir` | Projects 按项目分组；IDE 未补前用 connection `workDir` 单组。见 [navigator-engine-segments §7](../../../dev/plans/navigator-engine-segments.md) |
| **G-NAV-2** | 无 `ListTeams(session_id)`；`team_id` 只在不落库事件出现 | 重连后 `liveTeamId` 空 → 节标题省略团队状态；Members/Tasks 仍可用 |
| **G-REV-1** | 持久化历史无归一化 `file_mutation`（L3 不落库；L2 路径在 `arguments_json`） | 归因 / reviewNav 仅限本连接（含重播种）。见 [sources-review-progress §6](../../../dev/plans/sources-review-progress.md) |
| **G-ENG-1** Provider 配置键合同 | Engine 页 Provider 组的读/写/测试 | 引擎只有通用 `ConfigService.Get/Set` 与 `TestModelProfile`，没有 Provider 列表 / 凭据已配置查询；需引擎仓给出 provider 相关 config key 与"已配置但不回显"语义。闭合前 Provider 组 unsupported |
| **G-ENG-2** Rules Remote gRPC | Engine 页 Rules（Instructions） | `RulesBridge` 仅 Desktop 进程内；IDE 一律 unsupported。原「Rules Remote gRPC」行合并至此 |
| **G-ENG-3** `ListHookPoints`（或握手带版本化点位表） | Engine 页 Hooks「来自引擎」 | 原行改编号；闭合前 Hooks 节只显示 unsupported |
| **G-ENG-4** Agent profile `model.json` 写路径 | Agents 节 Model 子 tab | `SaveAgentProfileRequest.AgentProfileProto` 无 `model` / `modelType` / `maxTurns`，引擎 mapper 写死 null；Model 子 tab 在引擎补字段前只能是 unsupported |
| **G-CORE-1** session-core `CoreIntent` 无 `sessionId`；`takeIntents()` 为全局队列 | 多会话并发时 intent 归属只能靠「`core.post` 后立刻 drain」不变量 | **来源 vendored session-core，非 gRPC**。F2 @ `917a7f8d` 以宿主 `postAndDrain` 门禁守住该不变量并对未实现 intent 计 `intent.unhandled`。闭合建议：上游在 `emitIntent` 盖 `sessionId`，或提供 `takeIntents(sessionId)`；闭合后宿主归属退化为只读 `intent.sessionId`。见 [session-view-frame-fanout](../../../dev/plans/session-view-frame-fanout.md) |
| **G-CONV-1** compact 事实进入 session-core | 轨迹 `compacted` 记录 | **P2b 生产者已落** + **Q3 已消费**：host 只从 L2 取行身份（`branch_reason` compact / `EnvelopeRangeReplaced(reason=COMPACT)` 单独成立）→ `ItemAttribution.branchReason:'compact'` + `compacted{…}`。轨迹 `projectSnapshotToTrajectory` 只据此 emit；无 attribution 则零行。`ContextCompactedEvent` 仍非显示源、不订阅 |
| 独立 CreateSkill RPC（或等价新建 UI） | E1 新建技能 | Skill **新建** UI 已落 @ `e6167c45`（写文件后 `ListSkills` 刷新）；独立 RPC 仍缺 |
| `SaveSkillContent` node gRPC 传输 | —（**已闭** @ `45fa7a35`/`040c823d`） | `grpcClient` / `grpcTransport` / `universeAgentConnectionService` 动态绑定；单测 `universeAgentConnection.test.ts` |
| Agent profile `tools.json` / `model.json` 独立 UI | Engine 页目录三件套附件编辑 | `AGENTS.md` 正文 @ `9419f583` 已落；`tools.json` 经 Tools 节 checkbox；`model.json` 仍无独立编辑器 |
| `plugins` IDE probe | Plugins Engine 节 | **M7 P1a 已闭**（`PluginService.List` 探测）；`globalRules` 无 RPC，见 G-ENG-2 |

## 5. Conversation 会话面（A1/A2 @ HEAD 回填）

[IConversationRosterService](../../systems/conversation/stub-and-fixtures.md) 需要的引擎面；adapter 落层 [ADR-003](../../../dev/decisions/003-engine-adapter-boundary.md)（`platform/universeAgent`）；时间线 / 发送 / 权限流形态 [conversation-stream-timeline](../../../dev/plans/conversation-stream-timeline.md)。下表「HEAD 事实」来自 m6-engine-wave §3 与 `platform/universeAgent` + `ConversationEngineRosterService` 合入代码：

| IDE 需要 | 对应 stub 方法 | HEAD 事实 |
|----------|----------------|-----------|
| 会话枚举 / 创建 / 删除 | `getSessions` … `deleteSession` | `SessionService.List` / `Create` / `Delete`；`work_dir` 过滤随 Connect。已连接时首次 `List` 完成前 roster **不**含 stub 种子行。**ConversationEngineRosterService.createSession** 接通后转发 `SessionService.Create`，用引擎返回的 `sessionId` 入目录并切活动会话（同步返回 `''`，不把旧 active / stub `untitled` 冒充新会话）；空 id 忽略；断连缓存不发 unary、不造 stub 种子 |
| 切换 / 重命名 | `switchSession` / `renameSession` | 切换 = 客户端 `activeSessionId` 投影（**无** `SwitchSession` RPC）。传输 `IUniverseAgentConnection.renameSession` **已接** `AgentService.Rename`。**ConversationEngineRosterService** 接通后 `renameSession` 转发该 unary 并更新引擎目录标题；未接通 / 从未连过仍走 stub 本地标题 |
| 回合流（用户 / 助手 / thinking / tool / …） | `getTurns`、`onDidChangeSession` | `SessionService.GetHistory`（`cursor_seq`）+ `SessionEventStream` → session-core fold → `ViewFrame`；renderer 经 `IUniverseAgentSessionView.acquireLease` + **`onDynamicDidApplyFrame(leaseId)`**（F1 @ `c37bbc6e`：宿主 per-lease 事件；订阅前该 lease 的帧入 `pending`，首个 listener 按序 flush，首帧为 baseline；未知 / 已释放 id → `Event.None`）。已删除全局 `onDidApplyFrame`；渲染端**不**再按 leaseId 过滤全窗广播 |
| 轨迹记录 | `getTrajectoryRecords(sessionId, { filterAgentId? }?)` | HEAD：`projectSnapshotToTrajectory(snapshot, attribution, details, options)` 从 lease/帧源投影；stub 仅 `untitled` 且未连接时 ∪ fixture extras（**无** compacted 伪造行）；UA 会话**不** merge fixture；**P2a** `requestDetail` / `FetchToolDetail` 通道已接通（renderer 帧源 upsert `outcome.content`；stub 本地 `requestDetail`）；**P2b** 已投影 `ItemAttribution.compacted`（browser 不产出）；**Q3** 消费 attribution emit `compacted` 行（未投影则零行）。Overview 瀑布 Deferred。活 Event fold 全文仍 M6-D / PRD-008 |
| 权限请求 / 回执 | `resolveConfirmation`、`countPendingConfirmations` | 流内 L4 `permission_request` → `pendingActions`。传输 `IUniverseAgentConnection.respondPermission?` **已进** `PermissionService.Respond`。**ConversationEngineRosterService.resolveConfirmation** 接通后转发 unary（空 id / 未知 session / 断连缓存 / 无 hook 不发；不双写 Chat 臂）。未接通 / stub 仍 `permissionRespond` |
| Inbox Stop | `cancelGeneration(sessionId, agentId?)` | 传输 `IUniverseAgentConnection.cancelGeneration` **已接** `AgentService.Cancel`。**ConversationEngineRosterService** 接通后转发 unary（未指定 agent 用末条 streaming 否则 `root`）；未接通 / 断连缓存 / 从未连过 stub 返回 false。Inbox Stop 已连接且时间线有 `streaming` 行才启用，点击走 roster。单工具 `cancelToolCall(sessionId, { toolCallId, agentId? })` 接通后转发 `AgentService.CancelToolCall`；时间线执行中工具行「Cancel Tool」走 roster（未指定 agent 用末条 streaming 否则 `root`） |
| MessageQueue | `getMessageQueueState` 与五个操作 | 传输 `IUniverseAgentConnection` **已接** `AgentService.EnqueueQueueItem` 族七 unary。**ConversationEngineRosterService** 接通后转发 Pause / Resume / Clear / Hold / Release / Edit（未知 id / 空 item / 空正文 / 断连缓存不发）。无 GetQueue，`getMessageQueueState` 接通 / 断连缓存诚实空，不把 fixture 冒充引擎队列。`EnqueueQueueItem` 仍仅传输 |
| Inbox Goal | `setSessionGoal` / `cancelSessionGoal` / `getSessionGoal` | 传输 `IUniverseAgentConnection.setSessionGoal?` / `cancelSessionGoal?` **已进** `PermissionService` catalog + node unary。**ConversationEngineRosterService** 接通后转发（空/未变/未知 id / 断连缓存 / 无 hook 不发）。Inbox Goal 接通后启用；非空确认 set、已有本地目标时清空 cancel。无 `GetSessionGoal`，`getSessionGoal` 只记本机上次成功 set |
| AutoDrive / Task 列表 | `getAutoDriveTasks` | **仍 fixture**；与 Inbox Goal 分家，不把任务列表冒充已设目标 |
| fork / 子代理 catalog | `IConversationSessionChatService` + roster `onDidChangeLiveAgentTree` | GC-4 @ `22ce3013`：roster 观察活动会话 lease 的 **`liveAgentTree` 唯一源**预同步 catalog（`chatId` ≡ `agent_id`，根不登记）；`AgentService.Tree` 仍 host 首拉 + 事件再拉（§11）。传输 `IUniverseAgentConnection.forkAgent?` **已进** `AgentService.Fork` catalog + node unary。**ConversationEngineRosterService.forkSubAgent** 接通后转发；接通后用户 Fork 动作走该 unary，不造本地 catalog / Fork tab。未接通仍 `registerForkChat`。传输 `killAgent?` **已进** `AgentService.Kill` catalog + node unary。**ConversationEngineRosterService.killSubAgent** 接通后转发（空 `agentId` 原样上线、不默认 `root`；未知 id / 断连缓存 / 无 hook 不发）。Navigator 仍只读 |
| `visualize` 工具输出 | fixture / tool turn | 仍 stub / 本地 fixture；引擎工具名待 T4+ |
| 引擎连接态 | `isEngineConnected` | `SystemService.Connect` 成功 + 非空 `session_token` + 活 channel；pairing-pending → false。StatusBar 文案 = `IUniverseAgentConnection.getConnectionPhase()`（H4b）；connected 芯片 command → Engine pane，否则 Connection |
| 配对确认 / 取消 / 探测 | `IUniverseAgentConnection` | **GC-1b / GC-3** @ `a551fdef` / `f74e151f`：`confirmPairing()` 写 trust 并完成拨号（`recover_trust` 时调 `confirmRecoverTrust`）；`cancelPairing()` 不写 trust、断开 pairing-pending；`probeConnectionProfile(profileId)` 对 active profile 建独立探测链只调 `GetAuthNonce`，**不** `Connect`、不改 `ConnectionPhase`。Web stub 三方法均为 `unsupported_environment`。**recoverTrust UI**：`connectProfile` 可返回 `recoverTrust` + `leafSha256Hex`；pane 独立 identity+fingerprint 对话框（Desktop ADR-031；0× SAS）后再 `confirmPairing` |
| Route / AgentProfile / Model / Permission / Tools 选项 | Composer 各下拉 | 无引擎 = 诚实空；Engine 页 Agents **list-only** 已接，Composer 下拉 **仍**待 profile/策略切片 |
| 本地会话缓存与引擎权威切换 | PRD-017 | D13 @ HEAD：`conversation.roster.v1` @ `StorageScope.WORKSPACE` + `StorageTarget.MACHINE`；引擎接通后本地存 stub + UA 断连快照（`source` 字段） |

## 7. Engine catalog 消费面（九节 @ HEAD；写路径自 `f49615a1`）

系统规格：[engine-catalog](../../systems/workbench/engine-catalog.md)。代码锚：`enginePreferencesPane.ts` · `engineCatalog.ts` · `engineOverviewSection.ts` · `engineProviderModelSection.ts` · `engineSkillsSection.ts` · `engineAgentsSection.ts` · `engineRulesSection.ts` · `engineHooksSection.ts` · `engineMcpSection.ts` · `enginePluginsSection.ts` · `engineToolsSection.ts`。

| 能力键 | List RPC | Toggle / 写 | Engine 页 @ HEAD |
|--------|----------|--------------|------------------|
| （Overview 聚合） | snapshot + 可选 `ListModels` | 无 | Connection / workDir / Transport / capability 摘要；GC-6 Model 计数；Provider 行 G-ENG-1 前省略 |
| `providerConfig` | **无**（G-ENG-1） | 无 | Provider 组 unsupported 完整态；零输入 |
| `models` | `ListModels`（`include_disabled=true`） | 无 | Provider & Model 节只读注册表；Overview 计数 |
| `skills` | `ListSkills` · `SkillInfo` | `SetSkillEnabled` · `SaveSkillContent`（node 传输 @ `45fa7a35`/`040c823d`；`saveSkillContent?` 契约 @ `f3f2d366`） | 分组 list + 开关 + 正文 textarea（Save 在 `saveSkillContent?` 存在且可写时展示） |
| `agentProfiles` | `ListAgentProfiles` | `SaveAgentProfile` / `DeleteAgentProfile` / `ResetAgentProfile` | 分组 list + New/Delete/Reset + **`AGENTS.md` 全文编辑器** @ `9419f583` |
| `globalRules` / `projectRules` | **无**（G-ENG-2） | 无 | Rules 节壳；已连接 unsupported |
| `hooksMetadata` | **无**（G-ENG-3） | 无 | Hooks 节壳；已连接 unsupported |
| `mcp` | `ListMcpServers` | `ToggleMcpServer` · `AddMcpServer` / `UpdateMcpServer` / `RemoveMcpServer` | Definitions tab：分组 list + checkbox + CRUD 工具栏 |
| `mcpRuntime` | `GetMcpServerStatuses` / `GetMcpServerTools` | Refresh | Runtime tab（P1a） |
| `plugins` | `PluginService.List` | `Enable` / `Reload` / `Unload` / `ScanNew` | 列表 + 启停/重载/扫描；无 marketplace |
| `tools` | `ListTools` + 选中行 `ToolInfo` | `SaveAgentProfile`（profile `tools.json`） | 目录 + profile 下拉 + 启用 checkbox + 只读详情（不画 schema 编辑器） |

断连 / unsupported / loading / failed / empty / ready 六态见 engine-catalog §2；**禁止** Copilot 盘或 vscode `IMcpService` 顶替 UA 定义面。

## 11. Navigator / Review host 面（m6 §11 @ HEAD）

§1 已列 RPC；本节只记 **renderer 不直接见的 host join 与 IDE 事件**（细节 [m6-engine-wave §11](../../../dev/plans/m6-engine-wave.md)）。

| 面 | 生产者 | 消费者 |
|----|--------|--------|
| `AgentService.Tree` → `agentTreeBound` | M6-A2 host（必拉 + 事件再拉；`requestAgentTreeRefresh`） | Navigator Agents Hierarchy（lease `liveAgentTree`）；Team manager 发现 |
| `team.*` unary + `onDidChangeTeamRuntime` | A1 传输 + A2 demux L3 `multi_agent_status` | Navigator Team Members/Tasks |
| `tool_call_id` join 表 + `onDidFileMutation` + turn settle | A2 host（`ToolCallLifecycleEvent` + L3 snapshot + `assistant_turn_id` settle） | Sources Review 归因 chip；`ItemAttribution.toolCallId` → `conversation.revealItem` |
| `onDidChangeTeamRuntime` / `requestAgentTreeRefresh` | connection（A1 类型；A2 实现） | Navigator Team / Agents Refresh |
| `isAgentTreeFetchFailed`（D21） | connection：`AgentService.Tree` 非 UNIMPLEMENTED 失败置位、成功清除；经 `onDidChangeConnection` 通知 | Hierarchy / Team 共用空态失败 note（**非** lease 快照字段；**非** `transport === 'failed'`） |

协议缺口 **G-NAV-1 / G-NAV-2 / G-REV-1** 见 §4。

## 6. 维护

- 外仓 RPC 改名 / 新增时改本页对应行并更新 `updated`；不在 plan 里重复枚举。
- 本页不得出现 `src/vs/` 类型名充当引擎类型；IDE 侧行为规格在 [engine-catalog](../../systems/workbench/engine-catalog.md) 与 [systems/conversation](../../systems/conversation/INDEX.md)。
- 写 RPC 合入后须同步 §1 行、§4 缺口、§7 表与 [engine-catalog §3–§4](../../systems/workbench/engine-catalog.md)；**不得**把 PRD-008 升 `implemented` 或写隔离 profile 冒烟已通过。
