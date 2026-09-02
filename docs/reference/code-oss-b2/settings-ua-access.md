---
title: "Settings 接入：UA 设置项如何挂进 vscode Preferences"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "混合宿主已落；HEAD Client properties 为空、Engine 仅四节；M7 按 PRD-025/026 补九节 Engine 与七组真实 Client 设置"
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

**选定：混合宿主 C。** 默认窗 Client Settings **仍用 `SettingsEditor2`**。Connection / Engine 注册为 **`PreferencesEditor` 子 pane**（`ua.connection` / `ua.engine`）。**拒绝**并列 `RequiresModal` `EditorInput` 作为 Connection/Engine 宿主。Customizations **文件工具**保留 `AICustomizationManagementEditor`（ADR-061 决策 5）。产品主面（Skill/Agent catalog 等）在 Engine pane，见 [settings-two-surfaces.md](../../../dev/plans/settings-two-surfaces.md)。**C5 已落 @ `77d6e7cc`：** `ua.customizations` pane 已从 `IPreferencesEditorPaneRegistry` 注销；TOC `ua/customizations` 链接 → `aiCustomization.openManagementEditor`（`settingsLayout.ts`）。

**候选对比（签收背景）：**

| 候选 | HEAD 形态 | 适合 | 不适合 |
|------|-----------|------|--------|
| `SettingsEditor2` | 出厂 `useModal: 'some'` → `MODAL_GROUP`；可被用户改成 Preview tab | `IConfigurationRegistry` 全量键 + 搜索 + TOC | Connection 非 key 行塞进 settings 树（**已拒绝**） |
| `PreferencesEditor` + `PreferencesEditorInput` | `openPreferences({ paneId? })` **无条件** `MODAL_GROUP`；`IPreferencesEditorPaneRegistry` 挂 UA 子页 | Connection / Engine 外链子页 | Client 全量键搬迁（**已拒绝**）；C5 后 Customizations **不是**第三 pane |
| **混合 C（选定）** | Client → `SettingsEditor2`；Connection/Engine → Preferences 子 pane | 层边界干净 | 双宿主深链须路由表 |

**HEAD 事实 @ `77d6e7cc`：** `IPreferencesService.openPreferences(options?: { paneId?: string })` 已扩展（`preferencesService.ts`）。Registry **仅**注册 `ua.connection`（order 10）、`ua.engine`（20）（`uaPreferencesPanes.contribution.ts`）；**无** `ua.customizations`。未知 / 未注册 `paneId` **fail-closed** → `openSettings()` 无 `query` / `revealSetting` / `focusSearch`。

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
| Engine | Provider / Model / Skill catalog / Agent Profile / Rules / Hooks / MCP 定义 / 引擎工具 | Settings TOC **链接行** → `openPreferences({ paneId: 'ua.engine' })`。catalog 产品面见 [settings-two-surfaces.md](../../../dev/plans/settings-two-surfaces.md)。**允许进 `IConfigurationRegistry` 的 Engine 键 = 空集 `[]`** | 引擎侧，非第二套会话真相 |

**HEAD 与 M7：** `registerUaClientSettings()` 当前 `properties: {}`，七个 TOC 组尚无真实 UA setting；`EnginePreferencesPane` 当前只挂 Skills、Agents、MCP Definitions、Tools。M7 由 [PRD-026](../../product/requirements.md#prd-026-client-设置完整性) / [client-settings-completion](../../../dev/plans/client-settings-completion.md) 补 Client 七组真实键与消费点；由 [PRD-025](../../product/requirements.md#prd-025-engine-设置完整性) / [engine-preferences-completion](../../../dev/plans/engine-preferences-completion.md) 补 Engine 九节与全状态矩阵。目标未落前，本页不得把空 TOC 或缺失节写成已完成。

**TOC 链接允许族（签收形态 A，钉死）：** HEAD 新增 `SettingsTreeNavigationLinkElement`（`settingsTreeModels.ts` / `SettingNavigationLinkRenderer` in `settingsTree.ts`）——仅 `label` + `commandId`，零内嵌控件。Connection / Engine / Customizations「Open …」三行同族。走 group 级 `ITOCEntry.command` 备选 **须人类回签**。

**Client → Preferences 过渡 UX（钉死）：**

| 步 | 行为 |
|----|------|
| 开 Connection / Engine | TOC → **关闭**当前 `SettingsEditor2Input` → `openPreferences({ paneId })`。**禁止**双 Preferences 栈 |
| 开 Customizations（C5） | TOC → `aiCustomization.openManagementEditor`。**不要**走 pane helper。可能同组两个 tab |
| Back | PreferencesEditor 壳按 descriptor `showBackToClientSettings` 渲染「Back to Client Settings」→ `workbench.action.backToClientSettings` → 关 Preferences → `openSettings()` **不带** query / revealSetting / focusSearch。v1 **不保证**恢复 TOC 滚动 |
| `useModal: 'off'` | Client 已在 Preview；Connection/Engine 链接仍关 Preview 中的 Settings → 开 Preferences **模态**；Back 再 `openSettings()` |

Client 与 vscode 原生重叠的项 **不要双入口**：

- 主题/色 → `workbench.colorTheme`（Display 不另做主题选择器）
- 编辑器字号 → `editor.fontSize`（消息字号仅当产品要独立时才新 key）
- 快捷键编辑器 → `KeybindingsEditor` / `workbench.action.openGlobalKeybindings`；UA 只保留「聊天输入 Enter 行为」一项挂 TOC

## 4. Customizations 切分（ADR-061 决策 5 + two-surfaces）

**已拍板：** 保留 `AICustomizationManagementEditor` 作 **文件工具 donor**，**不是**第三套主设置。Skill/Agent/Rules/Hooks/MCP 定义 / 引擎工具的产品主面是 `ua.engine`。chrome 见 [customizations-host-ui.md](../../../dev/plans/customizations-host-ui.md)；权威见 [customizations-engine.md](../../../dev/plans/customizations-engine.md)。**donor H0–H3 已落 @ `77d6e7cc`**（去 Copilot 营销脸、WorkbenchList 密度、Instructions/Hooks UA 文案、MCP Browse 剥离；见 [settings-two-surfaces.md](../../../dev/plans/settings-two-surfaces.md) §3）。

| 面 | 宿主 | 禁止 |
|----|------|------|
| 打开某份 UA markdown / `tools.json` | `AICustomizationManagementEditor`（`aiCustomization.openManagementEditor`，`RequiresModal`） | Settings TOC 再做一份 catalog 列表；默认窗构造 Plugins/Tools widget |
| Skill/Agent catalog 等产品面 | Preferences **Engine pane**（[engine-catalog §3](../../systems/workbench/engine-catalog.md)：Skills list/toggle + Agents/MCP/Tools **List** + MCP toggle @ HEAD） | 把 Copilot Overview 当 Engine 首页；无引擎扫盘 Stub catalog；**不得**把槽 A 未合入的 Save/MCP CRUD/tools.json 写 UI 标成已接 |
| 跳转 | TOC「Open Customizations…」→ `aiCustomization.openManagementEditor`（C5 已落；**无**第三 Preferences pane） | 复制列表进 Settings 树 |

MCP：vscode 本地 `mcp.json` 可在 donor 当普通文件；引擎 MCP 定义 CRUD 在 Engine 页。运行态另切片。

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

从 Settings 模态链到 Connection/Engine 会关当前 Client 模态（`uaPreferencesNavigation.ts`）。Customizations C5 **不**走该 helper，可能同组两个 tab。

## 7. 首次连接 / 无引擎

Client Settings **无连接也可开**（Singularity 原则）。**选定：** Connection 空态 = 打开 Preferences **Connection pane**（`ConnectionPreferencesPane`），按 [connection-hub-client §4.2](../../../dev/plans/connection-hub-client.md#42-uaconnection-pane-内容替换今日占位宿主与-id-不变) 四区诚实占位（**不是**滚到 Settings Connection 分组，**不是** vscode Welcome walkthrough，INV-NO-COPILOT）：

| 区 | 未登录 / 无 profile 空态 |
|----|--------------------------|
| Hub 账号 | 表单（`hubBaseUrl`、邮箱、密码、登录）；加密不可用 → 提示重启需重登 |
| 设备列表 | 整节省略（未登录） |
| Direct Address | host:port 添加入口；默认拒 RFC1918 除非勾 `allowPrivateNetwork` |
| 连接 profiles | 「No connection profiles yet」 |
| Test Connection | 无 active profile → 「Not connected — no engine.」；不假成功 |
| Remote I/O | 常显一行：远程 Engine 时文件 / Shell 在本机执行 |

Hub 登录态与引擎连接态 **各说各的**（PRD-007 验收 4 再叠 Hub 账号层）：Hub `signedIn` 但 `ConnectionPhase` 非 `connected` 时，StatusBar 仍为「Engine not connected」。Web 形态：`IUniverseAgentHubService` = `unavailable`，pane 显示「本形态不支持连接引擎」，不画登录表单（PRD-019 / PRD-024 验收 7）。

## 8. 非目标

- 不把 Settings 做成 Conversation。
- 不自研 Keyboard shortcuts 全页（复用 `KeybindingsEditor`）。

## 9. 相关文档

- [Desktop 壳映射](desktop-shell-mapping.md) · [缺口](gap-vs-desktop-shell.md) · [agent-ui](../../systems/chat/agent-ui.md) · [companion-contribs](../../systems/workbench/companion-contribs.md)
- 外仓 IA Overlay 行 · ui-interaction-spec · Singularity Settings UI · ADR-037
- 父方案：[page-access-schemes.md](../../../dev/plans/page-access-schemes.md) §2 / §15
- 产品目录：[settings-two-surfaces.md](../../../dev/plans/settings-two-surfaces.md)（`accepted`）

## 审查

2026-08-31 已经 Opus 5.0（`claude-opus-5-thinking-high`）审查并改稿。Critical：出厂打开路径是 `useModal: 'some'` → `MODAL_GROUP`，不是 Preview tab。Important：Connection 用非 setting TOC 元素、`ITOCFilter.exclude` 并入 advanced 滤、`agentsWindow` 与 TOC 可见性不可互替、StatusBar 映射 `status.conversation.engine`。

2026-09-01 设置两套主面签收：Customizations 不是第三 pane；C5 不走 pane helper。见 [settings-two-surfaces.md](../../../dev/plans/settings-two-surfaces.md)。

2026-09-01 HEAD 同步 @ `77d6e7cc`：`accepted`；C5 与 donor H0–H3 已落；`ua.customizations` pane 已从 registry 注销；TOC 链接 commandId 已换为 `aiCustomization.openManagementEditor`。
