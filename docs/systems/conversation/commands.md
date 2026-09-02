---
title: "Agent IDE 壳命令、菜单落点与快捷键"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "四钮、Conversation、Sources、Sessions roster、UA Preferences、深链的用户可见命令清单；快捷键现状（四钮与 Conversation 命令均无默认键位，PRD-018 proposed）；设置键与默认值"
---

# Agent IDE 壳命令、菜单落点与快捷键

> 导航：[系统索引](INDEX.md)。命令 id 以源码 `registerAction2` / `MenuRegistry` 为准；本页只登记**默认 Code 窗口**可见的产品入口，Copilot Chat 被藏 / 转的命令族见 [agent-ui §3 / §5](../chat/agent-ui.md)。

## 1. 四钮与区域显隐（`workbench/browser/actions/layoutActions.ts`）

| 命令 id | 标题 | 落点 | 默认键位 |
|---------|------|------|----------|
| `workbench.action.toggleSidebarVisibility` | Navigator（产品名；上游 Toggle Primary Side Bar） | titlebar `LayoutControlMenu` 首钮；View › Appearance | `Ctrl/Cmd+B`（上游继承） |
| `workbench.action.toggleConversation` | Toggle Conversation Visibility | `LayoutControlMenu`「Conversation」；View › Appearance；F1 | **无** |
| `workbench.action.toggleEditorVisibility` | Toggle Editor Area Visibility | `LayoutControlMenu`「Preview」（四钮之一，`CreateToggleLayoutItem`）；`LayoutControlMenuSubmenu` 亦有；Preview editor title 上的 Hide / Show Preview（`MenuId.EditorTitle` / `EditorTitleContext`）；F1 | **无** |
| `workbench.action.toggleSources` | Toggle Sources Visibility | `LayoutControlMenu`「Sources」；View › Appearance；F1 | **无** |
| Panel / Auxiliary Bar toggles | 上游命令 | 退到 `LayoutControlMenuSubmenu`（D7） | 上游继承 |

四钮之外，Conversation / Sources 区域内各有本地 hide（−）控件（`partRegionHideControl.ts`），Preview 的本地 hide 是 editor title 动作；全部经 `setPartHidden` 走同一 Layout 路径。互斥规则见 [ADR-006](../../../dev/decisions/006-shell-invariants.md)。

## 2. Conversation（`contrib/conversation`）

| 命令 id | 标题 / 触发 | 说明 | 默认键位 |
|---------|-------------|------|----------|
| `workbench.action.chat.open` | **Open Conversation**（默认窗标题） | F1 主入口；经 `chatShellRouting.focusConversationPart` 显示并聚焦 `CONVERSATION_PART`，**不**开 ChatEditor / Aux Chat | `Ctrl+Alt+I`（mac `Cmd+Ctrl+I`，上游继承） |
| `workbench.action.showConversationPart` | StatusBar session / model 芯片点击 | `setPartHidden(false, CONVERSATION_PART)` + `IConversationPartService.focus()` | 无 |
| `workbench.action.chat.forkConversation` | Fork（Conversation 版 `ForkConversationAction`） | 同 session 新增延伸 tab | 上游继承 |
| `workbench.action.conversation.splitSessionWindow` | Split Conversation Editor（类别 Conversation） | 当前叶内开 `CONVERSATION_SIDE_GROUP`；F1 | 无 |
| SessionBar ← / → | 按钮；鼠标侧键 4 / 5（`event.button` 3 / 4） | 每个 Conversation `IEditorPart` 自有导航栈 | 鼠标侧键 |
| SessionBar「关非根」 | 按钮 | `closeNonRootTabs` | 无 |
| 子代理对话框：popout / maximize / close | overlay 按钮 | `promoteSubAgentDialog` / `toggleSubAgentDialogMaximized` / `closeSubAgentDialog` | 无 |
| 「对话 \| 轨迹」 | pane 内透镜切换 | 持久化到 workspace storage | 无 |
| Composer | Enter 发送；Shift+Enter 换行；Esc 退出 turnEdit / queueEdit；↑ / ↓ 浏览输入历史 | 见 [composer-and-inbox](composer-and-inbox.md) | 组件内键处理 |
| 图示卡全屏 | Expand diagram；Esc 关闭 | overlay Close + Reset | 组件内键处理 |

## 3. Navigator「Sessions」roster（`workbench.view.sessions` 容器）

| 命令 id | 落点 |
|---------|------|
| `workbench.view.sessions.focus` | 视图容器自动生成的 focus 命令；D4 V5 用它 |
| `workbench.action.conversationSessions.newSession` | 视图标题 `+` |
| `workbench.action.conversationSessions.deleteSession` | 视图标题垃圾桶 |
| `workbench.action.conversationSessions.openBeside` | 行右键「Open beside」；Alt+点击等价 |
| 行单击 / `onDidOpen` | `switchSession` → 显示 Part → focus |

## 4. UA Preferences 与深链

| 命令 id | 标题 | 说明 |
|---------|------|------|
| `workbench.action.openConnectionPreferences` | Open Connection Preferences | 打开 Settings 的 `ua.connection` 页；`f1: false`，由 Settings 左 nav、深链与 StatusBar `status.conversation.engine` 芯片点击调用 |
| `workbench.action.openEnginePreferences` | Open Engine Preferences | `ua.engine` 页；`f1: false` |
| `workbench.action.backToClientSettings` | 返回 vscode 客户端 Settings | 两页顶部返回 |

深链 scheme `universe-agent://`（`UniverseAgentDeepLinkHandler`，`IURLHandler`）：`universe-agent://settings/<page>` 或 `universe-agent://<page>` 打开对应 Settings 页；`<page>` 为 `client`（默认）、`connection`、`engine`，以及客户端分组别名（`display`、`chat-input`、`startup`、`keyboard-enter`、`notifications`、`permissions`、`client-tools`）。不绑 `product.urlProtocol`（[page-access-schemes](../../../dev/plans/page-access-schemes.md)）。

## 5. Sources（`contrib/sources`）

Sources 无独立命令；tab 切换为 title 区 tab strip 点击（`nextSourcesTab` 支持循环）。Changes 的 stage / unstage / commit 调用 git 扩展命令 `git.stage` / `git.unstage` / `git.commit`（或 SCM `acceptInputCommand`）。见 [Sources 系统](../sources/overview.md)。

## 6. 设置键

| 键 | 默认 | 说明 |
|----|------|------|
| `conversation.navigate.closeChildOnBack` | `true` | 后退时关掉延伸 tab / 子代理对话框而非仅切焦点 |
| `workbench.conversation.hidden` / `workbench.sources.hidden` | runtime storage | Part 显隐（非用户设置；[layout-state](../workbench/layout-state.md)） |
| `chat.titleBar.signIn.enabled` | `false` | 出厂关：titlebar 无 Copilot Sign In |
| `chat.agentsControl.enabled` | `hidden` | 出厂关：无 Agent Status 命令中心 chrome |
| `editor.inlineSuggest.enabled` | `false` | 出厂关：Preview 内无 ghost-text |
| UA 客户端设置组（`uaClientSettings.ts`） | 各自默认 | display / chat-input / startup / keyboard-enter / notifications / permissions / client-tools；宿主为 `SettingsEditor2` |

## 7. 键盘可达性现状

键盘上今天能做的：`Ctrl/Cmd+B` 切 Navigator；`Ctrl+Alt+I`（Open Conversation）显示并聚焦 Conversation——所以隐藏 Conversation 后键盘用户**有**一条返回路径。做不到的：Conversation / Preview / Sources 的 toggle、`showConversationPart`、split、关非根均**无默认键位**，只能鼠标或 F1；无法用键盘单独藏 / 显 Preview 或 Sources。约束与目标见 [PRD-018](../../product/requirements.md#prd-018-键盘可达与辅助功能)（`proposed`）；新键位须避开已占用的 `Ctrl+Alt+I` 与 `Ctrl/Cmd+B`。
