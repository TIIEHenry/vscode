---
title: "a04 窗口外框与工作台布局的适配"
type: reference
status: active
phase: M7
updated: 2026-11-01
summary: "默认编辑器窗口的 Part 最小尺寸、窗口缩放、侧栏左右、辅助栏与面板最大化、竖放面板、编辑器页签换行在不同窗口尺寸与布局设置下的问题；路径相对 src/vs/workbench/"
---
# a04 窗口外框与工作台布局的适配

路径未写前缀时相对 `src/vs/workbench/`。判据和共性根因见 [README](README.md)。

基线：

- `src/vs/sessions/browser/parts/media/editorPart.css` 的未提交改动不会被默认窗口加载，它只经 `sessions.common.main.ts` 引入。
- D1354 的窄桌面导航抽屉只在 Agents Window（`src/vs/sessions/browser/layoutPolicy.ts`、`src/vs/sessions/browser/workbench.ts`），默认窗口没有窄窗口回退。
- 隐藏后恢复尺寸会记住：`browser/layout.ts` 的 `onWillSaveState` 保存侧栏、面板、辅助栏、右列宽与 Sources 高，`adjustPartPositions` 移动前后按缓存尺寸恢复。
- INV-052 保证 Conversation、Preview、Sources 至少一个可见；Zen 进出保留并恢复 Conversation。
- 身份条、会话胶囊、子代理面包屑都挂在 `.part.conversation` 内，不进标题栏，不挤窗口控件或命令中心。
- 编辑器页签的未提交改动只作用于新建页签按钮。新建页签按钮只在配置了 `menuIds.tabsBarAddTab` 时创建（`browser/parts/editor/multiEditorTabsControl.ts:258-265`），默认窗口只有 Preview 主编辑区配置了它，会话页签不受影响。

下面只列问题。

## a04-1 各 Part 最小宽之和远超窗口最小宽，窄窗口时网格溢出

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：

- 窗口最小尺寸 `WIDTH: 400, WIDTH_WITH_VERTICAL_PANEL: 600, HEIGHT: 270`（`src/vs/platform/window/common/window.ts:22-26`），只在面板竖放时换成 600。
- Part 最小宽：Conversation 450（`browser/parts/conversation/conversationPart.ts:27`）、Sources 200、侧栏 170、辅助栏 170、面板 300；活动栏约 48。活动栏、侧栏、Conversation、右列之和约 870px；加辅助栏约 1040；面板竖放约 1170。
- 高度：标题栏 35 + Conversation 160 + 面板 77 + 状态栏 22 = 294 > 270。
- `clampConversationEndColumnWidth`（`browser/layout.ts:61-63`）只在 `createGridDescriptor` 初始化时调用，运行中变窄不重算。

溢出时网格按顺序裁边。侧栏在左时，最右边的辅助栏与右列（含 Sources 标题栏右端的隐藏按钮）先被裁；侧栏在右时顺序反过来（`arrangeMiddleSectionNodes`），最右边的活动栏与导航侧栏先被裁。上游也有同样的溢出机制，产品把门槛从约 600 抬到了约 870。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `window.ts:22-26`、`conversationPart.ts:27、82-88`、`layout.ts:61-63、2986-3027` |

要看什么：800×600、侧栏在右时截图，看溢出部分是硬裁还是出现横向滚动条。

**方案**：属于 README「待用户确认 2」。可选：默认窗口加窄窗口策略（按优先级自动收起右列或侧栏）；或把 Electron 窗口最小宽抬到 Part 最小宽之和。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D17：窗口窄于可见 Part 最小宽之和时依次临时收起辅助栏、右列、侧栏，Conversation 不自动收起，临时收起不写入显隐状态。另写方案并过规则 16 后实施。

## a04-2 窗口缩放时先让出空间的列随侧栏左右翻转

状态：成立。优先级 P2；往返核实后 P1。排序逻辑已确认；往返效果待运行时核对。

观察（作者：agent:context-gatherer）：网格 `proportionalLayout: false`（`browser/layout.ts:1736-1740`）。Conversation 是 `LayoutPriority.High`（`conversationPart.ts:88`），右列里的 Preview 也是 High，所以中心分支和右列分支都是 High（`base/browser/ui/grid/gridview.ts:297-307`）。SplitView 对 High 项按索引升序 `pushToStart`，索引最大的 High 项最先吸收尺寸变化（`base/browser/ui/splitview/splitview.ts:1249-1262`）。侧栏在左时右列先吸收；侧栏在右时 Conversation 先吸收。一次最大化、还原往返后，用户拖定的分隔位置可能丢失，两种侧栏位置的体验相反。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 读 `layout.ts:1735-1745`；splitview 未读 |

要看什么：1920 → 1200 → 1920 往返中，记录两种侧栏位置下 Conversation 与右列的宽度。

**方案**：明确只让一列优先吸收，例如右列改 Normal；或中间行按比例布局。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D17：窗口缩放由 Conversation 吸收宽度变化，侧栏与右列保持宽度，与侧栏在哪一边无关。

## a04-3 Sources 分隔线写死在左边

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`browser/parts/sources/media/sourcesPart.css:19` `border-left: 1px solid …`，高对比下改 `border-left-color`（114-116）。侧栏在右时右列被放到 Conversation 左侧（`layout.ts:2236-2244` 与 `arrangeMiddleSectionNodes`），Sources 的 CSS 没有位置类。分隔线贴到窗口左缘或辅助栏一侧，与 Conversation 相接的那一侧没有线。另外 114-124 的三条高对比规则是祖先写法，不生效，见 a05-17。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `sourcesPart.css:10-24、113-124`、`layout.ts:2224-2244` |

要看什么：网格 sash 在该处是否另有边框弥补。

**方案**：仿照 `.part.sidebar.left / .right` 给 Sources 加位置类，按位置选 `border-inline-start` 或 `border-inline-end`。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。`sourcesPart.css` 里失效的祖先写法高对比选择器一起修，或明确交给 a05-17。

## a04-4 「最大化辅助栏」不隐藏 Conversation，也不加宽辅助栏

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`setAuxiliaryBarMaximized(true)`（`browser/layout.ts:2419-2465`）隐藏侧栏、面板、Preview、Sources，只把 `conversationVisible` 记进状态，不隐藏 Conversation；进入时也不 `resizeView(auxiliaryBarPartView)`。腾出的宽度被 High 优先级的 Conversation 吸收，辅助栏宽不变，看不出「最大化」。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `layout.ts:2411-2490` |

**方案**：属于 README「待用户确认 4」。若保留 Conversation 是有意的，就显式把辅助栏 resize 到可用宽；否则最大化时也隐藏 Conversation。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D17：保留 Conversation（parts-and-grid 第 79 行），最大化时辅助栏占满其余宽度，Conversation 压到最小宽。

## a04-5 面板「已最大化」等于「右列已隐藏」

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`isPanelMaximized()` 的条件是面板居中或竖放、右列隐藏、辅助栏未最大化（`browser/layout.ts:2495-2501`）。用户用四钮把 Preview 和 Sources 都关掉后，面板按钮显示「还原」；点了以后走 `setEditorHidden(!(state?.editorVisible ?? true))`，没进过最大化时 `state` 为空，用户主动关掉的 Preview / Sources 被重新打开。进入最大化时只隐藏右列，不隐藏 Conversation，底部面板与 Conversation 在同一竖向分支里，面板高度不变。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `layout.ts:2495-2575` |

**方案**：用独立的运行时标志记录面板最大化；最大化时让 Conversation 让出高或宽。属于 README「待用户确认 4」。

签收：不签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D17：面板最大化保持合同，改用独立标志；与 2026-10-30 r09-1 同一改动，那份补齐禅模式、重载与使用方清单后一起签。

## a04-6 四钮只在标题栏，native 标题栏下没有界面入口

状态：不成立。

观察（作者：agent:context-gatherer）：四钮注册在 `MenuId.LayoutControlMenu`，受 `workbench.layoutControl.type` 门控；区域隐藏按钮只能隐藏。推测 native 标题栏、全屏、Zen 下只能靠命令面板找回。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 不成立 | `browser/actions/layoutActions.ts:353-445`：Toggle Conversation / Sources 都是 `f1: true`、有默认快捷键，并注册在 `MenuId.MenubarAppearanceMenu`（查看 → 外观）；侧栏与 Preview 开关是上游既有菜单项 |

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。确认「不成立」、不修：Toggle Conversation、Toggle Sources、Toggle Preview 都是 F1 命令，有默认快捷键，前两个还挂在「查看 → 外观」菜单下（`layoutActions.ts`）；native 标题栏下走原生菜单，全屏与 Zen 下仍可用 F1 和快捷键。

## a04-7 面板竖放时插在 Conversation 与 Preview / Sources 之间

状态：待核对。优先级 P2。代码形态已确认；是否有意待用户。

观察（作者：agent:context-gatherer）：`arrangeMiddleSectionNodes` 竖放分支先 push Conversation，再按位置放面板，最后放右列，结果是 `[活动栏, 侧栏, Conversation, 面板, 右列, 辅助栏]`。运行时 `adjustPartPositions` 也把面板锚在 Conversation 旁（`browser/layout.ts:2258-2264`）。会话和它的配套右列被面板隔开，与愿景「窗口右侧配套 Preview + Sources」不一致；最小宽再加 300（见 a04-1）。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 代码成立 | 读 `layout.ts:2986-3027、2257-2264` |

**方案**：属于 README「待用户确认 4」。若不是有意的，竖放面板改锚在右列外侧。

签收：待用户。

## a04-8 wrapTabs 判断加入新建页签按钮宽度

状态：待核对。优先级 P2。涉及未提交改动。

观察（作者：agent:context-gatherer）：未提交改动在 `browser/parts/editor/multiEditorTabsControl.ts:2118-2130` 的 `lastTabFitsWrapped` 里加了 `addTabWidth = this.addTabContainer?.offsetWidth ?? 0`。换行模式下最后一个页签可能被拉伸到占满本行剩余宽度，再加上按钮宽可能被误判放不下，从而关闭换行退回滚动。只影响 Preview 主编辑区的各组。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `multiEditorTabsControl.ts:254-316、2109-2135` |

要看什么：Preview 宽 300–500px、5–8 个页签、开启 `workbench.editor.wrapTabs` 时，最后一行能否同时放下最后一个页签、新建页签按钮与编辑器工具栏；退回滚动的临界宽度。

**方案**：改用最后一行实际排布判断（新建页签按钮与最后一个页签 `offsetTop` 是否相同），不相加宽度。

签收：待用户。

## a04-9 身份条 z-index 6 高于区域隐藏按钮的 5

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：`contrib/conversation/browser/media/conversationIdentityStrip.css:6-23` `position: relative; z-index: 6; width: min(100%, 720px)`；隐藏按钮所在 `.conversation-region-chrome` 为 `position: absolute; top: 0; right: 0; z-index: 5`（`browser/parts/conversation/media/conversationPart.css:29-42`）。Conversation 宽小于约 784px 且身份条位于 Part 顶部那一行时，可能盖住「Hide Conversation」。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 未读 |

要看什么：身份条实际纵向位置；它与 region-chrome 之间有无中间层叠上下文。

**方案**：region-chrome 的 z-index 高于叶内外框，或身份条让出右上角 32px。

签收：待用户。
