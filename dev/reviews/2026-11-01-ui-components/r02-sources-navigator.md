---
title: "r02 Sources 与 Navigator"
type: reference
status: active
phase: M7
updated: 2026-11-01
summary: "Sources 页签与列表、Navigator 列表和行内筛选框的交互与视觉问题；路径相对 src/vs/workbench/contrib/"
---
# r02 Sources 与 Navigator

路径未写前缀时相对 `src/vs/workbench/contrib/`。审查背景、判据和共性根因见 [README](README.md)。

基线：两区所有列表和树都是 `WorkbenchList` / `WorkbenchObjectTree`，方向键、键入跳转和 `aria-activedescendant` 来自平台。Sources 页签条（`sources/browser/sourcesTabsHost.ts:195-300`）的 `tablist / tab / tabpanel`、`aria-selected`、漫游 `tabIndex` 与 Home / End 都正确。下面只列问题。

## r02-1 Navigator 列表没有键盘可达的上下文菜单

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：`navigator/browser` 下没有任何 `onContextMenu` 或 `showContextMenu`。Projects、Agents、Team、Inspect 的行上按 Shift+F10 或菜单键没有反应。行内操作是手建的 `ActionBar`（`navigatorAgentsView.ts:154-163`、`navigatorProjectsList.ts:164-177`），只在悬停或聚焦时显示。Sources 三个列表都接了 `list.onContextMenu`（`sourcesChangesList.ts:754`、`sourcesFilesList.ts:354`、`sourcesReviewList.ts:755`），两区不一致。

推测：Agents 的 Inspect / Reveal 注册在 `MenuId.ViewItemContext`、`group: 'inline'`（`navigatorAgentsView.ts:1189、1210`），但 `navigator/` 里没有代码读取这个菜单。如果别处也不读，这两条注册只起到暴露命令的作用。另外 Tab 能否进入聚焦行的 `ActionBar` 未实测。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | `grep -rn "onContextMenu\|showContextMenu" navigator/browser` 无结果；推测部分未核 |

方案：给四个 Navigator 列表接 `onContextMenu`，菜单内容与行内 `ActionBar` 一致，参照 Sources 的写法。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md)）：收窄：只给已有行内动作的 Agents 活动列表与 Projects 列表加右键 / Shift+F10，菜单等于行内动作；Team、Inspect 与层级树没有行内动作，不加。

## r02-2 行内筛选框 Escape 只清空，不能把焦点交还列表

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：同一段 keydown 逻辑复制了五份：`sources/browser/sourcesListFilterBox.ts:50-57`、`navigator/browser/navigator{Agents,Projects,Team}InlineFilterBox.ts:57-64`、`conversation/browser/conversationSessionsInlineFilterBox.ts:49-55`。都是 `if (e.keyCode === KeyCode.Escape && this.input.value)` 才清空；框已空时 Escape 什么都不做。没有 DownArrow / Enter 把焦点移进结果列表，宿主只订阅 `onDidChange`，没有调用 `list.domFocus()`。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `sourcesListFilterBox.ts:44-73`；`grep` 确认其余四处是同一写法，且都用 `addStandardDisposableListener`，键值换算没问题 |

方案：抽一个共用的行内筛选框类：有内容时 Escape 清空，空时 Escape 把焦点交还列表；DownArrow 聚焦列表第一项；Enter 打开第一项。五处改用它。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D11）：空框 Escape 还焦点、DownArrow 进列表第一项；Enter 不打开第一项。`explorerInlineFilterBox.ts` 一并纳入。

## r02-3 Navigator 列表行焦点框只在 `:focus-visible` 下出现

状态：待核对。

观察（作者：agent:context-gatherer）：`navigator/browser/media/navigatorProjectsList.css:6-16`、`navigatorTeamList.css`、`navigatorStub.css`、`agentInspect.css:101-111` 都先 `.monaco-list:focus .monaco-list-row.focused { outline: none !important }`，再只在 `.monaco-list:focus-visible` 下恢复。Engine 与 Connection 首选项的导航列表也是这个写法。

要看什么：用鼠标点一行，再按方向键移动。Chromium 对鼠标聚焦的元素可能保持 `:focus-visible` 为假，这时焦点框一直不出现，违反「键盘焦点始终可见」。若复现，改为按列表的键盘导航状态加类，而不是依赖 `:focus-visible`。

## r02-4 Review 归属 chip 用徽标色

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`sources/browser/media/sourcesReviewList.css:192-206` 的 `.sources-review-attribution-chip` 用 `--vscode-badge-background / badge-foreground`、`border-radius: 999px`、`font-size: 10px`。这是强调色胶囊，原则 6 不允许彩色徽标。chip 是真 `<button>`（`sourcesReviewList.ts:170-184`），样式里只有 `:active`，没有 `:hover` 与 `:focus-visible`。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读第 190-212 行。焦点是否被工作台全局按钮规则兜住未核 |

方案：改成中性底（`color-mix(foreground 6%)`）加 `descriptionForeground` 文字，补 `:hover`；`:focus-visible` 用中性阴影焦点（写法见 [README](README.md) 用户裁定 2），高对比用 `contrastActiveBorder` 轮廓。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D13）：芯片常态无底无框、弱化字，悬停 `toolbar.hoverBackground`，`cornerRadius.small`，`fontSize.label2`；焦点按 D1。

## r02-5 五个行内筛选框外观各不相同

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：

| 属性 | Navigator（Agents / Team / Projects） | Sources 列表内 | Sources 停靠标题栏 | Conversation 会话列表 |
|---|---|---|---|---|
| 输入框高 | 22px | 24px | 外框 22px、输入 20px | 28px |
| 圆角 | `cornerRadius-small` | `4px` 字面量 | `4px` | `8px` |
| 静止描边 | 透明 | 前景 8% | 前景 8% | 透明 |
| 底部分隔线 | 有 | 无 | 无 | 无 |
| 清除按钮 | 24×22 | 18×18、圆角 3px | `spacing-size200` | 24×22 |
| 高对比聚焦规则 | 有（但见 r02-7） | 无 | 无 | 有（但见 r02-7） |
| 减弱动效 | 无（见 r02-9） | 部件全局规则覆盖 | 有 | 部件全局规则覆盖 |

Agents 与 Team 的 CSS 除类名前缀外逐字相同；Projects 多 12 行。Navigator 的底部分隔线属于原则 6 说的装饰性分隔线；静止描边透明时，若主题的 `input.background` 与侧栏同色，输入框不可见，不符合「内容容器要有低对比轮廓」。`navigatorAgentsInlineFilterBox.ts:20` 的 `HEIGHT = 32` 是按 22 + 2×4 + 1 硬算的，改 CSS 会悄悄失配。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `navigatorAgentsInlineFilter.css`、`sourcesListFilter.css`、`sourcesTabs.css:30-190` 全文；会话列表那一列未逐行复读 |

方案：与 r02-2 合并：一个共用组件配一份 CSS，统一 24px 高、`cornerRadius-small`、前景 8% 静止描边、无分隔线，高度常量从同一处取。聚焦不再用现在的 `border-color: var(--vscode-focusBorder)`，改为中性阴影焦点（写法见 [README](README.md) 用户裁定 2）；高对比用 `contrastActiveBorder`，并按 r02-7 修正选择器。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D11）：共用组件：输入 22px、`cornerRadius.small`、淡底、无常驻描边、无底部分隔线，聚焦描边换 `focusBorder`；容器 30px。

## r02-6 Sources 页签悬停与选中外观相同

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：`sources/browser/media/sourcesTabs.css:239-249`，`.sources-tab:hover` 与 `.sources-tab.selected` 都是 `toolbar-hoverBackground` 加激活前景色，选中保持 `font-weight: 400`，`::after` 指示条在非高对比下是 `content: none`。鼠标划过未选页签时，它看起来和选中页签一样。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读第 239-270 行。补充：高对比下的选中指示条规则写成 `:is(.hc-black, .hc-light) .monaco-workbench …`（第 263 行），按 r02-7 永不匹配，所以高对比下同样分不清 |

方案：悬停改用更浅的底（例如前景 5%），选中保留当前底并加字重 600 或底部 2px 指示；高对比规则按 r02-7 修正。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D12）：未选无底；悬停 `toolbar.hoverBackground`；选中 `toolbar.activeBackground` 加前景字、不加粗；高对比选中补 `contrastActiveBorder` 下划线。透镜 tab 同改。

## r02-7 祖先形式的高对比选择器永不匹配

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：`conversation/browser/media/conversationSessionsInlineFilter.css:78` 用 `:is(.hc-black, .hc-light) .monaco-workbench …`，要求高对比类在 `monaco-workbench` 的祖先上。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 主题类加在 `layoutService.mainContainer`（`services/themes/browser/workbenchThemeService.ts:120、640`）；`monaco-workbench` 也加在 `this.mainContainer` 上（`browser/workbench.ts:329、337`）。同一元素，祖先形式不匹配。三个 contrib 目录共 13 处：`conversationSessionsInlineFilter.css` 1、`conversationSubAgentOverlay.css` 1、`navigatorAgentsInlineFilter.css` 3、`navigatorProjectsInlineFilter.css` 3、`navigatorTeamInlineFilter.css` 3、`sourcesTabs.css` 2 |

影响：Sources 页签的高对比选中指示和高对比聚焦框、Navigator 与会话筛选框的高对比聚焦边框都不生效。聚焦时仍有普通的 `focusBorder`，所以焦点不是完全不可见，但高对比专用的 `contrastActiveBorder` 用不上。

方案：13 处统一改成 `.monaco-workbench:is(.hc-black, .hc-light) …`。可以在 docs-health 或 stylelint 里加一条检查拒绝 `^:is(.hc-` 开头的选择器。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md)）：收窄：不加「拒绝 `^:is(.hc-` 开头」的检查，只精确匹配 `:is(.hc-black, .hc-light) .monaco-workbench`。与适配审查 a05-17 合并，共 20 处。

## r02-8 Sources 页签面板去掉了聚焦框

状态：待核对。

观察（作者：agent:context-gatherer）：`sources/browser/media/sourcesTabs.css:279-281` 对 `tabIndex = -1` 的 `.sources-tab-panel` 设 `:focus { outline: none }`，没有替代。

要看什么：是否有代码路径把焦点放到面板本身（而不是面板里的列表）。若有，键盘用户会看到焦点消失；若没有，这条规则无害。

## r02-9 Navigator 不在全局减弱动效规则的覆盖范围内

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`src/vs/workbench/browser/media/productAccessibility.css:78-88` 只覆盖 `.part.statusbar, .part.conversation, .part.sources, .preferences-editor`。Navigator 注册在侧栏（`navigator/browser/navigator.contribution.ts:64`），其筛选框、行、Inspect 的过渡没有本地 `monaco-reduce-motion` 覆盖。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读全局规则。现有过渡都是 0.1-0.12s 的颜色变化，影响小 |

方案：在全局规则的 `:where(...)` 里加 Navigator 视图容器的选择器，而不是在每个文件里补。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md)）：收窄：只加 Navigator 各视图根类，不用 `.part.sidebar`。

## r02-10 单击 / 双击打开在相邻列表之间不一致

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：显式 `openOnSingleClick: true` 的有 Sources 三个列表、Agents 活动列表、Team 成员列表。Projects 树、Agents 层级树、Team 任务列表没写，跟随用户的 `workbench.list.openMode`。用户把它设为双击时，同一侧栏里相邻两个列表一个单击开、一个双击开。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | `grep openOnSingleClick` 只有五处，与观察一致 |

方案：先定产品规则：Navigator 全部单击打开，还是全部跟随设置。定了以后三处补齐。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D9）：Navigator 所有列表单击打开。

## r02-11 Navigator 空态文案不说原因和下一步

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`navigatorTeamList.ts:64-65` 是 "No team members yet"、"No tasks yet"；筛选无结果在 Projects / Team / Agents 都是 "No matches"，Sources 则是 "No matching changes." 和 "No changes match the filter."。原则 6 要求空态用一两句话说清为什么空、下一步做什么。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | `grep` 字符串，与观察一致 |

方案：筛选无结果统一为一句 "No items match "{0}". Clear the filter to see all."（各列表替换名词）；Team 空态补一句来源，例如成员由引擎上报。文案改动属用户可见行为，先按愿景原则 5 更新对应需求。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D10）：筛选无结果「No {items} match "{query}".」加 Clear filter 文本按钮；Team 空态「This session has no team members.」「This session has no tasks.」。

## r02-12 `sources-stub-empty` 是死样式

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`sources/browser/media/sourcesTabs.css:313-334` 的 `.sources-stub-empty` 及其硬编码图标字形 `content: "\ea86"` 没有任何 TS 引用。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | `grep -rn sources-stub-empty --include=*.ts src/vs/workbench` 无结果 |

方案：删除这段规则。

签收：签。签收人：agent:codex，日期：2026-11-01。

## r02-13 Sources / Navigator 字号写死 px

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：两区 CSS 的字号全部是 px 字面量，没有一处用 `--vscode-fontSize-*`。Conversation 与首选项已经在用这些令牌。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | `grep` 计数：px 字号 51 处，`fontSize-` 令牌 0 处。最多的是 `sourcesReviewList.css` 11 处、`sourcesFilesList.css` 10 处 |

方案：随 r02-5 的筛选框合并一起换；其余随改动逐段换，不单独开大改。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D14）：Sources、Navigator 整份替换为字号 token，现为 53 处。
