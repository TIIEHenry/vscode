---
title: "2026-10-30 默认窗口视觉审查收口"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "默认编辑器窗口浅色、深色和 1024 宽的视觉审查。焦点、圆角、设置卡内衬、空态字号、禁用选择器和单复数已直接修。类别条裁切、状态重复、回合间距和深色分层等待拍板。规则 16 审查后已改稿。"
---

# 2026-10-30 默认窗口视觉审查收口

状态：草案。负责：agent:grok。
覆盖需求：PRD-028。

对照 [UI 设计原则](../../docs/architecture/cross-cutting/ui-design-principles.md)。同轮间距仍归 [chatgpt-visual-language](chatgpt-visual-language.md) §13.1，本方案不另改那条 margin，见 V3。不改 PRD 状态，也不重做上游标题栏和活动栏。

## 现状与证据

2026-10-30 在测试配置 `~/.universe-agent-studio-test` 的默认编辑器窗口里审查，带 `--new-window`。主题是 UniverseAgentStudio Light 和 Dark，视口 1443×851 与 1024×720，并用 Tab 走了一遍会话区。尺寸和颜色来自元素盒与 `getComputedStyle`。

钉死引擎 `127.0.0.1:50061` 在监听，界面仍显示 Engine not connected。在线圆点、工具状态、真实回答排版、高对比、叶宽小于 450 的 `.is-narrow`，以及各浮层菜单没有验到。引擎在听却显示未连接是功能问题，不在本方案里改。

## 已直接修复

下面几处已经在工作区改完，不进后面的切片。

| 项 | 改动 |
|:---|:---|
| 用户回合卡和权限座位键盘焦点看不见 | `conversationLens.css` 里 `:focus { outline: none !important }` 改为 `:focus:not(:focus-visible)`。权限座位和提问座位补 1px `focusBorder`，偏移 -1px。用户卡原有的 `:focus-visible` 规则因此才能生效 |
| 权限座位和提问座位圆角 | 权限座位从写死 8px、提问座位从 `cornerRadius.large` 改为 `cornerRadius.medium`（6px）。规范 §5.1 两处都是 medium |
| Engine 设置卡内容贴边 | Overview、Providers 等分区不是 `.engine-section.is-active-section`，吃不到那条 16px 内衬。本次给 `.engine-preferences-detail-body > *` 加 16px（窄屏 12px）。这和分区根上原有的 padding 是同一条属性，不会加成 32px |
| Preview 空态快捷键 10px | `editorgroupview.css` 改为 `fontSize.label2`（11px） |
| 禁用的底栏选择器叠了透明度 | Permission、Agent、Model 三条共用的 `:disabled` 已是 `disabledForeground`，浏览器再叠约 0.7 透明度。产品样式把这三条的 `opacity` 定为 1 |
| Providers 和 Overview 的 “1 models” | 数字为 1 时用 “1 model”。Overview 的数组重载仍是「{0} 个模型」，界面计数走数字重载 |

`enginePreferencesPane.css` 里另有这次审查之前就在工作区的改动：栏间距 16px 改为 20px，内容卡内衬从 2px 改为 0、底色混合从 92% 改为 97%，`.engine-section.is-active-section` 去掉自己的边和圆角，输入框焦点改成只换描边。那些不是本表的直接修复。空卡大约 454px 来自分区 `flex: 1 1 auto`，卡本身 `min-height: 0`，不是最小高度把卡撑高。

## V1 窄窗口裁掉 Preview 组动作

窗宽 1024 时，`.preview-category-bar` 宽 220px，`scrollWidth` 288px，`overflow: hidden`（`editorgroupview.css` 类别条规则）。右端拆分、更多、关闭进了 `.preview-category-empty-group-actions`，不可见也点不到。类别开关 `.preview-category-switcher` 是 `flex-shrink: 0`（`previewCategoryBar.css`）。组动作本身已经 `flex: 0 0 auto` 并靠右（`editorgroupview.css` 约 329 行）。停靠逻辑在 `categorizedMainEditorPart.ts` 的 `syncEmptyCategoryActions`，注释写明是为了避开网格裁切，高度仍是 28px。合同见规范 §5.4 和 [ADR-011](../decisions/011-preview-two-level-tabs.md)。

`previewCategoryBar.css` 和 `editorgroupview.css` 都把开关写成 `flex-shrink: 0`，前者更特异。开关里的 `.preview-category-tab` 也是 `flex-shrink: 0`。组动作槽注释里的动作是 split、hide、more、close。规范 §5.4 对一行放不下的决定是不显示计数，不是把类别收进新菜单。[chatgpt-visual-language](chatgpt-visual-language.md) 写明七类别条不改交互。ADR-011 仍是七个类别独占一行、不高于 28px。

不另拍板的做法：组动作保持 `flex-shrink: 0`。类别开关 `min-width: 0`、`overflow-x: auto`，图标不缩小，放不下就在开关内部横向滚动，整条不再把右侧动作裁掉。不新增溢出按钮，也不加高。

溢出按钮（只留当前类别，其余进一颗按钮）是新交互，需要拍板。选项：

- A（推荐）：开关内部横向滚动，组动作始终可见。
- B：溢出按钮。代价是改 §5.4 和 ADR-011 已经定下的「七个类别都在这一行」。

验收：1024 宽时 split、hide、more、close 完整可点；七个类别仍能到达；条高仍是 28px；键盘能把焦点移到被滚出的类别。

## V2 同一状态多处出现

规范 §6.5：同一区域的错误只显示一次。原则八：说明文字用正常前景色，语义色留给图标或圆点。原则一：语义色不做大面积底。

实测：

- 引擎未连接。阅读列身份条整句是警告色（浅色 `rgb(191, 136, 3)`，深色 `rgb(204, 167, 0)`）。状态栏 `warning-kind` 是整块警告底（浅色 `rgb(114, 81, 2)`），文案 Engine not connected，注册在 `conversationSessionStatusBar.ts`，颜色来自上游 `statusbarpart.css` 的 `statusBarItem.warning*`。Goal 提示和禁用的 Permission 再各说一次。Engine 设置页头部和正文各有一句，Open Connection 出现两次。
- 待确认。权限座位是 “1 confirmation pending” 加 “Input needed” 徽标。过程折写 “1 waiting”。Inbox 再用链接色写一遍。规范允许 Inbox 用链接色。
- 会话标题同时在会话条和状态栏。状态栏项在 `createSessionEntry`。

这不是「规范已经规定只留一处」。§6.5 说的是同一区域不重复。身份条、状态栏、Inbox、过程折是不同区域。原则八要求过程折收起后仍保留影响判断的状态，不能因为座位在视口里就拿掉 “1 waiting”。

可以先做、不必另拍板的只有同一张卡片里的重复：权限座位标题已经是 “1 confirmation pending” 时，去掉同行的 “Input needed” 徽标。

需要拍板的是跨区域的重复。选项：

- A（推荐）：身份条改为圆点加正常前景色的一句说明。状态栏保留这句话，但 `kind` 不再用 `warning`，从而去掉整块警告底。不改上游 `statusbarpart.css`。设置页只留正文那一句和一颗 Open Connection。过程折的 “1 waiting” 和 Inbox 的链接色计数都留着。会话标题两处都留着。
- B：状态栏保留警告底和整句，身份条只留圆点。
- C：跨区域的文案维持现状，只把身份条的警告色改成正常前景色。

## V3 回合间距

相邻回合实测 36–44px。`conversationTimeline.css` 里条目 `margin-bottom: 32px`，用户回合 24px，再加正文容器 `padding-bottom: 12px`。规范 §4 写 comfortable 16px，HEAD 列也写 16px。`773eafd007f`（2026-10-23）把 16px 改成了 32px，提交说明是对话视觉细节，没有写进规范。

看见的 36–44px 是外边距再加 `.conversation-lens-timeline-row` 的 `padding-bottom: 12px`（32+12，用户回合 24+12）。

[chatgpt-visual-language](chatgpt-visual-language.md) §13.1 已经指定一条后续改法：只把明确同轮的过程根和回答根的 `margin-bottom` 从 32px 改为 12px；用户回合后的 24px 和其他跨轮 32px 不动。那一节还没进产品代码，因为组身份合同还没定。本方案不另改这条 margin。若要按规范 §4 收回 16px，必须同时改 §13.1，避免两篇各改一次。

需要拍板。选项：

- A（推荐）：本方案不动 `conversationTimeline.css`。同轮收紧仍归 §13.1，等组身份合同后再做。
- B：放弃 §13.1 的 12px，把全部相邻回合改回规范的 16px，并在那篇方案里写明被取代。代价是短回合更密，也作废已有的 A/B 样本。

## V4 用户回合上方的空头

用户回合的 `.conversation-lens-turn-header` 里只有一颗 `opacity: 0` 的 “View in trajectory”（`conversationLens.css` 里 `.conversation-lens-turn-header-trajectory`）。它仍占约 24px，气泡从标题下才开始。规范 §5.1 里「不占行高」说的是助手回合正文下的动作行。用户回合写的是没有那一行。所以把这颗按钮改成悬浮，不是已经拍过的合同。

需要拍板。选项：

- A（推荐）：按钮绝对定位到气泡角上，悬停、焦点或键盘落到该回合时出现，平时不占 24px。
- B：留着这行空白，保证标题区结构和其他回合一致。

## V5 行内会话胶囊

`.conversation-session-pill` 嵌在 13px、行高 1.5 的段落里，把两行撑到约 52px。字色是 `--vscode-foreground`，前景 6% 淡底。高度来自 `min-height: 22px` 加上下 `padding: 2px`，而且是 content-box，圆角写死 `999px`，字号 11px。

推荐：高度收到一行正文以内（约 20px），字号用 `fontSize.label1`（12px），圆角改用 `cornerRadius.circle`。字色和淡底不动。这是密度修正，不新增颜色。不另拍板。

## V6 浅色次按钮是实底

权限座位的 Skip、Engine 页的 Test Engine 等 `.monaco-button.secondary`，浅色底和边都是 `#EAEAEA`，深色是透明底加 `#333536` 边。来源是 `extensions/theme-defaults/themes/2026-light.json` 的 `button.secondaryBackground` 和 `button.secondaryBorder`。产品浅色主题 include 它，没有覆盖。规范 §5.6：次按钮是低对比描边、无底。

推荐：只在 `universe-agent-studio-light.json` 把 `button.secondaryBackground` 设为透明，描边用前景色约 12% 的混合。会影响所有走这颗主题的上游次按钮，包括设置编辑器和对话框。深色已经是无底，不动。

需要拍板，因为会波及上游面板。选项：

- A（推荐）：改产品浅色主题，全窗口次按钮与深色一致。
- B：不改主题，只在权限座位和 Engine 页用产品类覆盖。代价是同一窗口两套次按钮。

## V7 深色分层和浅色不一致

浅色：chrome `#F6F6F6`，会话画布和 Preview 画布都是 `#FFFFFF`。深色：会话画布 `conversation.background` 是 `#191A1B`，和标题栏、会话条、状态栏相同；Preview 画布 `editor.background` 来自 `2026-dark.json` 的 `#121314`。Composer 和用户卡在深色里也是 `#191A1B`，只靠 8%–10% 描边分开。规范 §10 把深色画布写成 `#191A1B`。原则一要求区域之间有 2%–4% 明度差。浅色两种表面是 2026-10-22 选定的，深色没有对应的选定。

需要拍板。选项：

- A（推荐）：深色会话画布改成与 Preview 相同的 `#121314`，chrome 保持 `#191A1B`。输入卡继续靠描边从画布上分开。要改规范 §10 的深色画布值。
- B：Preview 画布抬到 `#191A1B`，与会话相同。代价是深色下中心区和侧栏几乎同色，只剩描边。
- C：保持现状。

## V8 其余密度

- Sources 空态 `.sources-files-explorer-empty` 没有字号，继承 13px。规范 §6.1 要求面板内空态 12px，并可带一个文本按钮。文案 “You have not yet opened a folder.” 没有动作。改为 `fontSize.label1`，并给一个打开文件夹的文本按钮。不另拍板。
- Engine 导航行选中是前景约 8% 的淡底（列表有焦点时 12%），圆角 6px。透镜 tab 和 Sources tab 用 `toolbar.hoverBackground`，圆角 4px。导航行可以改成 4px 和同一悬停底，这是产品 CSS。不另拍板。
- 设置页顶部 Connection / Engine 的选中态在上游 `preferencesEditor.css` 的 `.action-label.checked`：`editor.background` 底、圆角 6px。按规范 §9 不为观感改这份上游 CSS。只记录。
- 未连接时内容区被 `flex: 1 1 auto` 拉高，边框画在 `.engine-preferences-detail-body` 上，于是一张高约 454px 的卡里只有一两行字。卡自己的 `min-height` 是 0，去掉最小高度不会变矮。若要让空说明贴住内容，得让这个分区不要撑满剩余高度。这会改变设置页右侧的留白，需要拍板。选项：A（推荐）未连接时分区按内容高度，不撑满；B 保持撑满。

## V9 只记录

- 标题栏和活动栏常驻 `--vscode-shadow-md`（`style.css`、`titlebarpart.css`、`activitybarpart.css`）。这违反原则六，属于上游，按 §9 不改。
- 引擎端口在听、界面显示未连接，不在本方案查。

## 切片

| 切片 | 内容 | 何时做 |
|:---|:---|:---|
| 已直接修复 | 见上表 | 工作区已改，随本主题提交 |
| S1 | V1 的横向滚动、V5、V8 的 Sources 空态和 Engine 导航行 | 可做。不含溢出按钮，不含上游分段页签 |
| S2 | V2 里去掉座位上的 “Input needed” 徽标 | 可做。跨区域重复等拍板 |
| S3 | V2 的跨区域选项、V4、V6、V7、V8 的空卡是否撑满 | 拍板之后 |
| S4 | V3 | 默认不动 CSS。只有选 B 才改间距，并同时改 [chatgpt-visual-language](chatgpt-visual-language.md) §13.1 |
| 不改 | 上游 `preferencesEditor.css`、标题栏和活动栏投影 | 见 V8、V9 |

验证只用本地门禁：改到的 CSS 和 TS 跑 `conversationLensCssScan` 与对应 Engine 单测。现有扫描没有锁住 `:focus:not(:focus-visible)`、label2 和 “1 model”，跑过不能当成这三处已锁上。浅色和深色各看一眼；1024 宽确认组动作；Tab 确认用户卡和权限座位有焦点环。不重开托管 CI。

只读审查（规则 16）没有 Critical。Important 已改入正文：Engine 文件里审查前就有的 diff 与本次内衬分开；`> *` 不叠成双倍内衬；V3 不再和 §13.1 抢同一条 margin；V1 的溢出按钮、V4 的用户回合头、V2 的跨区域收口、V8 的上游分段和空卡高度改为待拍板。提问座位圆角已随直接修复改成 medium。
