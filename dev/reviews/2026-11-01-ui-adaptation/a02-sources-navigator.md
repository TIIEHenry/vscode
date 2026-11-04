---
title: "a02 Sources 与 Navigator 的适配"
type: reference
status: active
phase: M7
updated: 2026-11-01
summary: "Sources 页签条、列表行、矮高度、底部面板 Diff 与 Navigator 列表在不同容器宽高下的问题；路径相对 src/vs/workbench/"
---
# a02 Sources 与 Navigator 的适配

路径未写前缀时相对 `src/vs/workbench/`。判据和共性根因见 [README](README.md)。

基线：Sources 是独立 Part（`browser/parts/sources/sourcesPart.ts:67-69`，最小 200×120），由宿主 `layout()` 打 `is-narrow`（<600）和 `is-compact`（<300），不用视口媒体查询。侧栏与辅助栏最小宽 170，底部面板最小 300×77。`SourcesListViewport.layout()` 遇到 0 尺寸直接返回，隐藏页签不会缓存 0。Files / Changes / Review 行高 22 与 CSS 一致，Projects 24 一致。Changes 行尾按钮用 `opacity: 0` 常驻占位，不跳动。两个 Diff 视图 `automaticLayout: false` 并显式 `layout`。方案 §5 没有给 Sources / Navigator 成文的宽度合同，下面按「能拖到的最小宽高」判。

## a02-1 Files 页标题栏动作组不收缩，最窄宽度下三个页签只剩省略号

状态：成立。优先级 P1；运行时确认页签小于 16px 或隐藏按钮被盖则 P0。

观察（作者：agent:context-gatherer）：

- Files 页不分宽度把 Explorer 动作停到标题槽：`contrib/sources/browser/sourcesTabsHost.ts:319` `setActionsDock(isFiles ? slot : undefined)`。过滤框只在 ≥600 时才停（`dock` 变量），动作组没有这个条件。
- Explorer 在标题菜单注册了 6 个动作（`contrib/sources/browser/sourcesFilesExplorer.ts:653-770`），每个 22px。
- 动作容器 `flex-shrink: 0`（`contrib/sources/browser/media/sourcesTabs.css:49-55`）；标题槽本身 `flex: 0 1 auto; min-width: 0`（14-24）。
- 窄档页签 `flex: 1 1 0; min-width: 0; text-overflow: ellipsis`（230-237）。
- 估算：Part 宽 200 时，扣隐藏按钮约 30、动作组约 118，三个页签共剩不到 50px。页签名读不出来。动作组溢出标题槽，可能压到「Hide Sources」上。

切到 Changes / Review 时动作组撤走，页签恢复。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `sourcesTabsHost.ts:313-326`、`sourcesTabs.css:5-55、185-237` |

要看什么：Part 宽 200 时 `.sources-tab` 宽度；`.sources-title-filter > .actions` 右边界是否越过 `.title-actions`。

**方案**：宽 < 300 时把 Explorer 动作收进「…」溢出菜单，或移到 Files 面板内的工具行。与 [r02-6](../2026-11-01-ui-components/r02-sources-navigator.md)（页签外观）不同，本条是页签宽度。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D5：动作放得下时常驻，放不下时从末尾收进行尾 `…`；页签文字不截断。同刀改 Sources 概览「Files 标题旁常驻」。

## a02-2 页签条用隐藏滚动条的横向滚动兜底

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：`.sources-tab-list { overflow-x: auto; scrollbar-width: none }` 并隐藏 webkit 滚动条（`sourcesTabs.css:186-202`）；≥600 时页签 `flex-shrink: 0; white-space: nowrap`（204-228）。选中时 `tab.scrollIntoView({ inline: 'nearest' })`（`sourcesTabsHost.ts:301-303`），它也会滚动 `overflow: hidden` 的祖先。英文下估算放得下；长本地化标签或 600–700px 时可能被滚出可视区且没有提示。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `sourcesTabs.css:185-228`、`sourcesTabsHost.ts:287-303` |

要看什么：德语或法语、Part 宽 600–700 时页签是否被滚出；`.title` 的 `scrollLeft` 是否变成非 0。

**方案**：≥600 也允许页签收缩加省略号；不依赖 `scrollIntoView`。

签收：待用户。

## a02-3 长文件名被父级硬裁，没有省略号

状态：成立。优先级 P1（Changes / Review 若无悬停全名）；Files P2。涉及未提交改动（Changes CSS）。

观察（作者：agent:context-gatherer）：三份列表 CSS 写法相同。外层 `.monaco-icon-label-container { display: flex; overflow: hidden }`，内层名称盒 `.monaco-icon-name-container { flex-shrink: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis }`。名称盒不收缩，宽度恒等于文字宽，自己的 `text-overflow` 不会触发；文字被父级直接截在字形中间。位置：`contrib/sources/browser/media/sourcesChangesList.css:267-282`、`sourcesReviewList.css:139-153`、`sourcesFilesList.css:103-117`。

Files 行有 `title`（`sourcesFilesList.ts:104`）；Changes 行用 ResourceLabel，没有显式 `title`，悬停是否显示全路径未查。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `sourcesReviewList.css:139-153`、`sourcesChangesList.css:265-282` |

要看什么：Changes / Review 被裁的行上悬停，是否出现完整路径。

**方案**：名称盒改为 `flex-shrink: 1` 并给 `min-width`（例如 6ch），描述继续先缩。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。实现时描述盒要改成 basis 0 或给更大的 flex-shrink，否则名称与描述按 basis 比例一起缩，做不到描述先缩；名称保底 8ch，与 Navigator 一致。「涉及未提交改动」已过时，`sourcesChangesList.css` 已在 `b5ec35bd101` 提交。

## a02-4 父路径从尾部截断

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：三份 CSS 的 `.label-description` 都是尾部省略（`sourcesChangesList.css:292-300`、`sourcesReviewList.css:151-159`、`sourcesFilesList.css:127-135`）。深路径只剩 `src/vs/work…`，看不到紧邻文件的目录。上游 SCM 视图也这样截，所以这是建议而不是缺陷。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `sourcesReviewList.css:151-159` |

**方案**：父路径改为头部省略或中间截断，并保证悬停有全路径。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D6：不改截断方向，沿用上游尾部省略；只给没有完整路径 tooltip 的行补上。

## a02-5 Review 行的归属 chip 先占宽，文件名被挤到接近 0

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：行内顺序是图标标签、归属容器、状态按钮（`contrib/sources/browser/sourcesReviewList.ts:114-117`）。文件名列 `flex: 1; min-width: 0`，即 basis 0（`sourcesReviewList.css:131-137`）；归属容器 `flex-shrink: 1; min-width: 0`，basis 是 chip 内容宽（179-186）；单个 chip `max-width: 140px`，compact 下 72px（188-205）；状态按钮 `flex-shrink: 0`，非 compact 下还带文字。400px 宽、两个 140px 的 chip 时，文件名约剩 2px。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `sourcesReviewList.css:131-240` |

要看什么：`getChips` 返回几个、有没有 `+N` 溢出 chip。

**方案**：文件名改 `flex: 1 1 auto; min-width: 8ch`；归属容器限 `max-width: 40%`，或窄档只留 1 个 chip 加 `+N`。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。只签 CSS 路线：标签 `flex: 1 1 auto; min-width: 8ch`，归属容器封顶。排除「窄档只留 1 个 chip」，那会改 `sourcesReviewAttribution.ts` 的 chip 数规则。必须与 a02-3 同批落地。

## a02-6 Sources 压到最小高度时 Changes 列表 0 行，Commit 可能被推出

状态：成立。优先级 P1。涉及未提交改动。列表 0 行已确认；Commit 是否被裁待运行时核对。

观察（作者：agent:context-gatherer）：Part 高 120 时内容区 92px。Changes 面板依次是工具栏（`min-height: 30px`，`sourcesChangesList.css:21-30`）、面板内过滤框约 36px（`sourcesListFilter.css`）、列表（`flex: 1 1 0; min-height: 0`）、提交区（`flex-shrink: 0`，8px 外边距加 8px 内边距，输入框 28–112px，`sourcesChangesList.css:353-385`）。30 + 36 + 52 已超过 92，列表为 0 行；外层面板 `overflow: hidden`（`sourcesTabs.css:275-281`）。提交信息写到多行时，Commit 按钮会被推出可视区。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 列表 0 行成立 | 读 `sourcesChangesList.css:21-74、353-405` |

要看什么：Sources 在 Preview 下方被拖到 120px 高，输入 3 行提交信息，Commit 是否可见。

**方案**：矮高度下把工具栏和提交区放进同一个可滚区，或给列表保底高度；提交区保证 Commit 始终可见。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D7：提交区钉在底部，列表可缩到 0 行；Sources Part 最小高度抬到放得下标题、工具栏、单行提交区和两行列表。

## a02-7 Changes / Review 空态与错误态不能滚动

状态：待核对。优先级 P2；下一步动作若在文案末尾则 P1。

观察（作者：agent:context-gatherer）：`.sources-changes-empty`（`sourcesChangesList.css:65-74`）与 `.sources-review-empty`（`sourcesReviewList.css:282-292`）没有 overflow 规则，外层面板 `overflow: hidden`。Files 页已给错误态加了 `overflow: auto`（`sourcesFilesList.css:150-170`）。200px 宽、150px 高时长文案可能被截掉后半段，违背原则 6「空态说清原因和下一步」。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `sourcesChangesList.css:65-79` |

要看什么：200×150 下触发 Changes 读取失败，文案末尾是否可见。

**方案**：两个空态加 `overflow: auto`，与 Files 一致。

签收：待用户。

## a02-8 底部面板 Diff 在矮面板下正文只剩 0–3 行

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：编辑器高度 = 视图高减文件头、新文件提示、动作提示（`contrib/sources/browser/sourcesDiffPanelView.ts:246-258`）。文件头与动作区 `flex-wrap: wrap`，提示条 `overflow-wrap: anywhere` 且没有 `max-height`（`sourcesDiffPanel.css:1-28、70-84`）。面板高 77 时编辑器约 5px，120 时约 48px。移到 170px 宽侧栏时文件头折成多行约 90px。Accept / Stage / Revert 在文件头顶部，仍可达。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `sourcesDiffPanelView.ts:246-266` |

**方案**：提示条加 `max-height` 和滚动；编辑器高度过小时显示「放大面板查看」提示。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。只签提示条加 `max-height` 与 `overflow: auto`（`layoutBody` 读 offsetHeight，编辑器自动多拿到高度）。排除「放大面板查看」提示，那是新文案和新 UI。面板很矮时文件头仍占掉大部分，这部分不解决。

## a02-9 两个 Diff 视图不读内联切换设置

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`sourcesDiffPanelView.ts:265` 与 `contrib/sources/browser/conversationDiffReviewPane.ts:336-337` 只从配置读 `diffEditor.renderSideBySide`，审阅面还写死 `useInlineViewWhenSpaceIsLimited: true`。配置监听也只响应 `renderSideBySide`（`sourcesDiffPanelView.ts:197`、`conversationDiffReviewPane.ts:148`）。默认 ≤900px 自动切内联，用户关掉自动内联或改断点后这里不跟。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `sourcesDiffPanelView.ts:260-267` |

**方案**：两个视图都读 `diffEditor.useInlineViewWhenSpaceIsLimited` 与 `diffEditor.renderSideBySideInlineBreakpoint`，并加监听。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。改为读上游设置并监听，默认值下行为不变。`conversationDiffReviewPane.ts` 写死的 `useInlineViewWhenSpaceIsLimited: true` 没有文档说明是有意形态，一并改。两处目前都没有相关单测，各补一例。

## a02-10 Projects 行 is-compact 没有 CSS，悬停出动作时行内跳动

状态：成立。优先级 P2。涉及未提交改动。

观察（作者：agent:context-gatherer）：TS 会切 `is-compact`（`contrib/navigator/browser/navigatorProjectsList.ts:416-420`），`navigatorProjectsList.css` 里没有任何 `.is-compact` 规则。名称 `flex: 1 1 auto; min-width: 8ch`，描述 `flex: 0 1 42%`，detail 不收缩；行动作平时 `display: none`，悬停、聚焦、选中时变 `display: flex` 再加 8px 外边距（112-144）。只有会话行在悬停时隐藏 detail 让位。170–300px 宽时悬停导致布局跳动，名称被硬裁（机制同 a02-3）。行有 `title`，全名可看。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | grep `is-compact` 在该 CSS 无命中 |

**方案**：compact 档隐藏描述；行动作改为常驻占位（像 Changes 行用 `opacity`）。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D8：行尾固定宽度槽：平时消息数，悬停、焦点或选中换成行动作，不重排；路径照样不藏；删掉 `is-compact` 切换。Navigator CSS 有他人未提交改动，等其提交后再改。

## a02-11 Projects 树 layout 高度可能为负

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：`navigatorProjectsList.ts:428` `this.tree?.layout(height - filterHeight - statusHeight - emptyHeight, width)`，没有 `Math.max(0, …)`。同目录 `agentInspectView.ts:284` 有这个保护。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 未读 |

要看什么：把 Projects 视图压到最矮，树是否盖到下一个 pane 的标题。

**方案**：包一层 `Math.max(0, …)`。

签收：待用户。

## a02-12 Review 进度头按钮可被压窄

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：`.sources-review-progress-header { flex-wrap: nowrap }`，按钮 `flex: 0 1 auto; min-width: 0`（`sourcesReviewList.css:90-106`），计数文字有省略号，按钮自己没有截断规则。200–260px 宽时按钮文字可能溢出边框或被裁。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `sourcesReviewList.css:90-113` |

要看什么：200px 下「Mark all reviewed」文字是否完整。

**方案**：按钮 `flex-shrink: 0`，让计数文字先缩；或窄档允许换行。

签收：待用户。

## a02-13 compact 档隐藏 Unreviewed 文字后可读名称来源不明

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：`.part.sources.is-compact .sources-review-unreviewed-toggle span { display: none }`（`sourcesReviewList.css:41-43`）。状态按钮有 `title`；这个切换控件有没有 `aria-label` 或 `title` 没查到。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 未读 TS |

要看什么：compact 档下该控件的可读名称与悬停提示。

**方案**：隐藏文字时补 `aria-label` 与 `title`。

签收：待用户。
