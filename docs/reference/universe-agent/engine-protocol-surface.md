---
title: "UniverseAgent 引擎协议面（本仓消费口径）"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "已知 gRPC 服务 / RPC 名与本仓用途；§1 Conversation（A1/A2）与 Engine catalog list-only（M6-C @ ad4be0ea）；§7 Engine 页三节；§5 会话面对照；§11 Navigator/Review；§4 G-NAV-* / G-REV-*"
---

# UniverseAgent 引擎协议面（本仓消费口径）

> 导航：[索引](INDEX.md)。RPC 名以外仓 proto 为准。§1 **Conversation 传输**行来自 `platform/universeAgent/node/grpc/grpcTransport.ts`（`UniverseAgentGrpcServices`，A1/A2 @ HEAD）。§1 **Engine catalog list/toggle** 与 §7 UI 口径来自 [customizations-engine](../../../dev/plans/customizations-engine.md) 与 [engine-catalog §3](../../systems/workbench/engine-catalog.md)（`ListSkills`/`SetSkillEnabled` + Agents/MCP/Tools **List** + MCP **Toggle** @ `ad4be0ea`；**写 RPC 待槽 A**）。

## 1. 已知服务与 RPC

| 服务 | RPC | 本仓消费面 | 备注 |
|------|-----|-----------|------|
| `SystemService` | `Connect` / `GetAuthNonce` | `IUniverseAgentConnection.connect`；握手、`session_token`、`ConnectResponse.capabilities.methods` | 无 `supported_methods` 字段；DeviceAuth 走 `ConnectWithDeviceAuth`（transport 内） |
| `SessionService` | `List` / `Create` / `Delete` / `GetHistory` / `SessionEventStream` | Conversation roster + 时间线 fold 输入（`GetHistory` + 流 → session-core Actor → `ViewFrame`） | 无 `SwitchSession`；切换 = IDE 客户端投影。标题 proto 为 `AgentService.Rename`，**HEAD adapter 未接** |
| `AgentService` | `Chat` | 发送 + 流内 permission / question / clientTool 应答（Chat 双向流） | 权限 cleanup 亦走 Chat 臂；`PermissionService.Respond` 为备选（见 stream-timeline S5 注释） |
| `AgentService` | `Tree` | Navigator Agent 树（**host-only**，不经 renderer `IUniverseAgentConnection`） | m6 §11；`UNIMPLEMENTED` → `agentTree=UNSUPPORTED` |
| `TeamService` | `MemberStatus` / `TaskList` / `TeamInfo` | Navigator Team 段（renderer `IUniverseAgentConnection.team`） | m6 §11 A1 unary |
| L3 `tool_runtime_snapshot` | `payload.file_mutation_payload` + `ToolCallLifecycleEvent` join | Sources Review 归因 chip / `reviewNav` 物化（**host-only** demux；contrib 消费 `onDidFileMutation`） | m6 §11 A2；禁止解析 L2 `arguments_json`；历史见 **G-REV-1** |
| `ToolService` | `ListSkills` / `SkillInfo` / `SetSkillEnabled` | **@ HEAD** 传输 + `EngineSkillsSection` list/toggle（E1） | 无独立 Create RPC；写文件后 `ListSkills` 刷新；Skill 正文/新建 UI 未在本 slice |
| `ToolService` | `ListTools` / `ToolInfo` | **@ HEAD** `listTools` → `EngineToolsSection` **只读目录** | 无 `SetToolEnabled`；profile 启用集经 `SaveAgentProfile`/`tools.json`（**写路径待槽 A**） |
| `AgentService` | `ListAgentProfiles` | **@ HEAD** `listAgentProfiles` → `EngineAgentsSection` **只读列表** | `SaveAgentProfile` / `DeleteAgentProfile` / `ResetAgentProfile` **未进传输**（槽 A） |
| `McpService` | `ListMcpServers` / `ToggleMcpServer` | **@ HEAD** list + toggle → `EngineMcpSection` | `AddMcpServer` / `UpdateMcpServer` / `RemoveMcpServer` **未进传输**（槽 A）；`GetMcpServerStatuses` / `GetMcpServerTools` 运行态，不在 Engine 页 |
| `PluginService` | `List` / `Info` / `Enable` / `Reload` / `Unload` | Plugins 节（v1 延后） | Local 模式 UNSUPPORTED |
| Local `RulesBridge` | list / create / update / delete / preview / health × global / workDir（12）+ `defaultAgentHome()` | Engine 页 Rules（Instructions） | **Remote gRPC 不存在**；默认 `Unsupported`；Engine 页 Rules list **未**在本 slice |
| `MemoryService` | — | 不在 Engine 页；未来独立 pane | 与 Instructions 分家 |

## 2. 能力探测

UA 侧 `EngineSettingsCapabilities` / `CapabilitySupport`：`SUPPORTED | UNSUPPORTED | UNKNOWN` + `reason`。

| 键 | 来源 | IDE 处理（@ HEAD） |
|----|------|-------------------|
| `skills` | Connect 广告 `ToolService.ListSkills` + 运行时 probe | `grpcCapabilityProbe.ts` → `getCapabilitySnapshot()`；Engine Skills 节消费 |
| `mcp` | Connect 广告 + `McpService.ListMcpServers` probe | 同上 → MCP 节 |
| `agentProfiles` | Connect 广告 + `AgentService.ListAgentProfiles` probe | 同上 → Agents 节（IDE 三态，非 UA Boolean 直出） |
| `tools` | Connect 广告 + `ToolService.ListTools` probe | 同上 → Tools 节 |
| `agentTree` · `team` | IDE 推导（m6 §11） | `AgentService.Tree` / `TeamService.MemberStatus` probe |
| `plugins` · `globalRules` | UA 侧键；本仓 probe 未实现 | @ HEAD 固定 `UNSUPPORTED`（`probe not implemented in M6-A1`） |
| `projectRules` · `hooksMetadata` | UA 无握手字段 | IDE 矩阵；@ HEAD 同上固定 `UNSUPPORTED` |
| IDE 传输失败 | 非 UA 概念 | 独立态；list RPC `catch` → 传输失败文案，**不得**映射为 UNSUPPORTED 或「0 条」 |

Connect 后 `probeEngineCapabilities`：**仅**广告了 method 且 probe 非 `UNIMPLEMENTED` 才升 `SUPPORTED`。无连接（PRD-008 未接通证据）：catalog 节 **disconnected**（隐藏），不用 Stub 填 `UNKNOWN`。

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
| Rules Remote gRPC | Remote 模式 Instructions | — |
| `ListHookPoints`（或握手带版本化点位表） | Engine 页 Hooks「来自引擎」 | — |
| 独立 CreateSkill / 写正文 RPC（或「写后刷新」约定） | E1 新建技能 UI | list/toggle 已接；新建/编辑 UI 未在本 slice |
| Catalog **写** RPC 进 IDE 传输 | Agents/MCP/Tools 定义 CRUD、`tools.json` | `SaveAgentProfile` / MCP Add·Update·Remove **待槽 A**；不得写进「已落地」 |
| `globalRules` / `plugins` IDE probe | Rules / Plugins Engine 节 | 待后续切片；Today 诚实 UNSUPPORTED |

## 5. Conversation 会话面（A1/A2 @ HEAD 回填）

[IConversationRosterService](../../systems/conversation/stub-and-fixtures.md) 需要的引擎面；adapter 落层 [ADR-003](../../../dev/decisions/003-engine-adapter-boundary.md)（`platform/universeAgent`）；时间线 / 发送 / 权限流形态 [conversation-stream-timeline](../../../dev/plans/conversation-stream-timeline.md)。下表「HEAD 事实」来自 m6-engine-wave §3 与 `platform/universeAgent` + `ConversationEngineRosterService` 合入代码：

| IDE 需要 | 对应 stub 方法 | HEAD 事实 |
|----------|----------------|-----------|
| 会话枚举 / 创建 / 删除 | `getSessions` … `deleteSession` | `SessionService.List` / `Create` / `Delete`；`work_dir` 过滤随 Connect。已连接时首次 `List` 完成前 roster **不**含 stub 种子行 |
| 切换 / 重命名 | `switchSession` / `renameSession` | 切换 = 客户端 `activeSessionId` 投影（**无** `SwitchSession` RPC）。重命名 HEAD 仍走本地 `renameSession`；proto `AgentService.Rename` **未接** |
| 回合流（用户 / 助手 / thinking / tool / …） | `getTurns`、`onDidChangeSession` | `SessionService.GetHistory`（`cursor_seq`）+ `SessionEventStream` → session-core fold → `ViewFrame`；renderer 经 `IUniverseAgentSessionView` / `acquireSessionView` |
| 轨迹记录 | `getTrajectoryRecords` | 接通前 = turns 投影 ∪ Stub fixture；活 Event fold = M6-D / stream-timeline S6 |
| 权限请求 / 回执 | `resolveConfirmation`、`countPendingConfirmations` | 流内 L4 `permission_request` → `pendingActions`；应答经 `AgentService.Chat` 臂（`permissionRespond` fact）；`PermissionService.Respond` 为文档化备选 |
| MessageQueue | `getMessageQueueState` 与五个操作 | **仍 fixture**；`AgentService.EnqueueQueueItem` 族未进 roster adapter |
| AutoDrive / Task 列表 | `getAutoDriveTasks` | **仍 fixture**；`PermissionService.SetSessionGoal` 未接 |
| fork / 子代理 catalog | `IConversationSessionChatService` fixture | `AgentService.Tree` host 首拉 + 事件再拉（§11）；活 fork catalog / `Fork` **未**假装已接通 |
| `visualize` 工具输出 | fixture / tool turn | 仍 stub / 本地 fixture；引擎工具名待 T4+ |
| 引擎连接态 | `isEngineConnected` | `SystemService.Connect` 成功 + 非空 `session_token` + 活 channel；pairing-pending → false。StatusBar 文案 = `IUniverseAgentConnection.getConnectionPhase()`（H4b）；connected 芯片 command → Engine pane，否则 Connection |
| Route / AgentProfile / Model / Permission / Tools 选项 | Composer 各下拉 | 无引擎 = 诚实空；Engine 页 Agents **list-only** 已接，Composer 下拉 **仍**待 profile/策略切片 |
| 本地会话缓存与引擎权威切换 | PRD-017 | D13 @ HEAD：`conversation.roster.v1` @ `StorageScope.WORKSPACE` + `StorageTarget.MACHINE`；引擎接通后本地存 stub + UA 断连快照（`source` 字段） |

## 7. Engine catalog 消费面（M6-C list-only @ HEAD）

系统规格：[engine-catalog](../../systems/workbench/engine-catalog.md)。代码锚：`engineCatalog.ts` · `engineSkillCatalog.ts` · `engineSkillsSection.ts` · `engineAgentsSection.ts` · `engineMcpSection.ts` · `engineToolsSection.ts`。

| 能力键 | List RPC | Toggle / 写 | Engine 页 @ HEAD |
|--------|----------|--------------|------------------|
| `skills` | `ListSkills` | `SetSkillEnabled` | 分组 list + 开关 + 冻结说明 |
| `agentProfiles` | `ListAgentProfiles` | —（写 RPC 待槽 A） | 分组只读 list |
| `mcp` | `ListMcpServers` | `ToggleMcpServer` | 分组 list + 启用 checkbox |
| `tools` | `ListTools` | —（`tools.json` 待槽 A） | 只读工具目录 |

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
- 槽 A 合入写 RPC 后：更新 §1 行、§4 缺口、§7 表与 [engine-catalog §3–§4](../../systems/workbench/engine-catalog.md)；**不得**提前写「已落地」。
