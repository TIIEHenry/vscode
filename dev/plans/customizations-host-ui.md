---
title: "Agent Customizations 宿主 UI：按 vscode 重排各节"
type: plan
status: accepted
phase: N/A
updated: 2026-09-01
summary: "已签收：文件编辑器 donor chrome；剥 Copilot 营销；零件可拆进 Engine 页；H0–H3 ReadyToImplement"
---

# Agent Customizations 宿主 UI

> **产品目录 SSOT：** [settings-two-surfaces.md](settings-two-surfaces.md) — 主设置页是 **本地 Client** 与 **Engine**；本编辑器是文件工具 donor，**不是**第三套主设置。  
> **本文件职责：** 若打开 `AICustomizationManagementEditor`，页内 chrome / 空态 / vscode 控件 / 要剥的 Copilot 脸。不写引擎 RPC。零件拆进 Engine pane 时必须落在 vscode Preferences 密度上。  
> **C5：** 目标 TOC → `aiCustomization.openManagementEditor`。HEAD 仍打开 `ua.customizations` pane。**不要**包进 `openUaPaneReplacingClientSettings`；也不要求先关 Client Settings 模态（`RequiresModal` 由 `editorGroupFinder` 接管，可能同组两个 tab）。删除 pane Open Action 见 two-surfaces。  
> **视觉：** 与 vscode Settings / Preferences **同一张脸**（workbench token）。禁止 Singularity 卡、Copilot 营销卡栅。  
> **范围窗：** 默认窗（`isSessionsWindow === false`）。

**Goal：** 剥 Copilot 营销 Overview / Browse / CLI 工具清单，改成 vscode 左 nav + 列表 + markdown 预览。无引擎时本页只列/空着本地文件，**不**画 catalog；诚实空 + Test 在 Engine 页。**不要**把这只编辑器当成 Skill/Agent 产品首页。

本稿 `accepted`（2026-09-01）。规则 16 三轮 Grok 4.6（Opus 不可用）。第三轮 Approve with changes 已改入。**ReadyToImplement：** H0–H3 donor chrome（不改扫描根）。E1 不在本文件。

## 0. 已拍板约束（本文件不重开）

| 约束 | 选定 |
|------|------|
| 宿主 | 继续 `AICustomizationManagementEditor` + `AICustomizationManagementEditorInput`（`RequiresModal`）。禁止新 Part、禁止独立 `SettingsScreen` |
| 布局语法 | **vscode 同一张脸。** 左 `WorkbenchList` + 右内容；文件节 list + monaco/markdown；MCP 定义列表+详情。workbench CSS 变量，与 Settings/Preferences 同密度 |
| 禁止视觉 | Singularity Settings 卡、Material 彩色圆标大卡、Copilot Overview 营销卡栅、Ocean/Snow |
| 标题 | 禁止停留在 `Copilot [Agent Host]` / `Agent Customizations - Copilot` |
| Overview 输入 | 禁止「Customize Your Agent」预填 Chat / `/init` |
| Plugins | v1 默认窗 **`managementSections` 删除** `plugins`（只藏左 nav 仍会构造 `PluginListWidget`）。深链诚实空。禁止 Browse 进 Copilot / Open VSX |
| Tools | 禁止 `COPILOT_CLI_TOOLS`。默认窗 **不画** Tools 节（HEAD 已藏）。产品 enablement 在 Engine 页 |
| 默认窗不进产品轨 | TypeScript 枚举可留。默认窗 `managementSections` **数组必须去掉** `prompts` / `harnessSettings` / `models`（contributed 含 harnessSettings：只藏 nav 仍会建 container）。`automations` 左 nav 不画 |
| 截图底栏 | `+ Agent` / `Auto` / `Autopilot` / `Detailed permissions` 是 **Conversation Dock**，不是本编辑器。剥离走 M5 / INV-NO-COPILOT。本页只记 **out of scope** |
| 无引擎 | donor 列出的是文件，不是 catalog。禁止假技能名、假 Featured MCP、假工具组 |
| OpenEditor | HEAD `f1: true` + `IsSessionsWindowContext`。**保持**（Palette 仍注册、默认窗隐藏）。TOC 用 `executeCommand`，不靠 precondition。禁止为 TOC 去掉 Sessions 门 |

引擎 list/toggle 在 [customizations-engine.md](customizations-engine.md) + **Engine pane**。本文件遇到引擎门控一律 **不要在本编辑器画 catalog**。

## 0b. 余量（禁止第三套主设置）

| 本编辑器可以做 | 必须在 `ua.engine`、本文件不做产品面 |
|----------------|--------------------------------------|
| 剥 Copilot 标题/营销卡/Browse/CLI 清单 | Skill catalog / enable |
| 列表+预览 **普通文件**（含用户从 Engine 行打开的 UA md） | Agent Profile catalog |
| MCP **vscode 本地定义文件**（不得写已连引擎） | 引擎 MCP 定义 CRUD、引擎工具 enablement、Hook 点位表 |

HEAD 默认窗 Local harness **隐藏 Tools**（`hiddenSections`）。本文件 **不要**把 Tools 加回左 nav。产品 Tools 在 Engine 页。

默认窗 `managementSections` **去掉** `plugins` / `prompts` / `harnessSettings` / `tools`（隐藏左 nav 不够，仍会构造 `PluginListWidget`）。

## 1. 目标 chrome（ASCII）

壳不变：Preferences 模态 Editor（compact header）→ 左 sidebar + sash + 右 content。三态只换右栏。

### 1.1 Overview（着陆，无节选中）

```text
┌ Agent Customizations                              [链接] [x] ┐
├──────────────────┬───────────────────────────────────────────┤
│ Overview      ●  │  File customizations                      │
│ Agents           │  Edit markdown files. Skill / Agent       │
│ Skills           │  catalogs live in Engine settings.        │
│ Instructions     │                                           │
│ Hooks            │  Sections                                 │
│ MCP Servers      │  Agents          Profile markdown…        │
│                  │  Skills          Skill files…             │
│                  │  Instructions    Rules files…             │
│                  │  Hooks           Hook files…              │
│                  │  MCP Servers     Local MCP definitions…   │
└──────────────────┴───────────────────────────────────────────┘
```

Overview **不是** Engine catalog 着陆：无 sparkle 卡、无预填输入。节跳转若保留，只打开 **文件列表**（donor），文案不得写「引擎 catalog / until E1」。产品 Skill/Agent 去 Engine pane。

### 1.2 文件节（Agents / Skills / Instructions / Hooks）

```text
┌ Agent Customizations                              [链接] [x] ┐
├──────────────────┬───────────────────────────────────────────┤
│ Overview         │  Skills                                   │
│ Agents           │  Reusable skill files for this workspace  │
│ Skills        ●  │  and your user profile.                   │
│ Instructions     │  ┌ Search…                      [New] ┐   │
│ Hooks            │  │ Workspace                          │   │
│ MCP Servers      │  │   (empty: honest copy, no fakes)   │   │
│                  │  │ User                               │   │
│                  │  │   (empty)                          │   │
│                  │  └────────────────────────────────────┘   │
│                  │  选中一行后右栏切到 markdown 预览/编辑     │
│                  │  （同一模态，不新开 Part）                 │
└──────────────────┴───────────────────────────────────────────┘
```

有文件时：分组头（Workspace / User）+ 行（名、路径）。**不要**把 enable checkbox 当引擎 catalog 开关（那是 Engine 页）。点行 → embedded editor。无文件：列表空，不画假行。

### 1.3 MCP（定义面，非运行态）

```text
┌ Agent Customizations                              [链接] [x] ┐
├──────────────────┬───────────────────────────────────────────┤
│ Overview         │  MCP Servers                              │
│ Agents           │  Definitions in this workspace / user     │
│ Skills           │  profile. Not live engine tools.          │
│ Instructions     │  ┌ Search…                       [Add] ┐  │
│ Hooks            │  │ Workspace                          │   │
│ MCP Servers   ●  │  │   my-server     mcp.json           │   │
│                  │  │ User                               │   │
│                  │  │   (empty)                          │   │
│                  │  └────────────────────────────────────┘   │
│                  │  无 Featured / Browse Marketplace         │
│                  │  点行 → 现有 MCP 定义详情（配置/启用）     │
└──────────────────┴───────────────────────────────────────────┘
```

无本地 `mcp.json` 定义：诚实空，**不**用 gallery snapshot 填三张 Featured。与引擎是否接通无关。

## 2. 全局 chrome 改造

### 2.1 标题

| 现状（截图 / HEAD） | 选定 |
|---------------------|------|
| 模态名截图 `… Copilot [Agent Host]`；**默认窗 HEAD** `getName()` = `Agent Customizations - Local`（core descriptor `Local`） | 默认窗固定 **`Agent Customizations`**，去掉 `- Local` / Copilot / Agent Host |
| `EditorInput.setTargetLabel(harnessService.getActiveDescriptor().label)` 拼出 `- Copilot` | 默认窗 **不要**把 Copilot / Agent Host / 回退 `"Local"` 写进标题 |
| Overview `h2` 已是 `Agent Customizations`，但截图大标题仍带 Copilot | Overview 大标题与模态名同一字符串，不再重复 harness |

引擎真正连上之后本文件仍不改标题成商品名。副文案不要写 Engine catalog 空态（那是 Engine pane）。

改点：`AICustomizationManagementEditorInput.getName()` 的 target 后缀；`updateHarnessLabelPresentation()` 默认窗不再 `setTargetLabel` Copilot 描述符。

### 2.2 左 nav

| 现状 | 选定 |
|------|------|
| 顶上独立 `sidebar-home-button`（Overview）+ 下面 `WorkbenchList` **不含** Overview | Overview 收进 **同一只** `sectionsList`（`WorkbenchList<ISectionItem>`）作第一行，选中态与其它节同一 renderer。删掉 harness 风格 home 按钮 |
| HEAD `managementSections` 默认窗含 Plugins, MCP, Skills, Instructions, Agents, Hooks, Tools, Prompts, HarnessSettings；Local harness **`hiddenSections` 含 Tools** | 默认窗可见序：**Overview · Agents · Skills · Instructions · Hooks · MCP Servers**。**不要**把 Tools 加回左 nav（HEAD 已藏）。`managementSections` **删除** plugins / prompts / harnessSettings / tools，否则仍会构造 widget |
| harness `hiddenSections` 再滤一层 | 保留机制；默认窗产品轨额外 **永不画出** Prompts / Automations / Models / HarnessSettings / Plugins |
| 侧栏 count 徽章 | 可保留；0 不营销 |

Overview 选中 = 今日 `selectedSection === undefined` + `showWelcomePage()`。不要给 Overview 新枚举值；`AICustomizationManagementSection` 保持 HEAD 字符串。

### 2.3 默认窗节显隐（对照 HEAD 枚举）

`AICustomizationManagementSection`（`aiCustomizationWorkspaceService.ts`）：`agents` `skills` `instructions` `prompts` `hooks` `automations` `mcpServers` `plugins` `models` `tools` `harnessSettings`。

| 节 | 默认窗左 nav | 备注 |
|----|----------------|------|
| Overview | 有（welcome，非枚举） | 文件工具着陆，不是 Engine catalog |
| Agents / Skills / Instructions / Hooks / MCP | 有 | 文件列表+预览，§3 |
| Tools | **无**（保持 harness 隐藏；并从 `managementSections` 去掉） | 产品面在 Engine 页 |
| Plugins | **无**；从 `managementSections` 去掉（只藏左 nav 仍会挂载 Browse） | 深链 → 诚实空 |
| Prompts / Automations / Models / HarnessSettings | **无** | 不进默认窗产品轨。禁止挂 `ChatModelsWidget` |

### 2.4 从整页剥掉的 Copilot chrome

- Overview `showGettingStartedBanner` / `prefillChat` / 「Sent to chat」
- Voice Mode / Dictation 「Other Customizations」卡（`CONFIGURE_VOICE_INSTRUCTIONS_ACTION_ID` 等）
- Copilot prompt→skill「Needs Attention」迁移栅与侧栏 `sidebar-migration-shortcut`（不是 UA 迁移；仅当未来 UA catalog 真有可迁文件再开，文案对 Skill 不对 Copilot）
- 各节 `learnMore` 外链 `code.visualstudio.com/docs/agent-customization/...`（Copilot 文档）。无本仓 UA 手册 URL 则 **不画 Learn more**，禁止换成 GitHub Copilot 文档
- MCP Featured gallery、Plugins/Tools「Browse Marketplace」
- Tools `AGENT_HOST_COPILOT_CLI_SESSION_TYPE` + `COPILOT_CLI_TOOLS`
- List「Generate with AI」走 Chat / `generateCustomization`（默认窗产品对话是 `CONVERSATION_PART`，不是 Chat 视图）

## 3. 分节：零件处置 + 空态

图例：**保留壳** = 仍在这只编辑器里；**复用零件** = 继续用现有 widget，换文案/数据/显隐；**替换呈现** = 同一文件内丢掉营销卡网，改用列表/链接行；**剥离** = 删除或永不渲染。

空态句式对齐 `registerViewWelcomeContent`：短标题 + 一行原因 + 可选「去哪」；不画插画、不列假条目。

### 3.1 Overview

| | |
|--|--|
| 宿主 | 保留 `AICustomizationWelcomePage` 包装；实现仍是 `PromptLaunchersAICustomizationWelcomePage` |
| 「Customize Your Agent」输入 | **剥离**（`welcomePageFeatures.showGettingStartedBanner` 默认窗恒 false，或删掉该 DOM） |
| 7 张 `welcome-prompts-card` 营销栅 | **替换呈现**：Settings 式链接行（`selectSection`）。Codicon 小图标可留，禁止彩色 tile |
| 卡上文案 | 改造：去掉 Copilot marketing（「Create specialized agents…」等）。每行一句产品事实，见下表 |
| Voice/Dictation | **剥离** |
| 迁移卡 | 默认窗 **剥离** |
| 无引擎 | 着陆说明文件工具；**不要**写 Engine not connected 六节 catalog。链到 Engine settings 用 Settings 式一行链接即可 |

链接行 copy（英文 UI 源串）：

| 节 | 行描述 |
|----|--------|
| Agents | Agent profile markdown files. Catalog is in Engine settings. |
| Skills | Skill markdown files. Catalog is in Engine settings. |
| Instructions | Rules markdown files. |
| Hooks | Hook definition files. |
| MCP Servers | Local MCP definition files (not live engine tools). |

禁止 Overview 再做第二套 Conversation。

### 3.2 Agents → Agent Profile

| | |
|--|--|
| 列表 / New / 点开 md | **复用** `AICustomizationListWidget` + 编辑器内 `CodeEditorWidget` + `IMarkdownRendererService` 预览 |
| 呈现 | HEAD `usesCustomizationCardLayout(Agents) === true` 走 `CustomizationCardListController`。**替换呈现为 `WorkbenchList`**（widget 内已有 list 路径）。分组头继续 Workspace / User |
| 文案 | 去掉 persona/Copilot。标题 **Agents**。说明：Agent profiles (`AGENTS.md` + `tools.json`) for this workspace or your user profile. |
| Learn more | 去掉 vscode Copilot 文档链 |
| New | 只留 **Manual New**（现有 `NEW_AGENT_COMMAND_ID` / `onDidRequestCreateManual`）。剥离 AI-guided `onDidRequestCreate` |
| 路径/元数据 | H0 只改正文案与卡→列表。catalog 权威在 Engine 页；本编辑器只当普通文件打开 |
| 工具白名单 | 本编辑器最多预览已打开的 `AGENTS.md`。`tools.json` enablement 在 Engine 页 |
| Copilot agent 市场 | **剥离** |
| 空态 | 标题 `No agent files yet`。副句：`Create a markdown file. Agent profiles are managed in Engine settings.` **禁止**填 Copilot persona 名 |

### 3.3 Skills → 技能**文件**（不是 Engine catalog）

| | |
|--|--|
| 列表 / New / SKILL.md | **复用** `AICustomizationListWidget`；卡→`WorkbenchList` 同 Agents |
| 文案 | 去掉 Copilot loads。改为：Skill markdown files. Engine catalog is in Engine settings. |
| enable 开关 | **不要**当引擎 catalog toggle |
| Skill 商店 / Browse | **剥离** |
| 空态 | `No skill files yet` / `Add a skill markdown file.` **禁止**假技能名 |
| 路径 | 禁止扫 `~/.copilot/skills` 冒充 UA。可列工作区普通文件；**不要**标 Stub catalog |

### 3.4 Instructions → 规则

| | |
|--|--|
| 列表 / New / md | **复用** list + preview；卡→列表 |
| 产品意图 | 保留「总是注入的短规则」 |
| 文案 | 去掉「teach Copilot about your codebase」。改为：Always-on rules for this workspace or your user profile. |
| 空态 | `No instructions yet` / `Add a rules file.` Engine-backed rules 在 Engine 页 |
| Memory | **不**出现。不增加 Memory 节 |
| H2 | 语义对 UA global/project rules；禁止 UI 声称 `.github/copilot-instructions.md` 已是引擎权威 |

### 3.5 Hooks → AgentLoop hook

| | |
|--|--|
| 列表 + 编辑定义 | **复用** list + preview；卡→列表 |
| 文案 | HEAD「saving files or running tasks」是 vscode 任务钩子。改为：Hook definition files for the agent loop (message / tool / permission lifecycle). |
| New | 可建本地 hook 文件。点位下拉若只有 Copilot/vscode task 事件则 **隐藏下拉**（点位表在 Engine 页） |
| 空态 | `No hook files yet` / `Add a hook definition file.` |
| H2 | 去 Copilot 任务钩子文案。live 点位表不在本编辑器 |

### 3.6 MCP Servers

| | |
|--|--|
| 定义列表 + 点开详情 | **复用** `McpListWidget` + `EmbeddedMcpServerDetail` |
| Browse / Featured gallery / `queryGallerySnapshot` | **剥离**（H3）。无 UA 商店则按钮不存在，不写「不可用」假市场 |
| Add | 保留 vscode MCP **定义**添加（工作区/用户 `mcp.json` 流）。这是定义 CRUD，不是商店 |
| Copilot 扩展源分组 | **剥离**（`isCopilotExtension` 那路不要在默认窗当「已安装 MCP」推销） |
| 运行态（已连引擎的 live 工具） | **不在本页** |
| 有本地定义 | 列出 vscode `mcp.json` 文件定义；状态文案不得写 Connected to engine |
| 无本地定义 | `No MCP servers yet` / `Add a server definition for this workspace. Featured marketplace servers are not available.` |

### 3.7 Plugins（v1 延后）

| | |
|--|--|
| 左 nav | **无**；从默认窗 `managementSections` **删除** `plugins`（只藏 nav 仍会构造 Browse） |
| `PluginListWidget` / `EmbeddedAgentPluginDetail` | 默认窗不挂载。深链 `openManagementEditor({ section: 'plugins' })`：**不构造 widget**；右栏一句不可用即可，无 Browse、无 `PluginMarketplaceSnapshotModel` |
| 深链（节未构造） | `Plugins are not available.` / `This editor does not manage engine plugins.` **不要**写 until-engine catalog |
| Browse Marketplace | **剥离** |

### 3.8 Tools

| | |
|--|--|
| HEAD | `ToolsListWidget(AGENT_HOST_COPILOT_CLI_SESSION_TYPE)` 画出只读 `copilot-cli` 组（bash、apply_patch、…）+ 默认窗 Browse Marketplace |
| 选定 | **默认窗不构造、不展示** Tools（保持 harness 隐藏并从 `managementSections` 去掉）。产品 enablement 在 `ua.engine` |
| Copilot CLI 清单 | **剥离**（不实例化即达标） |
| Browse / `GalleryItemRenderer` | **剥离** |
| 有引擎后 | **不在本编辑器**。列表零件可拆到 Engine pane |

## 4. H0–H3 UI 验收（donor chrome，不是 Engine catalog）

E1 / catalog 不在本页。

### H0 — 去 Copilot 脸；不要加回 Tools

- 模态标题是 `Agent Customizations`，不含 Copilot、Agent Host、Local。
- Overview 无「Customize Your Agent」输入，无预填 Chat，无营销卡栅，无 Voice/Dictation。
- 左 nav：**Overview · Agents · Skills · Instructions · Hooks · MCP**。无 Tools / Prompts / Models / HarnessSettings / Plugins。`managementSections` 不含 plugins/tools/prompts/harnessSettings。
- DOM 无 `apply_patch` / `copilot-cli`。Chat `ViewTitle` Open Customizations 默认窗须藏（M5）。
- 截图底栏 Auto / Autopilot / Detailed permissions **未**出现在本编辑器内（若仍在窗口底，属 Dock / M5，不记本切片失败）。
- 无假技能名、无 Featured MCP 三卡。

### H1 — 文件列表 vscode 化（不是 Stub catalog）

- 两节卡布局改为 `WorkbenchList` 分组（Workspace / User）。
- 文案不再含 Copilot。New 为 Manual；无 Generate with AI。
- 仍扫 `~/.copilot/skills` 冒充 UA → 失败。
- **不**做引擎 enable / Stub catalog。

### H2 — Instructions / Hooks 换 UA 语义

- Instructions 空态/说明不再 teach Copilot；不出现 Memory 节。
- Hooks 说明指向 agent loop，不指向 save-file / run-task。
- 无引擎：文件列表可空；不列出 Copilot/vscode 任务事件冒充 hook 点。

### H3 — MCP 定义去 Copilot 源；Browse 去掉

- 无 Browse Marketplace、无 Featured 组、无 gallery snapshot 填空。
- 默认窗 MCP 列表不含 github.copilot / github.copilot-chat 扩展源推销。
- 有本地 `mcp.json` 定义则列出；状态不写已连引擎。
- 点行仍进定义详情（`EmbeddedMcpServerDetail`），不进 live 工具运行态。

## 5. 非目标

- 新 Part、新 Preferences 子 pane、`CustomizationsPreferencesPane`（内页方案已要求删空 pane）
- 像素抄 Singularity Engine Settings / Compose 卡网 / 独立 SettingsScreen 路由
- 把 Navigator Agents 发现树并进本页
- Overview 第二套 Conversation、预填 `CONVERSATION_PART` 输入
- 本编辑器内做 Auto / Autopilot / Detailed permissions（M5 / Dock）
- Prompts / Automations / Models / HarnessSettings 进入默认窗左 nav
- Memory 节、Provider / Model Profile / Token / Gateway / Galaxy（Engine pane 或其它已钉宿主）
- MCP 运行态、UA 插件商店、Skill 商店
- 引擎 RPC / 协议缺口（另开引擎面详稿）
- 用 Copilot agent-host 磁盘布局对外写「已接引擎」
- 本文件实施或改 `src/`

## 6. 文件级：restyle vs replace（HEAD 名字，非实施任务单）

只提示「动哪只现成零件」。不在此写逐步 patch。

| 文件 | 处置 |
|------|------|
| `aiCustomizationManagementEditor.ts` | **保留壳**（`SplitView`、sidebar list、content 显隐、embedded editor）。改：默认窗节序/显隐、Overview 并进 `sectionsList`、去掉 harness 标题后缀、不构造 Models/Plugins/Tools Copilot CLI、关掉 migration shortcut |
| `aiCustomizationManagementEditorInput.ts` | **restyle 标题**：默认窗 `getName()` 不加 Copilot target |
| `aiCustomizationWelcomePage.ts` | **保留包装**；回调里默认窗 `prefillChat` 不再从 Overview 触发 |
| `aiCustomizationWelcomePagePromptLaunchers.ts` | **替换 Overview**：删输入与卡栅；链接行按 §3.1（无 Tools 行）；删 Voice/Dictation/迁移卡；副文案是文件工具，**不要** Engine not connected catalog |
| `media/aiCustomizationWelcomePromptLaunchers.css` | **restyle**：去掉 `.welcome-prompts-primary` / card grid；链接行用 settings 密度 |
| `aiCustomizationListWidget.ts` | **复用** `WorkbenchList` 路径；**关掉** `usesCustomizationCardLayout` 对 Agents/Skills/Instructions/Hooks（默认窗改走 list 非 `CustomizationCardListController`）；换 header/空态 copy；去掉 Copilot learnMore；去掉 AI create |
| `customizationCardList.ts` | 默认窗文件节 **不再作为主呈现**。Plugins 卡默认窗不挂 |
| `customizationGroupHeaderRenderer.ts` | **复用** Workspace/User 分组头 |
| `mcpListWidget.ts` | **复用** 已安装/本地定义列表 + search + Add；**剥离** Featured / gallery / Browse |
| `embeddedMcpServerDetail.ts` | **复用** 定义详情 |
| `pluginListWidget.ts` / `embeddedAgentPluginDetail.ts` | 默认窗 **不挂载**；深链空态即可 |
| `toolsListWidget.ts` / `embeddedExtensionToolsDetail.ts` | 默认窗 **不实例化**。禁止 `COPILOT_CLI_TOOLS` |
| `galleryItemRenderer.ts` | 默认窗产品轨 **不用** |
| `aiCustomizationWorkspaceService.ts`（browser） | 默认窗 `managementSections` **仅**文件节（agents/skills/instructions/hooks/mcpServers）；**删除** plugins/tools/prompts/harnessSettings。`showGettingStartedBanner: false` |
| `ChatModelsWidget`（经 editor 挂载） | 默认窗 **不挂载** |
| `agentGlobalConfigurationSettingsWidget.ts` | HarnessSettings：**不进**默认窗轨 |
| `promptsServiceCustomizationItemProvider.ts` / `aiCustomizationItemsModel.ts` | H0–H3 **不**把扫描根改到 `{AgentHome}` / `.universe-agent`。H0 只动 chrome。UA 路径 list 只在 E1 Engine-backed |
| `customizationMigration*.ts` | 默认窗 **不展示** Copilot 迁移 UI |

主题继续 `aiCustomizationManagement.css` workbench token，不引入新设计系统。

## 7. 与产品目录 / C5 的边界

- 产品主面（本地 vs Engine、vscode 同一张脸）以 [settings-two-surfaces.md](settings-two-surfaces.md) 为准。本文件只写 donor 零件 chrome。
- TOC 入口：C5 目标 `executeCommand(OpenEditor)`；Palette **保持** `f1: true` + `IsSessionsWindowContext`。HEAD 仍有 `ua.customizations` pane。
- catalog 空态与 E1 在 Engine 页 / 引擎面稿。H0–H3 已签收为 ReadyToImplement。

## 8. 审查记录（规则 16）

2026-09-01：三路并行 Cursor Grok 4.6 只读。本文件原评估 **Block**。已当轮改入：H0–H3 收成文件工具；Tools 不进默认窗左 nav；OpenEditor Palette 门钉死；`managementSections` 必须删 plugins/tools 而非只藏 nav。

2026-09-01 第二轮：**Block**。已改入：§0/§3.1 Overview 去掉 Tools 行与「catalog after connection」；Plugins 改为删 `managementSections`；§3.5/§3.8 去掉 until E1 / Tools 空态；§6 welcome 不再写 Engine not connected。

2026-09-01 第三轮 [host-ui](f389761d-3658-41ea-b5ef-66a498df6855)：**Approve with changes**。Round-2 六条 gone。已改入：Goal 不再用 Engine「诚实空」口号；§3.7 深链不写 until-engine catalog；§0 默认窗从 `managementSections` 删 contributed，不是藏 nav。

engine 第三轮连带：H0–H3 **不得**把扫描根改到 `{AgentHome}`。

2026-09-01：**签收** `accepted`。H0–H3 ReadyToImplement。未改 `src/`。
