---
title: "Settings 接入：UA 设置项如何挂进 vscode Preferences"
type: reference
status: draft
phase: N/A
updated: 2026-08-31
summary: "对照 Singularity/Desktop Settings：宿主选型、UA 三层键空间、Customizations 切分、Copilot TOC 剥离与入口/深链；非正式决策"
---

# Settings 接入：UA 设置项如何挂进 vscode Preferences

> **结构性决策 SSOT** = [`dev/plans/page-access-schemes.md`](../../../dev/plans/page-access-schemes.md)；冲突以父方案为准。

对照外仓：[IA](../../../../UniverseAgentDesktop/docs/product/information-architecture.md) Overlay 行、[ui-interaction-spec](../../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md)、[Singularity Settings UI](../../../../UniverseAgentDesktop/docs/reference/upstream/singularity/systems/state/settings-ui-components-design.md)、[ADR-037](../../../../UniverseAgentDesktop/dev/decisions/037-deep-link-navigation-event-seam.md)。本仓壳事实：[映射](desktop-shell-mapping.md)、[缺口](gap-vs-desktop-shell.md)、[agent-ui](../../systems/chat/agent-ui.md)、[companion](../../systems/workbench/companion-contribs.md)。

本页写 **怎么接**，不是实施切片。标 **推荐（非正式决策）** 的条目须人类签收；**已拍板** 不在此重开。

## 1. 问题

Singularity：独立路由 `SettingsScreen` + 子页；三层 Client / Connection / Engine。  
Desktop：Overlay `OverlayKind.settings`；齿轮在 AppTabBar；StatusBar profile 导航到同一 overlay；深链 `universe-agent://settings/<page>`。  
本仓今天：`contrib/preferences` 的 `SettingsEditor2` + `SettingsEditor2Input`（`preferences.contribution.ts` 注册 pane）。打开路径：`workbench.action.openSettings` → `preferencesService.openSettings` → `getEditorGroupFromOptions`。出厂 **`workbench.editor.useModal` = `'some'`**（`workbench.contribution.ts`）时走 **`MODAL_GROUP` 居中模态浮层**，不是 Preview tab；`'off'` 或调用带 `groupId` 时才落进 `EDITOR_PART`。另有 `AICustomizationManagementEditor`（`RequiresModal` 单例，节 id 含 agents / skills / instructions / hooks / mcpServers / plugins / tools）与 `ModelsManagementEditor`（`contrib/chat/browser/chatManagement/`），同为 `EditorInput`。`docs/` 几乎没有 preferences 实现真相页。

## 2. 推荐宿主（非正式决策）

**推荐（非正式决策）：** 默认窗 Settings 宿主仍用 **`SettingsEditor2`**（键空间、扩展设置、搜索齐全），不要自研 Overlay 再做一套表单。

**候选对比（必须看见再选）：**

| 候选 | HEAD 形态 | 适合 | 不适合 |
|------|-----------|------|--------|
| `SettingsEditor2` | 出厂 `useModal: 'some'` → `MODAL_GROUP`；可被用户改成 Preview tab | `IConfigurationRegistry` 全量键 + 搜索 + TOC | Connection 非 key 行要改树（见 §3） |
| `PreferencesEditor` + `PreferencesEditorInput` | `openPreferences` **无条件** `MODAL_GROUP`；`IPreferencesEditorPaneRegistry` 可挂子页 | 最接近 Desktop「Overlay + 子页」壳 | 内容面几乎空，每个 UA 子页要自建 pane |

选前者的真实理由：复用配置注册与搜索，不重做整本设置。`PreferencesEditor` **保留为**「人类若强制独立 Overlay 子页」时的 ADR 候选，不是「不相干旁路」。

张力（v1 **接受**，不要假装已解决）：

| 张力 | 态度 |
|------|------|
| Desktop `OverlayKind.settings` vs 本仓 `useModal` | 出厂已是模态浮层，**同构方向对**。真正风险是用户把 `useModal` 改成 `'off'` 后 Settings 掉进 Preview。v1 **不钉死**该设置；若产品必须 Overlay 恒成立，另开 ADR（可改默认或改走 `PreferencesEditor`） |
| Settings 永久占中心 | **禁止**做成 `CONVERSATION_PART` |

禁止：用 Copilot setup / `IChatEntitlementService` 当设置门闩（`SettingsEditor2` 已注入该服务做 AI 搜索开关——donor 泄漏，须剥，不得当 UA 门闩）；用 `ModelsManagementEditor` 当 UA Provider/Model UI；把 Engine Settings 整页做成 `settings.json` 字面量（见 §3）。

## 3. UA 三层 → vscode 键空间

| 层 | Singularity | 本仓落点 | 持久化 |
|----|-------------|----------|--------|
| Client | Display / Chat Input / Startup / Keyboard Enter / Notifications / Permissions / Client Tools | `IConfigurationRegistry.registerConfiguration` → `IConfigurationService`；**必须**写入 `tocData` 新产品名分组（只注册不进 TOC 的键不会出现在 UI，只会 leftover 警告）。窗口差异用注册项 `agentsWindow.default` / `.readOnly`（`settingsTreeModels.ts`） | 用户 settings.json |
| Connection | Profile 列表、host/port/TLS、Test Connection | **禁止**当普通 setting key。TOC 节点用 **非 setting 元素**撑起（仿 `SettingsTreeNewExtensionsElement` + 专属 renderer），避开 `_resolveSettingsTree` 对空 TOC 节点抛错。这会改 `settingsTree*.ts`（记 [diff-footprint](diff-footprint.md)） | ConnectionProfileStore（经 UA adapter；本仓无第二套） |
| Engine | Provider / Model Profiles / Agent / Prompts / MCP | 与「默认保留」Customizations 切分见 §4。需活跃连接的项走 ConfigService adapter，失败诚实降级 | 引擎侧，非第二套会话真相 |

Client 与 vscode 原生重叠的项 **不要双入口**：

- 主题/色 → `workbench.colorTheme`（Display 不另做主题选择器）
- 编辑器字号 → `editor.fontSize`（消息字号仅当产品要独立时才新 key）
- 快捷键编辑器 → `KeybindingsEditor` / `workbench.action.openGlobalKeybindings`；UA 只保留「聊天输入 Enter 行为」一项挂 TOC

## 4. Customizations 切分（ADR-061 决策 5）

**已拍板：** 默认保留 vscode Customizations 中心（Agents / Skills / Instructions / Hooks / MCP Servers / Plugins / Tools）。见 [映射](desktop-shell-mapping.md) §4a、[agent-ui](../../systems/chat/agent-ui.md)、外仓 [ADR-061 决策 5](../../../../UniverseAgentDesktop/dev/decisions/061-code-oss-base-and-editor-window-shell.md)。

**推荐（非正式决策）** 唯一入口：

| 面 | 宿主 | 禁止 |
|----|------|------|
| 文件型定制（skills / instructions / hooks / agents md、MCP 服务器定义） | `AICustomizationManagementEditor`（`aiCustomization.openManagementEditor`） | Settings TOC 再做一份列表 |
| UA Engine 运行时（Provider API key、Model Profile、连接探测） | Settings 的 Engine 分组（自定义控件） | 塞进 Customizations / `ModelsManagementEditor` |
| 跳转 | TOC **链接行**「Open Customizations」（目标 `RequiresModal`；从 Settings 模态点进去会关/接管当前模态，见 `editorGroupFinder`） | 复制其列表 |

MCP：定义面留 Customizations；「连上哪台引擎后的 MCP 运行态」若 UA 有独立页，标为后续切片，本页不发明第二 MCP UI。

## 5. Copilot TOC 剥离（INV-NO-COPILOT）

锚点：`src/vs/workbench/contrib/preferences/browser/settingsLayout.ts`。

- `COMMONLY_USED_SETTINGS` 含 `GitHub.copilot-chat.manageExtension`、`chat.agent.maxRequests`；`getCommonlyUsedData` 按此白名单灌 commonly-used。
- `tocData` 有 `id: 'chat'` 子树（`chat/agent`、`chat/appearance`、`chat/sessions`、`chat/tools`、`chat/mcp`、`chat/context`、`chat/inlineChat`、`chat/miscellaneous`）。
- `ITOCFilter`（`include` / `exclude` 的 `keyPatterns` / `tags`）经 `settingsTree.ts` `resolveSettingsTree` 生效。`SettingsEditor2` 今天只用它滤 `@tag:advanced`。

**推荐（非正式决策）：** 默认 Code 窗口剥 Copilot / entitlement **可见性**用 `ITOCFilter.exclude.keyPatterns`（**并入**现有 advanced-tag 排除，不要替换那一个 filter 槽；`include` 是往每组 **加** 键，不能当收窄白名单）。排空的 TOC 节点会被丢掉，扩展设置树同享该 filter。`COMMONLY_USED_SETTINGS` 是模块常量、`getCommonlyUsedData` **不收** filter——窗口化要改签名。值语义 / 只读差异用 `agentsWindow`，与 TOC 可见性 **不可互替**。Agents Window 可保留 chat TOC。**不要**删 `settingsLayout.ts` 源结构到无法给 Agents Window 用。

整树排除 `chat.*` 会连带 `ChatAIDisabledSettingId` / `chat.allowAnonymousAccess`（`tocData` `chat/miscellaneous`）。**推荐：** 一并剥出默认窗；产品若要「禁用 AI」入口，另挂产品 TOC，不留 Copilot 分组。

入口：`workbench.action.openSettings` 保留。Copilot `workbench.action.chat.manageSettings` 已在默认窗 `f1: false`（[agent-ui](../../systems/chat/agent-ui.md) §5），本页不重开。

## 6. 入口与深链

| Desktop | 本仓 v1 |
|---------|---------|
| AppTabBar 齿轮 | titlebar / 菜单既有 Preferences；**不**自研第二齿轮到 SessionBar（UI-INV-14） |
| StatusBar profile 芯片 | **映射 `status.conversation.engine`**（今天恒「Engine not connected」、无 command）。有引擎后加 command → `openSettings` + query 滚到 Engine 分组。**不要**用 `status.conversation.model`（Dock 为 model owner，座位可见时整槽省略，UI-INV-14） |
| `universe-agent://settings/<page>` | 投影为 `workbench.action.openSettings` + `@id:` / TOC 查询（`IPreferencesService.openSettings({ query })` / `parseQuery`）。未知 page **只打开不滚**（对齐 ADR-037 fail-closed） |

## 7. 首次连接 / 无引擎

Client Settings **无连接也可开**（Singularity 原则）。**推荐（非正式决策）：** Connection 空态 = Open Settings 滚到 Connection 分组，诚实「not connected」。不要用 vscode Welcome walkthrough（`contrib/welcomeGettingStarted`）冒充 UA 连接向导（INV-NO-COPILOT）。

## 8. 非目标

- 不实施本页；不改 `product.json`；不迁 ADR-003 token。
- 不把 Settings 做成 Conversation。
- 不自研 Keyboard shortcuts 全页（复用 `KeybindingsEditor`）。

## 9. 相关文档

- [Desktop 壳映射](desktop-shell-mapping.md) · [缺口](gap-vs-desktop-shell.md) · [agent-ui](../../systems/chat/agent-ui.md) · [companion-contribs](../../systems/workbench/companion-contribs.md)
- 外仓 IA Overlay 行 · ui-interaction-spec · Singularity Settings UI · ADR-037

## 审查

2026-08-31 已经 Opus 5.0（`claude-opus-5-thinking-high`）审查并改稿。Critical：出厂打开路径是 `useModal: 'some'` → `MODAL_GROUP`，不是 Preview tab。Important：Connection 用非 setting TOC 元素、`ITOCFilter.exclude` 并入 advanced 滤、`agentsWindow` 与 TOC 可见性不可互替、StatusBar 映射 `status.conversation.engine`。
