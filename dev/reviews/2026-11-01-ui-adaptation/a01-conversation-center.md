---
title: "a01 Conversation 中心的适配"
type: reference
status: active
phase: M7
updated: 2026-11-01
summary: "Conversation 叶宽档、SessionBar、Composer、时间线、浮层与 Trajectory inspector 在不同叶宽、叶高和缩放下的问题；路径相对 src/vs/workbench/"
---
# a01 Conversation 中心的适配

路径未写前缀时相对 `src/vs/workbench/`。判据和共性根因见 [README](README.md)。

基线：宽度档从 `contrib/conversation/browser/conversationEditorPane.ts` 的 `layout(dimension)` 开始，用叶宽调 `applyLeafWidthClasses`（`conversationNarrowLayout.ts`：≥900 full、450–899 medium、300–449 narrow、<300 min）。并列叶、会话窗口叶、子代理浮层各自判定，没有地方用 `window.innerWidth` 定档。300px 叶里 Send 与 model 在 trailing 且不收缩，SessionBar 的 More 在 narrow 和 compact 下都显示；确认座位按钮可换行；Trajectory 窄档 inspector 覆盖表格、带 Back、关闭后恢复滚动。下面只列问题。

## a01-1 阅读列容器查询写死 599，与叶档 450 并存

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`contrib/conversation/browser/media/conversationLens.css:4890-4906` 有 `@container conversation-reading (max-width: 599px)`，给行头换行、给气泡与座位 `max-width: 100%`。同一组元素在 4879-4888 已按 `.is-narrow`（<450）写过一遍，4874-4877 又按 `[data-conversation-width="medium"]` 写了换行。叶宽 450–599 时 JS 档是 medium，容器查询已按窄生效。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `conversationLens.css:4874-4906` |

**方案**：删掉这个容器查询块，改用叶档类；或者改成 449 并在 `conversationNarrowLayout.ts` 注释里登记。属于 README「待用户确认 1」的阈值口径。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D3：叶档按 450 / 300；删掉 599 容器查询，它独有的规则并进 `.is-narrow`；可访问性方案 §5 的 600 同刀改为 450。

## a01-2 Trajectory inspector 覆盖阈值 600，按表格宽算

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`contrib/conversation/browser/conversationTrajectory.ts:45` `CONVERSATION_TRAJECTORY_OVERLAY_WIDTH = 600`。`isNarrowWidth()` 用 `tableScroll.clientWidth`，测不到时回退 `Math.min(width, 704)`（约 806-812）。叶宽约 450–650 时 inspector 已覆盖表格并出现 Back，但 Back 的 `flex-shrink: 0` 只挂在 `.is-narrow`（<450）上（`conversationLens.css:4775-4780`）。Back 可达，口径和叶档不同。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `conversationTrajectory.ts:45、794-812、917-934` |

**方案**：注明按表格宽判的理由，或改用叶档；Back 的 `flex-shrink: 0` 改挂在 `--inspector-overlay` 类上。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。只签把 Back 的 `flex-shrink: 0` 改挂到 `--inspector-overlay` 类上，并写明覆盖按表格宽判定。排除「改用叶档」：lens-and-trajectory.md 已写定叶宽 < 600 覆盖表，改成 450 属待用户确认 1。

## a01-3 Composer 自增高上限按视口 36vh，矮叶里会把时间线挤到 0

状态：待核对。优先级 P1；核实 Send 被裁则 P0。

观察（作者：agent:context-gatherer）：`conversationLens.css:3843-3849` `.conversation-lens-dock-input { max-height: min(336px, 36vh); field-sizing: content }`。Dock 与 composer-cluster 都 `flex-shrink: 0`（2972-2975、3633-3636）。底栏（Send、model、More）在输入框下方。

- 窗口 900px 高、编辑器上下拆 3 叶，每叶内容约 260px，`36vh` = 324px。
- 200% 缩放，1080 设备像素约 540 CSS px，再上下拆分，每叶约 210px，`36vh` ≈ 194px。

草稿 15 行以上时，Dock 总高超过叶内容高，时间线高为 0，底栏可能落到叶外被裁。Enter 仍能发送。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 上限按视口成立 | 读 `conversationLens.css:3843-3849、3632-3646` |

要看什么：上下拆 3 叶、每叶约 300px 高、输入 20 行时，`.conversation-lens-dock-bottom-bar` 的 `getBoundingClientRect().bottom` 是否超出 `.conversation-editor-page`，`.conversation-timeline-viewport` 高度是否为 0。

**方案**：上限改按叶高。`layout` 里按叶高的四成写一个 CSS 变量；时间线保留最小高度（例如 96px）。

签收：待用户。

## a01-4 SessionBar 在 300–449px 仍是文字 tabs，标题与同步态可能被挤到 0

状态：成立。优先级 P1。`min-width: 8ch` 不生效已确认；标题与同步态被挤到多窄待运行时核对。

观察（作者：agent:context-gatherer）：

- 栏高 28px，`padding: 0 32px 0 6px; overflow: hidden`（`conversationLens.css:6-27`）。
- 透镜 tabs `flex-shrink: 0`（45-50），narrow 档又加了一次（4775-4780）。tabs 只在 `.is-compact`（<300）才变图标（84-94）。
- 标题外层 `.conversation-lens-session-title-wrap` 是 `flex: 0 1 auto; min-width: 0; overflow: hidden`（148-155）。`.is-narrow` 下的 `min-width: 8ch` 写在内层标题上（4787-4790），内层 `flex: none`，外层照样能缩到 0 并裁掉，8ch 保不住。
- 估算：300px 时 leading 可用约 200px，图标加两个文字 tab 约 190–200px，留给标题与同步态的约为 0。

RWD-1 要求同步态可达。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 8ch 不生效成立；挤压按估算 | 读 `conversationLens.css:6-27、45-50、84-175、4775-4790` |

要看什么：叶宽 300 / 330 / 360px 时 `.conversation-lens-session-sync-badge` 与 `.conversation-lens-session-title-wrap` 的 `clientWidth`；`.conversation-lens-lens-tabs` 右边界是否越过 `.conversation-lens-session-controls`。

**方案**：tabs 在 `.is-narrow` 就切图标；同步态在窄档改成带 `min-width` 的状态点；8ch 挪到 title-wrap 上。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D4：标题先截断并配 tooltip，8ch 保底挪到标题外层；同步徽章 `flex-shrink: 0`，窄档最宽 12ch 省略；tabs 只在 < 300 变图标，同步态不改成点。同刀改 lens-and-trajectory §1「允许收缩」。

## a01-5 450–899px 时 Composer 次要控件藏在横向滚动后

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：add / tune / permission / agent 都在 bottom-leading 里，leading 是 `overflow-x: auto`（`conversationLens.css:3908-3922`），trailing `flex-shrink: 0`，model 下拉 `max-width: 165px`（4121-4123）。More 只在 `.is-narrow` 下显示（4857-4864），`toggleMoreContextView` 在非 narrow 时直接返回（`conversationLensComposerChrome.ts:342`）。450px 时 leading 可用约 197px，四个控件加间距超过 250px。Send 不受影响，permission 与 agent 选择器被藏在细滚动条后面。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `conversationLens.css:3908-3936、4857-4869` |

要看什么：叶宽 450 / 520px 时 `.conversation-lens-dock-bottom-leading` 的 `scrollWidth` 是否大于 `clientWidth`。

**方案**：按实测溢出决定是否收进 More，不只按 450 档。

签收：待用户。

## a01-6 Inbox 队列面板 min-width 320px 大于 300px 叶

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`contrib/conversation/browser/conversationInboxOverlay.ts:502-505` 把面板宽设成锚点宽，但 `conversationLens.css:3378-3380` 在队列非空时写 `min-width: min(320px, calc(100vw - 24px))`，CSS 的 `min-width` 压过 JS 宽度。面板挂在 workbench 根上，不会被裁，能关闭，只是盖到邻叶上。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `conversationLens.css:3362-3380` |

**方案**：`min-width` 改为不超过锚点列宽，或去掉。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。只签「min-width 不超过锚点列宽」（例如 JS 同时写 minWidth）。排除「去掉 min-width」：锚点没量到时面板回到 `min-width: 0`，会窄于 ui-design-principles 规定的弹出层 200px 下限。验证：`conversationInboxOverlay.test.ts` 加锚点 284px 一例。

## a01-7 Composer 弹出菜单高度没有按视口封顶

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：Add 弹窗 `width: 280px; max-height: 320px`（`conversationLens.css:4326-4330`），agent-down 弹窗 `max-height: 240px`（357-359）。宽度都有 `calc(100vw - 24px)` 封顶，高度没有。360 CSS px 高的窗口里，上方空间不足 320px 时顶部项可能出视口。Esc 能关闭。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 未逐行读 |

要看什么：360 CSS px 高窗口里打开 Add，弹窗顶边是否小于 0，contextView 是否翻到下方。

**方案**：`max-height: min(320px, calc(100vh - 48px))` 加 `overflow: auto`。

签收：待用户。

## a01-8 宽度为 0 时档位与类不一致

状态：成立。优先级 P2。目前没有可见影响。

观察（作者：agent:context-gatherer）：`conversationLeafWidthBucket(0)` 返回 `'min'`，而 `isConversationLeafNarrow` 与 `isConversationLeafCompact` 都要求 `width > 0`，结果是 `data-conversation-width="min"` 同时没有任何窄类。`ConversationLeafSessionBar.applyWidth` 没有 0 守卫（`contrib/conversation/browser/conversationLeafSessionBar.ts:150-152`），`layout()` 有。现在 CSS 只用 `medium` 这个 dataset 值，所以看不出来。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `conversationNarrowLayout.ts:9-47` |

**方案**：宽度 ≤ 0 时不写 dataset、不改类；`applyWidth` 加同样的守卫。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。守卫放进 `applyLeafWidthClasses` 一处，覆盖没有守卫的三个调用方；补一条「宽 0 时 dataset 和类都不变」的单测。

## a01-9 两个来源写同一组宽度类

状态：待核对。优先级 P2。涉及未提交改动。

观察（作者：agent:context-gatherer）：`ConversationLens.layout` 用叶的 `dimension.width`（`conversationLens.ts:553-558`），`bindReadingColumnLayout` 用阅读列 ResizeObserver 的 `contentRect.width`（`conversationLensReadingColumn.ts:288-299`），两者都调 `applyConversationWidth`。两者差一个滚动条或内边距时，在 300 / 450 / 900 边界附近档位取决于谁最后写。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `conversationLensReadingColumn.ts:282-366` |

要看什么：默认窗口里 `readingColumn.clientWidth` 是否等于 EditorPane 的 `dimension.width`。

**方案**：只保留叶宽一个来源；ResizeObserver 只负责 layout，不改档。

签收：待用户。

## a01-10 时间线 Markdown 图片没有 max-width

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：时间线视口 `overflow-x: hidden`（`contrib/conversation/browser/media/conversationTimeline.css:25-34`）。`conversationLens.css` 没有 `img` 规则；上游 Chat 有 `.rendered-markdown img` 限宽（`contrib/chat/browser/widget/media/chat.css:972`），但不作用于 Conversation。Conversation 的 Markdown 渲染没有关掉图片（`conversationTurnContentAdapter.ts:148-155` 只扩了链接 scheme）。宽图在 300px 叶里会被视口裁掉。

观察里提到的表格问题不成立：`conversationLens.css:2719-2728` 的表格已有 `display: block; max-width: 100%; overflow-x: auto`。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 表格不成立；图片待核对 | 读 `conversationLens.css:2718-2730`；grep `rendered-markdown img` 只命中 chat.css |

要看什么：在 300px 叶里渲染一张 1200px 宽的图片，看是否被裁、能否滚到。

**方案**：加 `.conversation-lens-turn-body.rendered-markdown img { max-width: 100%; height: auto }`。

签收：待用户。

## a01-11 content-visibility 占位在窄档滚动时跳动

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：`conversationTimeline.css:49-68` 的行用 `content-visibility: auto; contain-intrinsic-block-size: auto 120px`。`auto` 记住上次渲染尺寸。叶从宽拖到窄后，没重新渲染的行仍用旧的较矮尺寸，进视口时变高，滚动位置跳。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `conversationTimeline.css:49-68` |

要看什么：300px 叶、50 个以上回合、从宽拖窄后向上滚，`scrollTop` 是否突变。

**方案**：宽度档变化时让已记住的尺寸失效。

签收：待用户。

## a01-12 ProcessFold 测不到宽时回退 400px

状态：待核对。优先级 P2。涉及未提交改动。

观察（作者：agent:context-gatherer）：`contrib/conversation/browser/conversationProcessFold.ts:737` `container.clientWidth || 400`。fold 内容在隐藏或尚未布局时测量，叶宽小于 400 时可能按 400 排版。这个宽度喂给了什么没有查清。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 未读 |

要看什么：300px 叶里展开 fold，内容是否超宽。

**方案**：回退值改用 `host.lastReadingWidth`。

签收：待用户。

## a01-13 每个叶的 SessionBar 都留 32px 右内边距

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：`conversationLens.css:16-17` 注释说右内边距是给 Part 右上角的隐藏按钮让位。隐藏按钮绝对定位在 Part 的 `top: 0; right: 0`（`browser/parts/conversation/media/conversationPart.css:24-37`），只压在贴右上角的那一叶上。其余叶也留了 32px，300px 叶里加重 a01-4。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `conversationLens.css:6-27` |

要看什么：默认窗口里这条栏是每叶一份还是 Part 级一份；隐藏按钮压在哪一叶上。

**方案**：只给贴 Part 右上角的那一叶加这段内边距。

签收：待用户。
