---
title: "页面接入方案：Settings / 会话列表 / 透镜 / Navigator tab"
type: plan
status: implemented
phase: N/A
updated: 2026-09-01
summary: "B2 壳之后页面接入；切片 1a–4 已落；切片 5 blocked PRD-008"
origin: multi-party-design-review
mpdr:
  skill: multi-party-design-review
  synthesized_by: "Cursor / Grok"
  draft_sources:
    - platform: Cursor
      model: composer-2.5
      file: draft-cursor-composer.md
    - platform: Cursor
      model: composer-2.5-fast
      file: draft-cursor-composer-fast.md
  perspective_reviewers:
    - dimension: Architecture
      platform: Cursor
      model: composer-2.5-fast
    - dimension: Product / Interaction
      platform: Cursor
      model: composer-2.5-fast
    - dimension: Testing / Verification
      platform: Cursor
      model: composer-2.5-fast
    - dimension: Documentation / Traceability
      platform: Cursor
      model: composer-2.5-fast
  architecture_reviewed_by: "Cursor / Grok (review session ≠ synthesizer)"
  architecture_review_verdict: "Approve with changes"
  refined_by: "Cursor / Grok"
  implementer_ask_rounds: 2
---

# 页面接入方案：Settings / 会话列表 / 透镜 / Navigator tab

> **本文件是已签收（`accepted`）决策 SSOT。** 与知识层四页冲突时 **以本文件为准**。四页仍作细节锚点（HEAD 类名、容器 id、donor 禁令、分阶段清单）；文首已加 SSOT banner。**选定设计全文已于 2026-09-01 按 §12 同步至四页**；实施者 **禁止**按四页旧 Connection 树内形态施工。  
> **前置**：M0–M3 壳 `implemented`；M4 验证波仍 `in_progress`（D4 启动）。**实施另开会话按切片开**；本文件不改 `src/`。切片 1a ReadyToImplement；1b 及之后按 §10 / B12。  
> **知识层锚点**（选定设计已按 §12 同步；banner 已标父方案优先）：[settings-ua-access](../../docs/reference/code-oss-b2/settings-ua-access.md) · [session-roster-reuse](../../docs/reference/code-oss-b2/session-roster-reuse.md) · [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) · [navigator-tabs-access](../../docs/reference/code-oss-b2/navigator-tabs-access.md)。  
> **壳拓扑**（已 accepted）：[desktop-shell-mapping](../../docs/reference/code-oss-b2/desktop-shell-mapping.md)。  
> **外仓**（只链，不复述条款）：[IA](../../../UniverseAgentDesktop/docs/product/information-architecture.md) · [ui-interaction-spec](../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md) · [ADR-061 决策 5](../../../UniverseAgentDesktop/dev/decisions/061-code-oss-base-and-editor-window-shell.md) · [ADR-037](../../../UniverseAgentDesktop/dev/decisions/037-deep-link-navigation-event-seam.md)。

**Goal：** 把 Singularity / Desktop **页面**接到 vscode 默认 Code 窗口宿主——Settings、Navigator 各 tab、会话列表、Conversation 透镜组装——写成可签收、可拆切片的映射方案。消 **问题类**（Copilot 控件偷换为产品面、会话真相混源、Navigator 升格中心、键空间互穿），不修孤立症状。

### 签收记录（DOCUMENTATION 规则 16）

本稿 `status: accepted`（2026-08-31）。审查记录见文末。知识层四页已各自经 Opus 5.0 审查改稿；父综合稿本轮由 3 路并行只读 reviewer 核验 HEAD 后改入 Important。产品追踪见 [traceability.md](../../docs/product/traceability.md) 页眉 precedence。

### 切片 0 / 签收 checklist（B1，实施者必读）

1. **施工 SSOT = 本文件**（含 §15）。知识层四页只提供 HEAD 类名 / 容器 id / donor 禁令；**冲突以本文件为准**。
2. **禁止**按 `settings-ua-access.md` 旧形态实施：Connection/Engine **不是** settings 树内非 setting 元素 + 专属 renderer；Engine **不是** Settings 分组内嵌控件。
3. **禁止**按 `conversation-lens-assembly.md` 旧形态从 `ChatListWidget` 抽出虚拟化。
4. **禁止**按 `navigator-tabs-access.md` / `session-roster-reuse.md` 把产品四段 `hideIfEmpty: true` 当签收后目标。
5. 四页选定设计全文改写 = 签收后 §12（**已完成 2026-09-01**）。banner 已加，足够挡住读错 SSOT。
6. 本文件不改 `src/`。实施强制 **切片 1a merge 先于 1b**（§10 / B12）。

---

## 0. 跨页问题类与复发机制

### 0.1 症状（今天可见）

| 症状 | 所在 |
|------|------|
| Settings 打开是 Copilot `chat.*` TOC + entitlement 搜索门闩；无 Client / Connection / Engine 产品分组 | Settings |
| 产品 roster 是 stub 内存列表；Projects / Agents / Team 仅 honest empty；Activity 图标可因 `hideIfEmpty` 消失 | roster / Navigator |
| 透镜三槽已落地 stub DOM；长列表与引擎发送链未接；donor `ChatWidget` / `ChatListWidget` 路径最短 | 透镜 |
| `workbench.action.chat.openSessionInEditorGroup` 菜单 `when` 默认窗未收紧（**行为**已 `runWithSessions` guard；INV-TOPO 可见性未闭合） | roster |
| SessionBar `SelectBox`、Sidebar roster、未来 Projects 树可能各存一份 active id（数据层今天已共用 stub，UI 仍双入口） | roster / 透镜 |
| 用户改 `workbench.editor.useModal` 为 `'off'` 后 Settings 掉进 Preview tab | Settings |

### 0.2 问题类（架构层）

| 问题类 | 说明 | 六个月后若不管会怎样 |
|--------|------|----------------------|
| **PC-TRUTH** | 产品会话 / 设置 / 连接真相必须来自 UA 或明确 stub 契约，不得借 `IChatModel` / agentSessions / entitlement | 「改一行配置就挂 Copilot roster」 |
| **PC-HOST** | 每页必须有唯一 vscode 宿主选型；禁止为省事把 `ChatWidget` / `AgentSessionsControl` 整块当产品面 | Conversation 中心变 `ChatEditor` |
| **PC-BOUNDARY** | Client 配置 / Connection 生命周期 / Engine 运行时 / 文件型 Customizations 四 bucket 不可互穿 | Settings 树里改 MCP 定义 + Provider key 混一桌；Connection host/port 进 `settings.json` |
| **PC-NAV** | Navigator 段 = Sidebar 发现面；inspect 进 Panel；永不升格 L1 / `CONVERSATION_PART` | Agent Detail 变 Preview tab |
| **PC-CONTAINER** | vscode 容器默认同构（`hideIfEmpty`、可关唯一叶）与产品四段常在冲突（Files 例外见 §1.3） | Activity「四段变两段」silent 复发 |

### 0.3 复发机制

1. **Donor 整包迁移**：`ChatWidget.render()`、`ChatListWidget`、`AgentSessionsControl`、`ChatInputPart` 路径最短；INV-NO-COPILOT 靠 code review 挡不住，必须 **import lint / 容器 id / TOC bucket** 机械边界。
2. **键空间万能论**：把 Connection profile、Engine API key 注册成普通 `settings.json` key，或把非配置 UI 塞进 settings 树当「非 setting TOC 元素」，六个月后 Engine 卡片继续往同一棵树长。
3. **容器语义漂移**：Explorer / agentSessions viewlet / 产品 sessions 容器 id 混用；文档写 A 代码挂 B。
4. **hideIfEmpty 默认**：vscode 空容器隐藏 Activity 图标，与产品四段常在合同 silently 冲突（Files 例外见 §1.3）。
5. **Editor tab 当 Conversation**：`openSession` → `ChatEditorInput` 从 donor 路径复活。

本方案四页设计均针对上述问题类设机械边界（服务接口、import lint、容器 id、Preferences pane 注册、TOC 链接而非树内自定义节点），而非仅写「禁止」。

---

## 1. 结构性冲突裁决（本综合稿）

两路候选彼此高度同向；与知识层有三大结构性分歧，另有一项仅 fast 主张。每项给出 **选定 / 拒绝 / 理由**，并保留一句备选。

| 议题 | 知识层 | 两路候选 | **本文件选定** |
|------|--------|----------|----------------|
| Connection / Engine 宿主 | Settings 树内非 setting TOC 元素 + Engine 分组内嵌控件 | TOC 链接 → 专用面（composer 并列「PreferencesEditor 子 pane **或** `RequiresModal` EditorInput」；fast 钉死 pane） | **`PreferencesEditor` 子 pane**（钉死，不并列） |
| 透镜阶段 2 timeline | 从 `ChatListWidget` **抽出**虚拟化 | 绿field `ConversationTimelineTree`，零 import `chatListWidget` | **绿field `ConversationTimelineTree`** |
| `hideIfEmpty` | v1 接受 `true`（关叶图标消失） | 产品四段 `false`；fast 另主张禁 toggle + 提前选定 inspect Panel 容器 | **产品四段 `hideIfEmpty: false` + 唯一叶 `canToggleVisibility: false`；inspect 本轮选定专用 Panel 容器** |
| SessionBar SelectBox | 未要求移除 | 仅 fast：阶段 2 移除，roster 单点切换 | **Deferred**（阶段 1 保持双入口） |

### 1.1 Connection / Engine 宿主

- **选定：** Client 留 `SettingsEditor2`。Connection 与 Engine **运行时**注册为 `IPreferencesEditorPaneRegistry` 子 pane（**钉死 id** `ua.connection` / `ua.engine`，见 §15 B3）。Settings TOC **只放链接行**「Open Connection…」/「Open Engine…」，**不**在 `SettingsEditor2` 树内做非 setting 自定义节点，**不**内嵌 Connection/Engine 控件。
- **TOC 链接行允许实现族（钉死，BL-1 / B4）：** HEAD 树子类型仅 `SettingsTreeGroupElement | SettingsTreeSettingElement | SettingsTreeNewExtensionsElement`（`settingsTreeModels.ts`），无纯导航链接。
  - **签收形态 A（钉死）：** 新增轻量 `SettingsTreeNavigationLinkElement`（仅 `label` + `commandId`，**零**内嵌控件）。Renderer 只画可激活链接。Connection / Engine / Customizations「Open …」三行同族。command 见 §15 B4 / B10。
  - **备选 B（group 级 `ITOCEntry.command`）：** **走 B 须人类回签**（不得工程师自行切换）。证伪条件本轮不设工时阈值。
  - **拒绝：** 知识层「非 setting TOC 元素 + Connection/Engine 专属 renderer」；复用 `SettingsTreeNewExtensionsElement`；注册 dummy `IConfigurationRegistry` key 冒充链接（污染 `settings.json` / 搜索）；在 `SettingsTreeSettingElement` 上挂自定义 widget。
- **拒绝：** 知识层「非 setting TOC 元素 + `settingsTree*.ts` 专属 renderer」。理由：把非配置 UI 塞进 settings 树会复发 **PC-BOUNDARY**（Engine 卡片继续往同一棵树长）；`_resolveSettingsTree` 对空节点抛错类改动 footprint 大，且 Connection 根本不是 `IConfigurationRegistry` key。
- **拒绝并列：** composer 的「pane **或** `RequiresModal` EditorInput」。理由：须钉死一种宿主。Customizations 已占用 `RequiresModal` `EditorInput` 族（文件型中心，ADR-061 已拍板）；Connection/Engine 再开第三种 EditorInput 会变成三宿主。`PreferencesEditor` 已无条件 `MODAL_GROUP`，与 Desktop Overlay 子页同构；HEAD 已有 `IPreferencesEditorPaneRegistry.registerPreferencesEditorPane`（`preferencesEditorRegistry.ts`），内容面今天为空——正是挂 UA 子页的空位。
- **HEAD 实施钉（契约见 §15 B2）：** 今天 `IPreferencesService.openPreferences(): Promise<void>` **无 pane id**；`PreferencesEditor.setInput` 恒选 **第一个** tab。切片 1a 扩展为 `openPreferences(options?: { paneId?: string })`；**不得**假装 API 已存在。
- **备选：** 若 pane 注册 / 深链扩展成本被证伪，退回与 Customizations 同族的 `RequiresModal` `EditorInput`（仍禁止回 settings 树内非 setting 节点；切换须人类回签）。

### 1.2 透镜阶段 2 timeline

- **选定：** 在 `contrib/conversation` **新建** `ConversationTimelineTree`（`WorkbenchObjectTree<ConversationTimelineItem>`），**零 import** `chatListWidget.ts` / `ChatListItemRenderer`。虚拟化与滚底 hold **参考** donor 行为，代码写在新产品文件。Markdown/code **仅借 render 函数**，经唯一 `IConversationTurnContentAdapter` 入参。
- **拒绝：** 知识层「从 `ChatListWidget` 抽出 `WorkbenchObjectTree` 用法」。理由：抽出仍共享构造链与 `ChatTreeItem` 类型系统，import 级无法机械 enforce **INV-NO-COPILOT**；`ChatListWidget` 构造里 `createInstance(ChatListItemRenderer)` 会拖进 entitlement / quota parts。绿field 可用依赖检查：`contrib/conversation` **不得**依赖 `chat/widget/chatListWidget`。
- **备选：** 若绿field 滚底 hold 被证伪为重复造轮，允许 **复制算法到新文件**（仍禁止 import `chatListWidget`），不得改回「抽出并引用 ChatListWidget」。

### 1.3 hideIfEmpty / toggle / inspect

- **选定 hideIfEmpty：** Sessions / Projects / Agents / Team **四处产品容器**签收后改为 `hideIfEmpty: false`，空态走 `registerViewWelcomeContent`。
- **Files（Explorer）例外（签收默认）：** **不**把 Explorer 改为 `hideIfEmpty: false`，不把 Explorer 多叶（Open Editors / Outline / Timeline 等）卷进产品四段「禁关唯一叶」合同。**接受 Files Activity 图标可因 vscode 默认 `hideIfEmpty: true` 消失**——「五段常在」产品合同 = 产品四段恒在；Files 是 vscode 原生多叶容器，空容器隐藏是上游习惯。若日后要求 Files 图标也恒在，再改 Explorer `hideIfEmpty: false`（仍不自动禁 Explorer 叶 toggle）。
- **选定 toggle：** 产品四段 **唯一叶** `canToggleVisibility: false`，避免用户关掉唯一叶后容器虽 `hideIfEmpty: false` 仍变空壳、或与 vscode 视图菜单打架。`canMoveView` 暂保持 true（搬走后图标仍在，因 hideIfEmpty false）；若实施中发现搬空导致 IA 损坏，再禁 move。
- **拒绝：** 知识层对 **产品四段**「v1 接受图标消失」。理由：Sessions / Projects / Agents / Team 是 **产品 IA 合同**不是 optional 插件；`hideIfEmpty: true` 让「四段变两段」成为 vscode 默认路径上的 silent 复发（**PC-CONTAINER**）。HEAD `navigatorStubViews.test.ts` 现断言 Projects/Agents/Team `hideIfEmpty === true`（约 69–72）；**Sessions 容器 HEAD 确是 `true`（`conversation.contribution.ts:40`），但该测试未锁 Sessions**——切片 3 对 Sessions 是补断言，不是改旧断言。`canToggleVisibility` 同理只测了三 stub 叶。不得让测试把旧默认锁死。Files 例外见上条。
- **选定 inspect：** 注册 Panel 容器 **`workbench.panel.agentInspect`**（vscode Panel 惯例 `workbench.panel.*`，对齐 Output / Markers；**不是** Sidebar 的 `workbench.view.*`）+ 单叶 view id `workbench.panel.agentInspect.view` + `AgentInspectView`；Agents/Team 行 action「Inspect」→ `ViewsService.openView` 打开 Panel 叶。**不是** `openEditor` Preview tab，**不是** editor-in-panel（ADR-047 Diff FORK 另一族）。常量见 §15 B3。
- **拒绝：** 「签收前不假装已选」继续把 inspect 机制留白。理由：两路候选都同意落点是 `PANEL_PART`；不钉机制则实施会猜专用容器 vs 复用 Debug/Terminal 叶，复发 **PC-NAV**。
- **备选：** 若专用 Panel 容器与 Debug/Terminal 争位被证伪，改为复用已有 Panel 叶，仍禁止 Preview editor tab。

### 1.4 SessionBar SelectBox

- **选定（本轮）：Deferred。** 阶段 1 保持已落地双入口（SelectBox + roster），共用 `IConversationStubService` / 日后 `IConversationRosterService`，高亮谓词恒 `getActiveSessionId()`。
- **拒绝立即移除：** 仅 fast 主张；知识层与 composer 均未将其列为结构性项。数据层已单 owner，双 **UI** 入口不是双 **真相**（PC-3 的根因是第二份 catalog / 第二份 active id，不是两个控件绑同一服务）。
- **备选 / 触发：** roster 成为可验证的主切换路径、且 `openSessionInEditorGroup` 默认窗已门闩之后，若产品签收要求对齐 Desktop「会话选择只在 Navigator」，再切 SessionBar 移除 SelectBox（保留标题 / New / Delete / History）。不阻塞页面接入架构签收。

---

## 2. Settings UA 接入

### 2.1 选项对比

| 候选 | HEAD 形态 | 适合 | 不适合 |
|------|-----------|------|--------|
| **A. `SettingsEditor2` 单宿主**（知识层） | 出厂 `useModal: 'some'` → `MODAL_GROUP`；`IConfigurationRegistry` + `tocData` + 搜索 | Client 全量键、扩展设置 | Connection 非 key 行要改 `settingsTree*`；Engine 控件与 setting 行混排 |
| **B. `PreferencesEditor` 全 Overlay** | `openPreferences` 无条件 `MODAL_GROUP`；pane registry 可挂子页 | 最接近 Desktop Overlay + 子页 | Client 键空间 / 搜索需重建；内容面今天空 |
| **C. 混合宿主（选定）** | Client → `SettingsEditor2`；Connection + Engine 运行时 → Preferences 子 pane | **层边界干净**；Connection 零 `_resolveSettingsTree` hack | 双宿主深链须路由表；须扩展 `openPreferences` pane id |
| **D. 自研 Settings Overlay Part** | 无 | 像素级 Desktop Compose | 重做搜索/扩展设置；违反复用姿态 |

**选定：C。** 拒绝 D（除非新 ADR）。拒绝 A 的 Connection 树内形态（见 §1.1）。拒绝 B 全量搬迁 Client 键。

### 2.2 选定设计

#### 宿主

- **选定：** 默认窗 Client Settings **仍用 `SettingsEditor2`** + `SettingsEditor2Input`；不自研 Overlay Part。
- Connection / Engine 运行时：**`PreferencesEditor` 子 pane**（§1.1）。
- **张力接受：** 用户将 `useModal` 改为 `'off'` 后 **Client** Settings 进 Preview tab，与 Desktop Overlay 语义偏离。Connection/Engine 因走 `PreferencesEditor` **恒 `MODAL_GROUP`**。v1 **不钉死**全局 `useModal`。

#### Client Overlay（签收默认）

v1 **接受分裂体验**：用户将 `useModal` 改为 `'off'` 后 Client 可进 Preview；Connection/Engine 恒模态。**不改**出厂 `useModal`。若日后要求 Overlay 恒成立，须另拍——(a) 改出厂/策略强制 `'some'`，或 (b) Settings 专用打开路径永远带 modal group，或 (c) Client 也改走 `PreferencesEditor`。

#### Client → Preferences 过渡 UX（钉死，BL-1 / B5–B6）

用户已在 Client `SettingsEditor2` 模态内，点击 TOC「Open Connection…」/「Open Engine…」/「Open Customizations」：

| 步 | 行为 |
|----|------|
| 开 Connection / Engine | **关闭**当前 `SettingsEditor2Input` → `openPreferences({ paneId })`（恒 `MODAL_GROUP`）。**禁止**双 Preferences 栈（Settings 留在 Preferences 背后）。 |
| 开 Customizations（C5） | `executeCommand(aiCustomization.openManagementEditor)`。**不要**包进 `openUaPaneReplacingClientSettings`。`RequiresModal` 由 `editorGroupFinder` 接管；已有 Settings 模态时可能同组两个 tab。删除 `OpenCustomizationsPreferencesAction` / `ua.customizations` pane。产品目录 SSOT：[settings-two-surfaces.md](settings-two-surfaces.md) |
| Back | PreferencesEditor **壳**按 pane descriptor `showBackToClientSettings` 渲染 **「Back to Client Settings」**（§15 B6）：关闭 `PreferencesEditor` → `openSettings()` **不带** `query` / `revealSetting` / `focusSearch`。v1 **不保证**恢复 TOC 滚动位置。Customizations **不**发明 Back chrome。 |
| `useModal: 'off'` | Client 已在 Preview；Connection/Engine 链接仍关 Preview 中的 Settings → 开 Preferences **模态**；Back 再 `openSettings()`。Customizations 仍走 OpenEditor。空 editor group 交 vscode 默认清理，v1 不另关 group。 |

#### UA 三层 → 键空间与面

| 层 | 落点 | 持久化 |
|----|------|--------|
| **Client** | `registerConfiguration` + **`tocData` 新产品分组**（Display / Chat Input / Startup / Keyboard Enter / Notifications / Permissions / Client Tools）。只注册不进 TOC 的键会 leftover 警告 | `settings.json` |
| **Connection** | Settings TOC **链接行** → Preferences pane `ua.connection`：Profile 列表、host/port/TLS、Test Connection。**禁止**普通 setting key。切片 1 = **纯 UI 占位（内存）**，不引入 `ConnectionProfileStore` | 引擎 adapter 后经 UA；本仓无第二套；切片 1 **零** `settings.json` |
| **Engine 运行时 + catalog** | Settings TOC **链接行** → Preferences pane `ua.engine`：Provider / Model Profile **以及** Skill/Agent/Rules/Hooks/MCP 定义 / 引擎工具（[settings-two-surfaces.md](settings-two-surfaces.md)）。无引擎 = 诚实空 + Test。**允许进 `IConfigurationRegistry` 的 Engine 键 = 空集 `[]`** | 引擎侧，非第二套会话真相 |

**Client 与 vscode 原生不双入口：** 主题 → `workbench.colorTheme`；字号 → `editor.fontSize`；全局快捷键 → `KeybindingsEditor`；UA 仅保留「聊天 Enter 行为」等增量键。`agentsWindow.default` / `.readOnly` 保留 Agents Window 差异，与 TOC 可见性 **不可互替**。

#### Customizations 切分（C5 入口目标不重开宿主；HEAD 未落；产品主面见 two-surfaces）

| 面 | 代码宿主 |
|----|----------|
| 文件型编辑器（零件，**不是**产品主设置） | `AICustomizationManagementEditor` — C5 **目标** `aiCustomization.openManagementEditor`。HEAD TOC 仍走 `workbench.action.openCustomizationsPreferences` + `ua.customizations` |
| Engine 运行时 **与** Skill/Agent/Rules/Hooks/MCP 定义 **产品主面** | Preferences `ua.engine` |
| 跳转 | TOC「Open Customizations…」C5 后 = 文件工具。**禁止保留** `ua.customizations` pane |

**2026-09-01：** 两个主要设置页是本地 Client 与 Engine，必须分开；UI 与 vscode 统一。SSOT：[settings-two-surfaces.md](settings-two-surfaces.md)。

MCP 运行态若另有页，标为后续切片，不发明第二 MCP UI。

#### Copilot TOC 剥离（INV-NO-COPILOT）

- 锚点：`settingsLayout.ts` — `COMMONLY_USED_SETTINGS`、`tocData` 子节点 `id: 'chat'`（含 `inlineChat.*`、`mcp` / `mcp.*`、`accessibility.signals.chat*` 等非 `chat.*` 键）。
- **选定（1b）：** 默认窗 **丢掉 `tocData` 子节点 `id: 'chat'`**（Agents Window 仍挂源结构），**再**叠加 commonly-used exclude。只滤 `chat.*` keyPatterns **不够**：`resolveSettingsTree` 按 setting key 滤，剥 `chat.*` 后 `inlineChat` / `mcp` / a11y 组仍有内容，不会被丢掉。
- `ITOCFilter`：默认窗 **始终**有一份 exclude filter，与 advanced-tag **与/或**；**禁止**在 `canShowAdvancedSettings()` 为 true 时把 filter 设回 `undefined`（HEAD `settingsEditor2.ts` 约 1476–1478 会整段关掉 filter，导致 `chat/*` 全回来）。
- `COMMONLY_USED_SETTINGS` / `getCommonlyUsedData` **不受** TOC filter — 签名改为可传 `excludeKeyPatterns`（§15 B8）；默认窗剔除 `GitHub.copilot-chat.manageExtension` 与 `chat.agent.maxRequests`。
- `agentsWindow` 只读/值语义 **不可**替代 TOC 可见性过滤。不要删 `settingsLayout.ts` 源结构（Agents Window 仍需 chat TOC donor）；默认窗在 `SettingsEditor2` 装配时不挂 `id: 'chat'` 子树。
- 剥 Copilot 时一并剥 `ChatAIDisabledSettingId`；产品若要「禁用 AI」→ 另挂 UA TOC 行，不留 Copilot 分组。
- `SettingsEditor2` 已注入 `IChatEntitlementService` 做 AI 搜索——donor 泄漏；默认窗 **移除 toggle DOM、不订阅 sentiment、且停 extension-toggle 路径**（§15 B8），不得当 UA 门闩。

#### 入口与深链

| Desktop | 本仓 v1 |
|---------|---------|
| AppTabBar 齿轮 | titlebar / 菜单 Preferences；**不**在 SessionBar 加第二齿轮 |
| StatusBar profile | **`status.conversation.engine`**（HEAD 已注册，文案恒「Engine not connected」）→ **v1 芯片可点**（无引擎亦然）→ command `workbench.action.openConnectionPreferences` → Preferences **Connection** pane 空态 + CTA。**有引擎改开 Engine pane 从切片 5 才启用**；v1–切片 4 **永远** Connection。**不用** `status.conversation.model`（Dock owner，Conversation 可见时省略） |
| `universe-agent://settings/<page>` | 路由表见下 |

**深链路由表（双宿主，ADR-037 fail-closed；handler / 别名见 §15 B9）：**

| page | 宿主 | 行为 |
|------|------|------|
| 已映射 Client TOC / setting id | `SettingsEditor2` | `openSettings`；v1 Client **分组**页不滚（无 TOC reveal API）；已注册 setting id 可用 `@id:` |
| `connection` / 等价 | `PreferencesEditor` | `openPreferences({ paneId: 'ua.connection' })` |
| `engine` / 等价 | `PreferencesEditor` | `openPreferences({ paneId: 'ua.engine' })` |
| **unknown / 未映射 / typo**（BL-2） | **Client `SettingsEditor2`** | **只打开不滚**（无 `query` / `revealSetting`）。**不**打开 `PreferencesEditor`。与未知 `paneId` 同构（§15 B2） |

从 Settings 模态链到 Customizations（`RequiresModal`）：`editorGroupFinder` 接管；**不**保证关掉 Client Settings（可能同组两个 tab）。文档化即可，不另发明壳、不改回 pane helper。

#### 无引擎

Client Settings **无连接也可开**。Connection pane 空态诚实「not connected」+ CTA；**不用** Welcome walkthrough 冒充连接向导。

### 2.3 取舍与拒绝

| 拒绝 | 理由 |
|------|------|
| `ModelsManagementEditor` 当 UA Provider UI | Copilot 模型管理 donor |
| Engine 整页 `settings.json` 字面量 | PC-BOUNDARY |
| Settings → `CONVERSATION_PART` | INV-TOPO |
| 删 `settingsLayout.ts` 源结构 | Agents Window 仍需 chat TOC donor |
| 自研 Keyboard shortcuts 全页 | 复用 `KeybindingsEditor` |

### 2.4 红线 / 不变量

- INV-NO-COPILOT：entitlement / `IChatModel` 不当 UA 门闩
- Customizations 文件中心默认保留（ADR-061 决策 5）
- Engines 连接生命周期不进 Activity rail（走 Settings 链接 → Connection pane）
- Connection **禁止**普通 setting key；TOC 链接仅允许 §1.1 实现族

---

## 3. 会话列表（Navigator roster）复用

### 3.1 五套「会话」边界（不变）

| 名称 | 角色 |
|------|------|
| UA session | **唯一权威**（有引擎后） |
| `IConversationStubService` | 无引擎占位；adapter 替换面 |
| `IChatModel` / `sessionResource` | **禁止**产品 roster |
| agentSessions / `IAgentSessionsService` | **禁止**产品 roster |
| `ISessionsService` | Agents Window only；workbench **不得** import |

### 3.2 选项对比

| 候选 | 适合 | 不适合 |
|------|------|--------|
| **A. 保持 `ConversationSessionsView` + 演进服务接口** | HEAD 已落地；`WorkbenchList` 22px；独立容器 `workbench.view.sessions` | 须收紧 Open-as-Editor 菜单 `when`；Projects 树须纪律避免第二 roster |
| **B. 复用 `AgentSessionsControl` 进产品容器** | 开发快 | INV-NO-COPILOT + welcome/entitlement |
| **C. 新 Part / 透镜内嵌列表** | — | INV-TOPO |
| **D. 迁入 Explorer 第二叶** | vscode 少一个 Activity 段 | 违反 Desktop 五段 |

**选定：A。** 拒绝 B/C/D。SessionBar SelectBox 去留见 §1.4（Deferred）。

### 3.3 选定设计

#### 宿主（**已落地**，保持）

- 容器：`CONVERSATION_SESSIONS_CONTAINER_ID` = `workbench.view.sessions`（order 10；签收后 `hideIfEmpty: false`，见 §1.3）。
- 叶：`CONVERSATION_SESSIONS_VIEW_ID` = `workbench.view.conversationSessions`；签收后唯一叶 `canToggleVisibility: false`。
- 类：`ConversationSessionsView extends ViewPane` + `WorkbenchList`。
- 动作：`workbench.action.conversationSessions.newSession` / `deleteSession`；删 **当前活动会话** `getActiveSessionId()`，非列表焦点行。
- 点击行 → `IConversationStubService.switchSession` → 切 `CONVERSATION_PART` 当前会话；**禁止** `openEditor(ChatEditorInput)`。

#### 有引擎后

- **同一 decorator token 演进（钉死，B11）：** 公开类型名 **`IConversationRosterService`**；`createDecorator` **保留 id `'conversationStubService'`**（**不**改成 `'conversationRosterService'`）。`IConversationStubService` 作为 **type alias + 同 token 常量别名** 过渡。View / SessionBar / StatusBar **同一注入点**。stub 类实现该接口；引擎 adapter **替换实现类**，不并行注册第二 token。禁止「两套 decorator、View 改注入点」过渡——那会复发 PC-TRUTH。见 §15 B11。
- View 只绑：`getSessions` / `getActiveSessionId` / `switchSession` / `createSession` / `deleteSession` / 变更事件。
- 高亮谓词 = `getActiveSessionId()`（与 SessionBar、Navigator 投影段共用 **单一 owner**）。

#### INV-TOPO：Open-as-Editor（行为已 guard / when 仍待收紧）

HEAD **行为已 guard：** `OpenAgentSessionInEditorGroupAction.runWithSessions` 对 `isDefaultCodeWindow` 短路为 `focusConversationPart`（`agentSessionsActions.ts`）；`chatEditorShellPaths.test.ts` 覆盖「默认窗不打开 `ChatEditorInput`」。剩余缺口是 **可见性/命令可达性** defense-in-depth：菜单 `when` 仍为 `IsSessionsWindowContext.negate()`（默认窗菜单项理论上可见，依赖 agentSessions viewer 未挂载）。该命令 **未**注册 `MenuId.CommandPalette`。

签收后切片 2：默认窗菜单 `when` 收紧（与 F1 门闩同族）。**不**把「行为未 guard」写成现状。ChatEditor / Quick Chat / resolver 旁路属 [M5](m5-ui-shell-hardening.md) H1–H4，本方案不重复改同一路径；若 M5 已收紧该 `when`，本切片以已有测关闭即可。

### 3.4 红线

- 不把 `AgentSessionsControl` 挂进 `workbench.view.sessions`（任何容器 id 均禁止）。
- roster 不升格 Part / 透镜。
- 不把 Copilot Archive All / Mark All Read 搬进产品 roster。
- 点击不切 `ChatEditorInput`。

---

## 4. Conversation 透镜组装

### 4.1 三槽所有权（**已落地**，冻结）

```text
CONVERSATION_PART          ← 槽宿主；不渲染产品 chrome
└── ConversationLens
    ├── sessionBar  → 自研产品 chrome
    ├── timeline    → 阅读列（chrome 自研；阶段 2 = ConversationTimelineTree）
    └── dock        → 自研表面（外仓 §8.3 指针）
```

| 槽 | 今天 | 所有权 |
|----|------|--------|
| sessionBar | rename / SelectBox / New / Delete / History | **必须自研** |
| timeline | stub DOM + markdown + `ConversationConfirmationSeat` | 列表算法绿field；**禁止**整棵 `ChatListWidget` |
| dock | textarea + Send + Inbox + Maximize | **必须自研**；禁止 `ChatInputPart` 整块 |

**人类已拍板：** SessionBar / Inbox / 透镜自研；虚拟化、markdown/code、confirmation 零件可复用（复用 = 函数/算法，不是嵌入整棵 widget）。

轨迹页（闭集「对话 | 轨迹」、检查记录表）见 [conversation-trajectory-lens.md](conversation-trajectory-lens.md)（`accepted`）。**不重开**三槽所有权；轨迹只换 `timeline` 槽的阅读面。

对话页过程折（ThinkRail 式缩进折叠）见 [conversation-process-fold.md](conversation-process-fold.md)（`accepted`）。**不重开**三槽所有权；只改对话列表 chrome。

### 4.2 选项对比（时间线）

| 候选 | 适合 | 不适合 |
|------|------|--------|
| **A. 继续 stub DOM 直至引擎** | 无引擎、短列表 | 长列表性能 |
| **B. 从 `ChatListWidget` 抽出**（知识层） | 复用 scrollLock / AutoScrollHolds | 仍与 chat widget 层耦合；`ChatTreeItem` 硬编码 |
| **C. 整块 `ChatWidget.render()` / 嵌入整棵 `ChatListWidget`** | 开发快 | **禁止** PC-HOST / INV-NO-COPILOT |
| **D. 绿field `ConversationTimelineTree`（选定）** | import lint 可机械隔离；数据源 UA 投影 | 初期实现成本 |

**选定：D**（签收后阶段 2）。见 §1.2。

### 4.3 内容 parts / Dock / 发送链

- Markdown/code：复用 `chatMarkdownContentPart` / `codeBlockPart` **渲染实现**，经 **唯一 adapter** 入参；**禁止**影子 `IChatRequestViewModel` / `IChatResponseViewModel`。
- **adapter chat import 白名单（钉死）：** `contrib/conversation` 生产代码仅允许 import `vs/workbench/contrib/chat/browser/widget/chatContentParts/**`。禁止 `chat/widget/chatListWidget`、`chatWidget`、`input/`（含 `ChatInputPart`）、`agentSessions/**`、其余 `contrib/chat/**`。关闭标准见 §10 切片 4 Tests。
- 工具卡：外仓 §8.6 阅读层级（只链）；打开 File / Terminal；非 L1。
- 权限座位：`ConversationConfirmationSeat`；虚拟化时 **不可回收 virt 行**；对齐外仓 §8.4（只链：overlay / ≤1 CTA / trailer）。
- welcome / quota / setup parts：**禁止**。
- Dock 表面：**已落地** textarea；可借 `input/editor/` 基础设施；旁路 vscode model/mode/permission picker。
- Send：stub `appendUserTurn`；引擎 adapter → UA，**不是** `IChatService.sendRequest`。Send ≠ Stop（不照抄 `ChatInputPart` execute 条；指针外仓 §8.3.6/7）。
- Inbox / Maximize：**已落地**。
- SessionBar **无** Settings 齿轮。抽出/复用零件须同步 `chatCodeOrganization.md` 约束（`widget/` 核心须被 `ChatWidget` 直接引用——产品树不冒充该核心）。

### 4.4 分阶段

1. **无引擎（已落）：** 三槽位置与所有权冻结。
2. **长列表：** `ConversationTimelineTree` + parts adapter；座位对齐 §8.4。
3. **引擎：** 3a 换服务/发送链；3b Dock 控件集随 queue/stop/ctx 解锁（槽位仍 Dock）。

槽位所有权先于接线；阶段 2 与 3a/3b 可交错。

### 4.5 红线

- 禁止 `ChatEditor` / `ChatViewPane` 整块进 `CONVERSATION_PART`
- 禁止嵌入整棵 `ChatListWidget`；禁止 `contrib/conversation` import `chatListWidget`
- 禁止 `ChatWidget.render()` 接管三槽
- 禁止影子 `IChat*ViewModel` 第二真相

---

## 5. Navigator tab 适配

### 5.1 HEAD 事实

| Desktop 段 | 容器 id | 内容 |
|------------|---------|------|
| Files（默认） | `workbench.view.explorer` | Explorer 真树 |
| Sessions | `workbench.view.sessions` | `ConversationSessionsView` |
| Projects | `workbench.view.navigator.projects` | `NavigatorStubView` empty |
| Agents | `workbench.view.navigator.agents` | empty |
| Team | `workbench.view.navigator.team` | empty |
| Engines | **无** Activity | Settings → Connection pane |

### 5.2 选项对比

| 候选 | 适合 | 不适合 |
|------|------|--------|
| **A. 一段一容器 + hideIfEmpty: true**（知识层 / HEAD） | 与 vscode 默认同构 | Activity 图标可消失 |
| **B. 产品四段 hideIfEmpty: false + 禁关唯一叶（选定）** | 五段图标恒在 | 与 vscode「空容器隐藏」习惯略异 |
| **C. 五段合并单容器多叶** | 少图标 | 违反 Desktop 一段一面 |
| **D. Engines Activity 段** | Singularity 有 | **禁止** Desktop IA |

**选定：B**（Explorer 不改 `hideIfEmpty`；Files 例外见 §1.3 HUMAN_DECISION）。见 §1.3。

### 5.3 宿主规则（**已落地**，保持）

```text
ACTIVITYBAR_PART 图标 → 一个 ViewContainer → ViewPaneContainer → 一叶 ViewPane
```

- 一段 = 一容器；Sessions **不回** Explorer。
- 默认 Files：`isDefault: true` 不变。
- **不升格** L1 / Preview / `CONVERSATION_PART`。
- 共享 chrome：**不**复刻 Singularity 双行 ActionBar + Body filter；用 `ViewPane` 标题 + 标题动作 + 列表 filter。

### 5.4 各 tab 选定

#### Files

保留 Explorer 整容器。打开仍走 `IEditorService` → Preview。不要搬进 Sources End（Sources Files 是投影，非第二权威树）。Open Editors 可留；不冒充 Sources Files。无引擎也成立。`hideIfEmpty` 维持 vscode 默认（§1.3 HUMAN_DECISION：接受图标可消失）。

#### Sessions

见 §3；本页不重开。不要用 Projects 树替代 Sessions；不套 Singularity ENG-IA-2 把 Sessions 并进 Projects。

#### Projects

| 阶段 | UI | vscode 零件 |
|------|-----|-------------|
| 无引擎 | empty + Open Folder / Recent CTA | `registerViewWelcomeContent` + command |
| 有本地工作区、无 UA | Recent + Current folders | `IWorkspacesService` + `WorkbenchList` / 两级树。**不是** UA session catalog |
| 有引擎 | Engine → Project → Session **只读发现** | `WorkbenchAsyncDataTree`；Engine = **分组轴**；只发 `switchSession`，不持久化第二份 catalog |

**禁止：** 第二份 flat roster；`IChatModel` 冒充 Project；Engine 设置 / Files 浏览进本 tab。

#### Agents

- 意图：当前 session agent 发现；inspect → Bottom Panel。
- 无引擎：honest empty。有引擎：`WorkbenchAsyncDataTree` hierarchy + 可选 Activity `WorkbenchList`。
- **禁止：** `AICustomizationManagementEditor` Agents（文件型定义）；`IChatAgentService` participant 列表；Agent Detail 为 Preview L1。
- **inspect：** 专用 Panel 容器 `workbench.panel.agentInspect` + 叶 `workbench.panel.agentInspect.view` + `AgentInspectView`（§1.3 / §15 B3）。默认折叠；打开 inspect 时 `openPanel`。**v1 单叶**：Agents/Team 共用同一叶（同一 view id + 同一 ctor）；第二叶 id **本轮不钉**，留给切片 3（可与 §9.6 EH 矩阵一起定）。

#### Team

- 有引擎：`WorkbenchList` Members + 可选 Tasks 叶；inspect 同 Agents（同一 Panel 容器可复用叶或第二叶，不新开 Preview）。
- **禁止：** SCM Accounts / Extensions 市场 / Preview Surface / 伪造 `team.*` RPC。

#### Engines

- rail **0×**；连接 → Settings 链接 → Connection pane；Projects 树内 Engine 仅分组轴。

### 5.5 会话身份所有权

`getActiveSessionId()` owner = roster 服务（今 `IConversationStubService`）。Projects / Agents 树投影同一 id 时只调 `switchSession`，**不得**另存 active id。本仓不另立法外仓没有的 invariant 号。

### 5.6 分阶段

1. **无引擎（已落）：** 五段 + Files 真树 + Sessions 列表 + 三 empty。
2. **本地增强：** Projects welcome + Open Folder / Recent（仍无 UA）；产品四段 `hideIfEmpty: false` + 禁关唯一叶。
3. **引擎：** Projects / Agents / Team 换投影；inspect 进已注册 Panel 容器；Sessions adapter。

---

## 6. 跨页红线汇总

| 不变量 | 体现 | 状态 |
|--------|------|------|
| **INV-NO-COPILOT** | Settings 剥 chat TOC；roster 不用 agentSessions；透镜无 setup parts；conversation 零 import `chatListWidget` | 已拍板，不重开 |
| **INV-TOPO** | 中心 `CONVERSATION_PART`；Settings / roster 非 Conversation；Open-as-Editor **行为已 guard**，菜单 `when` 仍待收紧 | 已拍板；可见性门闩仍待切片 |
| **ADR-061 决策 5 Customizations** | 文件型中心保留；TOC 链接不复制列表 | 已拍板，不重开 |
| **Engines 不进 Activity** | Navigator 0×；Projects Engine 只读分组；连接面 Preferences Connection pane | 已拍板，不重开 |
| 不升格 Navigator 为 L1 / Preview Surface | inspect 只进 Panel | 已拍板姿态 |
| 非正式 vs 已拍板 | 本文件 `accepted`；上表已拍板项禁止当开放选项重开 | — |

---

## 7. 已落地 vs 推荐 vs 已拍板

| 页 | 已落地（HEAD） | 选定（已签收） | 已拍板（勿重开） |
|----|----------------|------------------------|------------------|
| Settings | `useModal: 'some'` 模态；Customizations / Models 编辑器存在；`status.conversation.engine` 已注册 | `SettingsEditor2` 主壳（Client）；Copilot TOC exclude；Connection/Engine = **PreferencesEditor 子 pane** + TOC 链接；扩展 `openPreferences` pane id | Customizations 文件中心保留；Settings 不进 `CONVERSATION_PART` |
| roster | `workbench.view.sessions` + `ConversationSessionsView` + stub | 换 `IConversationRosterService`（**保留 `'conversationStubService'` token + type alias**）不换 View；菜单 `when` 收紧 Open-as-Editor | 不用 agentSessions / `IChatModel`；**行为**已 guard |
| 透镜 | `ConversationLens` 三槽 stub | 绿field `ConversationTimelineTree` + parts adapter；UA 发送链 | INV-TOPO；三槽自研 chrome |
| Navigator | 五段容器 + Explorer + 三 stub；`hideIfEmpty: true` | 一段一容器；产品四段 **`hideIfEmpty: false` + 禁关唯一叶**；Projects 本地 Recent；**专用 Panel inspect 容器** | Engines 不进 Activity；不升格 L1 |
| SessionBar SelectBox | 双入口共用 stub | **Deferred**（§1.4） | — |

---

## 8. 风险

| 风险 | 缓解 |
|------|------|
| 双宿主深链分叉（Settings vs Preferences pane） | 统一路由表：Client → `openSettings`；Connection/Engine → `openPreferences` + pane；unknown → **Client SettingsEditor2 不滚**；单测 `universe-agent://` 映射 |
| `openPreferences()` 今日无 pane id | 切片 1a 按 §15 B2 扩展；未知 paneId fail-closed 开 Client Settings 不滚；未扩展前不得宣称深链已通 |
| PreferencesEditor 内容面空 | 子 pane 最小 viable：Connection 空态 + Test 按钮占位 |
| 从 Settings 链到 Customizations / Connection / Engine 关模态 | 已知 `editorGroupFinder`；Back 回 Client Settings（§2.2）；文档化 UX |
| 绿field timeline 重复造轮 | 只复用 renderer 实现与算法参考；单测滚底 hold；备选见 §1.2 |
| `hideIfEmpty: false` 与 vscode 习惯冲突 | 仅产品四段；Explorer 不动（HUMAN_DECISION 接受 Files 可消失）；空态 honest + CTA |
| 禁 `canToggleVisibility` 与视图菜单习惯冲突 | 仅产品四段唯一叶；用户仍可用 Activity 图标切段 |
| 专用 Panel 容器与 Debug/Terminal 争位 | 默认折叠；打开 inspect 时 `openPanel`；备选复用已有 Panel 叶 |
| settingsTree 不再承担 Connection UI 后 Client 键仍须 `tocData` | Client 仍走 registry；记 [diff-footprint](../../docs/reference/code-oss-b2/diff-footprint.md) |
| adapter 未就绪时假数据 | honest empty / stub 契约显式标注 |
| Open-as-Editor 菜单 `when` 未收紧 | 切片 2 + 保持 `chatEditorShellPaths.test.ts` baseline；不与 M5 H1–H4 重复改旁路 |
| HEAD `navigatorStubViews.test.ts` 锁死 `hideIfEmpty: true` | 改容器时同步改测试，避免测试把旧 IA 锁死 |

---

## 9. 验证 / 怎样证伪（签收后，本波不跑）

级别：**CI** = 单测/注册表/import 扫描进 `scripts/test.sh` 域测；**manual-launch** = 启动后目视或 DevTools；**deferred** = 不阻塞签收切片。

### 9.1 Settings

- [ ] **CI** 默认窗打开 Settings → **模态**（出厂 `useModal: 'some'`）；TOC **无** `chat/*` 分组；Client 新产品 TOC 可见。
- [ ] **CI** Connection TOC 链接行类型为允许族（§1.1）→ 关闭 Client 模态 → Preferences Connection pane；**无** Connection host/port 写入 `settings.json`；**无** `_resolveSettingsTree` 为 Connection 抛错。
- [ ] **CI** Engine 运行时控件在 Preferences Engine pane，**不在** `ModelsManagementEditor`、**不在** Customizations 列表。
- [ ] **CI** Customizations 链接可达；Settings TOC **无** duplicate agents 列表。
- [ ] **CI** `universe-agent://settings/unknown`（及 typo）→ 打开 **Client `SettingsEditor2`** **不滚动**；**不**打开 `PreferencesEditor`。
- [ ] **CI** StatusBar engine chip（无引擎亦可点）→ command 打开 Preferences **Connection** pane 空态（v1 永远 Connection；有引擎改 Engine = 切片 5）。
- [ ] **CI** Preferences Connection/Engine pane 标题 **Back to Client Settings** → 关闭 Preferences → 再开 `SettingsEditor2`。
- [ ] **manual-launch** 从 Client TOC 点 Connection：无双模态栈、无闪屏无响应。

**证伪：** 任一 Copilot entitlement 门闩阻断 UA Client 设置；或 Provider key 出现在 `ModelsManagementEditor`；或 Connection 控件出现在 `settings.json` / settings 搜索命中 host/port key；或 unknown 深链打开 Preferences。

### 9.2 roster

- [ ] **CI** 容器 id = `workbench.view.sessions`；**无** `AgentSessionsControl` DOM。
- [ ] **CI** 点击行切换 `CONVERSATION_PART` 会话；**不**打开 `ChatEditorInput` tab。
- [ ] **CI** 默认窗 invoke `openSessionInEditorGroup` **不**打开 `ChatEditorInput`（baseline：`chatEditorShellPaths.test.ts` 已覆盖）。菜单 `when` 收紧后：默认窗该菜单项不可见（`evalWhen`；该命令 HEAD **不在** Command Palette，勿写「F1 不可用」为新缺口）。
- [ ] **CI** 引擎 adapter 接入后：listed id 与 SessionBar 标题一致；`getActiveSessionId` 单源。

**证伪：** 列表数据来自 `IChatModel` 或 agentSessions store。

### 9.3 透镜

- [ ] **CI** `ConversationPart` slots 仅 `ConversationLens` 渲染；**无** `ChatWidget` 子树。
- [ ] **CI** import 边界：`contrib/conversation` 生产代码 **不** import `chat/widget/chatListWidget`；adapter 仅 `chatContentParts/**`（见 §10 切片 4 关闭标准）。
- [ ] **manual-launch** 长列表 1k turns：虚拟化滚动；confirmation 座位非 virt 行，滚动后仍可达。滚底 hold 算法须有 **CI** 单测（可不跑 1k DOM）。
- [ ] **CI** Send 走 stub/UA adapter；**manual-launch** 无引擎时网络面板 **无** Copilot chat API。

**证伪：** 时间线出现 Copilot welcome / quota part；或 Send 调用 `IChatService.sendRequest`；或 `ChatListItemRenderer` 出现在产品 timeline 依赖链且绑 entitlement。

### 9.4 Navigator

- [ ] **CI** Activity 产品四段 + Files 容器 id 稳定；Engines **无** 图标。
- [ ] **CI** 关掉产品四段唯一叶的尝试失败或图标仍在；Projects/Agents/Team 点进见 empty + welcome。
- [ ] **CI / HUMAN_DECISION** Files（Explorer）：维持 `hideIfEmpty: true` 时，关尽 Explorer 可见叶后 **Files 图标可消失**（期望，非回归）。若人类改签 Files 恒在，则本条翻转为图标仍在。
- [ ] **CI** Projects 有引擎后树为只读发现；选 session → roster 同一 `switchSession`。
- [ ] **CI** Agents inspect 打开在 **Panel** 叶 `workbench.panel.agentInspect` / `workbench.panel.agentInspect.view`，Preview 无新 tab。

**证伪：** Navigator 段注册 `EditorInput` 工厂；或 Customizations Agents 与 Navigator Agents 同一入口；或 Activity 出现 Engines 图标；或 roster 进 Projects 扁平列表。

### 9.5 跨页集成

| 场景 | 期望 | 级别 |
|------|------|------|
| 冷启动无引擎 | Files 树可用；**产品四段** Activity 可见；Conversation stub 可 New/Send；Files 图标随 Explorer 默认 | **manual-launch**（可绑 M4 launch T1–T3，不阻塞本方案签收切片的 CI） |
| 打开 Settings | 无 Copilot 分组；Client TOC 可见；Connection 在 Preferences pane | **CI** TOC/pane + **manual-launch** 开模态 |
| 切换会话 | roster 与 SessionBar 标题一致；无 editor tab | **CI** |
| 长对话 | timeline 虚拟化；confirmation 可达 | **manual-launch** + 滚底 **CI** |
| Agent inspect | Panel 打开；Preview 不变 | **CI** registry + **manual-launch** 开 Panel |

**整方案证伪：** 任一产品会话流默认依赖 `IChatModel`、Copilot entitlement 或 `ChatEditorInput` 才能完成。

### 9.6 跨页 EH 探针（deferred）

装 2–3 枚扩展验证 Activity / Sidebar / Panel 贡献不破坏四段 id — 见 [eh-surface-matrix](../../docs/reference/code-oss-b2/eh-surface-matrix.md)。本波不跑。**deferred**，非签收门禁。

---

## 10. 切片方向（已签收，未开实施）

与 [M5](m5-ui-shell-hardening.md)：**M5 拥有** ChatEditor / Quick Chat / resolver 旁路（H1–H4）与 roster 在 Conversation 隐藏时的聚焦闭环（H5，改 `conversationSessionsView.ts` `onDidOpen`）。本族切片 **不重复改** 上述路径。切片 2 仅补 `openSessionInEditorGroup` 菜单 `when` 收紧。**M5 不拥有、也不改** `agentSessionsActions.ts` 的 `runWithSessions` 行为（HEAD 已 guard）；该文件的 `when` 归本族切片 2。可与 M5 并行，文件所有权如上。

**强制顺序（B12）：切片 1a 必须先 merge，再开 1b。** 切片 2 可与 1a/1b **并行**（无共享 Preferences/TOC 文件）。与 H5 并行时：本族不改 `onDidOpen`；M5 不改本文件的 `when`。

### 切片 1a — Preferences API + pane scaffold（必须先 merge）

`openPreferences({ paneId })` 契约（§15 B2）；registry 上提以便 services 查 paneId；常量 `ua.connection` / `ua.engine`；Connection/Engine pane **纯 UI 占位**（内存，不调 `updateValue`）；descriptor `showBackToClientSettings`；壳层 Back + **禁用** header search；未知 paneId fail-closed。

**Tests**
- 扩展 `preferencesService.test.ts`：已知 `paneId` → `openEditor(PreferencesEditorInput, { paneId }, MODAL_GROUP)`；未知 `paneId` → **不** open Preferences，改为 `openSettings()` 且无 `query`/`revealSetting`（与 unknown 深链同构）。
- pane 不调用 `IConfigurationService.updateValue`（host/port 输入 mock）。
- `IConfigurationRegistry` 扫描：无 Connection host/port key；Engine 键空集。
- Back：descriptor 为 true 时壳渲染 Back；点 Back → close Preferences + `openSettings()` 无 query。

**不包含：** TOC 模型、Copilot 剥离、深链 handler、StatusBar command。

### 切片 1b — TOC + Copilot + 深链 + StatusBar（1a merge 之后）

Copilot TOC exclude + Client `tocData` 分组骨架；`SettingsTreeNavigationLinkElement`；关模态 helper 接到 TOC command；unknown 深链；StatusBar 芯片 command → Connection pane。

**Tests**
- 新 `settingsUaToc.test.ts`：TOC 无 `chat/*`；Client 新产品分组存在；链接行是 `SettingsTreeNavigationLinkElement` 而非 dummy setting key / NewExtensions；commonly-used 无 Copilot 两项；无 entitlement toggle DOM。
- 新 `universeAgentSettingsDeepLink.test.ts`：映射页走正确壳；`settings/unknown` → `SettingsEditor2` 且 mock `revealSetting` **不被调用**、不开 Preferences。
- StatusBar：`status.conversation.engine` entry **有** command `workbench.action.openConnectionPreferences`；unit 调 action → `openPreferences({ paneId: 'ua.connection' })`（不 launch）。
- Connection 非 `IConfigurationRegistry` key（registry 扫描）。
- 对应 §9.1 其余 CI 项。切片 1b 完成时 1a+1b 测必须绿。

### 切片 2 — Roster

`IConversationRosterService` **同 token 演进**（保留 decorator id `'conversationStubService'` + type alias，§15 B11）；Open-as-Editor 菜单 `when` 收紧（行为 baseline 已在）。**可与切片 1 并行。** 本切片只改 `MenuId.AgentSessionsContext` 的 `when`；**不**改 `runWithSessions`，**不等** M5 merge 该文件。

**Tests**
- `conversationSessionsView.test.ts`：行点击 → `switchSession` 且 **不** `openEditor`。
- 保持并引用 `chatEditorShellPaths.test.ts` 为行为闭合 baseline。
- 若本切片改菜单 `when`：按 `chatEditorChrome.commandPalette.test.ts` / `agentSessionsActions.commandPalette.test.ts` 的 `evalWhen` 模式断言默认窗菜单项不可见。勿要求 Command Palette 项（HEAD 未注册）。**不要**在本切片重写 `agentSessionsActions` 行为测。
- 对应 §9.2 CI 项。

### 切片 3 — Navigator

产品四段 `hideIfEmpty: false` + 唯一叶 `canToggleVisibility: false`；Projects welcome + Open Folder / Recent；Panel inspect 容器骨架（v1 单叶；第二叶 id 本切片可钉或显式延期）。

**Tests**
- `navigatorStubViews.test.ts`：**一次性**改断言为产品四段 `hideIfEmpty === false`、唯一叶 `canToggleVisibility === false`（含 Sessions 容器）；不保留旧 `true` 断言并行。Explorer 容器保持 `hideIfEmpty === true`（与 §1.3 HUMAN_DECISION 一致）。
- 新 `agentInspectPanel.test.ts`：容器/叶注册在 `PANEL_PART`；descriptor 非 `EditorInput`。
- 对应 §9.4 CI 项。

### 切片 4 — 透镜

仅当验收需要长列表时上 `ConversationTimelineTree` + parts adapter；Dock 槽位不动（控件集随引擎解锁）。

**Tests — import 禁令关闭标准**
- 新 `conversationImportBoundaries.test.ts`：扫描 `contrib/conversation` **生产**文件（排除 `test/`），失败条件 = import 路径含 `chat/widget/chatListWidget`、`chatWidget`、`chat/browser/widget/input/`、`agentSessions/`、或 `contrib/chat/` 下 **非** `chatContentParts/` 前缀。允许：`vs/workbench/contrib/chat/browser/widget/chatContentParts/**`。
- 纳入 conversation 域 `scripts/test.sh`。HEAD `layersChecker.ts` **只做分层/native-type**，**不**覆盖 contrib 内部路径禁令；**不得**宣称 `valid-layers-check` 已闭合本项。可选后续给 checker 加 RULE，不作为本切片关闭标准。
- `ConversationTimelineTree` 滚底 hold 单测（可参考 `chatListWidget` 测试所断言的行为，**禁止** import 该模块）。
- 对应 §9.3 CI 项。1k DOM / 网络面板 = manual-launch。

### 切片 5 — 引擎波

adapter 替换 stub（同 token）；Dock 控件集 3b — 以各页分阶段为准，本族不接引擎实现。

**Tests**
- roster listed id 与 SessionBar 标题一致；`getActiveSessionId` 单源。Send **不**调用 `IChatService.sendRequest`（负向 mock）。本族仍不写引擎实现测。

SessionBar 去 SelectBox **不进本序列**，见 §1.4 Deferred。

---

## 11. 非目标（整族）

- 不接 UniverseAgent 引擎 / adapter 实现（本方案只定边界与宿主）。
- 不改 `layout.ts` grid、Diff FORK、`product.json`、ADR-003 token。
- 不把 Settings / roster 做成 `CONVERSATION_PART`。
- Welcome / Command Palette Overlay / AppTabBar 多会话 tab / Workbench Overview·Planning·Project Context：**次优先**，本族不写方案。
- 本文件不改 `src/`；实施另开会话按切片开。

---

## 12. 知识层同步（签收后改四页选定设计）

本文件为已签收决策 SSOT。**细化 round 1 已在四页文首加 SSOT banner**（B1）。选定设计段落的结构性改写 **已于 2026-09-01 完成**（loop/A @103410c7），四页与 HEAD 对齐；冲突仍以本文件为准。

同步时保持现有 banner：「结构性决策 SSOT = `dev/plans/page-access-schemes.md`；冲突以父方案为准。」

| 页 | 待同步 |
|----|--------|
| [settings-ua-access.md](../../docs/reference/code-oss-b2/settings-ua-access.md) | §2–§3：Connection/Engine 从「非 setting TOC 元素 + Engine 分组内嵌控件」改为 TOC 链接 → `PreferencesEditor` 子 pane；钉死 pane、拒绝并列 EditorInput；补 TOC 链接允许族（`SettingsTreeNavigationLinkElement`）与 Client→Preferences 关模态/Back；补 HEAD：`openPreferences()` 无 pane id、registry 现无 pane。§6 StatusBar：无引擎可点 → Connection pane；unknown 深链 → Client SettingsEditor2 不滚。§7 Connection 空态从「滚到 Settings Connection 分组」改为打开 Connection pane。 |
| [conversation-lens-assembly.md](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) | §3：阶段 2 从「抽出 `ChatListWidget` 虚拟化」改为绿field `ConversationTimelineTree` + 零 import `chatListWidget`；机械 enforce 写明 `conversationImportBoundaries.test.ts` + `chatContentParts/**` 白名单。 |
| [navigator-tabs-access.md](../../docs/reference/code-oss-b2/navigator-tabs-access.md) | §2：撤回「v1 接受 `hideIfEmpty: true`」；改为产品四段 `false` + 唯一叶禁 toggle；Explorer 不动并写 Files 例外 HUMAN_DECISION。§3.4 / §3.5：inspect 从「未选机制」改为专用 Panel 容器 `workbench.panel.agentInspect`；v1 单叶。§3.6 连接面从「Settings Connection 自定义控件」改为 Preferences Connection pane（与 Settings 页同步）。 |
| [session-roster-reuse.md](../../docs/reference/code-oss-b2/session-roster-reuse.md) | §3 容器 `hideIfEmpty: true` 描述改为指向本文件 §1.3（签收后 false）。**不**把 SessionBar 去 SelectBox 写进该页为选定（保持 Deferred，或加一句「见父方案 Deferred」）。Open-as-Editor：区分行为已 guard vs 菜单 when 待收紧；roster **同 token 演进**。 |

四页其余同意点（Client=`SettingsEditor2`、Customizations 切分、`ITOCFilter`、换服务不换 View、五套会话、三槽冻结、一段一容器、Engines 不进 rail、深链 fail-closed、本波不实施）**保持**，同步时不要重开已拍板项。

---

## 13. 与两路候选 / 知识层的同意点（不重开）

| 主题 | 共识 |
|------|------|
| Settings 主宿主（Client） | `SettingsEditor2`，不自研 Overlay Part |
| Customizations | ADR-061 决策 5 文件中心保留；Engine runtime 分离 |
| Copilot 剥离 | 默认窗丢掉 `tocData` `id: 'chat'` + 始终 exclude filter；`agentsWindow` ≠ TOC 可见性 |
| roster 宿主 | `ConversationSessionsView` + 独立容器；换服务不换 View |
| 五套会话边界 | UA / stub / `IChatModel` / agentSessions / `ISessionsService` 画线 |
| 透镜三槽 | 自研 sessionBar + dock；禁止 `ChatWidget.render` / `ChatInputPart` 整块 |
| 发送链 | UA adapter，非 `IChatService.sendRequest` |
| Navigator 拓扑 | 一段一容器；Files = Explorer；Engines 不进 rail |
| Projects Engine 节点 | 只读分组轴，非连接生命周期 |
| 深链 | ADR-037 fail-closed |
| 本波 | 不实施 |

composer 与 fast 在上述同意点上无结构性分歧。fast 相对 composer 的增量（钉死 pane、禁 toggle、选定 inspect 容器）已被本文件吸收；fast 的 SessionBar 去 SelectBox **未**升格为选定（Deferred）。步骤 5 吸收 TOC 链接族、unknown 宿主、Files HUMAN_DECISION、测试 DoD、规则 16，不推翻上表。

---

## 14. HUMAN_DECISION / 签收默认

| 项 | 签收结论 | 若日后另选 |
|----|----------------|------------|
| **规则 16 审查** | 本轮已走并行只读审查并改稿（见文末）；`status: accepted` | — |
| **Files / Explorer `hideIfEmpty`** | 接受 Files 图标可消失；产品「五段常在」= 产品四段 | 要求 Files 恒在 → Explorer `hideIfEmpty: false`（仍不禁 Explorer 多叶 toggle） |
| **Client `useModal: 'off'`** | v1 接受分裂（Client 可 Preview；Connection/Engine 恒模态）；不改出厂 `useModal` | Overlay 恒成立 → §2.2 (a)/(b)/(c) |
| **TOC 链接形态 B** | 签收形态 **A**（新 child 类型） | 工程师若要改走 group command header，**须人类回签** |

非 HUMAN_DECISION、本审查已钉死：TOC 链接允许族 **A**（走 B 须人类回签）；unknown → Client SettingsEditor2 不滚；roster 同 token + 保留 `'conversationStubService'`；adapter `chatContentParts/**` 白名单；StatusBar 无引擎可点 → Connection pane（v1 永远 Connection）；inspect v1 单叶 `workbench.panel.agentInspect`；切片 1a 先于 1b。

---

## 15. 实施契约（MPDR 细化 round 1）

执行方 round 1 Blocking B1–B12 的可实施答案。与前文冲突时 **以本节为准**（同文件内最新钉死）。**本文件不改 `src/`；实施另开会话按切片开。**

### 15.1 B1 — 知识层 vs 父方案

见文首「切片 0 / 签收 checklist」。四页 **只加 banner**，选定设计全文留给签收后 §12。实施者必须按本文件（含 TOC 链接 → Preferences pane），禁止按四页旧 Connection 树内形态施工。

### 15.2 B2 — `openPreferences` 接口草案与调用链

**签名（钉死）：**

```ts
// src/vs/workbench/services/preferences/common/preferences.ts
export interface IOpenPreferencesOptions {
	readonly paneId?: string;
}

export interface IPreferencesEditorOptions extends IEditorOptions {
	readonly paneId?: string;
}

openPreferences(options?: IOpenPreferencesOptions): Promise<void>;
```

**Registry 上提（层规则）：** `PreferencesService` 在 `workbench/services/browser`，**不得** import `contrib/preferences`。`IPreferencesEditorPane` 含 `HTMLElement` / `DOM.Dimension`，**禁止**放进 `services/preferences/common/`（会撞 `valid-layers-check`）。切片 1a 将 registry 挪到 `src/vs/workbench/services/preferences/browser/preferencesEditorPaneRegistry.ts`；`contrib/preferences/browser/preferencesEditorRegistry.ts` **改为 re-export**。`IOpenPreferencesOptions` / `IPreferencesEditorOptions` 仍在 `common/preferences.ts`（无 DOM）。

**调用链：**

```
TOC / StatusBar / 深链 / Back 的反向
  → ICommandService.executeCommand(OPEN_CONNECTION|OPEN_ENGINE)
    或 helper openUaPreferencesPane(paneId)
      → IPreferencesService.openPreferences({ paneId })
        → Registry.getPreferencesEditorPanes() 查 paneId
        → 已知：editorService.openEditor(PreferencesEditorInput, { paneId }, MODAL_GROUP)
        → 未知 / 超时：不打开 Preferences；openSettings() 无 query / revealSetting / focusSearch；return
      → PreferencesEditor.setInput(input, options)
        → 读 (options as IPreferencesEditorOptions).paneId
        → 命中 tab → onDidSelectPreferencesEditorPane(paneId)
        → 省略 paneId → 按 registry order 的第一个 tab
```

**wait 落点（钉死）：** 只在 `PreferencesService.openPreferences`、**`openEditor` 之前**。HEAD `registerPreferencesEditorPane` 每次 fire 单个 descriptor（`preferencesEditorRegistry.ts:85–90`）；`setInput` 在 `preferencesTabActions.length === 0` 时直接 no-op（`preferencesEditor.ts:108–110`），事后 `onDidRegister` 只加 tab、**不会**按已传入的 `paneId` 再选。禁止先打开空 Preferences 再关掉。

**超时：** 等 `onDidRegisterPreferencesEditorPanes` **一次**，上限 **2000ms**；超时仍未知 → fail-closed 表。1a 单测：**先** `registerPreferencesEditorPane` **再** `openPreferences`（可不依赖 wait）。

**Fail-closed 表：**

| 输入 | 是否打开 PreferencesEditor | 行为 |
|------|----------------------------|------|
| `openPreferences()` 无 paneId | 是 | 首 tab（order 最小） |
| `paneId: 'ua.connection'` 且已注册 | 是 | 选 Connection tab |
| `paneId: 'ua.engine'` 且已注册 | 是 | 选 Engine tab |
| 未知 / 未注册 paneId | **否** | `openSettings()` 不滚（与 unknown 深链同构） |
| 已开 Preferences，再 open 已知另一 paneId | 复用同一 `PreferencesEditorInput`（`matches()`） | `setInput` 切 tab，**不**第二枚 |

**序列化：** `PreferencesEditorInput` v1 **不**加 paneId 字段。现有 serializer `serialize → ''` 保持。重启后回默认首 tab（Connection，因 order 10 < 20）**可接受**。

**与 donor 未来 pane 的 order：** UA Connection `order: 10`，Engine `order: 20`。UA **命令路径永远传显式 paneId**，不依赖 `[0]`。无 paneId 的 `openPreferences()` 仅用于 donor/通用入口；若 donor 日后以 `order < 10` 注册，会成为无 paneId 时的首 tab——可接受，因 UA 从不省略 paneId。

**CI（`preferencesService.test.ts`）：** 捕获 `openEditor` 的 input `typeId` + `options.paneId` + `group === MODAL_GROUP`。未知 paneId：assert 未创建 `PreferencesEditorInput`（或 typeId 为 Settings），且 options 无 `revealSetting`/`query`。

### 15.3 B3 — id / 常量文件 / tab order / 复用

| 常量 | 值 | 文件 |
|------|----|------|
| `UA_CONNECTION_PANE_ID` | `'ua.connection'` | `src/vs/workbench/contrib/conversation/common/uaPreferencesPanes.ts` |
| `UA_ENGINE_PANE_ID` | `'ua.engine'` | 同上 |
| `UA_CONNECTION_PANE_ORDER` | `10` | 同上 |
| `UA_ENGINE_PANE_ORDER` | `20` | 同上 |
| `AGENT_INSPECT_CONTAINER_ID` | `'workbench.panel.agentInspect'` | `src/vs/workbench/contrib/navigator/browser/agentInspectIds.ts`（切片 3） |
| `AGENT_INSPECT_VIEW_ID` | `'workbench.panel.agentInspect.view'` | 同上 |

Pane 命名空间 **`ua.*`**（产品 Preferences 子页）；inspect 容器 **`workbench.panel.*`**（vscode Panel 惯例，对照 `workbench.panel.output` / `workbench.panel.markers`）。

**localize：** title / Back 文案工程师可 invent key（建议 `ua.connectionPane` / `ua.enginePane` / `ua.backToClientSettings`）；**id 字符串不可改**。

**icon：** v1 `Codicon.plug`（Connection；HEAD 无 `Codicon.plugs`）/ `Codicon.server`（Engine），非产品合同，可换。

**Tab order：** Connection < Engine（10 < 20）。默认首 tab = Connection。

**复用已开 Preferences：** `PreferencesEditorInput.matches()` 已是类型相等 → `openEditor` 复用同一枚，`setInput` 切 pane。禁止再 `new` 第二枚 Input 当「强制切 tab」。

**Pane 注册落点：** `src/vs/workbench/contrib/conversation/browser/uaPreferencesPanes.contribution.ts` 调 `registerPreferencesEditorPane`（经 services 上提后的 registry）。实现类：`connectionPreferencesPane.ts` / `enginePreferencesPane.ts` 同目录。常量文件 `conversation/common/uaPreferencesPanes.ts` 是 **新建目录**（HEAD `contrib/conversation/common/` 不存在）。

**加载图（1a 必写，否则 registry 永空）：** 默认窗只从 `workbench.common.main.ts:232` 拉 `conversation.contribution.js`。1a **必须**在 `conversation.contribution.ts` **side-effect import** 该 contribution（或并列加入 `workbench.common.main.ts`）。禁止只新建文件却不进加载图。

### 15.4 B4 — `SettingsTreeNavigationLinkElement` 与 tocData

**签收形态 A（钉死）。走备选 B 须人类回签。**

**tocData 表示法（钉死 `navigationLinks[]`，不后置硬编码注入）：**

```ts
export interface ITOCNavigationLink {
	id: string;
	label: string;
	commandId: string;
}

export interface ITOCEntry<T> {
	id: string;
	label: string;
	order?: number;
	children?: ITOCEntry<T>[];
	settings?: Array<T>;
	navigationLinks?: ITOCNavigationLink[];
	hide?: boolean;
}
```

`createSettingsTreeGroupElement`：在 `settings` / `children` 之后，把 `navigationLinks` map 成 `SettingsTreeNavigationLinkElement`（字段：`id`, `label`, `commandId`）。

**`_resolveSettingsTree`（1b 必改，否则链接行不可达；HEAD `settingsTree.ts` 约 566–596）：** 仅含 `navigationLinks`、无 `settings`/`children` 的 TOC 节点（`ua/connection`、`ua/engine`、`ua/customizations`）今天会 **throw** 或被 filter 剥掉。1b 须三处同时改：

1. return 对象 **pass-through** `navigationLinks`。
2. 空组判定：`navigationLinks?.length` 算作有效内容，不得当 leftover 空组抛错。
3. 子组 filter **保留** navigation-only 组（不要因无 setting child 丢掉）。

**Renderer / Delegate：** `SettingsTreeDelegate.getTemplateId` 与 `estimateHeight` 须识别新 child 类型；renderer 对标 `SettingNewExtensionsRenderer`（HEAD 约 1162）。**可点击链接行在右栏 settings 树**（`settingsTree.ts`）；左栏 `TOCTree` 只迭代 `SettingsTreeGroupElement`（`tocTree.ts:158–162`），左 TOC 出现的是 `ua/connection` **组**，不要把 renderer 挂到 TOCTree。

**示意 tocData（id 钉死，label 可 localize）：**

```text
ua                          (group)
  ua/display                settings: ['ua.client.display.*']
  ua/chatInput              settings: ['ua.client.chatInput.*']
  ua/startup                settings: ['ua.client.startup.*']
  ua/keyboardEnter          settings: ['ua.client.keyboardEnter.*']
  ua/notifications          settings: ['ua.client.notifications.*']
  ua/permissions            settings: ['ua.client.permissions.*']
  ua/clientTools            settings: ['ua.client.clientTools.*']
  ua/connection             navigationLinks: [{ id: 'ua/connection/open', commandId: OPEN_CONNECTION }]
  ua/engine                 navigationLinks: [{ id: 'ua/engine/open', commandId: OPEN_ENGINE }]
  ua/customizations         navigationLinks: [{ id: 'ua/customizations/open', commandId: 'aiCustomization.openManagementEditor' }]
```

**搜索：** 链接行 **不**进 settings 搜索（`SearchResultModel` / `filterSettings` 只扫 `SettingsTreeSettingElement`）。v1 **不做** label 命中。host/port **不得**因链接出现——它们不是 setting key。

**Command 两族（测试按 `commandId` 区分）：**

| 链接 | commandId | 目标 |
|------|-----------|------|
| Open Connection… | `workbench.action.openConnectionPreferences` | close Settings → `openPreferences({ paneId: 'ua.connection' })` |
| Open Engine… | `workbench.action.openEnginePreferences` | close Settings → `openPreferences({ paneId: 'ua.engine' })` |
| Open Customizations | `aiCustomization.openManagementEditor` | **复用既有 command**；`RequiresModal` + `editorGroupFinder` 接管模态 |

**Renderer（C4）：** 在 `settingsTree.ts` 新增 `SettingsTreeNavigationLinkRenderer`，挂进现有 `SettingTreeRenderers`（对标 `SettingNewExtensionsRenderer`）。复用 settings 行高与 focus 环；a11y `role="link"`。不另开文件，除非 1b 体积被迫拆。

### 15.5 B5 — 关模态序列（伪代码）

Helper 落点：`src/vs/workbench/contrib/conversation/browser/uaPreferencesNavigation.ts`。`SettingsEditor2Input` 从 `workbench/services/preferences/common/preferencesEditorInput.ts` 引用（services，合法）。`MODAL_GROUP` 从 `workbench/services/editor/common/editorService.ts`。

```ts
async function closeAllSettingsEditor2(accessor: ServicesAccessor): Promise<void> {
	const groups = accessor.get(IEditorGroupsService);
	for (const group of groups.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
		for (const editor of group.editors) {
			if (editor instanceof SettingsEditor2Input) {
				await group.closeEditor(editor);
			}
		}
	}
}

async function closeAllPreferencesEditor(accessor: ServicesAccessor): Promise<void> {
	const groups = accessor.get(IEditorGroupsService);
	for (const group of groups.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
		for (const editor of group.editors) {
			if (editor instanceof PreferencesEditorInput) {
				await group.closeEditor(editor);
			}
		}
	}
}

// TOC Connection / Engine / StatusBar
async function openUaPaneReplacingClientSettings(accessor: ServicesAccessor, paneId: string): Promise<void> {
	await closeAllSettingsEditor2(accessor);
	await accessor.get(IPreferencesService).openPreferences({ paneId });
	// openPreferences 内部恒 MODAL_GROUP
}

// Back
async function backToClientSettings(accessor: ServicesAccessor): Promise<void> {
	await closeAllPreferencesEditor(accessor);
	await accessor.get(IPreferencesService).openSettings();
	// 无 query / revealSetting / focusSearch → 不滚 TOC
}
```

**两路：**

| 当前 Client 位置 | 开 Connection | Back |
|------------------|---------------|------|
| MODAL_GROUP（出厂 `useModal: 'some'`） | close Settings（模态内）→ open Preferences `MODAL_GROUP` | close Preferences → `openSettings()` 再进模态 |
| Preview tab（`useModal: 'off'`） | close Preview 中的 Settings → open Preferences **仍** `MODAL_GROUP` | close Preferences 模态 → `openSettings()` 进 Preview |

空 group：v1 不额外 `removeGroup`。验收「无双模态栈」= 关完后同一时刻不得同时存在 `SettingsEditor2Input` 与 `PreferencesEditorInput`（unit：close 后 open 前断言；或 spy 两次 `openEditor` 之间 Settings 已 close）。

**Back 不恢复 TOC 滚动：** `openSettings()` 不带 query 即为 pass。

HEAD Customizations 先例：`AICustomizationManagementEditorInput`（`RequiresModal`）+ `aiCustomization.openManagementEditor`（`aiCustomizationManagement.contribution.ts` / `chatActions.ts`）。Connection **不**靠 RequiresModal（Input 无该 capability；靠 `openPreferences` 的 `MODAL_GROUP` 实参），故必须显式 close Settings。

### 15.6 B6 — Back chrome 与 header search

- Back **由 PreferencesEditor 壳**按 **active pane descriptor** 条件渲染，pane 实现 **不**自绘标题栏。
- `IPreferencesEditorPaneDescriptor` 增 `showBackToClientSettings?: boolean`。Connection / Engine = `true`。未设 = 不渲染 Back（donor pane 未来默认）。
- `showBackToClientSettings === true` **同时禁用 header 跨 pane search**：隐藏或 disable `searchWidget`，不把检索词传到 `pane.search()`。不另加 `disableHeaderSearch` 字段。
- Customizations 不走 PreferencesEditor，无 Back。

**调用链（钉死，避免 contrib 互挖）：** HEAD `PreferencesEditor`（`preferencesEditor.ts:37–61`）不注入 `IPreferencesService` / `IEditorGroupsService`，只有 search + tabs。源码组织禁止 `contrib/preferences` import `contrib/conversation`。因此：

1. 注册无产品层 import 的 command：`workbench.action.backToClientSettings`（实现落在 `conversation` contribution，body = §15.5 `backToClientSettings`）。
2. PreferencesEditor 壳只 `ICommandService.executeCommand('workbench.action.backToClientSettings')`（或等价：注入 workbench services 直接 `group.closeEditor` + `IPreferencesService.openSettings()`）。**禁止**从 donor 壳 import `uaPreferencesNavigation.ts`。
3. `uaPreferencesNavigation.ts` 限定为 **1b** 的 TOC / StatusBar 关 Settings 路径（`openUaPaneReplacingClientSettings`），不是 1a 壳层 Back 的调用面。

### 15.7 B7 — 切片 1 纯 UI 占位与 CI

切片 1 Connection/Engine pane = **纯 UI 占位（组件内存 state）**。不引入 `ConnectionProfileStore`、不引入 adapter 接口、不写 `IStorageService` 当伪持久化（避免被误当成产品真相）。

**CI：**

1. `IConfigurationRegistry` 扫描：不存在 key 匹配 `ua.connection.*` / `connection.host` / `connection.port` 及字面 `host`/`port` 的 UA 产品键。
2. pane 单测：stub `IConfigurationService.updateValue`；填写 host/port/TLS、点 Test → **assert `updateValue` 调用次数 = 0**。
3. Engine：**允许进 registry 的键名清单 = `[]`（空集）**。runtime 控件全在 pane。SettingsEditor2 **不**建 Engine 配置分组（避免与「Open Engine…」重复，C2）。

无引擎时 Engine pane：诚实 disabled / empty CTA，**不是**可编辑本地 scratch 冒充引擎 key。

### 15.8 B8 — Client tocData / commonly-used / entitlement / 键注册

**tocData 节点 id**（格式钉死，见 15.4 示意）。`universe-agent://settings/<page>` 对 Client **分组** v1 **打开不滚**（HEAD 无稳定 TOC reveal API）。将来 setting 键用 `@id:ua.client.*`。

**`getCommonlyUsedData` 签名：**

```ts
getCommonlyUsedData(
	settingGroups: ISettingsGroup[],
	excludeKeyPatterns?: readonly string[],
): ITOCEntry<ISetting>;
```

默认 Code 窗传入 `['GitHub.copilot-chat.manageExtension', 'chat.agent.maxRequests', 'chat.*']`（至少剔除 Copilot 两项；`chat.*` 防 commonly-used 复发）。Agents Window **不传** exclude（保留 donor commonly-used）。接线：`SettingsEditor2` 已有 `environmentService.isSessionsWindow`。

**默认窗丢掉 `tocData` 子节点 `id: 'chat'`**（见 §2.2）：`settingsLayout.ts` 该子树含 `inlineChat.*`、`mcp` / `mcp.*`、`accessibility.signals.chat*`，只 exclude `chat.*` 剥不掉。Agents Window 仍挂源结构。默认窗 **始终**传入 exclude filter，**即使** `canShowAdvancedSettings()` 为 true，也不得把 filter 设回 `undefined`。

**Entitlement：** 默认 Code 窗同时关闭三条路径（同一关闭标准）：

1. 不创建 `showAiResultsAction` toggle DOM。
2. **不**订阅 `IChatEntitlementService.onDidChangeSentiment`（HEAD 构造无条件订，`settingsEditor2.ts:331–333`）。
3. **不**走 extension-toggle：`onConfigUpdate` 仍调 `getExperimentalExtensionToggleData(this.chatEntitlementService, …)`（约 1494），该函数按 `sentiment.hidden/disabled` 短路（`preferences.ts:137–151`）。默认窗不 fetch / 不插入推荐扩展行。

禁止「hidden 但仍订阅 sentiment」。Agents Window 可保留 donor。可去掉默认窗对 `IChatEntitlementService` 的注入（若拆构造成本高，至少 1–3 全停）。

**UA Client 键注册：**

- `src/vs/workbench/contrib/conversation/common/uaClientSettings.ts` — `registerConfiguration`（键名 `ua.client.*`）
- `src/vs/workbench/contrib/conversation/browser/uaClientSettings.contribution.ts` — 入口 side-effect import

**层：** 必须 `contrib/conversation`（产品键），**禁止**放 `contrib/preferences`（donor）。`tocData` 仍在 `settingsLayout.ts` 用 key pattern 引用，不 import conversation 实现。

切片 1 可只注册分组骨架 + 0～N 个占位键；无键的分组须有至少一条非 leftover 的 pattern 或显式空组策略——若 HEAD leftover 警告，放 **一条** `ua.client.display.placeholder` 仅作 TOC 占位 **须在 1b 注明且不得进 commonly-used**。优先：有真实 Client 键再进 TOC。**Deferred：** 各分组完整键清单留给产品签收，不阻塞 1b 骨架。

### 15.9 B9 — 深链 handler / 别名 / 「未滚动」

**Handler 落点：** `src/vs/workbench/contrib/conversation/browser/universeAgentDeepLink.contribution.ts`  
实现 `IURLHandler`，`IURLService.registerHandler`。scheme = `'universe-agent'`（Desktop ADR-037；**不**绑 `product.urlProtocol`）。OS 级协议注册 **Deferred**。切片 1b 测直接 `handler.handleURL(URI.parse(...))`。

**page 别名（lowercase、trim、去尾 `/`；authority 忽略或为 `settings`）：**

| URI 例 | 解析 page | 行为 |
|--------|-----------|------|
| `universe-agent://settings/connection` | `connection` | Connection pane |
| `universe-agent://connection` | `connection` | 同上 |
| `universe-agent://settings/engine` | `engine` | Engine pane |
| `universe-agent://engine` | `engine` | 同上 |
| `universe-agent://settings` / `.../client` / `.../settings/` | `client` | `openSettings()` 不滚 |
| 上表 Client 分组 id（`display`, `chat-input`, `chatInput`, `startup`, `keyboard-enter`, `notifications`, `permissions`, `client-tools`） | 映射到 toc 节点 | v1 同 client：打开不滚 |
| 其它 / typo | unknown | `openSettings()` 不滚；不开 Preferences |

**「未滚动」CI：** mock `IPreferencesService.openSettings`；unknown / client 路径 assert 调用参数 **不包含** `revealSetting`，且 `query` 为 `undefined`。不依赖 SettingsEditor2 内部 view state。

### 15.10 B10 — StatusBar command 与状态机

| 项 | 钉死 |
|----|------|
| Action | `workbench.action.openConnectionPreferences` → `openUaPaneReplacingClientSettings(..., 'ua.connection')` |
| Action | `workbench.action.openEnginePreferences` → 同上 Engine |
| StatusBar `command` | `{ id: 'workbench.action.openConnectionPreferences', title: '' }` |

**状态机：**

```text
v1 / 切片 1b–4（无引擎信号）：永远 Connection pane
切片 5+（adapter 提供 connected）：connected → Engine pane；否则 Connection
```

v1 **不**发明 `engineConnected` 探测。芯片无引擎亦可点。

**CI（unit，不 launch）：** `conversationSessionStatusBar` 测 `createEngineEntry().command.id === 'workbench.action.openConnectionPreferences'`；command 测 spy `openPreferences` 收到 `{ paneId: 'ua.connection' }`。

### 15.11 B11 — roster token / 并行 / M5

```ts
export const IConversationRosterService = createDecorator<IConversationRosterService>('conversationStubService');
export type IConversationStubService = IConversationRosterService;
export const IConversationStubService = IConversationRosterService;
```

保留 decorator id **`'conversationStubService'`**。公开类型名 `IConversationRosterService`。**不**改 id（避免无谓全仓替换；非 extension-facing 稳定 API，但仍零收益）。

**接口 surface：** 切片 2 **不冻结**新方法。今天 `ConversationStubSession` / stub 方法 = 无引擎 v1 契约；引擎 adapter 必实现同一组（`getSessions` / `getActiveSessionId` / `switchSession` / `createSession` / `deleteSession` / 两事件）。扩展方法留给切片 5。

切片 2 可与切片 1 **并行**。共享冲突：无 Preferences/TOC 文件。`agentSessionsActions.ts`：HEAD `runWithSessions` **已 guard**，本族切片 2 **只改** `MenuId.AgentSessionsContext` 的 `when`。**M5 不拥有、不改该文件行为**（M5 H1–H4 列的是 `chatActions.ts` / resolver / Quick Chat；H5 改 `conversationSessionsView.ts`）。不必等 M5 merge 再改 `when`。本族 **不**改 `runWithSessions` 测。

SessionBar：type alias 后旧注入名仍编译；切片 2 **同 PR** 改 import 到新名（或保留 alias 不改调用点——alias 存在则漏改仍编译，C16）。

### 15.12 B12 — 切片顺序

官方顺序：**1a merge → 1b**。不得把 TOC/Copilot/深链放进 1a 同一 PR。其后：2 与 3 可并行；4 按长列表验收；5 等引擎里程碑（§11 / C20）。

工程师理解的 B2→B3→B4→B5/B6 链：1a 覆盖 B2/B3/B5/B6/B7；1b 覆盖 B4/B8/B9/B10。B8 与 1a 不同文件为主（`settingsLayout.ts` 仅 1b），避免与 1a registry 上提抢同一 PR。

### 15.13 Clarification C1–C20

| ID | 钉死 / Deferred |
|----|-----------------|
| C1 | Connection/Engine：**不**聚焦 header search（已禁用）。`focusSearch` 不从 Client 继承。Tab：Back → pane tabs → pane body。更细 a11y 顺序 Deferred。 |
| C2 | v1 **无** SettingsEditor2 Engine 配置分组（Engine registry 空集）。用户只见 TOC「Open Engine…」。 |
| C3 | 走备选 B **须人类回签**。本轮不设工时/行数证伪阈值。 |
| C4 | 见 15.4 Renderer。 |
| C5 | Customizations TOC **复用** `aiCustomization.openManagementEditor`（不走 pane helper）。删除 `OpenCustomizationsPreferencesAction` + `ua.customizations` pane + `settingsUaToc` 旧 commandId。产品目录 [settings-two-surfaces.md](settings-two-surfaces.md)（`accepted`）。 |
| C6 | 默认窗丢掉 `tocData` 子节点 `id: 'chat'`，并 **始终** 有 exclude filter（advanced 开启也不得 `undefined`）。commonly-used exclude **仅** `!environmentService.isSessionsWindow`。Agents Window **完全保留** chat TOC + Copilot commonly-used。CI：`settingsUaToc.test.ts` 分两例（mock isSessionsWindow true/false）。 |
| C7 | `canToggleVisibility: false` 足够（对照 Explorer / Search）。CI：断言 descriptor，**不**要求 `setViewVisible(false)` throw。View 菜单残留 hide **Deferred** 切片 3 若复现再补 `when`。 |
| C8 | `hideIfEmpty: false` 后删光 stub session：**图标仍在** + welcome。welcome 文案切片 3 可占位；copy SSOT Deferred 切片 3。 |
| C9 | 容器 `order: 50`（Terminal/Output 之后）；`hideIfEmpty: true`（inspect 非常在产品轨，默认折叠）。无引擎：Inspect action **可点**，打开诚实 empty `AgentInspectView`。Team/Agents **同一 view id + 同一 ctor**。 |
| C10 | Open Folder = `workbench.action.files.openFolder`。Recent = `IWorkspacesService.getRecentlyOpened()`。与 Explorer **重复可接受**（发现面 vs 文件树）。 |
| C11 | `IConversationTurnContentAdapter` 形状 **Deferred 切片 4**。最小 sketch（非签收门禁）：`{ toMarkdown(turn): IMarkdownString; toCodeBlocks(turn): readonly { language: string; text: string }[] }`。禁止输出 `IChat*ViewModel`。 |
| C12 | 扫描排除 `**/*.test.ts` 与 `test/`。同目录测试 **允许** import 被禁路径作 reference。失败条件 = 生产文件的 **直接** import，**非** transitive。 |
| C13 | M5 **不**拥有 `agentSessionsActions.ts` 行为（HEAD 已 guard）。切片 2 只改 `when`；H5 由 M5 改 `conversationSessionsView.ts`。文件不冲突则不必互等。 |
| C14 | `ReadyToImplement=yes` **仅切片 1a**。1b 及之后按 B12。`dev/progress/status.md` 与本文件同时更新。 |
| C15 | 人类未另签 → 切片 3 **按默认**（Explorer 不动）。CI **assert** Explorer `hideIfEmpty === true`（可消失），不 skip。 |
| C16 | type alias 使漏改仍编译。切片 2 仍应改 import 到 `IConversationRosterService`。 |
| C17 | 本族 **不隐藏** `ModelsManagementEditor` 命令/菜单。UA 路径不调用即可。Copilot 入口若要藏 → **M5 / Deferred**，本族不 touch。 |
| C18 | 扩 `preferencesService.test.ts`：assert `lastOpenEditorOptions.paneId` + input typeId + `MODAL_GROUP`。未知 pane 走 Settings。**不**要求 PreferencesEditor 集成测作为 1a DoD。 |
| C19 | 页面接入 manual-launch 证据写 **PR 描述** 即可。与 M4 T1–T3 目录对齐 **Deferred**。 |
| C20 | 切片 5 **不在**签收后首批序列，除非另立引擎里程碑。 |

### 15.14 仍开项

- **Blocking：** 无（B1–B12 已落契约；round 2 核验 1a 可实施。1b 的 `_resolveSettingsTree` 三处改动已写入 §15.4）。
- **HUMAN_DECISION：** Files / useModal 已按审查默认签收（§14）。备选 TOC 形态 B 仅当有人要切换时回签。
- **Deferred：** 见执行方表 + C11/C19/切片 5/OS 协议/TOC 滚到分组/完整 Client 键清单。

---

## 16. 审查记录（规则 16）

- 2026-08-31 签收审查。规则 16 请求 Opus 5.0（`claude-opus-5-thinking-high`）因账单未付失败；改派 3 路并行只读 reviewer（inherit / Cursor Grok 4.6），一篇方案一个。人类本会话要求审查后签收。父 agent 已对 HEAD 核验。Critical：无。已当轮改入 Important：
  - **I1**：Back chrome 不从 `PreferencesEditor` 调 conversation helper；壳 `executeCommand('workbench.action.backToClientSettings')` 或 workbench services。
  - **I2**：1a pane contribution 必须从 `conversation.contribution.ts` side-effect import；`conversation/common/` 为新建目录。
  - **I3**：unknown pane wait 只放 `openPreferences`、`openEditor` 之前；超时 2000ms；禁止先打开空 Preferences。
  - **I4**：默认窗丢掉 `tocData` 子节点 `id: 'chat'`；exclude filter 在 advanced 开启时也不得 `undefined`。
  - **I5**：Entitlement 同时停 toggle DOM / sentiment 订阅 / extension-toggle。
  - **I6**：撤回「`agentSessionsActions.ts` 行为归 M5」；该文件行为 HEAD 已 guard，切片 2 只改 `when`。
  - **I7**：C14 `ReadyToImplement=yes` 仅切片 1a。
  - Minor：`Codicon.plug`；Sessions `hideIfEmpty` 测试覆盖缺口；链接行在右栏 settings 树。

---

## 17. 相关文档

- 知识层四页（细节锚点，冲突以本文件为准）：[settings-ua-access](../../docs/reference/code-oss-b2/settings-ua-access.md) · [session-roster-reuse](../../docs/reference/code-oss-b2/session-roster-reuse.md) · [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) · [navigator-tabs-access](../../docs/reference/code-oss-b2/navigator-tabs-access.md)
- [desktop-shell-mapping](../../docs/reference/code-oss-b2/desktop-shell-mapping.md) · [gap-vs-desktop-shell](../../docs/reference/code-oss-b2/gap-vs-desktop-shell.md)
- [agent-ui](../../docs/systems/chat/agent-ui.md) · [widget-parts](../../docs/systems/chat/widget-parts.md)
- [views-and-composites](../../docs/systems/workbench/views-and-composites.md) · [activity-and-sidebar](../../docs/systems/workbench/activity-and-sidebar.md) · [companion-contribs](../../docs/systems/workbench/companion-contribs.md)
- 产品追踪：[traceability.md](../../docs/product/traceability.md)（precedence 以本文件为准）
- 相邻方案：[m5-ui-shell-hardening.md](m5-ui-shell-hardening.md)（旁路加固，非本族切片）
- 外仓（只读，不复述）：IA · ui-interaction-spec · ADR-061 决策 5 · ADR-037
- 门禁：[DOCUMENTATION.md 规则 16](../../docs/DOCUMENTATION.md)
