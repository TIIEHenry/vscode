---
title: "UniverseAgent 引擎协议面（本仓消费口径）"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "已知 gRPC 服务 / RPC 名与本仓用途（§1–4 来自已签收 customizations-engine）；能力探测三态；协议缺口；§5 会话面仍对照 R5 draft，未签收前勿当 RPC SSOT——权威在外仓"
---

# UniverseAgent 引擎协议面（本仓消费口径）

> 导航：[索引](INDEX.md)。RPC 名以外仓 proto 为准；本页列出的名称来自 [customizations-engine](../../../dev/plans/customizations-engine.md)（2026-09-01 三轮审查签收）。凡写「须查明」的行表示本仓尚无可引用的事实，R5 研究必须填掉。

## 1. 已知服务与 RPC

| 服务 | RPC | 本仓消费面 | 备注 |
|------|-----|-----------|------|
| Connect / handshake | `ConnectResponse.capabilities.methods` | 能力探测入口 | 没有 `supported_methods` 字段；不要为 IDE 显隐键扩 proto |
| `ToolService` | `ListSkills` / `SkillInfo` / `SetSkillEnabled` | Engine 页 Skills：列表（`source ∈ bundled/user/project`）、正文、启停 | 无独立 Create RPC；写文件后 `ListSkills` 刷新。Root `<available_skills>` 会话冻结，开关不热切换 |
| `ToolService` | `ListTools` / `ToolInfo` | Engine 页 Tools 目录 | 无 `SetToolEnabled`；启用集写 profile `tools.json` |
| `AgentService` | `ListAgentProfiles(project_path?)` / `SaveAgentProfile` / `DeleteAgentProfile` / `ResetAgentProfile` | Engine 页 Agents（profile 目录：`AGENTS.md` + `tools.json` + `model.json`） | BUILT_IN 只可 Reset |
| `McpService` | `ListMcpServers(work_dir?, enabled_only?)` / `AddMcpServer` / `UpdateMcpServer` / `RemoveMcpServer` / `ToggleMcpServer` | Engine 页 MCP **定义**（scope global / project） | `GetMcpServerStatuses` / `GetMcpServerTools` 是运行态，不在 Engine 页 |
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

| 缺口 | 阻塞 |
|------|------|
| Rules Remote gRPC | Remote 模式 Instructions |
| `ListHookPoints`（或握手带版本化点位表） | Engine 页 Hooks「来自引擎」 |
| 独立 CreateSkill / 写正文 RPC（或「写后刷新」约定） | E1 新建技能 |
| vscode 侧能力探测等价物 | E1 全部（IDE 自己补，不是引擎缺口） |

## 5. Conversation 会话面（R5 草案已覆盖大半，签收后回填）

[IConversationRosterService](../../systems/conversation/stub-and-fixtures.md) 需要的引擎面，R5 草案 [m6-engine-wave §3](../../../dev/plans/m6-engine-wave.md) 已逐行对照（例如时间线 = `SessionService.GetHistory(cursor_seq)` + `SessionEventStream`；队列 = `AgentService.EnqueueQueueItem` 族；Goal = `PermissionService.SetSessionGoal`），adapter 落层见 [ADR-003](../../../dev/decisions/003-engine-adapter-boundary.md)（`platform/universeAgent`）。两文仍 `draft`；**规则 16 签收后**把确认的 RPC 名回填到 §1 表，并把下表「须查明」列改成事实或「引擎缺口」：

| IDE 需要 | 对应 stub 方法 | 须查明 / 草案答案位置 |
|----------|----------------|--------|
| 会话枚举 / 创建 / 切换 / 重命名 / 删除 | `getSessions` … `deleteSession` | 服务与 RPC；是否按 `workDir` 过滤；标题权威 |
| 回合流（用户 / 助手 / thinking / tool / subtool / visualization） | `getTurns`、`onDidChangeSession` | 流式 RPC 形态；回合 id 稳定性；断线重连补齐策略 |
| 轨迹记录（context 注入、SYSTEM、compacted、附带 block / chip） | `getTrajectoryRecords` | 是否与回合流同源；`compacted` 分段如何暴露 |
| 权限请求 / 回执 | `resolveConfirmation`、`countPendingConfirmations` | 请求推送形态；allow / skip 回执 RPC；超时与撤回 |
| MessageQueue | `getMessageQueueState` 与五个操作 | 队列是否在引擎侧；hold / pause 语义是否存在 |
| AutoDrive / Task 列表 | `getAutoDriveTasks` | 权威是否存在；无则 Inbox 整槽省略 |
| fork / 子代理 catalog（`ChatOrigin` 四 kind、`parentChatId`、`ChatInteractivity`） | `IConversationSessionChatService` fixture | 协议 `origin.chat` 字段；SideChat / ReadOnly / Hidden 何时出现 |
| `visualize` 工具输出 | `visualizeArgsFromMermaidTool` | 工具名与 payload 形状；只映射 `visualization` kind |
| 引擎连接态 | `isEngineConnected` | Connect 生命周期事件；三态与传输失败如何暴露给 StatusBar / Engine 页 |
| Route / AgentProfile / Model / Permission / Tools 选项 | Composer 各下拉 | 策略表 RPC；无则诚实空 |
| 本地会话缓存与引擎权威切换 | [PRD-017](../../product/requirements.md#prd-017-本地会话持久化) | 是否需要 IDE 侧持久化；冲突规则 |

## 6. 维护

- 外仓 RPC 改名 / 新增时改本页对应行并更新 `updated`；不在 plan 里重复枚举。
- 本页不得出现 `src/vs/` 类型名充当引擎类型；IDE 侧类型在 [systems/conversation](../../systems/conversation/INDEX.md)。
