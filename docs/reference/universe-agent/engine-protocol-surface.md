---
title: "UniverseAgent 引擎协议面（本仓消费口径）"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "已知 gRPC 服务 / RPC 名与本仓用途；§1 Conversation（A1/A2）+ Device Grant；§1b P0/P1a/P1b/P2a 已绑定、P2b 待接；Engine catalog list/toggle + 写 RPC @ f49615a1；§7 Engine 页四节；§5 会话面对照；§11 Navigator/Review；§4 G-NAV-* / G-REV-* / G-ENG-*"
---

# UniverseAgent 引擎协议面（本仓消费口径）

> 导航：[索引](INDEX.md)。RPC 名以外仓 proto 为准。§1 **Conversation 传输**行来自 `platform/universeAgent/node/grpc/grpcTransport.ts`（`UniverseAgentGrpcServices`，A1/A2 @ HEAD）。§1 **Engine catalog** 与 §7 UI 口径来自 [customizations-engine](../../../dev/plans/customizations-engine.md) 与 [engine-catalog §3](../../systems/workbench/engine-catalog.md)（list/toggle @ `4833c008`/`8bfc299e`；Skills 正文 UI + `saveSkillContent?` @ `f3f2d366`；Agents Save/Delete/Reset、MCP Add/Update/Remove、Tools 经 `SaveAgentProfile` @ `f49615a1`）。

## 1. 已知服务与 RPC

| 服务 | RPC | 本仓消费面 | 备注 |
|------|-----|-----------|------|
| `SystemService` | `GetAuthNonce` | `IUniverseAgentConnection.connect` / pairing orchestrator S2–S4 | 请求：`client_identity_id`、`client_public_key` → `auth_nonce` + `engine_cert_fingerprint`（**transcript 只用本地 TLS 观测指纹**，自述值不一致 fail-closed） |
| `SystemService` | `Connect` + `device_auth` | 同上；非 loopback 一律 DeviceAuth | `DeviceAuth{ client_identity_id, client_public_key, auth_nonce, signature }`；transcript = `engineIdentityId ‖ 观测 leaf 指纹 ‖ authNonce ‖ clientIdentityId ‖ protocolVersion`；`supported_tools=[]` 于 provisional 首配 |
| `SystemService` | `ConnectResponse` | `session_token` → `isEngineConnected()`；capabilities | 已 Grant：`session_token` 非空 → connected。**未配对**：`pairing_nonce` + `sas_code`（Crockford `XXXX-XXXX`），**无** `session_token`；pairing-pending ≠ connected（ADR-003 D7）。S4 意外 token → 丢弃、recoverTrust |
| `SessionService` | `List` / `Create` / `Delete` / `GetHistory` / `SessionEventStream` | Conversation roster + 时间线 fold 输入（`GetHistory` + 流 → session-core Actor → `ViewFrame`） | 无 `SwitchSession`；切换 = IDE 客户端投影。标题 proto 为 `AgentService.Rename`，**HEAD adapter 未接** |
| `AgentService` | `Chat` | 发送 + 流内 permission / question / clientTool 应答（Chat 双向流） | 权限 cleanup 亦走 Chat 臂；`PermissionService.Respond` 为备选（见 stream-timeline S5 注释） |
| `AgentService` | `Tree` | Navigator Agent 树（**host-only**，不经 renderer `IUniverseAgentConnection`） | m6 §11；`UNIMPLEMENTED` → `agentTree=UNSUPPORTED` |
| `AgentService` | `FetchToolDetail` | Conversation DetailRef 按需通道（**host-only**，lease `requestDetail`） | **P2a**；见 §1b；`subscribe=false` |
| `TeamService` | `MemberStatus` / `TaskList` / `TeamInfo` | Navigator Team 段（renderer `IUniverseAgentConnection.team`） | m6 §11 A1 unary |
| L3 `tool_runtime_snapshot` | `payload.file_mutation_payload` + `ToolCallLifecycleEvent` join | Sources Review 归因 chip / `reviewNav` 物化（**host-only** demux；contrib 消费 `onDidFileMutation`） | m6 §11 A2；禁止解析 L2 `arguments_json`；历史见 **G-REV-1** |
| `ToolService` | `ListSkills` / `SkillInfo` / `SetSkillEnabled` | **@ HEAD** 传输 + `EngineSkillsSection` list/toggle + 正文 **读**（E1） | 无独立 Create RPC；写文件后 `ListSkills` 刷新 |
| `ToolService` | `SaveSkillContent` | **@ HEAD** node gRPC @ `45fa7a35`/`040c823d` + common 可选 `saveSkillContent?` @ `f3f2d366` + **UI** textarea/Save @ `f3f2d366`/`3e986bde` | USER/PROJECT 可编、BUNDLED 只读；断连/`UNSUPPORTED` 不渲染；probe/`UNIMPLEMENTED` 时 `saveSkillContent?` 缺席、Save 隐藏；运行时 `UNIMPLEMENTED` → `{ ok: false }` |
| `ToolService` | `ListTools` / `ToolInfo` | **@ HEAD** `listTools` → `EngineToolsSection` 目录 + profile 启用 checkbox | 无 `SetToolEnabled`；enablement 经 `SaveAgentProfile` → `{profileDir}/tools.json`（`engineToolProfile.ts` @ `f49615a1`） |
| `AgentService` | `ListAgentProfiles` / `SaveAgentProfile` / `DeleteAgentProfile` / `ResetAgentProfile` | **@ HEAD** list + 写 RPC → `EngineAgentsSection`（New/Delete/Reset 工具栏 + **`AGENTS.md` 全文编辑器** @ `9419f583`） | 选中 profile textarea + Save → `SaveAgentProfile`；断连/`UNSUPPORTED` 不渲染；built_in 只读；built_in 不可 Delete、仅 Reset |
| `McpService` | `ListMcpServers` / `ToggleMcpServer` / `AddMcpServer` / `UpdateMcpServer` / `RemoveMcpServer` | **@ HEAD** list + toggle + 定义 CRUD → `EngineMcpSection` | 运行态 RPC 见 §1b（M7 P1a / E2-4） |
| `PluginService` | `List` / `Info` / `Enable` / `Reload` / `Unload` / `ScanNew` | Plugins 节（M7 E2-5；见 §1b） | Local 模式 Singularity 标 UNSUPPORTED；IDE 以 `List` probe 决定三态 |
| `ConfigService` | `ListModels` | Engine 页 **Model** 组只读注册表（M7 E2-2；见 §1b） | **P1b** `listModels()`；恒 `include_disabled=true`。会话级 `SwitchModel` **未接** |
| Local `RulesBridge` | list / create / update / delete / preview / health × global / workDir（12）+ `defaultAgentHome()` | **本仓不可达**：`RulesBridge` 是 Desktop/Singularity 进程内接口，IDE 只经 gRPC | **Remote gRPC 不存在** → Engine 页 Rules 一律 `UNSUPPORTED`（见 §4 G-ENG-2） |
| `MemoryService` | — | 不在 Engine 页；未来独立 pane | 与 Instructions 分家 |

## 1b. M7 协议面（P0/P1a/P1b/P2a 已绑定；P2b 待接）

非 RPC：`IUniverseAgentConnection` / `IUniverseAgentSessionView` / `IUniverseAgentHubService` 在 Web 以 **`registerSingleton`** 注册（**禁止** `registerMainProcessRemoteService`），实现位于 `platform/universeAgent/browser/`。`connectionHub.contribution.ts` **不再**静态 import electron-browser Hub；该注册仅在 `workbench.desktop.main.ts`。

| 服务 | Web 诚实断连（**P0 已落**） | 备注 |
|------|------------------------------|------|
| `IUniverseAgentConnection` | transport `idle`；capability 已有键全 `UNSUPPORTED` reason「Web 不支持本机 Engine 连接」；`connect()` 不 throw、无 token；`connectProfile` `{ ok:false, code:'unsupported_environment' }`；`getConnectionPhase` = `disconnected` | `workbench.web.main.ts` |
| `IUniverseAgentSessionView` | 空 lease；`requestDetail` 恒 `{ ok:false, reason:'unavailable' }` | 同上 |
| `IUniverseAgentHubService` | `getAuthStatus=unavailable`；mutating `ok:false`；不回显凭据 | 同上 |

| 服务 | RPC | 本仓消费面 | P 切片 | 状态 |
|------|-----|-----------|--------|------|
| `McpService` | `GetMcpServerStatuses` / `GetMcpServerTools` | Engine Runtime tab | **P1a** `getMcpServerStatuses` / `getMcpServerTools`；`mcpRuntime` | **已绑定** |
| `PluginService` | `List` / `Info` / `Enable` / `Reload` / `Unload` / `ScanNew` | Engine Plugins | **P1a** 八方法；`plugins` 由 `List` 真探测 | **已绑定** |
| `AgentService` | `FetchToolDetail(..., subscribe=false)` | Conversation DetailRef | **P2a** `requestDetail` + `DetailPatch.truncated/totalBytes`；browser 恒 unavailable；stub 源由 B Q2 接通 | **已绑定** |
| `ConfigService` | `ListModels` | Engine Model 组 | **P1b** `listModels()`（`include_disabled=true`）；`models` | **已绑定** |
| `ConfigService` | `Get` / `Set` / `Watch` | Provider 候选 | `providerConfig` 固定 `UNSUPPORTED`（G-ENG-1） | **已登记** |
| L2 compact 事件 | `branch_reason` / `CompactedSpanBlock` / `RangeReplaced(COMPACT)` | 轨迹 compacted | **P2b** | 待接 |

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
| **G-CONV-1** compact 事实进入 session-core | 轨迹 `compacted` 记录 | proto 已有 L2 `branch_reason` / `CompactedSpanBlock` / `RangeReplaced(COMPACT)`；`ContextCompactedEvent` 只在 Chat 流。缺 host demux 与 `ItemAttribution.branchReason` / `compacted` 生产者（M7 **P2b**） |
| 独立 CreateSkill RPC（或等价新建 UI） | E1 新建技能 | Skill **新建** UI 已落 @ `e6167c45`（写文件后 `ListSkills` 刷新）；独立 RPC 仍缺 |
| `SaveSkillContent` node gRPC 传输 | —（**已闭** @ `45fa7a35`/`040c823d`） | `grpcClient` / `grpcTransport` / `universeAgentConnectionService` 动态绑定；单测 `universeAgentConnection.test.ts` |
| Agent profile `tools.json` / `model.json` 独立 UI | Engine 页目录三件套附件编辑 | `AGENTS.md` 正文 @ `9419f583` 已落；`tools.json` 经 Tools 节 checkbox；`model.json` 仍无独立编辑器 |
| `plugins` IDE probe | Plugins Engine 节 | **M7 P1a 已闭**（`PluginService.List` 探测）；`globalRules` 无 RPC，见 G-ENG-2 |

## 5. Conversation 会话面（A1/A2 @ HEAD 回填）

[IConversationRosterService](../../systems/conversation/stub-and-fixtures.md) 需要的引擎面；adapter 落层 [ADR-003](../../../dev/decisions/003-engine-adapter-boundary.md)（`platform/universeAgent`）；时间线 / 发送 / 权限流形态 [conversation-stream-timeline](../../../dev/plans/conversation-stream-timeline.md)。下表「HEAD 事实」来自 m6-engine-wave §3 与 `platform/universeAgent` + `ConversationEngineRosterService` 合入代码：

| IDE 需要 | 对应 stub 方法 | HEAD 事实 |
|----------|----------------|-----------|
| 会话枚举 / 创建 / 删除 | `getSessions` … `deleteSession` | `SessionService.List` / `Create` / `Delete`；`work_dir` 过滤随 Connect。已连接时首次 `List` 完成前 roster **不**含 stub 种子行 |
| 切换 / 重命名 | `switchSession` / `renameSession` | 切换 = 客户端 `activeSessionId` 投影（**无** `SwitchSession` RPC）。重命名 HEAD 仍走本地 `renameSession`；proto `AgentService.Rename` **未接** |
| 回合流（用户 / 助手 / thinking / tool / …） | `getTurns`、`onDidChangeSession` | `SessionService.GetHistory`（`cursor_seq`）+ `SessionEventStream` → session-core fold → `ViewFrame`；renderer 经 `IUniverseAgentSessionView` / `acquireSessionView` |
| 轨迹记录 | `getTrajectoryRecords(sessionId, { filterAgentId? }?)` | HEAD：`projectSnapshotToTrajectory(snapshot, attribution, details, options)` 从 lease/帧源投影；stub 仅 `untitled` 且未连接时 ∪ fixture extras；UA 会话**不** merge fixture；**P2a** 已提供 `requestDetail` / `FetchToolDetail` 通道（renderer 帧源与 stub 本地解析仍待 B Q2 接通）；`compacted` 预留；Overview 瀑布 Deferred。活 Event fold 全文仍 M6-D / PRD-008 |
| 权限请求 / 回执 | `resolveConfirmation`、`countPendingConfirmations` | 流内 L4 `permission_request` → `pendingActions`；应答经 `AgentService.Chat` 臂（`permissionRespond` fact）；`PermissionService.Respond` 为文档化备选 |
| MessageQueue | `getMessageQueueState` 与五个操作 | **仍 fixture**；`AgentService.EnqueueQueueItem` 族未进 roster adapter |
| AutoDrive / Task 列表 | `getAutoDriveTasks` | **仍 fixture**；`PermissionService.SetSessionGoal` 未接 |
| fork / 子代理 catalog | `IConversationSessionChatService` fixture | `AgentService.Tree` host 首拉 + 事件再拉（§11）；活 fork catalog / `Fork` **未**假装已接通 |
| `visualize` 工具输出 | fixture / tool turn | 仍 stub / 本地 fixture；引擎工具名待 T4+ |
| 引擎连接态 | `isEngineConnected` | `SystemService.Connect` 成功 + 非空 `session_token` + 活 channel；pairing-pending → false。StatusBar 文案 = `IUniverseAgentConnection.getConnectionPhase()`（H4b）；connected 芯片 command → Engine pane，否则 Connection |
| Route / AgentProfile / Model / Permission / Tools 选项 | Composer 各下拉 | 无引擎 = 诚实空；Engine 页 Agents **list-only** 已接，Composer 下拉 **仍**待 profile/策略切片 |
| 本地会话缓存与引擎权威切换 | PRD-017 | D13 @ HEAD：`conversation.roster.v1` @ `StorageScope.WORKSPACE` + `StorageTarget.MACHINE`；引擎接通后本地存 stub + UA 断连快照（`source` 字段） |

## 7. Engine catalog 消费面（M6-C @ HEAD `f49615a1`）

系统规格：[engine-catalog](../../systems/workbench/engine-catalog.md)。代码锚：`engineCatalog.ts` · `engineSkillCatalog.ts` · `engineSkillsSection.ts` · `engineAgentsSection.ts` · `engineMcpSection.ts` · `engineToolsSection.ts` · `engineToolProfile.ts`。

| 能力键 | List RPC | Toggle / 写 | Engine 页 @ HEAD |
|--------|----------|--------------|------------------|
| `skills` | `ListSkills` · `SkillInfo` | `SetSkillEnabled` · `SaveSkillContent`（node 传输 @ `45fa7a35`/`040c823d`；`saveSkillContent?` 契约 @ `f3f2d366`） | 分组 list + 开关 + 正文 textarea（读 `SkillInfo`；Save 在 `saveSkillContent?` 存在且 `supported` 时展示） |
| `agentProfiles` | `ListAgentProfiles` | `SaveAgentProfile` / `DeleteAgentProfile` / `ResetAgentProfile` | 分组 list + New/Delete/Reset + **`AGENTS.md` 全文编辑器** @ `9419f583` |
| `mcp` | `ListMcpServers` | `ToggleMcpServer` · `AddMcpServer` / `UpdateMcpServer` / `RemoveMcpServer` | 分组 list + 启用 checkbox + Add/Update/Remove 工具栏 |
| `tools` | `ListTools` | `SaveAgentProfile`（profile `tools.json`） | 目录 + profile 下拉 + 启用 checkbox |

断连 / `UNSUPPORTED` / `UNKNOWN` / 传输失败四路径须与 customizations-engine §2 一致；**禁止** Copilot 盘或 vscode `IMcpService` 顶替 UA 定义面。

## 11. Navigator / Review host 面（m6 §11 @ HEAD）

§1 已列 RPC；本节只记 **renderer 不直接见的 host join 与 IDE 事件**（细节 [m6-engine-wave §11](../../../dev/plans/m6-engine-wave.md)）。

| 面 | 生产者 | 消费者 |
|----|--------|--------|
| `AgentService.Tree` → `agentTreeBound` | M6-A2 host（必拉 + 事件再拉；`requestAgentTreeRefresh`） | Navigator Agents Hierarchy（lease `liveAgentTree`）；Team manager 发现 |
| `team.*` unary + `onDidChangeTeamRuntime` | A1 传输 + A2 demux L3 `multi_agent_status` | Navigator Team Members/Tasks |
| `tool_call_id` join 表 + `onDidFileMutation` + turn settle | A2 host（`ToolCallLifecycleEvent` + L3 snapshot + `assistant_turn_id` settle） | Sources Review 归因 chip；`ItemAttribution.toolCallId` → `conversation.revealItem` |
| `onDidChangeTeamRuntime` / `requestAgentTreeRefresh` | connection（A1 类型；A2 实现） | Navigator Team / Agents Refresh |

协议缺口 **G-NAV-1 / G-NAV-2 / G-REV-1** 见 §4。

## 6. 维护

- 外仓 RPC 改名 / 新增时改本页对应行并更新 `updated`；不在 plan 里重复枚举。
- 本页不得出现 `src/vs/` 类型名充当引擎类型；IDE 侧行为规格在 [engine-catalog](../../systems/workbench/engine-catalog.md) 与 [systems/conversation](../../systems/conversation/INDEX.md)。
- 写 RPC 合入后须同步 §1 行、§4 缺口、§7 表与 [engine-catalog §3–§4](../../systems/workbench/engine-catalog.md)；**不得**把 PRD-008 升 `implemented` 或写隔离 profile 冒烟已通过。
