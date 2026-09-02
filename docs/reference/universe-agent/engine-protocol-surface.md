---
title: "UniverseAgent 引擎协议面（本仓消费口径）"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "已知 gRPC 服务 / RPC 名与本仓用途；§1 Conversation 传输（A1/A2 已合入）与 Engine catalog（customizations-engine，catalog 扩展 RPC 待槽 A）；§5 会话面对照；§11 Navigator/Review host join（m6 §11）；§4 登记 G-NAV-* / G-REV-*"
---

# UniverseAgent 引擎协议面（本仓消费口径）

> 导航：[索引](INDEX.md)。RPC 名以外仓 proto 为准。§1 **Conversation 传输**行来自 `platform/universeAgent/node/grpc/grpcTransport.ts`（`UniverseAgentGrpcServices`，A1/A2 @ HEAD）。§1 **Engine catalog** 行仍来自 [customizations-engine](../../../dev/plans/customizations-engine.md)（2026-09-01 签收）；`ListAgentProfiles` / `ListMcpServers` / `ListTools` 等 **尚未**进 platform 传输面（槽 A catalog RPC 未合入前不得写进「已落地」）。

## 1. 已知服务与 RPC

| 服务 | RPC | 本仓消费面 | 备注 |
|------|-----|-----------|------|
| `SystemService` | `Connect` / `GetAuthNonce` | `IUniverseAgentConnection.connect`；握手、`session_token`、`ConnectResponse.capabilities.methods` | 无 `supported_methods` 字段；DeviceAuth 走 `ConnectWithDeviceAuth`（transport 内） |
| `SessionService` | `List` / `Create` / `Delete` / `GetHistory` / `SessionEventStream` | Conversation roster + 时间线 fold 输入（`GetHistory` + 流 → session-core Actor → `ViewFrame`） | 无 `SwitchSession`；切换 = IDE 客户端投影。标题 proto 为 `AgentService.Rename`，**HEAD adapter 未接** |
| `AgentService` | `Chat` | 发送 + 流内 permission / question / clientTool 应答（Chat 双向流） | 权限 cleanup 亦走 Chat 臂；`PermissionService.Respond` 为备选（见 stream-timeline S5 注释） |
| `AgentService` | `Tree` | Navigator Agent 树（**host-only**，不经 renderer `IUniverseAgentConnection`） | m6 §11；`UNIMPLEMENTED` → `agentTree=UNSUPPORTED` |
| `TeamService` | `MemberStatus` / `TaskList` / `TeamInfo` | Navigator Team 段（renderer `IUniverseAgentConnection.team`） | m6 §11 A1 unary |
| L3 `tool_runtime_snapshot` | `payload.file_mutation_payload` + `ToolCallLifecycleEvent` join | Sources Review 归因 chip / `reviewNav` 物化（**host-only** demux；contrib 消费 `onDidFileMutation`） | m6 §11 A2；禁止解析 L2 `arguments_json`；历史见 **G-REV-1** |
| `ToolService` | `ListSkills` / `SkillInfo` / `SetSkillEnabled` | A1 传输已接；Engine 页 Skills（E1）消费 | 无独立 Create RPC；写文件后 `ListSkills` 刷新 |
| `ToolService` | `ListTools` / `ToolInfo` | Engine 页 Tools 目录（**catalog 传输待槽 A**） | 无 `SetToolEnabled`；启用集写 profile `tools.json` |
| `AgentService` | `ListAgentProfiles` / `SaveAgentProfile` / `DeleteAgentProfile` / `ResetAgentProfile` | Engine 页 Agents（**catalog 传输待槽 A**） | BUILT_IN 只可 Reset |
| `McpService` | `ListMcpServers` / … | Engine 页 MCP 定义（**catalog 传输待槽 A**） | `GetMcpServerStatuses` / `GetMcpServerTools` 是运行态，不在 Engine 页 |
| `PluginService` | `List` / `Info` / `Enable` / `Reload` / `Unload` | Plugins 节（v1 延后） | Local 模式 UNSUPPORTED |
| Local `RulesBridge` | list / create / update / delete / preview / health × global / workDir（12）+ `defaultAgentHome()` | Engine 页 Rules（Instructions） | **Remote gRPC 不存在**；默认 `Unsupported` |
| `MemoryService` | — | 不在 Engine 页；未来独立 pane | 与 Instructions 分家 |

## 2. 能力探测

UA 侧 `EngineSettingsCapabilities` / `CapabilitySupport`：`SUPPORTED | UNSUPPORTED | UNKNOWN` + `reason`。

| 键 | 来源 | IDE 处理 |
|----|------|----------|
| `skills` · `mcp` · `plugins` · `globalRules` | UA 已有（`GrpcCapabilityProbe` + UNIMPLEMENTED 降级） | 直接消费三态 |
| `agentProfiles` | UA `BridgeCapabilities` 上是 Boolean | IDE 折算成三态 |
| `projectRules` · `tools` · `hooksMetadata` | UA 无 | **IDE 本地推导**（对应 RPC 是否 UNIMPLEMENTED、Connect 是否成功）；禁止扩 proto |
| `agentTree` · `team` | IDE 推导（m6 §11） | `AgentService.Tree` / `TeamService.MemberStatus` probe；UNIMPLEMENTED → UNSUPPORTED |
| IDE 传输失败 | 非 UA 概念 | 独立态；**不得**映射为 UNSUPPORTED 或空列表 |

无连接（PRD-008 未接通）：一律按「无列表」渲染，不用 Stub 填 `UNKNOWN`。

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

## 4. 已登记的协议缺口（由引擎仓补）

| 缺口 | 阻塞 | 备注 |
|------|------|------|
| **G-NAV-1** | `SessionSummary` / `SessionInfoResponse` 无 `work_dir` | Projects 按项目分组；IDE 未补前用 connection `workDir` 单组。见 [navigator-engine-segments §7](../../../dev/plans/navigator-engine-segments.md) |
| **G-NAV-2** | 无 `ListTeams(session_id)`；`team_id` 只在不落库事件出现 | 重连后 `liveTeamId` 空 → 节标题省略团队状态；Members/Tasks 仍可用 |
| **G-REV-1** | 持久化历史无归一化 `file_mutation`（L3 不落库；L2 路径在 `arguments_json`） | 归因 / reviewNav 仅限本连接（含重播种）。见 [sources-review-progress §6](../../../dev/plans/sources-review-progress.md) |
| Rules Remote gRPC | Remote 模式 Instructions | — |
| `ListHookPoints`（或握手带版本化点位表） | Engine 页 Hooks「来自引擎」 | — |
| 独立 CreateSkill / 写正文 RPC（或「写后刷新」约定） | E1 新建技能 | — |
| vscode 侧能力探测等价物 | E1 全部（IDE 自己补，不是引擎缺口） | — |

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
| Route / AgentProfile / Model / Permission / Tools 选项 | Composer 各下拉 | 无引擎 = 诚实空；接通后仍待 catalog / 策略 RPC（槽 A） |
| 本地会话缓存与引擎权威切换 | PRD-017 | D13 @ HEAD：`conversation.roster.v1` @ `StorageScope.WORKSPACE` + `StorageTarget.MACHINE`；引擎接通后本地存 stub + UA 断连快照（`source` 字段） |

## 11. Navigator / Review host 面（m6 §11 @ HEAD）

§1 已列 RPC；本节只记 **renderer 不直接见的 host join 与 IDE 事件**（细节 [m6-engine-wave §11](../../../dev/plans/m6-engine-wave.md)）。

| 面 | 生产者 | 消费者 |
|----|--------|--------|
| `AgentService.Tree` → `agentTreeBound` | M6-A2 host（必拉 + 事件再拉；`requestAgentTreeRefresh`） | Navigator Agents Hierarchy（lease `liveAgentTree`）；Team manager 发现 |
| `team.*` unary + `onDidChangeTeamRuntime` | A1 传输 + A2 demux L3 `multi_agent_status` | Navigator Team Members/Tasks |
| `tool_call_id` join 表 + `onDidFileMutation` + turn settle | A2 host（`ToolCallLifecycleEvent` + L3 snapshot + `assistant_turn_id` settle） | Sources Review 归因 chip；`ItemAttribution.toolCallId` → `conversation.revealItem` |
| `onDidChangeTeamRuntime` / `requestAgentTreeRefresh` | connection（A1 类型；A2 实现） | Navigator Team / Agents Refresh |

协议缺口 **G-NAV-1 / G-NAV-2 / G-REV-1** 见 §4；**不**把槽 A 未合入的 `ListAgentProfiles` / `ListMcpServers` / `ListTools` catalog RPC 记为已落地。

## 6. 维护

- 外仓 RPC 改名 / 新增时改本页对应行并更新 `updated`；不在 plan 里重复枚举。
- 本页不得出现 `src/vs/` 类型名充当引擎类型；IDE 侧类型在 [systems/conversation](../../systems/conversation/INDEX.md)。
