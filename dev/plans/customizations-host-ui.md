---
title: "Agent Customizations 宿主 UI：按 vscode 重排各节"
type: plan
status: draft
phase: N/A
updated: 2026-09-01
summary: "文件编辑器 donor 的 vscode chrome：剥 Copilot 营销；零件可拆进 Engine 页；不是第三套主设置"
---

# Agent Customizations 宿主 UI

> **产品目录 SSOT：** [settings-two-surfaces.md](settings-two-surfaces.md) — 主设置页是 **本地 Client** 与 **Engine**；本编辑器是文件工具 donor，**不是**第三套主设置。  
> **本文件职责：** 若打开 `AICustomizationManagementEditor`，页内 chrome / 空态 / vscode 控件 / 要剥的 Copilot 脸。不写引擎 RPC。零件拆进 Engine pane 时必须落在 vscode Preferences 密度上。  
> **C5：** 目标 TOC → `aiCustomization.openManagementEditor`。HEAD 仍打开 `ua.customizations` pane（`workbench.action.openCustomizationsPreferences`）。从 Settings 点进去须关 Client 模态。  
> **视觉：** 与 vscode Settings / Preferences **同一张脸**（workbench token）。禁止 Singularity 卡、Copilot 营销卡栅。  
> **范围窗：** 默认窗（`isSessionsWindow === false`）。

**Goal：** 剥 Copilot 营销 Overview / Browse / CLI 工具清单，改成 vscode 左 nav + 列表 + markdown 预览。无引擎诚实空。**不要**把这只编辑器当成 Skill/Agent 产品首页（那是 Engine 页）。

## 0. 已拍板约束（本文件不重开）

| 约束 | 选定 |
|------|------|
| 宿主 | 继续 `AICustomizationManagementEditor` + `AICustomizationManagementEditorInput`（`RequiresModal`）。禁止新 Part、禁止独立 `SettingsScreen` |
| 布局语法 | **vscode 同一张脸。** 左 `WorkbenchList` + 右内容；文件节 list + monaco/markdown；MCP 定义列表+详情。workbench CSS 变量，与 Settings/Preferences 同密度 |
| 禁止视觉 | Singularity Settings 卡、Material 彩色圆标大卡、Copilot Overview 营销卡栅、Ocean/Snow |
| 标题 | 禁止停留在 `Copilot [Agent Host]` / `Agent Customizations - Copilot` |
| Overview 输入 | 禁止「Customize Your Agent」预填 Chat / `/init` |
| Plugins | v1 **默认窗左 nav 隐藏**；深链到该节则诚实空。禁止 Browse 进 Copilot / Open VSX 冒充引擎插件 |
| Tools | 禁止 `COPILOT_CLI_TOOLS` / `copilot-cli` 只读清单。无引擎：整节诚实空 until E1 |
| 默认窗不进产品轨 | `prompts` / `automations` / `models` / `harnessSettings`（HEAD 枚举仍可存在，左 nav 不画） |
| 截图底栏 | `+ Agent` / `Auto` / `Autopilot` / `Detailed permissions` 是 **Conversation Dock**，不是本编辑器。剥离走 M5 / INV-NO-COPILOT。本页只记 **out of scope** |
| 无引擎 | 节可以在（Plugins 除外），内容 `registerViewWelcomeContent` 风格诚实句。禁止假技能名、假 Featured MCP、假工具组 |

引擎 list/toggle/catalog 权威见 [customizations-engine.md](customizations-engine.md)；接到 UI 是 **E1**（依赖 PRD-008）。本文件遇到引擎门控一律写 **诚实空 until E1**，不画 stub 市场。

## 1. 目标 chrome（ASCII）

壳不变：Preferences 模态 Editor（compact header）→ 左 sidebar + sash + 右 content。三态只换右栏。

### 1.1 Overview（着陆，无节选中）

```text
┌ Agent Customizations                              [链接] [x] ┐
├──────────────────┬───────────────────────────────────────────┤
│ Overview      ●  │  Agent Customizations                     │
│ Agents           │  Engine not connected.                    │
│ Skills           │  Workspace and user files can still be    │
│ Instructions     │  listed after you open a section.         │
│ Hooks            │                                           │
│ MCP Servers      │  Sections                                 │
│ Tools            │  Agents          Define agent profiles…   │
│                  │  Skills          Reusable skill files…    │
│                  │  Instructions    Always-on rules…         │
│                  │  Hooks           AgentLoop hook files…    │
│                  │  MCP Servers     Server definitions…      │
│                  │  Tools           Engine tool enablement   │
│                  │                  (empty until engine)     │
└──────────────────┴───────────────────────────────────────────┘
```

Overview **不是** Copilot getting-started：无 sparkle 卡、无预填输入、无 7 张营销卡、无 Voice/Dictation 附属卡。节跳转是 Settings 式 **链接行**（一行标题 + 一行 description），点击调用现有 `selectSection`。

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
│ Tools            │  │ User                               │   │
│                  │  │   (empty)                          │   │
│                  │  └────────────────────────────────────┘   │
│                  │  选中一行后右栏切到 markdown 预览/编辑     │
│                  │  （同一模态，不新开 Part）                 │
└──────────────────┴───────────────────────────────────────────┘
```

有文件时：分组头（Workspace / User）+ 行（名、路径、enable checkbox）。点行 → 现有 embedded editor（preview / raw）。无文件、无引擎：列表不画假行，走 §3 空态。

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
│ Tools            │  │ User                               │   │
│                  │  │   (empty)                          │   │
│                  │  └────────────────────────────────────┘   │
│                  │  无 Featured / Browse Marketplace         │
│                  │  点行 → 现有 MCP 定义详情（配置/启用）     │
└──────────────────┴───────────────────────────────────────────┘
```

无本地定义且无引擎：诚实空，**不**用 gallery snapshot 填三张 Featured。

## 2. 全局 chrome 改造

### 2.1 标题

| 现状（截图 / HEAD） | 选定 |
|---------------------|------|
| 模态名 `Agent Customizations for Copilot [Agent Host]` | 默认窗固定 **`Agent Customizations`** |
| `EditorInput.setTargetLabel(harnessService.getActiveDescriptor().label)` 拼出 `- Copilot` | 默认窗 **不要**把 Copilot / Agent Host / 回退 `"Local"` 写进标题 |
| Overview `h2` 已是 `Agent Customizations`，但截图大标题仍带 Copilot | Overview 大标题与模态名同一字符串，不再重复 harness |

引擎真正连上 UniverseAgent 之后（E1 之后，本文件不实施）：标题可变为 `Agent Customizations — UniverseAgent`。未连上时副文案写 **Engine not connected.**，不要假装 Local harness。

改点：`AICustomizationManagementEditorInput.getName()` 的 target 后缀；`updateHarnessLabelPresentation()` 默认窗不再 `setTargetLabel` Copilot 描述符。

### 2.2 左 nav

| 现状 | 选定 |
|------|------|
| 顶上独立 `sidebar-home-button`（Overview）+ 下面 `WorkbenchList` **不含** Overview | Overview 收进 **同一只** `sectionsList`（`WorkbenchList<ISectionItem>`）作第一行，选中态与其它节同一 renderer。删掉 harness 风格 home 按钮 |
| HEAD `managementSections` 默认窗：Plugins, MCP, Skills, Instructions, Agents, Hooks, Tools, Prompts, HarnessSettings | 默认窗可见序：**Overview · Agents · Skills · Instructions · Hooks · MCP Servers · Tools**（对齐截图产品序，去掉 Plugins） |
| harness `hiddenSections` 再滤一层 | 保留机制；默认窗产品轨额外 **永不画出** Prompts / Automations / Models / HarnessSettings / Plugins |
| 侧栏 count 徽章 | 可保留数字；0 不显示「假 7 张卡都有货」的营销感。无引擎 Tools 计为 0 |

Overview 选中 = 今日 `selectedSection === undefined` + `showWelcomePage()`。不要给 Overview 新枚举值；`AICustomizationManagementSection` 保持 HEAD 字符串。

### 2.3 默认窗节显隐（对照 HEAD 枚举）

`AICustomizationManagementSection`（`aiCustomizationWorkspaceService.ts`）：`agents` `skills` `instructions` `prompts` `hooks` `automations` `mcpServers` `plugins` `models` `tools` `harnessSettings`。

| 节 | 默认窗左 nav | 备注 |
|----|----------------|------|
| Overview | 有（welcome，非枚举） | 改造 |
| Agents / Skills / Instructions / Hooks / MCP / Tools | 有 | 按 §3 |
| Plugins | **无**（隐藏） | 深链 → 诚实空，无 Browse |
| Prompts / Automations / Models / HarnessSettings | **无** | [settings-two-surfaces.md](settings-two-surfaces.md)：不进默认窗产品轨。禁止挂 `ChatModelsWidget` |

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
| 无引擎 | 着陆副文案：**Engine not connected.** 仍列出六节链接（Tools 行注明 until E1） |

链接行 copy（英文 UI 源串）：

| 节 | 行描述 |
|----|--------|
| Agents | Define agent profiles for this workspace or your user profile. |
| Skills | Add reusable skill files. The engine catalog appears after a connection. |
| Instructions | Always-on rules for the workspace or your user profile. |
| Hooks | Hook definition files for the agent loop. |
| MCP Servers | Server definitions (not live engine tools). |
| Tools | Enable tools for the current engine profile. Empty until an engine is connected. |

禁止 Overview 再做第二套 Conversation。

### 3.2 Agents → Agent Profile

| | |
|--|--|
| 列表 / New / 点开 md | **复用** `AICustomizationListWidget` + 编辑器内 `CodeEditorWidget` + `IMarkdownRendererService` 预览 |
| 呈现 | HEAD `usesCustomizationCardLayout(Agents) === true` 走 `CustomizationCardListController`。**替换呈现为 `WorkbenchList`**（widget 内已有 list 路径）。分组头继续 Workspace / User |
| 文案 | 去掉 persona/Copilot。标题 **Agents**。说明：Agent profiles (`AGENTS.md` + `tools.json`) for this workspace or your user profile. |
| Learn more | 去掉 vscode Copilot 文档链 |
| New | 只留 **Manual New**（现有 `NEW_AGENT_COMMAND_ID` / `onDidRequestCreateManual`）。剥离 AI-guided `onDidRequestCreate` |
| 路径/元数据 | H1 起按 UA Profile 目录（[customizations-engine.md](customizations-engine.md)）。H0 只改正文案与卡→列表，不在本 UI 稿规定磁盘布局 |
| 工具白名单 | 预览侧展示 `tools.json` 是引擎面；H0/H1 UI 只预览 `AGENTS.md`。完整白名单 until E1 |
| Copilot agent 市场 | **剥离** |
| 空态 | 标题 `No agent profiles yet`。副句：`Create a profile in this workspace or your user folder. The engine catalog is unavailable until E1.` 无引擎允许空列表；**禁止**填 Copilot 内置 persona 名 |

### 3.3 Skills → Engine Skill catalog

| | |
|--|--|
| 列表 / New / SKILL.md | **复用** `AICustomizationListWidget`；卡→`WorkbenchList` 同 Agents |
| 文案 | 去掉「Folders … that Copilot loads」。改为：Reusable skill files. Enablement applies to new conversations after the catalog is connected. |
| enable 开关 | 控件可留（list 行 checkbox）。无引擎：开关 disabled 或整行不可 toggle，hover：**诚实空 until E1**。禁止只改 Copilot 忽略列表却写「已接引擎」 |
| Skill 商店 / Browse | **剥离**（延后） |
| 空态 | `No skills yet` / `Skills are listed from the UniverseAgent catalog after an engine connects. This view stays empty until then.` **禁止**假技能名 |
| H1 | 列表分组改扫 UA 路径，仍可本地文件，标 Stub。本文件不写 RPC |

### 3.4 Instructions → 规则

| | |
|--|--|
| 列表 / New / md | **复用** list + preview；卡→列表 |
| 产品意图 | 保留「总是注入的短规则」 |
| 文案 | 去掉「teach Copilot about your codebase」。改为：Always-on rules for this workspace or your user profile. |
| 空态 | `No instructions yet` / `Add a rules file for this workspace or your user profile. Engine-backed rules stay empty until E1.` |
| Memory | **不**出现。不增加 Memory 节 |
| H2 | 语义对 UA global/project rules；禁止 UI 声称 `.github/copilot-instructions.md` 已是引擎权威 |

### 3.5 Hooks → AgentLoop hook

| | |
|--|--|
| 列表 + 编辑定义 | **复用** list + preview；卡→列表 |
| 文案 | HEAD「saving files or running tasks」是 vscode 任务钩子。改为：Hook definition files for the agent loop (message / tool / permission lifecycle). |
| New | 复用现有 create / `showConfigureHooksQuickPick`，但触发点枚举不得只列 Copilot/vscode task 事件。无引擎：New 仍可建本地文件；点位下拉若只有 Copilot 事件则 **隐藏下拉**，说明 **诚实空 until E1** |
| 空态 | `No hooks yet` / `Hook points come from the engine. This list stays empty until E1.` |
| H2 | 展示 UA hook 点（引擎面）；本文件不列 RPC |

### 3.6 MCP Servers

| | |
|--|--|
| 定义列表 + 点开详情 | **复用** `McpListWidget` + `EmbeddedMcpServerDetail` |
| Browse / Featured gallery / `queryGallerySnapshot` | **剥离**（H3）。无 UA 商店则按钮不存在，不写「不可用」假市场 |
| Add | 保留 vscode MCP **定义**添加（工作区/用户 `mcp.json` 流）。这是定义 CRUD，不是商店 |
| Copilot 扩展源分组 | **剥离**（`isCopilotExtension` 那路不要在默认窗当「已安装 MCP」推销） |
| 运行态（已连引擎的 live 工具） | **不在本页** |
| 无引擎但有本地定义 | 只读列出文件定义；状态文案不得写 Connected to engine |
| 无定义且无引擎 | `No MCP servers yet` / `Add a server definition for this workspace. Featured marketplace servers are not available.` |

### 3.7 Plugins（v1 延后）

| | |
|--|--|
| 左 nav | **隐藏** |
| `PluginListWidget` / `EmbeddedAgentPluginDetail` | 默认窗不挂载。深链 `openManagementEditor({ section: 'plugins' })`：右栏诚实空，无 Browse、无 `PluginMarketplaceSnapshotModel` |
| 空态（仅深链） | `Plugins are not available yet.` / `Engine plugins are not the VS Code marketplace. This section stays empty until the engine exposes a plugin catalog.` |
| Browse Marketplace | **剥离** |

### 3.8 Tools

| | |
|--|--|
| HEAD | `ToolsListWidget(AGENT_HOST_COPILOT_CLI_SESSION_TYPE)` 画出只读 `copilot-cli` 组（bash、apply_patch、…）+ 默认窗 Browse Marketplace |
| 选定 | **替换内容为诚实空 until E1**。左 nav **保留** Tools |
| Copilot CLI 清单 | **剥离**（H0 即可整节空） |
| Browse / `GalleryItemRenderer` | **剥离** |
| 有引擎后（E1，不在本文件画控件树） | 当前引擎/Profile 的工具 enablement（引擎工具 + 本机 client-tool）。本页仍用列表+checkbox，不新造卡网 |
| 空态（现在） | `No tools to configure` / `Tool enablement needs a connected engine. Copilot built-in tools are not listed.` |

## 4. H0–H3 UI 验收（切片名与引擎面 / two-surfaces 对齐）

本文件只验收 **看得见的宿主 UI**。E1（引擎 list/toggle 接到 H1）不在本页。

### H0 — 去 Copilot 脸 + Overview + Tools 空

- 模态标题是 `Agent Customizations`，不含 Copilot、Agent Host、Local。
- Overview 无「Customize Your Agent」输入，无预填 Chat，无营销卡栅，无 Voice/Dictation。
- 左 nav 默认窗只有 Overview + Agents + Skills + Instructions + Hooks + MCP Servers + Tools；无 Prompts / Models / HarnessSettings / Plugins。
- Tools 右栏诚实空，DOM/文案均无 `apply_patch` / `copilot-cli` / Copilot CLI 工具名。
- 截图底栏 Auto / Autopilot / Detailed permissions **未**出现在本编辑器内（若仍在窗口底，属 Dock / M5，不记本切片失败）。
- 无假技能名、无 Featured MCP 三卡。

### H1 — Skills / Agents 换 UA 路径与文案（仍可本地，标 Stub）

- 两节卡布局改为 `WorkbenchList` 分组（Workspace / User）。
- 文案不再含 Copilot；空态用 §3.2 / §3.3。
- New 为 Manual；无 Generate with AI / Chat。
- 列表若仍扫 Copilot `~/.copilot/skills` 冒充 UA catalog → **本切片失败**。本地 UA 路径文件可出现并标 Stub。
- enable 在无引擎时不可假装已打到 catalog。

### H2 — Instructions / Hooks 换 UA 语义

- Instructions 空态/说明不再 teach Copilot；不出现 Memory 节。
- Hooks 说明指向 agent loop，不指向 save-file / run-task。
- 无引擎：列表诚实空 until E1；不列出 Copilot/vscode 任务事件冒充 hook 点。

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
| `aiCustomizationWelcomePagePromptLaunchers.ts` | **替换 Overview 呈现**：删输入与卡栅；改为链接行；删 Voice/Dictation/迁移卡；副文案 Engine not connected |
| `media/aiCustomizationWelcomePromptLaunchers.css` | **restyle**：去掉 `.welcome-prompts-primary` / card grid；链接行用 settings 密度 |
| `aiCustomizationListWidget.ts` | **复用** `WorkbenchList` 路径；**关掉** `usesCustomizationCardLayout` 对 Agents/Skills/Instructions/Hooks（默认窗改走 list 非 `CustomizationCardListController`）；换 header/空态 copy；去掉 Copilot learnMore；去掉 AI create |
| `customizationCardList.ts` | 默认窗文件节 **不再作为主呈现**；MCP/Plugins 卡若仍用，MCP 只服务定义行 |
| `customizationGroupHeaderRenderer.ts` | **复用** Workspace/User 分组头 |
| `mcpListWidget.ts` | **复用** 已安装/本地定义列表 + search + Add；**剥离** Featured / gallery / Browse |
| `embeddedMcpServerDetail.ts` | **复用** 定义详情 |
| `pluginListWidget.ts` / `embeddedAgentPluginDetail.ts` | 默认窗 **不挂载**；深链空态即可 |
| `toolsListWidget.ts` / `embeddedExtensionToolsDetail.ts` | H0：**替换**为诚实空（或编辑器内不实例化 widget，右栏自绘 welcome）。禁止 `COPILOT_CLI_TOOLS` |
| `galleryItemRenderer.ts` | 默认窗产品轨 **不用** |
| `aiCustomizationWorkspaceService.ts`（browser） | **改** `managementSections` 默认窗集合与顺序；`welcomePageFeatures.showGettingStartedBanner: false` |
| `ChatModelsWidget`（经 editor 挂载） | 默认窗 **不挂载** |
| `agentGlobalConfigurationSettingsWidget.ts` | HarnessSettings：**不进**默认窗轨 |
| `promptsServiceCustomizationItemProvider.ts` / `aiCustomizationItemsModel.ts` | H1+ 换扫描路径时改 data source；H0 不动权威、只动 chrome |
| `customizationMigration*.ts` | 默认窗 **不展示** Copilot 迁移 UI |

主题继续 `aiCustomizationManagement.css` workbench token，不引入新设计系统。

## 7. 与产品目录 / C5 的边界

- 产品主面（本地 vs Engine、vscode 同一张脸）以 [settings-two-surfaces.md](settings-two-surfaces.md) 为准。本文件只写 donor 零件 chrome。
- TOC 入口、RequiresModal：以 [page-access-schemes.md](page-access-schemes.md) C5 **目标**为准；HEAD 代码未落（仍有 `ua.customizations` pane）。
- 引擎 catalog / Profile / hook / 工具： [customizations-engine.md](customizations-engine.md)；本页只规定无数据时的空态。
- 本文件不把 H0 标成 ReadyToImplement。
