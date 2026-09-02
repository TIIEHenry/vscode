---
title: "Agent IDE 壳命令、菜单落点与快捷键"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "四钮、Conversation、Sources、Sessions roster、UA Preferences、深链的用户可见命令清单；chat tab 复用 editor group 命令；对话框 Escape / Accessible View；窄宽度见透镜页"
---

# Agent IDE 壳命令、菜单落点与快捷键

> 导航：[系统索引](INDEX.md)。命令 id 以源码 `registerAction2` / `MenuRegistry` 为准；本页只登记**默认 Code 窗口**可见的产品入口，Copilot Chat 被藏 / 转的命令族见 [agent-ui §3 / §5](../chat/agent-ui.md)。

## 1. 四钮与区域显隐（`workbench/browser/actions/layoutActions.ts`）

| 命令 id | 标题 | 落点 | 默认键位 |
|---------|------|------|----------|
| `workbench.action.toggleSidebarVisibility` | Navigator（产品名；上游 Toggle Primary Side Bar） | titlebar `LayoutControlMenu` 首钮；View › Appearance | `Ctrl/Cmd+B`（上游继承） |
| `workbench.action.toggleConversation` | Toggle Conversation Visibility | `LayoutControlMenu`「Conversation」；View › Appearance；F1 | `Ctrl/Cmd+Alt+Shift+C` |
| `workbench.action.toggleEditorVisibility` | Toggle Editor Area Visibility | `LayoutControlMenu`「Preview」（四钮之一，`CreateToggleLayoutItem`）；`LayoutControlMenuSubmenu` 亦有；Preview editor title 上的 Hide / Show Preview（`MenuId.EditorTitle` / `EditorTitleContext`）；F1 | `Ctrl/Cmd+Alt+Shift+P` |
| `workbench.action.toggleSources` | Toggle Sources Visibility | `LayoutControlMenu`「Sources」；View › Appearance；F1 | `Ctrl/Cmd+Alt+Shift+S` |
| Panel / Auxiliary Bar toggles | 上游命令 | 退到 `LayoutControlMenuSubmenu`（D7） | 上游继承 |

四钮之外，Conversation / Sources 区域内各有本地 hide（−）控件（`partRegionHideControl.ts`），Preview 的本地 hide 是 editor title 动作；全部经 `setPartHidden` 走同一 Layout 路径。互斥规则见 [ADR-006](../../../dev/decisions/006-shell-invariants.md)。壳级 Part 焦点循环（F6）见 [§7](#7-键盘可达性现状)。

## 2. Conversation（`contrib/conversation`）

| 命令 id | 标题 / 触发 | 说明 | 默认键位 |
|---------|-------------|------|----------|
| `workbench.action.chat.open` | **Open Conversation**（默认窗标题） | F1 主入口；经 `chatShellRouting.focusConversationPart` 显示并聚焦 `CONVERSATION_PART`，**不**开 ChatEditor / Aux Chat | `Ctrl+Alt+I`（mac `Cmd+Ctrl+I`，上游继承） |
| `workbench.action.showConversationPart` | StatusBar session / model 芯片点击 | `setPartHidden(false, CONVERSATION_PART)` + `IConversationPartService.focus()` | 无 |
| `workbench.action.chat.forkConversation` | Fork（Conversation 版 `ForkConversationAction`） | 同 session 新增延伸 tab | 上游继承 |
| `workbench.action.conversation.splitSessionWindow` | Split Conversation Editor（类别 Conversation） | 当前叶内开 `CONVERSATION_SIDE_GROUP`；F1 | `Ctrl/Cmd+\`（`conversationPartFocus`） |
| `workbench.action.conversation.nextChatTab` | Open Next Conversation Chat | F1 别名：当前 Conversation 叶内下一 chat tab / 下一 split 列；**不另绑键** | 无（复用 `workbench.action.nextEditor`：`Ctrl+PageDown` / mac `Cmd+Alt+→`） |
| `workbench.action.conversation.previousChatTab` | Open Previous Conversation Chat | F1 别名：当前 Conversation 叶内上一 chat tab / 上一 split 列；**不另绑键** | 无（复用 `workbench.action.previousEditor`：`Ctrl+PageUp` / mac `Cmd+Alt+←`） |
| Conversation chat tablist ← / → | 焦点在 editor group tablist 上 | 只切同组 tab（循环）；Home / End 到首尾；不跨 split 列、不打到 Preview | 组件内键处理（`conversationSplitActions.contribution.ts`）；全局切 tab 走 editor group 命令 |
| SessionBar ← / → | 按钮；鼠标侧键 4 / 5（`event.button` 3 / 4） | 每个 Conversation `IEditorPart` 自有导航栈 | 鼠标侧键 |
| SessionBar「关非根」 | 按钮 | `closeNonRootTabs` | 无 |
| 子代理对话框：popout / maximize / close | overlay 按钮；Esc | trap 根 = `overlay.element`（自备透镜 tab / 标题行，不写 Part 级 sessionBar）。Esc 顺序：图示 overlay → 局部 inspector → 标题改名 → 对话框；**不**关根会话 | Esc（组件内） |
| 「对话 \| 轨迹」 | pane 内透镜 tablist | 左右键 / Home / End 切换；持久化到 workspace storage | 组件内键处理（`conversationLens.ts`） |
| Accessible View 朗读回合 | `Alt+F2`（上游 Accessible View） | `ConversationAccessibleView` 经 `IAccessibleViewService` 读完整回合；不新造 live 区 | 上游 Accessible View |
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

**四钮默认键位（D14 @2026-09-02）** — 注册于 `workbench/browser/actions/layoutActions.ts`（`ProductLayoutToggleKeybindingPrimary`），Keyboard Shortcuts 可见；须不与 Open Conversation（`Ctrl+Alt+I` / mac `Cmd+Ctrl+I`）或 Navigator（`Ctrl/Cmd+B`）冲突：

| 区域 | 命令 id | 默认键位 |
|------|---------|----------|
| Navigator | `workbench.action.toggleSidebarVisibility` | `Ctrl/Cmd+B` |
| Conversation | `workbench.action.toggleConversation` | `Ctrl/Cmd+Alt+Shift+C` |
| Preview | `workbench.action.toggleEditorVisibility` | `Ctrl/Cmd+Alt+Shift+P` |
| Sources | `workbench.action.toggleSources` | `Ctrl/Cmd+Alt+Shift+S` |

隐藏 Conversation 后可用 **`Ctrl/Cmd+Alt+Shift+C`**（toggle）或 **`Ctrl+Alt+I`**（Open Conversation，显示并聚焦）纯键盘回到对话。

**Part 焦点循环（D14 @2026-09-02）** — 键位注册于 `workbench/browser/actions/navigationActions.ts`；名义顺序与隐藏跳过逻辑于 `workbench/services/layout/browser/layoutService.ts`（`MAIN_WINDOW_PART_FOCUS_CYCLE`、`resolveVisiblePartFocusNeighbour`、`getDefaultPartFocusTarget`）：

| 命令 id | 标题 | 默认键位 |
|---------|------|----------|
| `workbench.action.focusNextPart` | Focus Next Part | `F6` |
| `workbench.action.focusPreviousPart` | Focus Previous Part | `Shift+F6` |

主窗口名义顺序（`F6` 正向）：Activity Bar → Navigator（Sidebar）→ **Conversation** → **Preview**（Editor）→ **Sources** → Panel → Auxiliary Bar → Status Bar。Conversation / Preview / Sources 经 `setPartHidden` 隐藏时，`resolveVisiblePartFocusNeighbour` 会跳过不可见 part，**F6 不会落到隐藏的 Agent 壳区域**。当前无 workbench part 持焦时，默认落到第一个可见的 Conversation / Preview / Sources（`getDefaultPartFocusTarget`）。

**对话区内 aria（实现文件索引）** — 下列 chrome 已有 `aria-label` / `role="tablist"` 等；默认键盘快捷键仍见下方「仍缺」：

| 控件 | 实现文件 |
|------|----------|
| 延伸 chat tab / SessionBar 窗口导航（← / →） | `conversationNavigation.contribution.ts`；chat tab 全局键复用 `workbench.action.nextEditor` / `previousEditor`，不另绑 |
| 「对话 \| 轨迹」透镜 tablist | `conversationLens.ts`（左右键） |
| 过程折（Process steps） | `conversationProcessFold.ts`、`conversationTimelineTree.ts` |
| 权限 / 提问座位 | `conversationConfirmationSeat.ts`、`conversationQuestionSeat.ts` |
| Composer 底栏 Permission 下拉 | `conversationLens.ts`（文案 `conversationLensDockStrings.ts`） |
| 子代理对话框 overlay | `conversationSubAgentOverlay.ts`（trap 根 `overlay.element`；Esc：图示 → inspector → 改名 → 对话框） |
| 完整回合朗读 | `conversationAccessibleView.ts` → `IAccessibleViewService`（`AccessibleViewProviderId.Conversation`） |

**仍缺（PRD-018 其余项）**：`showConversationPart`、关非根仍无默认键位；Composer Tab 进工具栏与 Enter 模式属 CS-2。窄宽度（Q6 / RWD-1）由叶级 `ConversationEditorPane.layout` 打 `.is-narrow` / `.is-compact`，见 [lens-and-trajectory](lens-and-trajectory.md) §1。`split` 的 `Ctrl+\\` 仍在 `conversationPartFocus` 时接管；chat tab **不**再另绑 `Ctrl+PageDown`。约束与目标见 [PRD-018](../../product/requirements.md#prd-018-键盘可达与辅助功能)（`accepted`）。
