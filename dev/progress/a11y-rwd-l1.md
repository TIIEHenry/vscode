---
title: "A11y / RWD L1 源码复核记录"
type: progress
status: in_progress
phase: M7
updated: 2026-09-04
summary: "对照 accessibility-responsive-ui.md §9；D19 全收；HC/reduced-motion 源码合同 pass（chevron transition 仅 `.ua-motion`）；不宣称 PRD-018 / 整份 a11y 完成"
updated: 2026-09-03
summary: "对照 accessibility-responsive-ui.md §9；Connection 窄宽 Back 与 Preferences HC 已补；Engine/Connection 无动画节点；不宣称 PRD-018 / 整份 a11y 完成"
---

# A11y / RWD L1 源码复核

> **切片：** [accessibility-responsive-ui.md](../plans/accessibility-responsive-ui.md) §8 L1。  
> **工位：** C · `loop/C`。  
> **方法：** 只读源码合同，不跑 electron / playwright / `code-web` / 测试套件。W1 Web 冒烟与 axe/手测属 §10，失败记 [D17](deferred-gaps.md)；本页不假装已手测。  
> **不宣称：** 整份 a11y、PRD-018、方案 checkbox 整包完成。

依赖切片按源码存在性对照（合入声明来自父委派，本页只核符号与文件）：B Q5a/Q5b/Q6/CS-2，A E2-1/E2-7，C K1/K2/T1。

## 总评

| 档 | 条数 |
|:---|:-----|
| pass | 8 |
| partial | 0 |
| fail | 0 |

原 partial（高对比度 / reduced-motion）已于 **2026-09-04 槽 B** 收口：conversation chevron `transition` 只挂在 `.ua-motion`；轨迹折补挂 class；选择器级 reduce 规则删掉（改由 T1）。**GC-7（2026-09-04）：** D19(2) 原先成立——`ua-common.css` 只从 `conversationPart.ts` 引入且选择器只打 `.part.conversation` / `.part.sources`，Preferences 模态（`.preferences-editor`）无描边。已把 `ua-common.css` 挂到 `style.ts`（与 `productAccessibility.css` 同链），并给 `.preferences-editor` 补 focus/selected 描边；`productAccessibility.css` 同步加 Preferences 按钮 focus 加粗。**D19(1)（2026-09-04）：** 方案改口「Engine / Connection 无动画节点」——两 pane CSS 无 `transition` / `animation` / `@keyframes`，文件头注明不挂空 `.ua-motion`。**D19(3)（2026-09-04）：** §5/§9 改口 Connection 窄宽为单栏滚动（无左导航/Back）；与实现一致，本条升 pass。D19 已 closed。
partial 一项：高对比度 / reduced-motion（Conversation 仍有未挂 `.ua-motion` 的 transition；Engine/Connection 无动画节点）。Connection 窄宽 Back 与 Preferences HC 已补，见 §6 / §8。

---

## §9 逐条

### 1. 对话页 `ConversationTimelineEntryKind` 可读名称与状态

**Verdict:** pass

**合同句：** `user`、`assistant`、`system`、`thinking`、`tool`、`confirmation`（permission 座位）、`question`（独立提问座位，role/name 与 confirmation 不同）、`error`、`unknown`、`visualization`、`reviewNav` 各有可读名称与状态。

**证据：**

| kind | 符号 / 落点 |
|:-----|:------------|
| 类型全集 | `ConversationTurnKind` = `StubTurnKind` ∪ `ConversationHonestTurnKind`（`conversationStubModel.ts`：`user`/`assistant`/`confirmation`/`thinking`/`tool`/`visualization`/`reviewNav` + `question`/`error`/`unknown`/`system`） |
| 通用角色名 | `getConversationTurnRoleLabel`（`conversationTrajectoryList.ts`）穷尽上述 kind |
| 行名 | `getConversationTurnAriaLabel`（`conversationAccessibility.ts`） |
| confirmation | `getConversationPermissionSeatAriaLabel`：role/name 为 **Permission**；座位 `role=group`（`conversationConfirmationSeat.ts`） |
| question | `getConversationQuestionSeatAriaLabel`：role/name 为 **Question**；座位 `role=region`（`conversationQuestionSeat.ts`）；Allow/Skip 不复用 |
| error | 读出 retryable / not retryable |
| unknown | 读出 `typeName` |
| visualization | 「Visualization」+ 标题；卡 `aria-label` 与全屏钮 `aria-label`（`conversationVisualizeCard.ts`） |
| reviewNav | 「Review, {summary}」；文案来自 `formatReviewNavLabel`（`conversationReviewEntry.ts`：「View changes (N files)」） |
| 树挂名 | `getConversationEntryAriaLabel` → 上式（`conversationSessionView.ts` / `conversationTimelineTree.ts`） |

**缺口：** 单测 `conversationAccessibility.test.ts` 只抽查 user/system/error/unknown/confirmation，未枚举 thinking/tool/question/visualization/reviewNav。§4「Review 行读出路径、审阅态和归因」比 §9 更严：当前 label 是文件计数，不是路径/已审阅/归因。不据此把 §9 本条打 fail。

### 1b. 流式行只在进入 / 离开 streaming 时改一次名

**Verdict:** pass

**证据：** `getConversationTurnAriaLabel` 在 `streaming === true` 时省略正文、只加「in progress」后缀（`conversationAccessibility.ts`）。单测 `streaming aria-label changes only with the streaming flag, not token text` 断言 token 增长不改名。无对正文设 `aria-live`。

**缺口：** 无（源码合同）。

### 1c. 完整回合可经 Accessible View 朗读

**Verdict:** pass

**证据：** `getConversationTurnAccessibleText` 含全文（含 streaming 时的 body）。`ConversationAccessibleView` 经 `IConversationTimelineRevealService.getAccessibleTurnContent` 接入既有 `AccessibleContentProvider`（`conversationAccessibleView.ts`）。`conversation.contribution.ts`：`AccessibleViewRegistry.register(new ConversationAccessibleView())`。未自造第二套 live 区。

**缺口：** 无运行时朗读证据（§10 / D17）。

### 2. 轨迹 `ConversationTrajectoryKind` 可读名称

**Verdict:** pass

**合同句：** `system`、`user`、`context`、`compacted`、`message`、`tool`、`subtool`、`thinking` + `permission`、`question`、`error`、`unknown` 各有可读名称。`compacted` 属 Q3。

**证据：** 类型在 `conversationTrajectoryModel.ts`。`getTrajectoryKindLabel`（`conversationTrajectory.ts`）switch 穷尽上述 kind。列表 `getAriaLabel` = `kindLabel: preview`（`TrajectoryTableAccessibilityProvider`）。行内 `kindCell` / `previewCell` 同函数。

**缺口：** 无。

### 3. chat tabs / 透镜 tablist / 对话框 trap 与 Escape

**Verdict:** pass

**合同句：** chat tabs 经 editor group 命令可切（末 tab `nextEditor` 离开 Conversation 不判 fail）；透镜 tablist 左右键可切；对话框 trap 根为 `overlay.element`、Tab wrap 与 Escape 顺序正确。

**证据：**

- Chat tab：`ConversationNextChatTabAction` 注释写明复用 `workbench.action.nextEditor` / `previousEditor`，不绑 `Ctrl/Cmd+PageUp/PageDown`（`conversationSplitActions.contribution.ts`）。F1 别名无独立主键。文档 [commands.md](../../docs/systems/conversation/commands.md) 同行。
- 透镜：`role=tablist/tab`；`handleLensTablistKeyDown` 左右 / Home / End（`conversationLens.ts`）。
- Trap：`handleConversationOverlayTab(this.element, …)`，`this.element` 即 overlay 根（`conversationSubAgentOverlay.ts`）。可视化 overlay 对自身 `overlay` 同样 wrap（`conversationVisualizeOverlay.ts`）。`handleConversationOverlayTab` 对 Tab / Shift+Tab 取模循环（`conversationConfirmationSeat.ts`）。
- Escape 顺序：visualize → inspector → rename → `close()`，注释写明不关根会话（`conversationSubAgentOverlay.ts`）。`tryCloseVisualizeOverlay` / `tryDismissLocalInspector` / `tryCancelSessionTitleEdit`（`conversationLens.ts`）。改名输入 Escape 只 `cancelSessionTitleEdit`。

**缺口：** 无运行时 trap/Escape 手测（§10 / D17）。

### 4. 座位提交回焦；Composer Tab 与两种 Enter

**Verdict:** pass

**证据：**

- `resolveConfirmation` / `resolveQuestion` → `focusTimelineRecord` → `timelineTree.focusRecord`（`preventScroll` + `scrollIntoView({ block: 'nearest' })`，注释写明不跳页顶）（`conversationLens.ts` / `conversationTimelineTree.ts`）。
- 选项组方向键：`wireConversationSeatOptionKeys`（左右上下循环）。
- Composer：textarea 后接 `conversation-lens-dock-bottom-bar` 工具栏；keydown **不**拦截 Tab，原生 Tab 进入工具栏。
- Enter：`getUaClientKeyboardEnterBehavior`（`ua.client.keyboardEnter.behavior`）`send` = Enter 发送 / Shift+Enter 换行，`newline` 相反（`conversationLens.ts` + `uaClientSettingsHelpers.ts`）。发送钮始终可点。

**缺口：** 无运行时 Tab/Enter 手测。

### 5. Conversation 叶 300px

**Verdict:** pass

**合同句：** 主输入、Back、透镜 tabs 可达；inspector 覆盖可返回；多叶时每叶独立判定。

**证据：**

- 档位：`CONVERSATION_LEAF_COMPACT_WIDTH = 300`、`NARROW = 600`（`conversationNarrowLayout.ts`）。
- 叶宿主：`ConversationEditorPane.layout` 只看本叶 `dimension.width` 打 `.is-narrow` / `.is-compact`（`conversationEditorPane.ts`）。`ConversationLens.applyConversationWidth` 对 reading/timeline/dock 用叶宽；Part 级 sessionBar 用自己盒宽，避免并列窄叶误伤共享栏（`conversationLens.ts`）。
- CSS：`.is-compact` 下 dock 输入 `flex: 1`、Send/More `flex-shrink: 0`；透镜 tabs、sync badge、`.conversation-window-nav`、inspector Back `flex-shrink: 0`（`conversationLens.css`）。
- Inspector：`conversationTrajectoryInspectorBack` 按钮；窄时 overlay + Back（`conversationTrajectory.ts`）。
- 溢出菜单：窄宽把 tune/permission 等藏进 More popup（`toggleMoreContextView`）。

**缺口：** 无 300px 目视证据（§10 / D17）。

### 6. Engine / Connection 300px

**Verdict:** pass

**合同句：** Engine：左导航可返回，表单不溢出。Connection：单栏滚动（无左导航 / Back），表单不溢出（D19(3) 改口）。

**证据（Engine — 满足）：**

- `layout` 用 pane `dimension.width` 打 `.is-narrow` / `.is-compact`（`enginePreferencesPane.ts`，阈值 `PREFERENCES_PANE_NARROW_WIDTH=600` / `COMPACT=300`，`engineSectionChrome.ts`）。
- 窄时 `is-showing-detail`；`backButton`「Back to Engine sections」；`showNarrowNav` 回列表并 `navList.domFocus()`。
- CSS：窄时单栏、详情覆盖导航、input/textarea `max-width: 100%`（`enginePreferencesPane.css`）。
- 单测 `layout under 600px applies is-narrow and Back returns to nav`（`enginePreferencesPane.test.ts`）。

**证据（Connection — 单栏滚动；表单不溢出）：**

- 同样按 pane 宽打 class（`connectionPreferencesPane.ts`）。
- CSS：`overflow-x: hidden`、窄宽 field 换行、input `width: 100%`（`connectionPreferencesPane.css`）。
- 单测断言 `is-narrow` class（无 Back——合同不要求）。
- Connection 是单栏分区表单（Hub / Direct / Test），**没有** Engine 那种 nav list + `showNarrowNav`。Preferences 宿主有 `Back to Client Settings`（`uaPreferencesPanes.contribution.ts`），那是回 Client Settings，不是「左导航可返回」。
- **D19(3) 改口：** 产品认定单栏滚动即可；不造假 Back。见 [deferred-gaps D19](deferred-gaps.md) closed。

**缺口：** 无（源码合同）。
**证据（Connection — 表单不溢出；窄宽分区 + Back 已落）：**

- 同样按 pane 宽打 class（`connectionPreferencesPane.ts`）。
- 窄宽：`is-showing-detail` + `.connection-preferences-back` 回分区导航；`overflow-y: auto`。
- 单测 `layout under 600px shows Back and returns to zone nav`。

### 7. Web：Connection / Engine 无桌面连接控件（E2-1）

**Verdict:** pass（源码合同；不是 W1 冒烟）

**证据：**

- `shouldDrawDesktopConnectionControls()` = `!isWeb`（`engineSectionChrome.ts`）。
- Connection：`applyDesktopConnectionControlVisibility` 隐藏 Hub account / Hub devices / Direct / Test（`connectionPreferencesPane.ts`）。
- Engine：`testRow.style.display = 'none'`；断连条不画第二颗 Test Engine（`enginePreferencesPane.ts`）。

**缺口（不把本条打 fail，但不得据 §7 宣称「已按 phase/capability 诚实」）：**

- 门控是 `isWeb`，**不是** §7 写的 `getConnectionPhase` + capability reason。
- 仓内无「此环境不支持本机 Engine 连接」文案。
- 无 Web 单测断言省略。
- **W1 / `code-web` 未跑**；运行时证据仍归 D15。L1 只核「源码会隐藏这些控件」。

### 7b. Sources Review 三命令可键盘触发（K2）

**Verdict:** pass

**证据：** `sources.review.openSelected` / `toggleReviewedSelected` / `markAllReviewed` 均 `f1: true`（`sourcesReviewCommands.contribution.ts`）。`ISourcesReviewListHost.getSelectedEntry`（`sourcesReviewHostService.ts`）由 `SourcesTabsHost` 转发 `sourcesReviewList.ts`。`sources.contribution.ts` import 该 contribution。Command Palette 即键盘路径；无默认主键（与 [commands.md](../../docs/systems/conversation/commands.md) 一致，可自绑）。

**缺口：** 无默认 keybinding（合同未要求）。

### 8. 高对比度与 reduced-motion 下状态仍可区分（T1 + B 挂 class；A 无动画节点）

**Verdict:** pass（源码合同；未跑目视/axe）

**不得假装：** 仅有 T1 公共 CSS 就等于「状态仍可区分」。`.ua-motion { transition: none }` 只作用于挂了该类的节点。

**T1 已落（C）：**

- `ua-common.css`：`.monaco-workbench.hc-black` / `.hc-light` token；focus / selected / error / pending 用描边区分；`@media (prefers-reduced-motion: reduce) .ua-motion { transition: none; animation: none }`。
- `conversationPart.ts` import `./media/ua-common.css`。
- 200% overlay：dialog `max-width/height: 100%`；chrome `pointer-events` 分层。

**B 已挂（2026-09-04 收口）：**

- `conversationProcessFold.ts` / `conversationTrajectory.ts` / `conversationVisualizeCard.ts`：chevron（及 tool icon）带 `.ua-motion`。
- `conversationLens.css` / `conversationVisualize.css`：`transition: transform` 只写在 `.…chevron.ua-motion`；裸 chevron 选择器无 transition。
- 选择器级 chevron `prefers-reduced-motion` 规则已删（交 T1）；保留 tool loading spinner 的 `animation: none`。
- 合同测：`conversationUaMotionContract.test.ts`。

**A / D19(1) 改口：** Engine / Connection pane CSS 无 `transition`/`animation`/`@keyframes`（`enginePreferencesPane.css` / `connectionPreferencesPane.css` 文件头已钉死）。不挂空 `.ua-motion`。减动对这两页是 no-op，不是漏关 shimmer。

**HC 覆盖（GC-7 后）：** T1 描边选择器现含 `.preferences-editor`（Engine / Connection pane 宿主）。引入链：`workbench/browser/style.ts` → `productAccessibility.css` + `ua-common.css`（后者仍由 `conversationPart.ts` 再 import 一次）。未跑目视/axe（§10 / D17）。

**仍缺：** 无（本条源码合同）；手测/axe/W1 仍归 §10 / D17 / D15。
**HC：** `ua-common.css` 已把 Engine / Connection Preferences 与 `.conversation-visualize-overlay` 纳入 `:focus-visible` / selected 描边。

**缺口：** Conversation 选择器级 transition 仍不完全依赖 `.ua-motion`。手测 / axe 未跑，归 D17。D19 源码残留已闭。

---

## §10

本轮 **未** 跑 axe、Lighthouse、视觉截图、键盘脚本、Web 冒烟。因此 **没有** 新的手测/axe 失败可记入 D17。源码复核也 **未** 看到 §10 四条硬阻塞的实现（trap 无法离开、键盘无确认危险动作、Web 误画本机连接控件、200% 关闭/发送不可达）——后两条仅源码合同，W1 仍待跑。

---

## 不升格

- 已改 [accessibility-responsive-ui.md](../plans/accessibility-responsive-ui.md) §5/§6/§9/T1：钉死 D19(1) 与 D19(3) 改口；方案 `status` 仍 `accepted`（W1 未完）。
- 不把 PRD-018 / PRD-019 标为 `implemented`。
- L1 本身是复核记录，不是整包 a11y 完成证明。
