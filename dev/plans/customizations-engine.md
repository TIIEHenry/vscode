---
title: "Agent Customizations 引擎面：UA catalog / profile / hook / MCP / tools"
type: plan
status: accepted
phase: N/A
updated: 2026-09-02
summary: "Engine 页 catalog 权威；E1 部分已落（Skills list/toggle @ 8bfc299e；正文编辑器 UI + saveSkillContent? 契约 @ f3f2d366；Agents/MCP/Tools List @ 4833c008；Save/CRUD/tools.json @ f49615a1；AGENTS.md @ 9419f583）；SaveSkillContent node 传输待槽 A；PRD-008 未升 implemented"
---

# Agent Customizations 引擎面

> **产品目录 SSOT：** [settings-two-surfaces.md](settings-two-surfaces.md) — 这些能力的 **产品主面是 Engine 页**（`ua.engine`），不是 Copilot Customizations Overview。  
> **并行宿主稿：** [customizations-host-ui.md](customizations-host-ui.md)（donor chrome；不写 RPC）。本文件只写 **数据权威、传输、协议缺口、能力探测**。不写像素；宿主必须是 vscode Settings/Preferences 脸。  
> **产品：** 引擎与会话权威是 UniverseAgent（[PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) 今天 `blocked`）。Agent Host / AHP **不是** catalog 权威。  
> **红线：** 无引擎时 **Engine 页诚实空 + Test**；禁止 Copilot 磁盘顶替 UA 路径后写「已接引擎」。`EngineSkillCatalogService` 等是 **外仓 UniverseAgent HEAD**，不是本仓 `src/vs/` 类型。vscode 消费 `ListSkills` / `SetSkillEnabled` / `SkillInfo` 等 RPC，**不要**在 IDE 里再实现一个同名 class。

**Goal：** 把 Engine 页各节钉到 UniverseAgent 的 SSOT 与传输面；列出最小协议。无引擎时 **不要**在 Engine 页或 Customizations Overview 扫盘当 catalog。

本稿 `accepted`（2026-09-01）。规则 16 三轮 Grok 4.6（Opus 不可用）。第三轮 Approve with changes 已改入。**E1 部分已落** @ `8bfc299e`/`4833c008`/`f49615a1`/`9419f583`/`f3f2d366`（Skills list/toggle；**Skills 正文编辑器 UI**—选中 skill textarea + Save，读 `SkillInfo`、USER/PROJECT 可编/BUNDLED 只读、断连/`UNSUPPORTED` 不渲染；common 可选 `saveSkillContent?` @ `f3f2d366`，**node gRPC 传输待槽 A**；Agents/MCP/Tools **List** + MCP `ToggleMcpServer`；Agents Save/Delete/Reset、MCP Add·Update·Remove、Tools 经 `SaveAgentProfile`/`engineToolProfile.ts`；**Agents `AGENTS.md` 全文编辑器** @ `9419f583`/`3756d04e`）；**未落**：Skill **新建** UI、SaveSkillContent node 传输、MCP 运行态、Plugins、§8.3 六条产品验收与 PRD-008 隔离 profile 冒烟仍待。H0–H3 在 host-ui。

---

## 0. 三层不要混（引擎面口径）

父方案三层在本文件的落点：

| 层 | 本页职责 | 禁止 |
|----|----------|------|
| A 壳 | 不写。Engine pane + 可拆的文件编辑器零件；vscode 同一张脸 | 独立 SettingsScreen / Compose 卡网 / 把 Customizations Overview 当 Engine 首页 |
| B 节语义 | catalog / profile / rules / hooks / MCP 定义 / 引擎工具 | Galaxy / Gateway / Devices。Provider/Model **运行时表单**在同一 `ua.engine` pane，但不在本表当 Customizations 节 |
| C 数据权威 | **本文 SSOT** | 把 `IChatModel`、AHP、`IPromptsService` Copilot 路径当 UA catalog |

**传输两态（产品语言，不是类名）：**

| 态 | 何时 | IDE 可以说什么 |
|----|------|----------------|
| **Disconnected** | PRD-008 未接通 | Engine 页诚实空 + Test。donor **禁止**扫 `{AgentHome}` / `{workDir}/.universe-agent`。只可列工作区普通 md，或用户从 **已接引擎** 的 Engine 行打开的文件 |
| **Engine-backed** | PRD-008 接通 **且** 对应能力 `SUPPORTED` | 「来自当前引擎」；list/toggle/body 必须走引擎协议，禁止 silent 读客户端盘冒充远端引擎 |

AHP 可以拉起 Copilot CLI / agent-host 进程，那只是 vscode 侧 harness。Customizations 的 Skills / Agents / Rules / Hooks / MCP 定义 **不得**经 AHP 的 Copilot 文件发现冒充 UA。

---

## 1. 权威表

默认 `AgentHome` = `~/.universe-agent`（可被测试覆盖；产品文案用这个路径）。工作目录 = 当前项目根（引擎 `workDir`，接通后以引擎回报为准）。

**读表规则：** 「引擎 SSOT」列的 Kotlin 类型/方法是 **外仓 UniverseAgent HEAD**，用来说明权威在 UA **进程内**。vscode **禁止**在 `src/vs/` 移植 `EngineSkillCatalogService` / `AgentPresetLoader` / `ProjectRuleManager` / `HookRegistry` 或重写磁盘合并。IDE 只消费「已有传输」列的 RPC（及缺口表）。磁盘路径列是引擎内部布局，**断连时 IDE 禁止扫这些根**。

| Engine 页节 | 引擎 SSOT（外仓，禁止移植） | UA 磁盘（进程内） | 已有传输（IDE 只走这里） | **产品主面 `ua.engine` 用它做什么** |
|-------------------|-----------|---------------------|----------|----------------|
| **Skills** | 外仓 `EngineSkillCatalogService`。IDE **不要**调 `listForUi`；只对 RPC | **BUNDLED** `resources/skills/{name}/SKILL.md`（只读）；**USER** `{AgentHome}/skills/{name}/SKILL.md`；**PROJECT** `{workDir}/.universe-agent/skills/{name}/SKILL.md`。合并/fail-closed **在 UA 进程内** | gRPC `ToolService.ListSkills` / `SkillInfo` / `SetSkillEnabled`（Local 同源 catalog）。**不含 CLIENT**（CLIENT 只进 Singularity Chip / 显式 `/name`，不进 `sys_skill`、不进本页） | 列表、启用开关、读 SKILL.md 正文。斜杠走同一 catalog，本页不另开 Prompts 节 |
| **Agents** | 外仓 `AgentPresetLoader`（discover/save/update/delete）。创建语义是 `agent_spawn` catalog | 目录 `{id}/AGENTS.md` + `tools.json` + 可选 `model.json`。优先级 PROJECT `{workDir}/.universe-agent/agents/` > USER `{AgentHome}/agents/` > BUILT_IN（种子写入用户目录后可改/禁/重置，不可删）。合并在 UA 进程内 | gRPC `AgentService.ListAgentProfiles`（`project_path` 可选）/ `SaveAgentProfile` / `DeleteAgentProfile` / `ResetAgentProfile` | 列表、读/写 profile 目录，不是单文件 `.agent.md` persona |
| **Instructions** | 外仓 `ProjectRuleManager` / `ProjectRuleLoader`。注入位置是 Root system prompt 基础层，**不是** Memory | Global `{AgentHome}/rules/`；Project `{workDir}/.universe-agent/rules/` | **Local** `RulesBridge`（list/create/update/delete/preview/health × global/workDir = 12；另 `defaultAgentHome()` 共 13）。**Remote gRPC 不存在**：默认实现显式 `Unsupported`，禁止 REMOTE 时静默读写客户端本机 | 「总是注入的短规则」的 CRUD。Memory 不进本页 |
| **Hooks** | 外仓 AgentLoop `HookRegistry.fire*`（点位表在 UA `docs/systems/server/hook/points.md`）。外部钩子产品路径 `{AgentHome}/hooks.json`。进程内 SPI **不**改写成 Codex/Copilot `hooks.json` | `{AgentHome}/hooks.json`；插件 JAR/DEX 在 `{AgentHome}/plugins/`。**不是** `.github/hooks` 或 vscode task hook | **缺**「Hook 点位元数据」RPC。插件管理：`PluginService.List` / `Info` / `Enable` / `Reload` / `Unload`（Plugins 节 v1 延后） | 有 `ListHookPoints`（或握手点位表）且 Engine-backed 才展示点位 / 编辑定义。未补 RPC 或断连：**节空**，禁止用 `points.md` 或读 `{AgentHome}/hooks.json` 顶替 |
| **MCP Servers** | 定义 SSOT：Global = ConfigStore 键 `mcp.servers`（现网 `config.json`；产品叙事 `{AgentHome}/mcp-servers.json`）；Project = `{workDir}/.universe-agent/mcp-servers.json`（`servers[]` + `globalOverrides`，ADR-291） | 同上。vscode `.vscode/mcp.json` / 用户 `mcp.json` **不是** UA | gRPC `McpService.ListMcpServers` / `AddMcpServer` / `UpdateMcpServer` / `RemoveMcpServer` / `ToggleMcpServer`（`scope` = global\|project，`work_dir` 项目时必填） | **定义** CRUD + 启用。`GetMcpServerStatuses` / `GetMcpServerTools` = **运行态**，本页不做 |
| **Plugins** | 外仓 `HookPluginEngine`，≠ vscode Extension ≠ Copilot `~/.copilot/installed-plugins` | `{AgentHome}/plugins/` | `PluginService.*`；Local 模式 Singularity 标 UNSUPPORTED（「需要远端引擎」） | **v1 整节延后**。无引擎或 `plugins=UNKNOWN/UNSUPPORTED` → 隐藏或诚实空，禁止 Browse 进 Open VSX / Copilot 市场 |
| **Tools** | 两层：① 引擎内置工具目录 `ToolService.ListTools`；② **Profile 白/黑名单** `tools.json`（`tools` / `disallowedTools`），随 `SaveAgentProfile` 落盘。本机 **client-tool** 是 IDE 向引擎登记的客户端工具，接通后才存在 | `{profileDir}/tools.json` | `ListTools` / `ToolInfo` **无**独立 `SetToolEnabled` RPC；enablement 写 profile。client-tool 走会话流登记，不是本页「内置 Copilot CLI 清单」 | 按当前 profile 展示/改工具启用；无引擎则空。禁止 `COPILOT_CLI_TOOLS` 只读清单 |
| **Overview** | 无独立引擎资源 | — | 能力探测聚合 | **不在 donor Overview。** Engine 页无引擎写诚实空 + Test。不预填 Chat |
| **Prompts / Automations / Models / HarnessSettings** | 不在本页产品轨 | — | — | Prompts：UA 斜杠 = Skill catalog。Models/Provider/token → Engine pane。Harness = Copilot |

**CLIENT skill**（Singularity 应用数据 `skills/`）明确 **不进本页**：不进 `EngineSkillCatalogService`，不进 `sys_skill`。vscode 若扫到 `~/.cursor/skills` / CLIENT 目录，当作外生态，不得标成 UA catalog。

---

## 2. 能力探测 → 节显隐矩阵

模式对齐 UniverseAgent `EngineSettingsCapabilities` / `CapabilitySupport`：**SUPPORTED / UNSUPPORTED / UNKNOWN**，带 `reason`。IDE 必须实现等价探测，**禁止**在 `UNKNOWN` 时画假列表或假 Browse。

本页相关探测键。UA `EngineSettingsCapabilities` **已有** `skills` / `mcp` / `plugins` / `globalRules`（以及本页排除的 memory/token/galaxy/…）。**没有** `agentProfiles` / `projectRules` / `tools` / `hooksMetadata`（`agentProfiles` 在 UA 是 `BridgeCapabilities` 上的 Boolean，不是三态）。后四键是 **IDE 显隐矩阵**，由 vscode **本地推导**（已有 RPC 是否 UNIMPLEMENTED、Connect 是否成功等）。**禁止**为这四键扩展 Connect / handshake proto。`hooksMetadata` 在 `ListHookPoints` 出现前无握手字段。

| 探测键 | 对应节（Engine 页） | `SUPPORTED` | `UNSUPPORTED` | `UNKNOWN` | 无连接（profile 未选 / PRD-008 blocked） |
|--------|--------|-------------|---------------|-----------|------------------------------------------|
| `skills` | Skills | 引擎 list/toggle/body | 节在，正文诚实句（「当前引擎无技能 API」），**零假名** | 同 UNSUPPORTED，文案「正在确认引擎能力」；禁止用 Copilot 目录填空 | **Engine 页空 + Test**。donor 不扫盘当 catalog |
| `agentProfiles` | Agents | List/Save/Delete/Reset | 节在，空 + 原因 | 同左 | 同上 |
| `globalRules` + `projectRules` | Rules（Instructions） | Local：可读可写本机 AgentHome / workDir。Remote：今天 UA 即 UNSUPPORTED | 空 + 原因；**禁止** REMOTE 时写 vscode 工作区盘假装改了引擎 | UNKNOWN 不画规则名 | 同上 |
| `hooksMetadata` | Hooks | 能拿到点位表 | 节在，列表空，不列 vscode task 事件 | 同 UNSUPPORTED | 同上 |
| `mcp` | MCP Servers | 定义 CRUD | 节在，空；不可声称已连引擎 | 不画假服务器、去掉 Browse | 同上 |
| `plugins` | Plugins | 以后切片 | **v1 隐藏或诚实空** | 隐藏或空 | 隐藏或空 |
| `tools` | Tools | ListTools + 当前 profile `tools.json` | 空，不列 Copilot CLI 名 | 空 | 空 |

**聚合规则（已拍板）：**

1. 任一键 `UNKNOWN`：**该节不渲染假条目**。Browse / 市场按钮直接去掉。  
2. `UNSUPPORTED`：节可以留在左 nav（父方案「节可在，内容诚实空」），但计数为 0。  
3. Memory browse / Galaxy / Gateway：**本 catalog 表永远不探测来决定显隐**。Provider/Model 运行时在同一 Engine pane 的另一分组，不走本表。
4. vscode `IMcpService` 已连接若干 `.vscode/mcp.json` 服务器 **不得**把 `mcp` 探测抬成 `SUPPORTED`。那是 IDE MCP 运行时，不是 UA 定义面。

探测失败必须分开：**能力三态** `SUPPORTED|UNSUPPORTED|UNKNOWN`（UA `CapabilitySupport`）vs vscode **传输失败**（计划中的 IDE 态，**不是** UA `Failed`）。**禁止** `catch → emptyList()` 当成「引擎说你有 0 个技能」。

无引擎映射（勿与 UA `deriveEngineSettingsCapabilities` 混）：PRD-008 未接通 → vscode **一律按无列表渲染**（Engine 空 + Test）。UA 侧 `profile==null` → `UNKNOWN`、`!bridgeAvailable` → `UNSUPPORTED` 是外仓公式；IDE 不要用 Stub 列表去填 `UNKNOWN`。

---

## 3. 最小协议（Engine-backed 消费面）

下列是 **已接引擎且对应能力 SUPPORTED** 时，Engine 页成真所需的最小 RPC 面。名称用 UA 已有 RPC；缺口单独标「须补」。**禁止**把本节当成断连 Stub 读写 `{AgentHome}` 的许可。UA **Local** = 已接本机引擎的文件面，≠ 断连 IDE Stub。

### 3.1 Skills：list + toggle + body

| 操作 | 最小契约 | 已有 | IDE 语义 |
|------|----------|------|----------|
| 列表 | 每条：逻辑 `name`、`description`、`source` ∈ `{bundled,user,project}`、`enabled`、`slash_enabled`、`contentPath` 不向 UI 暴露为可拼路径 | `ListSkills`。Local 已 `setSource` 为 bundled/user/project。未知 wire 当 unknown，不映射 Copilot local/user/extension | 按 scope 分组。BUNDLED 只可 disable，不可删、不可覆盖安装 |
| 启停 | `SetSkillEnabled(skill_name, enabled)` → 写对应 scope manifest，抬 catalog generation | 已有。损坏 manifest → `FAILED`，不得当空清单覆盖 | 开关打到引擎 catalog。UI 必须同时展示 §5 冻结文案 |
| 正文 | `SkillInfo(skill_name)` → `content`（读，经 `entry.contentPath`，INV-SKILL-PATH-1）；写经 `SaveSkillContent` → IDE `saveSkillContent?` | 读：已有。写：UA RPC 已有；**IDE node 传输待槽 A**（@ HEAD UI + common 契约 @ `f3f2d366`，未接线时 Save 隐藏） | @ HEAD：**UI 已落**—textarea 预览/编辑 USER/PROJECT；BUNDLED 只读；断连/`UNSUPPORTED` 不渲染。**不得**写「写路径已通」直到 node 挂接 |
| 新建 | 落盘 `{scopeRoot}/{name}/SKILL.md`（唯一合法布局）。无 manifest 行时 USER/PROJECT **opt-in**：`frontmatter.enabled == true` 才进入 catalog，禁止「丢文件即启用」 | 无独立 Create RPC。**仅 Engine-backed**：经 catalog/install 或约定「写文件后 ListSkills 刷新」（写发生在 UA Local 文件面，由已接引擎执行）。**禁止**断连 IDE 写 `{AgentHome}` | New 只在 E1+Engine-backed；目标目录是 UA 路径，不是 `.github/skills` |

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
| 列表 | global / project 两条 scope；记录含 id、title、body、enabled、priority；`globs` / `appliesTo` 在 `ProjectRuleRecord` 上可读。Local `create*`/`update*` **不写** globs/appliesTo | Local `RulesBridge` |
| 读写 | CRUD + prompt preview + health | Local 已有 |
| Remote | 与 Local 同形状的 gRPC | **须补**。未补之前探测 = `UNSUPPORTED`。禁止用工作区 `.github/copilot-instructions.md` 顶替 |

### 3.4 Hooks 元数据

| 操作 | 最小契约 | 已有 |
|------|----------|------|
| 点位表 | 只读：id、阶段（before/after）、分类（Turn/Llm/Tool/Permission/Lifecycle/…）、是否可取消/改写。与 AgentLoop `fire*` 一一对应 | **须补** `ListHookPoints`（或引擎握手里带版本化点位表）。未补或断连：Engine Hooks **空**。禁止用 `points.md` 文档副本填列表 |
| 定义 list | 外部钩子条目（命令、事件名须映射到 UA 点位，而不是 `onSave`/`task`） | 无 RPC。**仅 Engine-backed** 经已接引擎的 Local 文件面（或后续定义 RPC）。**禁止**断连 IDE 读 `{AgentHome}/hooks.json` |
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
| Handshake | UA **已有**键 `skills` / `mcp` / `plugins` / `globalRules` 走现网探测（`GrpcCapabilityProbe` + UNIMPLEMENTED 降级）。`projectRules` / `agentProfiles` / `tools` / `hooksMetadata` 是 **IDE 矩阵**，本地推导，**不**加 proto 字段 | Singularity 已有 UA 键探测。**vscode 侧无等价物，须补 IDE 推导**。Connect 广告的是 `ConnectResponse.capabilities.methods`（**没有** proto 字段 `supported_methods`） |

未接通引擎：Engine 页不画 catalog 列表（不是「0 个技能所以 SUPPORTED」）。

---

## 4. 断连 vs 假同步

**与 [settings-two-surfaces.md](settings-two-surfaces.md) 同一句：** 无引擎时 **Engine 页不扫盘**（诚实空 + Test）。donor 编辑器不是 catalog。旧「Stub 允许扫 UA 盘」表 **废除**，不是改成 H1 产品路径。下表仅列假同步红线。

| 节 | 无引擎时 Engine 页 | 假同步（禁止，即使文件碰巧存在） |
|----|-------------------|-----------------------------------|
| Skills | 空 | 扫描 `~/.copilot/skills`、`.github/skills` 并标成 UA；把本地开关说成 `SetSkillEnabled`；把空目录说成「引擎返回 0」 |
| Agents | 空 | `.github/agents`、`~/.copilot/agents` persona 当 Profile |
| Rules | 空 | `.github/copilot-instructions.md` 当引擎规则 |
| Hooks | 空 | vscode task / Copilot hook 事件当 AgentLoop 点位 |
| MCP | 空 | `.vscode/mcp.json` / `IMcpService` 当 UA 定义或已同步 |
| Plugins | 隐藏或空 | Browse Open VSX / Copilot plugin |
| Tools | 空 | `COPILOT_CLI_TOOLS` |

**判定句：** 用户若在未连接 UniverseAgent 时看到「已与引擎同步 / Copilot Agent Host / 来自 Copilot CLI」任一措辞，失败。

---

## 5. 会话冻结技能：开关 ≠ 热切换

引擎契约（skills INDEX）：

- **Catalog / 正文 / `sys_skill` / List\***：单一 versioned snapshot；install/toggle 抬 generation 后 **下一读**刷新。  
- **Root `<available_skills>`**：`AgentLoopFactory` 组装时快照，**活跃会话不热切换**。

因此 Engine 页把某个 skill 打开：

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
H0（donor：去 Copilot 文案 / Overview 去预填 / 不画 Tools CLI）
  → H1（donor：Skills/Agents 列表 vscode 化，禁止 Stub catalog）
      → H2（donor：Instructions/Hooks 去 Copilot 语义）
      → H3（donor：MCP 去 Copilot 源，去掉 Browse）
          → E1（PRD-008 后：Skills list/toggle 在 ua.engine）
```

- H0–H3 **可以**在无引擎时做；只动 donor chrome，**遵守 §4（Engine 页不扫盘）**。H1 **不得**把 `IPromptsService` 扫描根改到 `{AgentHome}` / `.universe-agent`。  
- **E1 部分已落** @ `8bfc299e`/`4833c008`/`f49615a1`/`9419f583`/`f3f2d366`：**Skills** list/toggle + **正文编辑器 UI**（`f3f2d366`；`saveSkillContent?` 契约已落、node 传输待槽 A）；**Agents / MCP / Tools List**（MCP toggle enablement）；**Agents Save/Delete/Reset**、**MCP Add/Update/Remove**、**Tools profile 启用集**（`SaveAgentProfile` + `engineToolProfile.ts`）；**Agents `AGENTS.md` 全文编辑器** @ `9419f583`/`3756d04e`。**未落**：Skill **新建** UI、SaveSkillContent node 传输、MCP 运行态、Plugins；§8.3 六条验收 + 断开诚实空仍待 PRD-008 隔离 profile 冒烟。  
- Plugins 整节不在 H1–E1。

### 8.2 H1 — donor chrome 卫生（不是 Engine catalog 交付）

H1 交付物 = donor 列表 vscode 化（卡→`WorkbenchList`、去 Copilot 文案），**禁止** Stub catalog、**禁止**改扫描根到 UA 盘。

约束（不是 H1 交付物）：无引擎时用户打开 **Engine pane** 看到诚实空 + Test。**不要**打开 Customizations Overview 去扫 `{AgentHome}` / `.universe-agent`。

PRD-008 接通 **且** `skills=SUPPORTED` **之前**：Engine 页无 catalog（空 + Test）。donor 与 Engine 页都 **不得**标 Stub catalog。

新建技能的 UA 路径约定留给 E1。

### 8.3 E1 验收（产品语言，禁止「某 class 接上了」当成功）

**代码已落（部分）：** @ `8bfc299e` Skills list/toggle；@ `4833c008` Agents/MCP/Tools **List**（MCP toggle only）；@ `f49615a1` Agents Save/Delete/Reset、MCP 定义 CRUD、Tools profile 启用集（`SaveAgentProfile`）；@ `9419f583`/`3756d04e` Agents **`AGENTS.md` 全文编辑器**；@ `f3f2d366`/`3e986bde` Skills **正文编辑器 UI**（textarea + Save 形状、读 `SkillInfo`、USER/PROJECT 可编/BUNDLED 只读、断连/`UNSUPPORTED` 不渲染；common `saveSkillContent?`，**node 传输未挂接**）。**未落：** Skill **新建** UI、SaveSkillContent node 传输、MCP 运行态、Plugins；§8.3 产品验收与隔离 profile 冒烟仍待 PRD-008 证据。

在 **UniverseAgent 已连接** 且 `skills=SUPPORTED` 时：

1. Skills 列表与引擎 catalog 一致：能看到内置（bundled）、用户、项目三组；名字来自引擎，不是 vscode 扫盘猜的。  
2. 关掉一个 USER/PROJECT 技能后，再打开本页或刷新，开关状态仍是关；引擎侧 `ListSkills` 的 `enabled` 为 false。损坏的 manifest 不会被静默当成「全部关闭成功」。  
3. 打开技能正文，预览的是引擎经 catalog 读出的 SKILL.md，而不是旁路打开了 `~/.copilot/skills/...`。  
4. 开关旁有冻结说明；用户改开关后，**当前已打开的对话**技能表不变，新对话才变。  
5. 断开引擎后，Engine 页回到 **诚实空 + Test**，**不再**显示刚才那次 RPC 的缓存并写「已同步」。禁止回成 Stub 磁盘 catalog。  
6. `skills=UNSUPPORTED` 或探测失败时：无假技能名，无 Copilot 回填。

未满足任一条，E1 不算完成。`SetSkillEnabled` 调用成功但 UI 仍扫 Copilot 路径，不算完成。

---

## 9. 协议缺口汇总（给引擎仓 / PRD-008 接线）

vscode 本页 **消费** 下列面；缺的由 UniverseAgent 补，IDE 不得用 Copilot 盘伪造。

| 缺口 | 严重度 | 说明 |
|------|--------|------|
| vscode 无能力探测 | 阻塞 E1 | UA 已有键 `skills`/`mcp`/`plugins`/`globalRules` 做三态；其余四键 **IDE 本地推导**，不扩 proto。UNIMPLEMENTED ≠ 空列表成功 |
| Rules Remote gRPC | 阻塞 Remote 下 Instructions 成真 | 现网 `RulesBridge` 默认 Unsupported；未补之前 REMOTE 诚实空 |
| Hook 点位元数据 RPC | 阻塞 Hooks「来自引擎」 | 未补则 Engine Hooks **空**。禁止 `points.md` 文档副本或读 `{AgentHome}/hooks.json` 顶替 |
| `ListSkills.source` | 非缺口 | Local 已 `setSource` 为 bundled/user/project。IDE 消费当前 wire；未知值当 unknown，不映射 Copilot local/user/extension |
| 独立 CreateSkill RPC | E1 新建技能 UI | Skill **新建** UI 未在本 slice |
| `SaveSkillContent` IDE node 传输 | E1 正文写到引擎 | common `saveSkillContent?` + UI @ `f3f2d366` 已落；**node gRPC 待槽 A**；禁止只写 vscode 工作区却声称 catalog 已收 |
| `SetToolEnabled` | 不强制 | 用 `SaveAgentProfile`/`tools.json` 即可；Tools 节不要再发明第三套开关存储 |
| MCP 运行态 | 非本页 | 不要为了填列表去调 Status/Tools |
| AHP 定制资源 | 永久非权威 | 不把 agent-host 文件提供者升级成 UA adapter |

---

## 10. 与产品目录的关系

| 锚点 | 本文约束 |
|------|----------|
| two-surfaces §2 余量表 | catalog 只在 `ua.engine`；无引擎整页空 + Test |
| host-ui donor | 只剥 Copilot 文件 chrome |
| E1 | §5 + §8.3：list/toggle 在 `ua.engine`，不暗示热切换 |

空态须区分：断连诚实空、UNSUPPORTED、UNKNOWN、真 0 条。**不要**把断连画成 Stub catalog。

UA **Local**（已接本机引擎的文件面）≠ 断连 Stub catalog。Local I/O 只在 Engine-backed。

宿主 UI 详稿只消费本表的节显隐与空态原因字符串，不另造数据源。

## 11. 审查记录（规则 16）

2026-09-01：三路并行 Cursor Grok 4.6 只读。本文件 **Approve with changes**。已当轮改入：无引擎 Engine 页不扫 Stub catalog；H1 走 `ua.engine` 空态；探测键与 handshake 字段、`ListSkills.source`、传输失败态按审查改口径。

2026-09-01 第二轮：**Approve with changes**。已改入：§8.1 DAG 的 H1 改为 donor 卫生（禁止 Stub catalog）；§8.2/§9 去掉「Customizations 里 Stub 可写」；E1.5 断连回诚实空而非 Stub；§10 改锚 two-surfaces 余量表；UA Local ≠ 断连 Stub。

2026-09-01 第三轮（engine）：**Approve with changes**。Round-2 点名位置 gone。已改入：§3 去掉 Stub→真的 / Local Stub I/O；§8.2 标题改为 donor 卫生；断连禁止扫 AgentHome；§1 禁止移植 Kotlin catalog；Hooks 未补 RPC 则空；四探测键为 IDE 矩阵不扩 proto。

2026-09-01：**签收** `accepted`。E1 blocked PRD-008。未改 `src/`。
