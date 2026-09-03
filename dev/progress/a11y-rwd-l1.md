---
title: "A11y / RWD L1 源码复核记录"
type: progress
status: in_progress
phase: M7
updated: 2026-09-04
summary: "对照 accessibility-responsive-ui.md §9 逐项源码判定；THEME 与 Connection 窄宽仍 partial；GC-7 已把 Preferences 模态纳入 T1 HC 描边；不宣称 PRD-018 / 整份 a11y 完成"
---

# A11y / RWD L1 源码复核

> **切片：** [accessibility-responsive-ui.md](../plans/accessibility-responsive-ui.md) §8 L1。  
> **工位：** C · `loop/C` · HEAD `06bd71d7`。  
> **方法：** 只读源码合同，不跑 electron / playwright / `code-web` / 测试套件。W1 Web 冒烟与 axe/手测属 §10，失败记 [D17](deferred-gaps.md)；本页不假装已手测。  
> **不宣称：** 整份 a11y、PRD-018、方案 checkbox 整包完成。

依赖切片按源码存在性对照（合入声明来自父委派，本页只核符号与文件）：B Q5a/Q5b/Q6/CS-2，A E2-1/E2-7，C K1/K2/T1。

## 总评

| 档 | 条数 |
|:---|:-----|
| pass | 6 |
| partial | 2 |
| fail | 0 |

partial 两项：Engine/Connection 300px（Connection 无左导航 Back）；高对比度 / reduced-motion（T1 公共文件已落，B 挂了部分 `.ua-motion`，A 未挂）。**GC-7（2026-09-04）：** D19(2) 原先成立——`ua-common.css` 只从 `conversationPart.ts` 引入且选择器只打 `.part.conversation` / `.part.sources`，Preferences 模态（`.preferences-editor`）无描边。已把 `ua-common.css` 挂到 `style.ts`（与 `productAccessibility.css` 同链），并给 `.preferences-editor` 补 focus/selected 描边；`productAccessibility.css` 同步加 Preferences 按钮 focus 加粗。未新开 D 项；D19 仍因 (1) `.ua-motion`、(3) Connection Back 保持 open。

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

**Verdict:** partial

**合同句：** 左导航可返回，表单不溢出。

**证据（Engine — 满足）：**

- `layout` 用 pane `dimension.width` 打 `.is-narrow` / `.is-compact`（`enginePreferencesPane.ts`，阈值 `PREFERENCES_PANE_NARROW_WIDTH=600` / `COMPACT=300`，`engineSectionChrome.ts`）。
- 窄时 `is-showing-detail`；`backButton`「Back to Engine sections」；`showNarrowNav` 回列表并 `navList.domFocus()`。
- CSS：窄时单栏、详情覆盖导航、input/textarea `max-width: 100%`（`enginePreferencesPane.css`）。
- 单测 `layout under 600px applies is-narrow and Back returns to nav`（`enginePreferencesPane.test.ts`）。

**证据（Connection — 表单不溢出；无左导航 Back）：**

- 同样按 pane 宽打 class（`connectionPreferencesPane.ts`）。
- CSS：`overflow-x: hidden`、窄宽 field 换行、input `width: 100%`（`connectionPreferencesPane.css`）。
- 单测只断言 class，无 Back。
- Connection 是单栏分区表单（Hub / Direct / Test），**没有** Engine 那种 nav list + `showNarrowNav`。Preferences 宿主有 `Back to Client Settings`（`uaPreferencesPanes.contribution.ts`），那是回 Client Settings，不是「左导航可返回」。

**缺口：** Connection 未实施窄宽左导航 / 详情覆盖 + Back。若产品认定 Connection 单栏滚动即可，须改 §9 合同；否则属 A 残留。见 [D19](deferred-gaps.md)。

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

### 8. 高对比度与 reduced-motion 下状态仍可区分（T1 + B/A 挂 class）

**Verdict:** partial

**不得假装：** 仅有 T1 公共 CSS 就等于「状态仍可区分」。`.ua-motion { transition: none }` 只作用于挂了该类的节点。

**T1 已落（C）：**

- `ua-common.css`：`.monaco-workbench.hc-black` / `.hc-light` token；focus / selected / error / pending 用描边区分；`@media (prefers-reduced-motion: reduce) .ua-motion { transition: none; animation: none }`。
- `conversationPart.ts` import `./media/ua-common.css`。
- 200% overlay：dialog `max-width/height: 100%`；chrome `pointer-events` 分层。

**B 已挂（部分）：**

- `conversationProcessFold.ts`：chevron / tool icon 带 `.ua-motion`。
- `conversationVisualizeCard.ts`：chevron 带 `.ua-motion`。
- `conversationLens.css` 另有对本折 chevron 的 reduce 规则（选择器级，不依赖 class）。

**B 未完全交给 `.ua-motion`：** `conversationLens.css` 与 `conversationVisualize.css` 仍把 `transition: transform 0.15s` 绑在 `.conversation-process-fold-chevron` / `-tool-chevron` / `.conversation-visualize-chevron` 上。挂了 class 的节点会被 T1 关掉动画；未挂的动画节点不会。

**A 未挂：** `contrib/conversation` 内 `.ua-motion` 仅上述 B 文件。Engine / Connection pane **零** `.ua-motion`。其 CSS 目前也无 `transition`/`animation`，故减动缺口是合同未完成，不是「现有 shimmer 仍在转」。

**HC 覆盖（GC-7 后）：** T1 描边选择器现含 `.preferences-editor`（Engine / Connection pane 宿主）。引入链：`workbench/browser/style.ts` → `productAccessibility.css` + `ua-common.css`（后者仍由 `conversationPart.ts` 再 import 一次）。未跑目视/axe（§10 / D17）。

**仍缺：** A 未挂 `.ua-motion`；Connection 300px 无左导航 Back。见 [D19](deferred-gaps.md) (1)(3)。

---

## §10

本轮 **未** 跑 axe、Lighthouse、视觉截图、键盘脚本、Web 冒烟。因此 **没有** 新的手测/axe 失败可记入 D17。源码复核也 **未** 看到 §10 四条硬阻塞的实现（trap 无法离开、键盘无确认危险动作、Web 误画本机连接控件、200% 关闭/发送不可达）——后两条仅源码合同，W1 仍待跑。

---

## 不升格

- 不改 `dev/plans/accessibility-responsive-ui.md` checkbox / status。
- 不把 PRD-018 / PRD-019 标为 `implemented`。
- L1 本身是复核记录，不是整包 a11y 完成证明。
