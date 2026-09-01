---
title: "Settings 接入：UA 设置项如何挂进 vscode Preferences"
type: reference
status: draft
phase: N/A
updated: 2026-09-01
summary: "对照 Singularity/Desktop Settings：混合宿主（Client SettingsEditor2 + Connection/Engine Preferences 子 pane）、UA 三层键空间、Customizations 切分、Copilot TOC 剥离与入口/深链；选定设计已按父方案 §12 同步"
---

# Settings 接入：UA 设置项如何挂进 vscode Preferences

> **结构性决策 SSOT** = [`dev/plans/page-access-schemes.md`](../../../dev/plans/page-access-schemes.md)；冲突以父方案为准。

对照外仓：[IA](../../../../UniverseAgentDesktop/docs/product/information-architecture.md) Overlay 行、[ui-interaction-spec](../../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md)、[Singularity Settings UI](../../../../UniverseAgentDesktop/docs/reference/upstream/singularity/systems/state/settings-ui-components-design.md)、[ADR-037](../../../../UniverseAgentDesktop/dev/decisions/037-deep-link-navigation-event-seam.md)。本仓壳事实：[映射](desktop-shell-mapping.md)、[缺口](gap-vs-desktop-shell.md)、[agent-ui](../../systems/chat/agent-ui.md)、[companion](../../systems/workbench/companion-contribs.md)。

本页写 **怎么接**，不是实施切片。**选定（已签收）** 见父方案；**已拍板** 不在此重开。

## 1. 问题

Singularity：独立路由 `SettingsScreen` + 子页；三层 Client / Connection / Engine。  
Desktop：Overlay `OverlayKind.settings`；齿轮在 AppTabBar；StatusBar profile 导航到同一 overlay；深链 `universe-agent://settings/<page>`。  
本仓今天：`contrib/preferences` 的 `SettingsEditor2` + `SettingsEditor2Input`（`preferences.contribution.ts` 注册 pane）。打开路径：`workbench.action.openSettings` → `preferencesService.openSettings` → `getEditorGroupFromOptions`。出厂 **`workbench.editor.useModal` = `'some'`**（`workbench.contribution.ts`）时走 **`MODAL_GROUP` 居中模态浮层**，不是 Preview tab；`'off'` 或调用带 `groupId` 时才落进 `EDITOR_PART`。另有 `AICustomizationManagementEditor`（`RequiresModal` 单例，节 id 含 agents / skills / instructions / hooks / mcpServers / plugins / tools）与 `ModelsManagementEditor`（`contrib/chat/browser/chatManagement/`），同为 `EditorInput`。`docs/` 几乎没有 preferences 实现真相页。

## 2. 选定宿主（已签收）

**选定：混合宿主 C。** 默认窗 Client Settings **仍用 `SettingsEditor2`**（键空间、扩展设置、搜索齐全），不要自研 Overlay 再做一套表单。Connection / Engine **运行时**注册为 **`PreferencesEditor` 子 pane**（钉死 id `ua.connection` / `ua.engine`，见 `uaPreferencesPanes.ts`）。**拒绝**并列 `RequiresModal` `EditorInput` 作为 Connection/Engine 宿主；Customizations 文件型中心仍保留 `AICustomizationManagementEditor`（ADR-061 决策 5），TOC 链接在 HEAD 亦可达 Preferences `ua.customizations` 占位 pane。

**候选对比（签收背景）：**

| 候选 | HEAD 形态 | 适合 | 不适合 |
|------|-----------|------|--------|
| `SettingsEditor2` | 出厂 `useModal: 'some'` → `MODAL_GROUP`；可被用户改成 Preview tab | `IConfigurationRegistry` 全量键 + 搜索 + TOC | Connection 非 key 行塞进 settings 树（**已拒绝**） |
| `PreferencesEditor` + `PreferencesEditorInput` | `openPreferences({ paneId? })` **无条件** `MODAL_GROUP`；`IPreferencesEditorPaneRegistry` 挂 UA 子页 | Connection / Engine / Customizations 外链子页 | Client 全量键搬迁（**已拒绝**） |
| **混合 C（选定）** | Client → `SettingsEditor2`；Connection/Engine → Preferences 子 pane | 层边界干净 | 双宿主深链须路由表 |

**HEAD 事实：** `IPreferencesService.openPreferences(options?: { paneId?: string })` 已扩展（`preferencesService.ts`）。Registry 已注册 `ua.connection`（order 10）、`ua.engine`（20）、`ua.customizations`（30）（`uaPreferencesPanes.contribution.ts`）。未知 / 未注册 `paneId` **fail-closed** → `openSettings()` 无 `query` / `revealSetting` / `focusSearch`。

张力（v1 **接受**，不要假装已解决）：

| 张力 | 态度 |
|------|------|
| Desktop `OverlayKind.settings` vs 本仓 `useModal` | 出厂已是模态浮层，**同构方向对**。用户把 `useModal` 改成 `'off'` 后 **Client** Settings 掉进 Preview；Connection/Engine 因走 `PreferencesEditor` **恒 `MODAL_GROUP`**。v1 **不钉死**全局 `useModal` |
| Settings 永久占中心 | **禁止**做成 `CONVERSATION_PART` |

禁止：用 Copilot setup / `IChatEntitlementService` 当设置门闩（默认窗须剥 entitlement toggle / sentiment 订阅 / extension-toggle）；用 `ModelsManagementEditor` 当 UA Provider/Model UI；把 Engine Settings 整页做成 `settings.json` 字面量（见 §3）；在 `SettingsEditor2` 树内做 Connection/Engine 非 setting 自定义节点（**已拒绝**，见 §3）。

## 3. UA 三层 → vscode 键空间

| 层 | Singularity | 本仓落点 | 持久化 |
|----|-------------|----------|--------|
| Client | Display / Chat Input / Startup / Keyboard Enter / Notifications / Permissions / Client Tools | `IConfigurationRegistry.registerConfiguration` → `IConfigurationService`；**必须**写入 `tocData` 新产品名分组（只注册不进 TOC 的键不会出现在 UI，只会 leftover 警告）。窗口差异用注册项 `agentsWindow.default` / `.readOnly`（`settingsTreeModels.ts`） | 用户 settings.json |
| Connection | Profile 列表、host/port/TLS、Test Connection | Settings TOC **链接行**（`SettingsTreeNavigationLinkElement`，`navigationLinks[]` in `tocData`）→ command `workbench.action.openConnectionPreferences` → 关 Client 模态 → `openPreferences({ paneId: 'ua.connection' })`。**禁止**普通 setting key；**禁止** settings 树内非 setting 自定义 renderer | 切片占位 = 内存 UI（`ConnectionPreferencesPane`）；引擎 adapter 后经 UA；本仓无第二套 |
| Engine | Provider / Model Profiles / Agent / Prompts / MCP | Settings TOC **链接行** → `openPreferences({ paneId: 'ua.engine' })`（`EnginePreferencesPane`）。**允许进 `IConfigurationRegistry` 的 Engine 键 = 空集 `[]`**；runtime 控件全在 pane，**不在** `SettingsEditor2` 建 Engine 配置分组 | 引擎侧，非第二套会话真相 |

**TOC 链接允许族（签收形态 A，钉死）：** HEAD 新增 `SettingsTreeNavigationLinkElement`（`settingsTreeModels.ts` / `SettingNavigationLinkRenderer` in `settingsTree.ts`）——仅 `label` + `commandId`，零内嵌控件。Connection / Engine / Customizations「Open …」三行同族。走 group 级 `ITOCEntry.command` 备选 **须人类回签**。

**Client → Preferences 过渡 UX（钉死）：**

| 步 | 行为 |
|----|------|
| 开 | TOC「Open Connection…」/「Open Engine…」/「Open Customizations…」→ **关闭**当前 `SettingsEditor2Input`（`uaPreferencesNavigation.ts`）→ `openPreferences({ paneId })`（恒 `MODAL_GROUP`）。**禁止**双模态栈 |
| Back | PreferencesEditor 壳按 descriptor `showBackToClientSettings` 渲染「Back to Client Settings」→ `workbench.action.backToClientSettings` → 关 Preferences → `openSettings()` **不带** query / revealSetting / focusSearch。v1 **不保证**恢复 TOC 滚动 |
| `useModal: 'off'` | Client 已在 Preview；链接仍关 Preview 中的 Settings → 开 Preferences **模态**；Back 再 `openSettings()`（随当时 `useModal` 进 Preview 或模态） |

Client 与 vscode 原生重叠的项 **不要双入口**：

- 主题/色 → `workbench.colorTheme`（Display 不另做主题选择器）
- 编辑器字号 → `editor.fontSize`（消息字号仅当产品要独立时才新 key）
- 快捷键编辑器 → `KeybindingsEditor` / `workbench.action.openGlobalKeybindings`；UA 只保留「聊天输入 Enter 行为」一项挂 TOC

## 4. Customizations 切分（ADR-061 决策 5）

**已拍板：** 默认保留 vscode Customizations 中心（Agents / Skills / Instructions / Hooks / MCP Servers / Plugins / Tools）。见 [映射](desktop-shell-mapping.md) §4a、[agent-ui](../../systems/chat/agent-ui.md)、外仓 [ADR-061 决策 5](../../../../UniverseAgentDesktop/dev/decisions/061-code-oss-base-and-editor-window-shell.md)。

| 面 | 宿主 | 禁止 |
|----|------|------|
| 文件型定制（skills / instructions / hooks / agents md、MCP 服务器定义） | `AICustomizationManagementEditor`（`aiCustomization.openManagementEditor`，`RequiresModal`）仍保留为 donor / 完整文件型中心 | Settings TOC 再做一份列表 |
| UA Engine 运行时（Provider API key、Model Profile、连接探测） | Preferences **Engine pane**（外链自 Settings TOC） | 塞进 Customizations / `ModelsManagementEditor` |
| 跳转 | TOC **链接行**「Open Customizations…」→ HEAD 亦注册 `workbench.action.openCustomizationsPreferences` → `ua.customizations` Preferences 占位 pane | 复制其列表进 Settings 树 |

MCP：定义面留 Customizations；「连上哪台引擎后的 MCP 运行态」若 UA 有独立页，标为后续切片，本页不发明第二 MCP UI。

## 5. Copilot TOC 剥离（INV-NO-COPILOT）

锚点：`src/vs/workbench/contrib/preferences/browser/settingsLayout.ts`。

- `COMMONLY_USED_SETTINGS` 含 `GitHub.copilot-chat.manageExtension`、`chat.agent.maxRequests`；默认窗 `getCommonlyUsedData` 传入 exclude key patterns 剔除 Copilot 项。
- 默认 Code 窗 **丢掉 `tocData` 子节点 `id: 'chat'`**（Agents Window 仍挂源结构）；只滤 `chat.*` keyPatterns **不够**（`inlineChat` / `mcp` / a11y 组仍会留）。
- `ITOCFilter`：默认窗 **始终**有一份 exclude filter，与 advanced-tag **与/或**；**禁止**在 `canShowAdvancedSettings()` 为 true 时把 filter 设回 `undefined`。
- 值语义 / 只读差异用 `agentsWindow`，与 TOC 可见性 **不可互替**。**不要**删 `settingsLayout.ts` 源结构到无法给 Agents Window 用。

整树排除 `chat.*` 会连带 `ChatAIDisabledSettingId` / `chat.allowAnonymousAccess`。**选定：** 一并剥出默认窗；产品若要「禁用 AI」入口，另挂产品 TOC，不留 Copilot 分组。

入口：`workbench.action.openSettings` 保留。Copilot `workbench.action.chat.manageSettings` 已在默认窗 `f1: false`（[agent-ui](../../systems/chat/agent-ui.md) §5），本页不重开。

## 6. 入口与深链

| Desktop | 本仓 v1 |
|---------|---------|
| AppTabBar 齿轮 | titlebar / 菜单既有 Preferences；**不**自研第二齿轮到 SessionBar（UI-INV-14） |
| StatusBar profile 芯片 | **`status.conversation.engine`**（HEAD 已注册 command `workbench.action.openConnectionPreferences`；无引擎亦可点）→ Preferences **Connection** pane 空态 + CTA。v1 **永远** Connection；有引擎改开 Engine pane = 切片 5+。**不要**用 `status.conversation.model`（Dock 为 model owner，座位可见时整槽省略，UI-INV-14） |
| `universe-agent://settings/<page>` | 双宿主路由表（ADR-037 fail-closed；`universeAgentDeepLink.contribution.ts`） |

**深链路由表（双宿主）：**

| page | 宿主 | 行为 |
|------|------|------|
| 已映射 Client TOC / setting id | `SettingsEditor2` | `openSettings`；v1 Client **分组**页不滚（无 TOC reveal API）；已注册 setting id 可用 `@id:` |
| `connection` / 等价 | `PreferencesEditor` | `openPreferences({ paneId: 'ua.connection' })` |
| `engine` / 等价 | `PreferencesEditor` | `openPreferences({ paneId: 'ua.engine' })` |
| **unknown / 未映射 / typo** | **Client `SettingsEditor2`** | **只打开不滚**（无 `query` / `revealSetting`）。**不**打开 `PreferencesEditor` |

从 Settings 模态链到 Connection/Engine/Customizations 会关当前 Client 模态（`uaPreferencesNavigation.ts`）——已知 UX，文档化即可。

## 7. 首次连接 / 无引擎

Client Settings **无连接也可开**（Singularity 原则）。**选定：** Connection 空态 = 打开 Preferences **Connection pane**（`ConnectionPreferencesPane`），诚实「not connected」+ Test Connection 占位；**不是**滚到 Settings Connection 分组，**不是** vscode Welcome walkthrough（INV-NO-COPILOT）。

## 8. 非目标

- 不把 Settings 做成 Conversation。
- 不自研 Keyboard shortcuts 全页（复用 `KeybindingsEditor`）。

## 9. 相关文档

- [Desktop 壳映射](desktop-shell-mapping.md) · [缺口](gap-vs-desktop-shell.md) · [agent-ui](../../systems/chat/agent-ui.md) · [companion-contribs](../../systems/workbench/companion-contribs.md)
- 外仓 IA Overlay 行 · ui-interaction-spec · Singularity Settings UI · ADR-037
- 父方案：[page-access-schemes.md](../../../dev/plans/page-access-schemes.md) §2 / §15

## 审查

2026-08-31 已经 Opus 5.0（`claude-opus-5-thinking-high`）审查并改稿。Critical：出厂打开路径是 `useModal: 'some'` → `MODAL_GROUP`，不是 Preview tab。Important：Connection 用非 setting TOC 元素、`ITOCFilter.exclude` 并入 advanced 滤、`agentsWindow` 与 TOC 可见性不可互替、StatusBar 映射 `status.conversation.engine`。

2026-09-01 按父方案 §12 同步选定设计：Connection/Engine → Preferences 子 pane + `SettingsTreeNavigationLinkElement`；Client→Preferences 关模态/Back；StatusBar / unknown 深链 / Connection 空态与 HEAD 对齐。
