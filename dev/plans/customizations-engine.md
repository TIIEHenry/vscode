---
title: "Agent Customizations 引擎面：UA catalog / profile / hook / MCP / tools"
type: plan
status: draft
phase: N/A
updated: 2026-09-01
summary: "Engine 页 Skill/Agent/Rules/Hook/MCP/tools 的 UA 数据权威与协议缺口；无能力诚实空；禁止 Copilot 磁盘冒充已接引擎"
---

# Agent Customizations 引擎面

> **产品目录 SSOT：** [settings-two-surfaces.md](settings-two-surfaces.md) — 这些能力的 **产品主面是 Engine 页**（`ua.engine`），不是 Copilot Customizations Overview。  
> **并行宿主稿：** [customizations-host-ui.md](customizations-host-ui.md)（donor chrome；不写 RPC）。本文件只写 **数据权威、传输、协议缺口、能力探测**。不写像素；宿主必须是 vscode Settings/Preferences 脸。  
> **产品：** 引擎与会话权威是 UniverseAgent（[PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) 今天 `blocked`）。Agent Host / AHP **不是** catalog 权威。  
> **红线：** 无能力则诚实空 / Stub；禁止 Copilot 磁盘顶替 UA 路径后写「已接引擎」。下文 `EngineSkillCatalogService` 等是 **计划中的 IDE 门面 / 外仓符号**，不是本仓 HEAD 类型。

**Goal：** 把 Engine 页各节钉到 UniverseAgent 的 SSOT 与传输面；列出最小协议；断连时 IDE 可碰哪些本地 UA 路径、什么算假同步。

---

## 0. 三层不要混（引擎面口径）

父方案三层在本文件的落点：

| 层 | 本页职责 | 禁止 |
|----|----------|------|
| A 壳 | 不写。Engine pane + 可拆的文件编辑器零件；vscode 同一张脸 | 独立 SettingsScreen / Compose 卡网 / 把 Customizations Overview 当 Engine 首页 |
| B 节语义 | 只引用父方案已拍板的节处置 | 把 Galaxy / Gateway / Devices / Provider 塞进本页 |
| C 数据权威 | **本文 SSOT** | 把 `IChatModel`、AHP、`IPromptsService` Copilot 路径当 UA catalog |

**传输两态（产品语言，不是类名）：**

| 态 | 何时 | IDE 可以说什么 |
|----|------|----------------|
| **Disconnected / Stub** | PRD-008 未接通，或能力探测 `UNKNOWN`/`UNSUPPORTED` | 「引擎未连接」；列表若来自本机 UA 路径，必须标 Stub |
| **Engine-backed** | PRD-008 接通 **且** 对应能力 `SUPPORTED` | 「来自当前引擎」；list/toggle/body 必须走引擎协议，禁止 silent 读客户端盘冒充远端引擎 |

AHP 可以拉起 Copilot CLI / agent-host 进程，那只是 vscode 侧 harness。Customizations 的 Skills / Agents / Rules / Hooks / MCP 定义 **不得**经 AHP 的 Copilot 文件发现冒充 UA。

---

## 1. 权威表

默认 `AgentHome` = `~/.universe-agent`（可被测试覆盖；产品文案用这个路径）。工作目录 = 当前项目根（引擎 `workDir`，接通后以引擎回报为准）。

| Customizations 节 | 引擎 SSOT | 磁盘路径（plane A） | 已有传输 | 本页用它做什么 |
|-------------------|-----------|---------------------|----------|----------------|
| **Skills** | `EngineSkillCatalogService`（`listForUi` / `listEnabled` / `resolve` / `loadBody`）；toggle 写 scope `manifest.json` 并抬 catalog generation | **BUNDLED** 安装包 `resources/skills/{name}/SKILL.md`（只读）；**USER** `{AgentHome}/skills/{name}/SKILL.md`；**PROJECT** `{workDir}/.universe-agent/skills/{name}/SKILL.md`。合并：BUNDLED 不可覆盖；同名非内置时 PROJECT > USER；损坏 manifest **fail-closed** | gRPC `ToolService.ListSkills` / `SkillInfo` / `SetSkillEnabled`（Local 同源 catalog）。**不含 CLIENT**（CLIENT 只进 Singularity Chip / 显式 `/name`，不进 `sys_skill`、不进本页） | 列表、启用开关、读 SKILL.md 正文。斜杠走同一 catalog，本页不另开 Prompts 节 |
| **Agents** | `AgentPresetLoader.discoverAll` / `savePreset` / `updatePreset` / `deletePreset`；创建语义是 `agent_spawn` catalog | 目录 `{id}/AGENTS.md` + `tools.json` + 可选 `model.json`。优先级：PROJECT `{workDir}/.universe-agent/agents/` > USER `{AgentHome}/agents/` > BUILT_IN `core/.../resources/agents/`（种子写入用户目录后可改/禁/重置，不可删） | gRPC `AgentService.ListAgentProfiles`（`project_path` 可选）/ `SaveAgentProfile` / `DeleteAgentProfile` / `ResetAgentProfile` | 列表、读/写 profile 目录，不是单文件 `.agent.md` persona |
| **Instructions** | `ProjectRuleManager` / `ProjectRuleLoader`：Global rules + Project rules（markdown + `manifest.json`）。注入位置是 Root system prompt 基础层，**不是** Memory | Global `{AgentHome}/rules/`；Project `{workDir}/.universe-agent/rules/` | **Local** `RulesBridge`（13 方法：list/create/update/delete/preview/health × global/workDir）。**Remote gRPC 不存在**：默认实现显式 `Unsupported`，禁止 REMOTE 时静默读写客户端本机 | 「总是注入的短规则」的 CRUD。Memory 不进本页 |
| **Hooks** | AgentLoop `HookRegistry.fire*` 点位（外仓 UniverseAgent `docs/systems/server/hook/points.md`：单 Agent 21 + Multi-Agent 8 + Memory 系统 6）。用户可配外部钩子产品路径 `{AgentHome}/hooks.json`（DESIGN.md Stop Hooks，子进程、失败不拖主流程）。进程内 SPI **不**改写成 Codex/Copilot `hooks.json`。三方包走 `HookPluginEngine` / `PluginService` | `{AgentHome}/hooks.json`（外部钩子定义）；插件 JAR/DEX 在 `{AgentHome}/plugins/`。**不是** `.github/hooks` 或 vscode task hook | **缺**「Hook 点位元数据」RPC。插件管理：`PluginService.List` / `Info` / `Enable` / `Reload` / `Unload`（Plugins 节 v1 延后，Hooks 节只展示点位 + 文件定义） | 展示 UA 生命周期点位；编辑 `hooks.json`。禁止列出 Copilot CLI / vscode 任务事件当引擎点位 |
| **MCP Servers** | 定义 SSOT：Global = ConfigStore 键 `mcp.servers`（现网 `config.json`；产品叙事 `{AgentHome}/mcp-servers.json`）；Project = `{workDir}/.universe-agent/mcp-servers.json`（`servers[]` + `globalOverrides`，ADR-291） | 同上。vscode `.vscode/mcp.json` / 用户 `mcp.json` **不是** UA | gRPC `McpService.ListMcpServers` / `AddMcpServer` / `UpdateMcpServer` / `RemoveMcpServer` / `ToggleMcpServer`（`scope` = global\|project，`work_dir` 项目时必填） | **定义** CRUD + 启用。`GetMcpServerStatuses` / `GetMcpServerTools` = **运行态**，本页不做 |
| **Plugins** | `HookPluginEngine`（SPI 发现的 `AgentHookPlugin`），≠ vscode Extension ≠ Copilot `~/.copilot/installed-plugins` | `{AgentHome}/plugins/` | `PluginService.*`；Local 模式 Singularity 标 UNSUPPORTED（「需要远端引擎」） | **v1 整节延后**。无引擎或 `plugins=UNKNOWN/UNSUPPORTED` → 隐藏或诚实空，禁止 Browse 进 Open VSX / Copilot 市场 |
| **Tools** | 两层：① 引擎内置工具目录 `ToolService.ListTools`；② **Profile 白/黑名单** `tools.json`（`tools` / `disallowedTools`），随 `SaveAgentProfile` 落盘。本机 **client-tool** 是 IDE 向引擎登记的客户端工具，接通后才存在 | `{profileDir}/tools.json` | `ListTools` / `ToolInfo` **无**独立 `SetToolEnabled` RPC；enablement 写 profile。client-tool 走会话流登记，不是本页「内置 Copilot CLI 清单」 | 按当前 profile 展示/改工具启用；无引擎则空。禁止 `COPILOT_CLI_TOOLS` 只读清单 |
| **Overview** | 无独立引擎资源 | — | 能力探测聚合 | 去 Copilot 文案；无引擎写诚实空。不预填 Chat |
| **Prompts / Automations / Models / HarnessSettings** | 不在本页产品轨 | — | — | Prompts：UA 斜杠 = Skill catalog。Models/Provider/token → Engine pane。Harness = Copilot |

**CLIENT skill**（Singularity 应用数据 `skills/`）明确 **不进本页**：不进 `EngineSkillCatalogService`，不进 `sys_skill`。vscode 若扫到 `~/.cursor/skills` / CLIENT 目录，当作外生态，不得标成 UA catalog。

---

## 2. 能力探测 → 节显隐矩阵

模式对齐 UniverseAgent `EngineSettingsCapabilities` / `CapabilitySupport`：**SUPPORTED / UNSUPPORTED / UNKNOWN**，带 `reason`。IDE 必须实现等价探测，**禁止**在 `UNKNOWN` 时画假列表或假 Browse。

本页相关探测键（不要把 Galaxy / Gateway / Devices / tokenUsage / Memory browse 拉进这页）：

| 探测键 | 对应节 | `SUPPORTED` | `UNSUPPORTED` | `UNKNOWN` | 无连接（profile 未选 / PRD-008 blocked） |
|--------|--------|-------------|---------------|-----------|------------------------------------------|
| `skills` | Skills | 引擎 list/toggle/body | 节在，正文诚实句（「当前引擎无技能 API」），**零假名** | 同 UNSUPPORTED，文案「正在确认引擎能力」；禁止用 Copilot 目录填空 | Stub：见 §4。节可在 |
| `agentProfiles` | Agents | List/Save/Delete/Reset | 节在，空 + 原因 | 同左 | Stub：本地 UA profile 目录，标 Stub |
| `globalRules` + `projectRules` | Instructions | Local：可读可写本机 AgentHome / workDir。Remote：今天 UA 即 UNSUPPORTED（规则在引擎主机，远端客户端未开通 RPC） | 空 + 原因；**禁止** REMOTE 时写 vscode 工作区盘假装改了引擎 | UNKNOWN 不画规则名 | Stub：可扫 UA rules 路径并标 Stub |
| `hooksMetadata` | Hooks | 能拿到点位表（协议或引擎版本钉死的点位清单） | 节在，列表空，不列 vscode task 事件 | 同 UNSUPPORTED | Stub：可显示静态 UA 点位表（来源写明「引擎合同副本」）+ 若存在则只读 `hooks.json`，标 Stub |
| `mcp` | MCP Servers | 定义 CRUD | 节在；可只读本地 UA `mcp-servers.json` **但不可声称已连引擎** | 不画假服务器、去掉 Browse | 同上 |
| `plugins` | Plugins | 以后切片 | **v1 隐藏或诚实空** | 隐藏或空 | 隐藏或空 |
| `tools` | Tools | ListTools + 当前 profile `tools.json`；接通后可列本机已登记 client-tool | 空，不列 Copilot CLI 名 | 空 | 空（H0 已要求去掉 Copilot CLI 清单） |

**聚合规则（已拍板）：**

1. 任一键 `UNKNOWN`：**该节不渲染假条目**。Browse / 市场按钮直接去掉。  
2. `UNSUPPORTED`：节可以留在左 nav（父方案「节可在，内容诚实空」），但计数为 0。  
3. Memory / Provider / Model / token / Gateway / Galaxy：**本页永远不探测来决定显隐**——它们不属于 Customizations。  
4. vscode `IMcpService` 已连接若干 `.vscode/mcp.json` 服务器 **不得**把 `mcp` 探测抬成 `SUPPORTED`。那是 IDE MCP 运行时，不是 UA 定义面。

探测失败必须三分：`Supported` / `Failed`（传输错）/ `Unsupported`（服务端未实现）。**禁止** `catch → emptyList()` 当成「引擎说你有 0 个技能」。

---

## 3. 最小协议（引擎必须暴露）

下列是 **本页从 Stub 变成真的** 所需的最小面。名称用 UA 已有 RPC；缺口单独标「须补」。

### 3.1 Skills：list + toggle + body

| 操作 | 最小契约 | 已有 | IDE 语义 |
|------|----------|------|----------|
| 列表 | 每条：逻辑 `name`、`description`、`source` ∈ `{bundled,user,project}`、`enabled`、`slash_enabled`、`contentPath` 不向 UI 暴露为可拼路径 | `ListSkills`。wire 上 `source` 曾写 built-in/custom/plugin；产品与合并规则以 **bundled/user/project** 为准（与 `ListCommands.skill_source` 对齐） | 按 scope 分组。BUNDLED 只可 disable，不可删、不可覆盖安装 |
| 启停 | `SetSkillEnabled(skill_name, enabled)` → 写对应 scope manifest，抬 catalog generation | 已有。损坏 manifest → `FAILED`，不得当空清单覆盖 | 开关打到引擎 catalog。UI 必须同时展示 §5 冻结文案 |
| 正文 | `SkillInfo(skill_name)` → `content`（经 `entry.contentPath` 读，INV-SKILL-PATH-1） | 已有 | 预览/编辑 USER/PROJECT；BUNDLED 只读 |
| 新建 | 落盘 `{scopeRoot}/{name}/SKILL.md`（唯一合法布局）。无 manifest 行时 USER/PROJECT **opt-in**：`frontmatter.enabled == true` 才进入 catalog，禁止「丢文件即启用」 | 无独立 Create RPC；Local Stub 写文件；Engine-backed 须经 catalog/install 或约定「写文件后 ListSkills 刷新」 | New 命令的目标目录必须是 UA 路径，不是 `.github/skills` |

**本页不做：** Skill 商店、CLIENT scope、把 `ListCommands` 当第二套 Skills 列表（斜杠是同一 catalog 的投影）。

### 3.2 Profile：list + read/write

| 操作 | 最小契约 | 已有 |
|------|----------|------|
| 列表 | `ListAgentProfiles(project_path?)`：不传 = USER+BUILT_IN；传 workDir = PROJECT∪USER∪BUILT_IN。每条带 `source` | 已有 |
| 读 | profile 目录三件套：`AGENTS.md`（frontmatter `summary`/`usage`/`detailLevel` + system prompt 正文）、`tools.json`、可选 `model.json` | 列表/详情随 Save 回读 |
| 写 | `SaveAgentProfile`；仅 USER/PROJECT。BUILT_IN 用 `ResetAgentProfile`，不可 `Delete` | 已有 |
| 创建 | 语义是向 `agent_spawn` catalog 增加一条可委派 profile，不是 Copilot Custom agent 市场条目 | 无商店 RPC；Save 即创建 |

`model.json` 在本页只作 profile 附件只读/可编；**Provider / Model Profile / token usage 仍归 Engine pane**，禁止本页变相做成模型选择器。

### 3.3 Rules

| 操作 | 最小契约 | 已有 |
|------|----------|------|
| 列表 | global / project 两条 scope；记录含 id、title、body、enabled、priority、globs、appliesTo | Local `RulesBridge` |
| 读写 | CRUD + prompt preview + health | Local 已有 |
| Remote | 与 Local 同形状的 gRPC | **须补**。未补之前探测 = `UNSUPPORTED`。禁止用工作区 `.github/copilot-instructions.md` 顶替 |

### 3.4 Hooks 元数据

| 操作 | 最小契约 | 已有 |
|------|----------|------|
| 点位表 | 只读：id、阶段（before/after）、分类（Turn/Llm/Tool/Permission/Lifecycle/…）、是否可取消/改写。与 AgentLoop `fire*` 一一对应 | **须补** `ListHookPoints`（或引擎握手里带版本化点位表）。在此之前 IDE 只允许展示文档合同副本并标明不是 live 探测 |
| 定义 list | 读 `{AgentHome}/hooks.json` 外部钩子条目（命令、事件名须映射到 UA 点位，而不是 `onSave`/`task`） | 无 RPC；Local Stub 读文件 |
| 插件 | `PluginService.List` + 每插件 `PluginHookEntry.hook_type` | 已有，但 **Plugins 节 v1 延后**；Hooks 节不靠插件列表凑数 |

### 3.5 MCP 定义（非运行态）

| 操作 | 最小契约 | 已有 |
|------|----------|------|
| 列表 | `ListMcpServers(work_dir?, enabled_only?)`：id、name、transport（stdio/sse/streamable_http）、command/args/env 或 url、`origin` global\|project、`enabled` / `effective_enabled` / `has_project_override` | 已有 |
| CRUD / Toggle | Add/Update/Remove/Toggle；project scope 必须带 `work_dir` | 已有 |
| **明确不要** | `GetMcpServerStatuses`、`GetMcpServerTools`、vscode `IMcpService` 已连接工具 | 运行态；后续切片 |

Browse 市场：UA 无商店则按钮不存在。Copilot featured gallery **剥离**。

### 3.6 工具 enablement

| 操作 | 最小契约 | 已有 |
|------|----------|------|
| 引擎工具目录 | `ListTools`（name、description、category、destructive、requires_permission） | 已有；**这是目录不是开关** |
| Profile 启用集 | 读/写该 profile 的 `tools.json`（允许列表 + `disallowedTools`） | 经 `SaveAgentProfile`，无独立 SetToolEnabled |
| Client-tool | 当前 IDE 已向该引擎会话登记的客户端工具名 + 用户是否允许广告给模型 | 运行时登记；**断连时本页不列**。禁止用 Copilot CLI 内置名占位 |

### 3.7 能力探测

| 操作 | 最小契约 | 已有 |
|------|----------|------|
| Handshake | 对 `skills` / `mcp` / `plugins` / `globalRules` / `projectRules` / `agentProfiles` / `tools` / `hooksMetadata` 返回 SUPPORTED\|UNSUPPORTED\|UNKNOWN + reason | Singularity：`GrpcCapabilityProbe` + UNIMPLEMENTED 降级。**vscode 侧无等价物，须补**（可复用 UA proto `supported_methods` / UNIMPLEMENTED，不必抄 Kotlin 类型名） |

未接通引擎：全部 `UNKNOWN`（「尚未选择/连接引擎」），不是「0 个技能所以 SUPPORTED」。

---

## 4. 断连 Stub vs 假同步

H1 **允许**在 PRD-008 之前用本机 UA 路径填 Skills / Agents 列表，但必须标 Stub。下表是对每一节的硬边界。

| 节 | Stub 允许（Disconnected） | 假同步（禁止，即使文件碰巧存在） |
|----|---------------------------|-----------------------------------|
| Skills | 扫描 `{AgentHome}/skills/*/SKILL.md` 与 `{workspace}/.universe-agent/skills/*/SKILL.md`；只读正文；本地改 USER/PROJECT 文件时文案为「仅写入本机 UniverseAgent 目录，未同步到引擎 catalog」 | 扫描 `~/.copilot/skills`、`.github/skills`、`.agents/skills`、`.claude/skills` 并标成 UA；把本地 manifest 开关说成 `SetSkillEnabled` 已生效；把空目录说成「引擎返回 0」 |
| Agents | 扫描 `{AgentHome}/agents/*/AGENTS.md` 与 `{workspace}/.universe-agent/agents/`；编辑目录内三件套，标 Stub | 把 `.github/agents/*.md`、`~/.copilot/agents/*.agent.md` 单文件 persona 当 Profile；声称 `agent_spawn` catalog 已更新 |
| Instructions | 扫描 `{AgentHome}/rules/` 与 `{workspace}/.universe-agent/rules/` | 把 `.github/copilot-instructions.md`、`.github/instructions/*.instructions.md`、`.claude/rules` 当 Global/Project rules；REMOTE 引擎时写客户端盘 |
| Hooks | 只读展示 UA 点位合同表；若存在则打开 `{AgentHome}/hooks.json` | 把 `.github/hooks`、`~/.copilot/hooks`、`.claude/settings.json` 的 save/task 事件标成 AgentLoop 点位 |
| MCP | 只读 `{workspace}/.universe-agent/mcp-servers.json`（及本机 AgentHome 叙事文件），文案「本地定义，引擎未连接」 | 把 `.vscode/mcp.json` / 用户 `mcp.json` / Copilot gallery / `IMcpService` 已连接态当作 UA 定义或「已同步」 |
| Plugins | 不展示假市场 | Browse Open VSX / Copilot plugin / `~/.copilot/installed-plugins` |
| Tools | **空**。不要用 Stub 清单 | `COPILOT_CLI_TOOLS`、vscode `ILanguageModelToolsService` 扩展工具冒充当前引擎/profile |

**判定句（产品）：** 用户若能在未连接 UniverseAgent 时看到「已与引擎同步 / Copilot Agent Host / 来自 Copilot CLI」任一措辞，本切片失败。

---

## 5. 会话冻结技能：开关 ≠ 热切换

引擎契约（skills INDEX）：

- **Catalog / 正文 / `sys_skill` / List\***：单一 versioned snapshot；install/toggle 抬 generation 后 **下一读**刷新。  
- **Root `<available_skills>`**：`AgentLoopFactory` 组装时快照，**活跃会话不热切换**。

因此 Customizations 里把某个 skill 打开：

1. 写的是 catalog（下次 `ListSkills` / 新会话 / 新 Root 组装会看见）。  
2. **已经打开的 Conversation 不会立刻换技能表。**  
3. UI 必须用产品句，例如：「已保存到引擎技能目录；当前对话仍使用开始时的技能表，新对话或重新开始后生效。」  
4. 禁止把开关画成「立即对正在跑的这一轮生效」。禁止用 vscode 侧本地 ignore 列表假装热更新了 Root prompt。

这与 PRD-008 接通后的 E1 同时生效：E1 验收包含这句诚实文案，而不是「toggle RPC 200 即成功」。

---

## 6. 与当前 vscode Copilot / agent-host 文件提供者的缺口

HEAD 发现路径在 `promptFileLocations.ts` / `IPromptsService` / `AICustomizationManagementEditor`。它们服务 Copilot Agent Host，**不是** UA。对照：

| 本页节 | vscode HEAD 实际扫的路径 | UA 权威路径 | 缺口 |
|--------|--------------------------|-------------|------|
| Skills | `.agents/skills`、`.github/skills`、`.claude/skills`、`~/.agents/skills`、`~/.copilot/skills`、`~/.claude/skills` | `{AgentHome}/skills/`、`{workDir}/.universe-agent/skills/`、BUNDLED | **零交集**。继续用 `IPromptsService` 等于用 Copilot 盘冒充 catalog |
| Agents | `.github/agents`、`.claude/agents`、`~/.copilot/agents`；单文件 `.agent.md` / 文件夹内 `.md` | 目录 `AGENTS.md`+`tools.json`+`model.json` 三件套 | 布局与语义都不同；AHP custom agent ≠ `agent_spawn` profile |
| Instructions | `.github/instructions`、`.github/copilot-instructions.md`、`.claude/rules`、`~/.copilot/instructions` | `{AgentHome}/rules/`、`{workDir}/.universe-agent/rules/` | Copilot always-on instruction ≠ UA Global/Project rules |
| Hooks | `.github/hooks`、`~/.copilot/hooks`、`.claude/settings.json`；事件含 Copilot CLI / vscode task | AgentLoop `fire*` + `{AgentHome}/hooks.json` | 点位集合不同；Copilot hook 文件不能当 UA 定义 |
| MCP | vscode `IMcpService`：`.vscode/mcp.json`、用户 `mcp.json`、扩展、Copilot gallery、plugin `.mcp.json` | ConfigStore `mcp.servers` + project `mcp-servers.json` | 两套定义面。Browse 市场是 Copilot/VS Code 的 |
| Plugins | Copilot `~/.copilot/installed-plugins`、marketplace | `HookPluginEngine` 插件 | 完全不同的包模型 |
| Tools | `toolsListWidget` 静态 `COPILOT_CLI_TOOLS` + `ILanguageModelToolsService` | `ListTools` + profile `tools.json` + client-tool 登记 | HEAD 把 Copilot 运行时内置工具冒充「chat 可用工具」 |

**agent-host / AHP：** 可以继续作为 vscode 进程与 Copilot harness 的管道，**不得**成为 Customizations 的 list/toggle 后端。`IAgentHostService` 已连接 ≠ `skills=SUPPORTED`。

**不得做的迁移：** 把仓库里已有 `.github/copilot-instructions.md` 自动改名为 UA rules 并声称引擎已接管。父方案允许「仅当仓库真有可迁文件」的 Overview hint，hint 的目标必须是 UA Skill/Rules 路径，且标手动/显式，不是默认同步。

---

## 7. 非目标（本页 v1）

父方案已拍板，此处钉死以免实施时回流：

| 不进本页 | 去哪 |
|----------|------|
| Memory 浏览 / 重建 / `/memory` 闸 | Memory 是独立引擎能力（`MemoryModule` / gRPC `MemoryService`），与 Instructions 分家。有引擎后另开 Engine pane 或另节 |
| Provider 密钥、Model Profile、token usage | Engine pane |
| MCP **live** 工具、连接状态灯、强制刷新工具 schema | 后续运行态切片；可用 `GetMcpServerStatuses` / `GetMcpServerTools` 但不挂这页 |
| Galaxy / Gateway / Devices / 剪贴板管理 / 引擎存储 | 不是 Customizations |
| Skill 商店、Copilot/Open VSX Browse、Autopilot | 剥离或延后 |
| Prompts 节、Automations、HarnessSettings | 不进默认窗产品轨 |
| 用 AHP 冒充 UA session-core | PRD-008 未接通前 Conversation 继续诚实空，不靠本页「假活」 |
| 像素稿 / Singularity Settings 分组卡 | 宿主 UI 详稿 |

---

## 8. 切片与验收

### 8.1 依赖关系

```text
H0（去 Copilot 文案 / Overview 去预填 Chat / Tools 去 CLI 清单）
  → H1（Skills/Agents 换 UA 路径，本地 Stub）
      → H2（Instructions/Hooks 换 UA 语义）
      → H3（MCP 定义去 Copilot 源，去掉 Browse）
          → E1（PRD-008 接通后：Skills list/toggle 走引擎协议）
```

- H0–H3 **可以**在无引擎时做；必须遵守 §4。  
- **E1 不得早于 PRD-008**。引擎接线方案未接受时，把 Stub 标成「已接引擎」= 产品失败。  
- Plugins 整节不在 H1–E1。

### 8.2 H1（产品语言）

用户打开 Customizations → Skills / Agents：

- 标题与分组不再出现 Copilot / Agent Host 商品名。  
- 若工作区或用户目录下存在 **UA** 技能/profile，列表能看到它们，并标明 **Stub（引擎未连接）**。  
- 若只有 `~/.copilot/skills` 而没有 UA 目录：Skills **空**，不把 Copilot 技能「借来」填上。  
- 新建技能落到 `{workspace}/.universe-agent/skills/{name}/SKILL.md`（或用户确认的 USER 根），不落到 `.github/skills`。

### 8.3 E1 验收（产品语言，禁止「某 class 接上了」当成功）

在 **UniverseAgent 已连接** 且 `skills=SUPPORTED` 时：

1. Skills 列表与引擎 catalog 一致：能看到内置（bundled）、用户、项目三组；名字来自引擎，不是 vscode 扫盘猜的。  
2. 关掉一个 USER/PROJECT 技能后，再打开本页或刷新，开关状态仍是关；引擎侧 `ListSkills` 的 `enabled` 为 false。损坏的 manifest 不会被静默当成「全部关闭成功」。  
3. 打开技能正文，预览的是引擎经 catalog 读出的 SKILL.md，而不是旁路打开了 `~/.copilot/skills/...`。  
4. 开关旁有冻结说明；用户改开关后，**当前已打开的对话**技能表不变，新对话才变。  
5. 断开引擎后，列表回到 Stub 或诚实空，**不再**显示刚才那次 RPC 的缓存并写「已同步」。  
6. `skills=UNSUPPORTED` 或探测失败时：无假技能名，无 Copilot 回填。

未满足任一条，E1 不算完成。`SetSkillEnabled` 调用成功但 UI 仍扫 Copilot 路径，不算完成。

---

## 9. 协议缺口汇总（给引擎仓 / PRD-008 接线）

vscode 本页 **消费** 下列面；缺的由 UniverseAgent 补，IDE 不得用 Copilot 盘伪造。

| 缺口 | 严重度 | 说明 |
|------|--------|------|
| vscode 无能力探测 | 阻塞 E1 | 须对 §2 键做 SUPPORTED/UNSUPPORTED/UNKNOWN，UNIMPLEMENTED ≠ 空列表成功 |
| Rules Remote gRPC | 阻塞 Remote 下 Instructions 成真 | 现网 `RulesBridge` 默认 Unsupported；未补之前 REMOTE 诚实空 |
| Hook 点位元数据 RPC | 阻塞 Hooks「来自引擎」 | 否则只允许文档合同副本 + Stub `hooks.json` |
| `ListSkills.source` 与 bundled/user/project 对齐 | E1 必须约定 | IDE 按三 scope 分组，不按 Copilot local/user/extension |
| 独立 CreateSkill / 写正文 RPC | H1 Stub 可写文件；E1 至少要「写后 catalog 刷新」或 SkillInfo 回读 | 禁止只写 vscode 工作区却声称 catalog 已收 |
| `SetToolEnabled` | 不强制 | 用 `SaveAgentProfile`/`tools.json` 即可；Tools 节不要再发明第三套开关存储 |
| MCP 运行态 | 非本页 | 不要为了填列表去调 Status/Tools |
| AHP 定制资源 | 永久非权威 | 不把 agent-host 文件提供者升级成 UA adapter |

---

## 10. 与父方案的关系

| 父方案切片 | 本文约束 |
|------------|----------|
| §6 引擎必须做的 | 展开为 §1 权威表 + §3 最小协议 |
| §7 UI 约束 | 不在本文重复；空态文案必须能区分 Stub vs UNSUPPORTED vs 真 0 条 |
| §8 H1 | §4 + §8.2：本地 UA 路径 + Stub |
| §8 E1 | §5 + §8.3：list/toggle 走引擎且不暗示热切换 |

宿主 UI 详稿只消费本表的节显隐与空态原因字符串，不另造数据源。
