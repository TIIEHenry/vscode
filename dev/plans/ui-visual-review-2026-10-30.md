---
title: "2026-10-30 默认窗口视觉审查收口"
type: plan
status: accepted
phase: N/A
updated: 2026-11-01
summary: "默认编辑器窗口浅色、深色和 1024 宽的视觉审查。焦点、圆角、设置卡内衬、空态字号、禁用选择器和单复数已直接修。类别条裁切、状态重复、回合间距和深色分层等待拍板。规则 16 审查后已改稿。"
---

# 2026-10-30 默认窗口视觉审查收口

状态：执行中。负责：agent:grok。
签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。S1、S3、S4 签收，S2 不做；范围见文末两节。
覆盖需求：PRD-028。

对照 [UI 设计原则](../../docs/architecture/cross-cutting/ui-design-principles.md)。同轮 12px 候选已由 D18 的 V3=B 作废；当前相邻回合统一按规范 §4 使用 16px 外间距，见 V3 实施检查点。不改 PRD 状态，也不重做上游标题栏和活动栏。

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

[chatgpt-visual-language](chatgpt-visual-language.md) §13.1 的 12px 同轮候选已由 D18 作废，历史身份门槛与几何证据仍保留。D18 的 V3=B 收回规范 §4 的 16px，相邻回合统一使用这一外间距；过程折、正文和用户气泡内部 padding 继续由各自组件合同控制。

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

## 签收（2026-11-01）

签收人：agent:kiro（用户委托）。只读核对到 HEAD `38c867b5268` 与工作区现状，没有跑测试。「已直接修复」一表已随 `98aa1b2140f`（2026-10-31）提交，切片表里「工作区已改，随本主题提交」已过时。

| 切片 | 签收 | 说明 |
|:-----|:-----|:-----|
| S1 · V1 开关内横向滚动 | 签 | 改动只放在产品文件 `previewCategoryBar.css`，不碰上游 `editorgroupview.css`。不违反 ADR-011（七个类别独占一行、不高于 28px）。补一条 CSS 合同测试，可放进 `previewEditorGroupHeader.test.ts`；现写的 `conversationLensCssScan` 覆盖不到 editor 的 CSS。 |
| S1 · V5 会话胶囊 | 签 | 只换成 token 的密度修正，不加颜色。 |
| S1 · V8 Sources 空态 | 签 | 打开文件夹的文本按钮要写明调用哪个命令，以及无工作区、远程窗口时怎么表现。 |
| S1 · V8 Engine 导航行改 4px 与 `toolbar.hoverBackground` | 不签 | 工作区正在把 Navigator 与会话列表统一到 `cornerRadius.medium` 加 5% / 9% / 12% 中性底（chatgpt-visual-language §20，未提交、未审），本项方向相反，做了会有两套列表选中态。等 §20 的去留定了再说。 |
| S2 去掉权限座位上的 “Input needed” | 不签，改为拍板项 | [agent-ui](../../docs/systems/chat/agent-ui.md) 的复用清单点名了这个徽标，lens-and-trajectory.md 把它写成等待态的显示规则，`conversationTimelineRenderer.test.ts` 断言它存在；方案也没说读屏名称里的 Input needed 留不留。 |
| S3、S4 | 不签 | 等用户就 V1（溢出按钮）、V2 跨区域、V3、V4、V6、V7、V8 空卡拍板。V2 的 A、B 都要改 `docs/systems/conversation/overview.md` 里身份条与状态栏共用引擎芯片色调那一句，方案没列；V7 的 A 除了 §10，还要改 [theming](../../docs/architecture/cross-cutting/theming.md) 里深色画布 `#191A1B` 那一句。 |

## 按设计原则的决定（2026-11-01）

用户委托 agent:kiro 按设计原则决定待拍板项，依据见 [审查待定项决定](../../docs/decisions/ui-review-decisions-2026-11-01.md) D18。

| 项 | 决定 |
|:---|:-----|
| V1 | A：类别开关内部横向滚动，不加溢出按钮 |
| V2 跨区域 | A。同刀改 `docs/systems/conversation/overview.md` 里身份条与状态栏共用引擎芯片色调那句 |
| V2 同一张卡（S2） | 不做：保留 Input needed 徽标 |
| V3（S4） | B：相邻回合间距回到 16px，[ChatGPT 视觉语言](chatgpt-visual-language.md) §13.1 的同轮收紧作废 |
| V4 | A：View in trajectory 绝对定位到卡角，悬停或焦点出现 |
| V6 | A：产品浅色主题 `button.secondaryBackground` 透明、描边前景约 12% |
| V7 | A：深色会话画布 `#121314`。同刀改规范 §10 与 theming 的深色画布值 |
| V8 空卡 | A：未连接时分区按内容高度 |
| V8 Engine 导航行 | 按 D2、D15：行底走主题 `list.*`、`cornerRadius.small`，选中分有焦点 / 无焦点两色 |

S1 补签 Engine 导航行；S3、S4 签收，按上表实施。

## V4 实施检查点（2026-11-05）

Sol 按 D18 的 V4=A 只改用户回合轨迹入口：`.conversation-lens-turn-header-trajectory` 的 header 在用户回合中绝对定位到气泡右上角，使用 `spacing.size40` / `spacing.size80`，不再占标题流的 24px 空间；用户气泡同步预留按钮右侧内衬，避免首行文字与 22px 命中区重叠。原有 hover、focus-within、focus-visible、高对比样式和 `turnId` 路由保留。未改 V1、V3、V5 或 Projects WIP。

验证分层如下：`npm run compile-client` 在 Node v24.18.0 下 exit 0；`conversationTimelineRenderer.test.ts` 32 passing；`conversationLensCssScan.test.ts` 39 passing，另有仓库既有 engine-nav / S9 的 2 条 32px 对 22px 旧断言失败。生产 renderer 等价测量 `/tmp/ua-user-trajectory-layout-20261105-sol-v1-result.json` 覆盖 1024/1443 viewport、752/360 conversation host、短/长文本和 hc-black 共 8/8：header computed absolute、22px button/header、按钮右边距气泡 8px、无横向溢出、首行文字不再与按钮重叠、focus-visible 与 click 路由通过。该产物不是完整默认 Electron 窗口或 native/WebView 验收，V4 仍需在完整窗口 gate 中单独观察。

## V5 实施检查点（2026-11-05）

Sol 将会话正文中的 `.conversation-session-pill` 收到一行阅读高度：只在 `.conversation-lens-turn-body--reading-text` 下使用 `box-sizing: border-box`、20px 最小高度、16px 行高、`fontSize.label1` 和 `cornerRadius.circle`。Composer 引用芯片和用户回合引用仍使用原 22px / 18px 基线，保留“pill 总高 26px”的既有输入合同；颜色、焦点环和 hover 行为未改。

验证：`npm run compile-client` 在 Node v24.18.0 下 exit 0；新增 `conversationLensCssScan` 合同通过，扫描共 40 passing，另有仓库既有 engine-nav / S9 的 2 条 32px 对 22px 旧断言失败；`conversationTimelineSessionPills.test.ts` 17 passing；`conversationComposerAtChip.test.ts` 7 passing。当前证据覆盖源码合同与组件行为，不替代默认 Electron 窗口的多主题人工视觉验收。

## V8 Sources 空态实施检查点（2026-11-05）

Sol 将 Sources Files 空态改为 12px `fontSize.label1` 的垂直内容组，保留原有说明并增加 `Open Folder...` 文本按钮。按钮点击调用 `workbench.action.files.openFolder`，使用 `OpenFolderWorkspaceSupportContext` 作为能力门：桌面与远程窗口可见，无法打开文件夹的 serverless 窗口诚实隐藏；hover、键盘 focus-visible 与高对比焦点环均有样式。未改 Sources 的文件树或远程列举合同。

验证：`sourcesFilesList.test.ts` 41 passing，覆盖命令点击与不支持环境隐藏；`sourcesWiringScan.test.ts` 新增空态 CSS/命令接线断言通过，扫描总计 33 passing，另有 3 条仓库既有 Changes/Review double-catch 断言失败。当前证据覆盖组件行为与源码合同，不替代默认 Electron 窗口的多主题人工视觉验收。

## V3 回合节奏实施检查点（2026-11-05）

Sol 按 D18 的 V3=B 将 `.conversation-timeline-item` 的相邻回合外间距统一为 `var(--vscode-spacing-size160, 16px)`，移除用户回合原有的 24px 特例；用户气泡、正文容器和过程折内部 padding 保持各自合同，不把 12px 同轮原型规则带入产品 CSS。`chatgpt-visual-language.md` §13.1 已标为作废并保留历史身份门槛与几何证据。

验证：`conversationLensCssScan` 新增 16px 节奏合同并通过；当前扫描结果的既有 engine-nav / S9 断言仍单列。该源码合同不替代默认 Electron 窗口在长回答、窄列、流式过程折和高对比主题下的人工间距观察。

## V6 浅色次按钮实施检查点（2026-11-05）

Sol 在产品浅色主题 `universe-agent-studio-light.json` 中覆盖 `button.secondaryBackground` 为透明，并将 `button.secondaryBorder` 设为 `#2020201F`（产品前景约 12%）；上游 `2026-light.json` 与深色主题保持不变，所有使用次按钮 token 的产品窗口统一获得低对比描边样式。

验证：`workbenchThemeService.test.ts` 23 passing，新增产品浅色次按钮 token 断言通过；另有 2 条仓库既有 product default / initial placeholder 颜色不一致失败。当前证据覆盖主题合并输入与 token 合同，不替代默认 Electron 窗口的多主题人工视觉验收。

## V7 深色会话画布实施检查点（2026-11-05）

Sol 在产品深色主题 `universe-agent-studio-dark.json` 中将 `conversation.background` 调整为 `#121314`，让会话画布与 Preview / 编辑器画布形成一致的深色表面；深色 chrome 仍由上游 `2026-dark.json` 保持 `#191A1B`。未改上游主题或组件 CSS。

验证：`workbenchThemeService.test.ts` 新增深色会话画布断言；现有主题定向扫描 23 passing，另有 2 条仓库既有 product default / initial placeholder 颜色不一致失败。当前证据覆盖主题合并输入，不替代默认 Electron 窗口的多主题人工视觉验收。

## V8 Engine 导航行实施检查点（2026-11-05）

Sol 将 Engine 首选项导航行收到 22px，TS 的 `NAV_ROW_HEIGHT` 与 CSS 同步，使用 `cornerRadius.small` 和 `list.hoverBackground`、`list.inactiveSelectionBackground`、`list.activeSelectionBackground` 主题 token；选中态焦点环与高对比边框保持，未加 `position: relative`，也未影响原生 Settings 编辑器。

验证：`conversationLensCssScan.test.ts` 43 passing，`enginePreferencesPane.test.ts` 32 passing，覆盖 22px 几何、主题选中态和 Engine 行为。当前组件证据不替代默认 Electron 窗口的多主题人工视觉验收。

## V1 Preview 类别条实施检查点（2026-11-05）

Sol 按 D18 的 V1=A 将 Preview 类别开关改为类别条内部横向滚动：`previewCategoryBar.css` 的 switcher 使用 `flex: 1 1 auto`、`min-width: 0` 与 `overflow-x: auto`，保留 28px 单行、7 个类别钮的 `flex-shrink: 0` 命中区；滚动条不另占行，也没有新增溢出按钮。`previewCategorySwitcher.ts` 的计数隐藏测量改用 switcher 自身 viewport，右侧空组动作槽不会被误算；tablist、roving tabindex、键盘焦点、drag/drop 和 aria 语义保持不变。未改上游 `editorgroupview.css`。

验证：`previewEditorGroupHeader.test.ts` 10 passing；`previewCategoryPart.test.ts` 11 passing，另有仓库既有 afterEach `multiEditorTabsControl` layout failure。新增 CSS 合同覆盖内部滚动、窄宽可收缩、28px 上限、固定 tab 命中区与无 overflow button；组件证据不替代默认 Electron 窗口的窄宽、多主题和键盘人工验收。

## Sessions 焦点策略实施检查点（2026-11-05）

规则16 独立复核为 C0/I1。Sol 复核发现 Sessions 列表的普通主题存在通用与非高对比两套重复 row `focusBorder` outline，More 按钮也重复使用 `focusBorder`；Important 风险是未选中 focused row 直接改成浅色 selected 背景可能在 Light+ 下不可辨。

按产品焦点原则实施最小 cohesive slice：普通主题移除 Sessions row 的 `focusBorder` outline，More 的 `:focus-visible` 改用既有 `toolbar.hoverBackground`；高对比主题保留 `contrastActiveBorder` / `contrastBorder` outline。没有新增低对比背景，继续使用现有 selected / active 行状态，避免浅色对比退化；More 显示条件、菜单、Tab/Enter/方向键与 ARIA 未改。

验证：CSS scan 44 passing；`conversationSessionsView.test.ts` Chromium 主题 suite 6 passing；`npm run compile-client` exit 0；`git diff --check` 通过。仍需默认编辑器窗口的浅/深、窄栏和高对比人工焦点观察，组件证据不替代该 gate。

## SessionBar lens tabs 焦点策略实施检查点（2026-11-06）

规则16 独立复核为 C0/I1。SessionBar 的 lens tabs 在普通主题的 `:focus-visible` 和 selected tab 上重复消费 `focusBorder`，已有 `toolbar-hoverBackground` 可表达当前 tab 与键盘定位。

按产品焦点原则实施最小切片：普通主题的 lens tab `:focus-visible` 使用 `toolbar-hoverBackground`，selected tab 不再追加 focusBorder；高对比主题保留 `contrastActiveBorder` / `contrastBorder` 2px 焦点线。tablist、roving tabindex、Arrow/Home/End、`aria-selected` 和其它 SessionBar 按钮未改。

验证：CSS scan 45 passing；`conversationLens.test.ts` Chromium tablist/切换/ARIA 3 passing；`npm run compile-client` exit 0。默认编辑器窗口浅/深、窄栏和高对比人工焦点观察仍待补。

## Sessions 当前标题窄实施检查点（2026-11-05）

规则16 独立复核为 C0；实现只在 `conversationSessions.css` 为同一 `.monaco-list-row.conversation-sessions-item-active` 增加 `fontWeight-semiBold`，并在 `conversationSessionsView.test.ts` 以真实 CSS/DOM 断言 active label computed weight=600、inactive label=400。未改 Sessions 行高、圆角、颜色、More、ARIA、键盘、HC 或 reduced-motion，也未触碰 Projects/Team。

验证：Chromium 主题 suite 6 passing；Electron hidden-window runner 2 passing / 5 个既有 focus 主题 pending；Node v24.18 `npm run compile-client` exit 0。默认编辑器窗口宽/窄、浅/深和 HC 的人工字重观察仍是独立证据层。

## Activity Bar fallback 窄实施检查点（2026-11-05）

规则16 独立复核为 C0/I0。`activityaction.css` 的标准 fallback 已从 48px/24px 对齐到当前 `ActivitybarPart` 的 44px/20px；Activity Bar 宽度 48px、compact/Modern UI 的 inline 28px/16px 或 44px/20px、高对比、badge 定位和拖放反馈均保持不变。

验证：`activitybarCssScan.test.ts` 3 passing（含错误捕获）；`activitybarPart.test.ts` Chromium 26 passing。尚未替代默认编辑器窗口的浅/深、宽/窄和键盘焦点人工观察。

## Activity Bar 动效合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：标准 Activity Bar 图标和选中指示器的 150ms 过渡超过规范 100ms 上限，且局部 CSS 没有显式 reduced-motion 关闭规则。实施将两处过渡改为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（不覆盖 `.monaco-enable-motion`）的 `transition: none`，不改尺寸、状态、badge、拖放或动作语义。

验证：`activitybarCssScan.test.ts` 3 passing（含错误捕获）；断言覆盖过渡上限与 reduced-motion 规则。默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## Navigator Projects 行动效合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：Projects 列表行的背景过渡已是 100ms，但没有局部 reduced-motion 覆盖。实施只在 `navigatorProjectsList.css` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）的 `transition: none`；不改行高、颜色、圆角、ARIA、键盘或菜单动作。

验证：`navigatorProjectsListCss.test.ts` focused suite 4 passing（含错误捕获），独占 `npm run compile-client` exit 0、compile-src 0 errors；断言覆盖 100ms、旧时长排除和 reduced-motion 入口。默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## Navigator Projects inline filter 动效合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：Projects inline filter 的输入框边框和清除按钮仍是 120ms，且没有局部 reduced-motion 覆盖。实施只把两处过渡改为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（不覆盖 `.monaco-enable-motion`）的 `transition: none`，不改 Agents/Team 过滤器、逻辑、DOM/ARIA、焦点或 HC。

验证：`npm run transpile-client` exit 0；`navigatorProjectsListCss.test.ts` focused suite 5 passing（含错误捕获）。未重新跑完整 `compile-client`，默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## Session window 隐藏叶按钮动效合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：隐藏叶按钮的颜色过渡已是 100ms，但缺少局部 reduced-motion 覆盖。实施只增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（不覆盖 `.monaco-enable-motion`）的 `transition: none`，不改生命周期、focus/HC、ARIA、命中区或按钮语义。

验证：`npm run transpile-client` exit 0；新增 hide-control 源码合同通过。`conversationRegionChromeCss.test.ts` 为 2 passing / 1 existing failure，失败是并行 WIP `conversationPart.css` 几何断言的 28px→36px 变更；默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## Navigator Agents inline filter 动效合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：Agents inline filter 的输入框边框和清除按钮仍是 120ms，且没有局部 reduced-motion 覆盖。实施只把两处过渡改为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（不覆盖 `.monaco-enable-motion`）的 `transition: none`，不改过滤逻辑、DOM/ARIA、焦点、HC、Projects 或 Team。

验证：`npm run transpile-client` exit 0；独立 `navigatorAgentsInlineFilterCss.test.ts` 2 passing（含错误捕获）。未重新跑完整 `compile-client` 或默认编辑器人工观察。

## Navigator Agents 行与行内动作动效合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：Agents hierarchy/activity 列表行与行内 action 仍是 120ms，且缺少局部 reduced-motion 覆盖。实施只将两类列表行和 action label 的过渡改为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（不覆盖 `.monaco-enable-motion`）的 `transition: none`；不改行高、颜色、圆角、焦点、HC、ARIA、动作语义或其它 Navigator WIP。

验证：源码合同 5 assertions、ESLint、Stylelint、`git diff --check` 通过；`npm run transpile-client` exit 0，编译后 `navigatorStubCss.test.ts` 2 passing（含错误捕获）。Stylelint 仅报告该文件既有 2 条字体 design-token 建议；默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## Agent Inspect 行动效合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：Agent Inspect 列表行仍是 120ms，且缺少局部 reduced-motion 覆盖。实施只将列表行过渡改为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（不覆盖 `.monaco-enable-motion`）的 `transition: none`；不改 TS、几何、颜色、焦点、HC、ARIA 或其它 Navigator WIP。

验证：源码合同 4 assertions、ESLint、Stylelint、`git diff --check` 通过；刷新产物后 `npm run transpile-client` exit 0，`agentInspectCss.test.ts` 2 passing（含错误捕获）。Stylelint 仅报告该文件既有 2 条字体 design-token 建议；默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## Conversation Agent breadcrumb 动效合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：Agent hierarchy 面包屑已有 100ms 背景过渡，但没有局部 reduced-motion 覆盖。实施只补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（不覆盖 `.monaco-enable-motion`）的 `transition: none`；不改 BreadcrumbsWidget 的焦点、键盘、ARIA、导航逻辑或 28px 几何。

验证：源码合同 4 assertions、ESLint、`git diff --check` 通过；Stylelint 通过但报告既有 `--ua-ease` unknown-variable 提示及 3 条 design-token 建议；刷新产物后 `npm run transpile-client` exit 0，`conversationAgentBreadcrumbCss.test.ts` 2 passing（含错误捕获）。默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## Conversation sub-agent overlay 动效合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：sub-agent overlay action button 已有 100ms 背景过渡，但没有局部 reduced-motion 覆盖。实施只补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（不覆盖 `.monaco-enable-motion`）的 `transition: none`；不改 overlay 几何、焦点、ARIA、生命周期或动作语义。

验证：源码合同 4 assertions、ESLint、`git diff --check` 通过；Stylelint 通过但报告既有 `--ua-ease` unknown-variable 及 3 条 design-token 建议；刷新产物后 `npm run transpile-client` exit 0，`conversationSubAgentOverlayCss.test.ts` 2 passing（含错误捕获）。默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## Connection Preferences reduced-motion opt-in 合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：Connection Preferences 的 `prefers-reduced-motion` 媒体规则没有尊重显式 `.monaco-enable-motion`，会错误覆盖用户的动效启用选择。实施只为五个媒体 selector 加 `.monaco-workbench:not(.monaco-enable-motion)`；不改 class 规则、布局、颜色、焦点、ARIA 或 TS。

验证：源码合同 4 assertions、ESLint、`git diff --check` 通过；Stylelint 通过但报告该大文件既有 `--ua-*` unknown-variable 及 21 条 design-token 建议；刷新产物后 `npm run transpile-client` exit 0，`connectionPreferencesPaneCss.test.ts` 2 passing（含错误捕获）。默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## ua-common motion opt-in 合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：全局 `.ua-motion` 的 `prefers-reduced-motion` 规则没有尊重显式 `.monaco-enable-motion`，与 `productAccessibility.css` 的 motion opt-in 语义冲突。实施只将媒体 selector 改为 `.monaco-workbench:not(.monaco-enable-motion) .ua-motion`；不改 class reduced-motion、创建点、布局、焦点或 ARIA。

验证：源码合同 5 assertions、ESLint、`git diff --check` 通过；Stylelint 通过但报告该文件既有 5 个 `--ua-status-*` unknown-variable 及 1 条 stroke token 建议；刷新产物后 `npm run transpile-client` exit 0，`uaCommonMotionContract.test.ts` 3 passing（含错误捕获）。默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## Sessions inline filter reduced-motion opt-in 合同窄实施检查点（2026-11-06）

Sol 只读复核为 Critical 0：Sessions inline filter 清除按钮已有 100ms 过渡和 class reduced-motion 规则，但缺少 `prefers-reduced-motion` 媒体覆盖。实施只补 `.monaco-workbench:not(.monaco-enable-motion)` 的媒体 selector；不改输入框、焦点、ARIA、列表行为或 100ms 合同。

验证：源码合同 3 assertions、ESLint、`git diff --check` 通过；Stylelint 通过但报告该文件既有 `--ua-ease` unknown-variable 及 5 条 design-token 建议；刷新产物后 `npm run transpile-client` exit 0，`conversationSessionsInlineFilterCss.test.ts` 2 passing（含错误捕获）。默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

## Conversation Visualize Card disclosure ARIA 合同窄实施检查点（2026-11-06）

Sol 只读复核发现折叠 header button 只有 `aria-expanded`，body 没有可引用的 `id`，屏幕阅读器无法建立 disclosure 控制目标关系。实施为每个 body 生成 `conversation-visualize-body-${turnId}`，并将 header 的 `aria-controls` 指向该 id；不改折叠逻辑、布局、CSS、焦点或其它 ARIA 状态。

验证：Chromium focused browser test 2 passing，覆盖展开、点击折叠/展开及 `aria-controls`/body id 匹配；刷新产物后 `npm run transpile-client` exit 0，ESLint（2 files）与 `git diff --check` 通过。默认 Firefox runner 因缺失 Playwright Firefox 可执行文件且首次未刷新产物而失败，不能作为多浏览器通过证据；默认编辑器人工验收仍待补。

## Conversation Engine History disclosure ARIA 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 History 触发按钮已有 `aria-expanded`/`aria-haspopup=dialog`，但没有 `aria-controls`，dialog overlay 也没有可引用的稳定 id。实施为每个实例生成 `conversation-lens-history-overlay-N`，并让 button 与 overlay 通过该 id 关联；不改 open/close、focus trap、布局或其它 ARIA 状态。

验证：focused Electron 测试 2 passing（含 `assertCleanState`），Chromium DOM 合同 1 passing；刷新产物后 `npm run transpile-client` exit 0，新增测试 ESLint 与 `git diff --check` 通过。生产 TS 全文件 lint 的 line 381 `querySelectorAll` warning 为未触碰的既有 baseline；默认编辑器人工验收仍待补。

## Conversation Engine Snapshots disclosure ARIA 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Snapshots 触发按钮已有 `aria-expanded`/`aria-haspopup=dialog`，但没有 `aria-controls`，dialog overlay 也没有可引用的稳定 id。实施为每个实例生成 `conversation-lens-snapshots-overlay-N`，并让 button 与 overlay 通过该 id 关联；不改 open/close、focus、布局或其它 ARIA 状态。

验证：focused Electron 测试 2 passing（含 `assertCleanState`），Chromium DOM 合同 1 passing；刷新产物后 `npm run transpile-client` exit 0，新增测试 ESLint 与 `git diff --check` 通过。生产 TS 全文件 lint 的 line 379/703 `querySelectorAll` warnings 为未触碰的既有 baseline；默认编辑器人工验收仍待补。

## Conversation Engine MCP tabpanel ARIA 合同收敛（2026-11-06）

Sol 只读复核确认 Engine MCP 的 Definitions/Runtime tabs 原有选中与显隐逻辑，但缺少稳定的 tab/panel 关联。现为每个实例生成唯一 tab/panel id，并补 `aria-controls`、`aria-labelledby` 与 `role=tabpanel`；不改切换、运行时内容、布局或动作语义。

验证：focused Electron 2 passing（含 `assertCleanState`），Chromium DOM 合同 1 passing；`npm run transpile-client` exit 0，新测试 ESLint 与 `git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## ConversationLens 多实例 ARIA ID 合同收敛（2026-11-06）

Sol 只读复核发现 ConversationLens 的 tab/panel 使用静态 DOM id，多个 lens 共存时会产生重复节点引用。现为每个 ConversationLens/leaf 实例生成唯一 `conversation-lens-N-*` 前缀，并让 tabs、timeline/trajectory panels 与 projection helper 共享该前缀；不改切换、键盘、内容投影、布局或动作语义。

验证：`npm run compile-client` exit 0（src tsconfig 0 errors）；SessionBar Chromium 14 passing、Lens focused Chromium 1 passing、Electron 1 passing；新旧目标 ESLint 仅保留未触碰的 3 条 `querySelector` warnings，`git diff --check` 通过。默认编辑器多实例与多主题人工验收仍待补。

## ConversationTrajectory overview disclosure ARIA 合同收敛（2026-11-06）

Sol 只读复核发现 Trajectory overview toggle 只有 `aria-expanded`，overview track 没有稳定目标 id。现为每个 track 生成唯一 `conversation-lens-trajectory-overview-N` id，并补匹配的 `aria-controls`；折叠、隐藏、布局、键盘和 segment 动作保持。

验证：Chromium `conversationTrajectoryUi.test.ts` 全套 13 passing、Electron focused 1 passing；`npm run transpile-client` exit 0，目标 ESLint 0 errors（仅保留生产文件未触碰的既有 `querySelector` warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Conversation process-fold disclosure ARIA 合同收敛（2026-11-06）

Sol 只读复核发现通用 process-fold 与 Trajectory 自有 renderer 的外层 header 没有可引用的 children id。现为两处 renderer 的每个 children 容器生成唯一 id，并补 `aria-controls`；折叠、布局、工具行、键盘和内容渲染保持。

验证：Chromium `conversationProcessFold.test.ts` 全套 49 passing、`conversationTrajectoryUi.test.ts` 全套 13 passing、`conversationTimelineRenderer.test.ts` 全套 31 passing、Electron focused process-fold 1 passing；`npm run transpile-client` exit 0，目标 ESLint 0 errors（仅保留 Trajectory 生产文件未触碰的 2 条 `querySelector` warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Sources tabs 多实例 ARIA ID 合同收敛（2026-11-06）

Sol 只读复核发现 SourcesTabsHost 的 tab/panel 使用静态 id，多个 Sources 宿主共存时可能交叉引用。现为每个宿主生成唯一 `sources-N-*` 前缀，并同步 tabs、tabpanel 与 focus helper；选中状态、存储恢复、键盘、内容面板和动作语义保持。

验证：`npm run compile-client` exit 0（compile-src 0 errors）；Chromium `sourcesPartFocus.test.ts` 9 passing、Electron Sources focus suite 10 passing（含 `assertCleanState`）；目标 ESLint 0 errors，`git diff --check` 通过。默认编辑器多宿主、多主题人工验收仍待补。

## Navigator Team 子视图 aria-hidden 合同收敛（2026-11-06）

Sol 只读复核发现 Team 的 Members/Tasks 切换只更新 active class，未把非活动内容从辅助技术树中隐藏。现让 `updateSubviewVisibility` 同步活动/非活动 body 的 `aria-hidden`，保留切换、空状态、列表、布局和其它 Navigator WIP。

验证：Chromium `navigatorTeamSubviews.test.ts` 全套 58 passing、Electron focused defaults+switch 2 passing；`npm run transpile-client` exit 0，目标 ESLint 0 errors，`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Navigator Agents 子视图 aria-hidden 合同收敛（2026-11-06）

Sol 只读复核发现 Agents 的 Hierarchy/Activity 切换只更新 active class，未同步非活动内容的 `aria-hidden`。现让 `updateSubviewVisibility` 同步活动/非活动 body 的 `aria-hidden=false/true`，保留切换、列表、布局和其它 Navigator WIP。

验证：定向 Chromium 2 passing、Electron 2 passing；`npm run transpile-client` exit 0，目标 ESLint 0 errors，`git diff --check` 通过。完整 Chromium 46 中 6 个既有 error-path `process is not defined` 失败不属于本切片；默认编辑器多主题人工验收仍待补。

## Sources Review 路径过滤计数 live-region 合同收敛（2026-11-06）

Sol 只读复核发现路径过滤计数会动态变化但没有 live-region 语义。现为计数 span 补 `aria-live=polite` 与 `aria-atomic=true`，过滤逻辑、文案、布局和键盘行为保持。

验证：Chromium targeted path-filter 2 passing、Electron 同范围 2 passing；`npm run transpile-client` exit 0，目标 ESLint 0 errors（仅保留测试文件未触碰的既有 `in` operator warning），`git diff --check` 通过。完整 sources suite 68 passing / 7 个既有 `process is not defined` error-path 失败；默认编辑器多主题人工验收仍待补。

## Activity Bar compact menubar reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 compact menubar More toggle 的 80ms 背景过渡没有局部 reduced-motion 覆盖。现补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下的 `transition: none`；命中区、菜单动作、颜色和既有 100ms Activity Bar 合同保持。

验证：`npm run transpile-client` exit 0，`activitybarCssScan.test.ts` 4 passing，目标 ESLint 0 errors，`git diff --check` 通过。直接 Stylelint 因仓库未为该文件提供配置而返回 ConfigurationError，未计为有效门禁；默认编辑器多主题人工验收仍待补。

## Sources 文件行 reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 Sources 文件行的 80ms 背景过渡没有局部 reduced-motion 覆盖。现保留默认反馈，并在 class/media reduced-motion 下关闭过渡、尊重 `.monaco-enable-motion`；文件行布局、选中、键盘和打开动作保持。

验证：`npm run transpile-client` exit 0；Chromium SourcesFilesList 39 passing（5-theme 新断言通过），node `sourcesWiringScan.test.ts` 33 passing；目标 ESLint 0 errors，`git diff --check` 通过。browser 2 个、node 3 个旧失败不属于本切片；默认编辑器多主题人工验收仍待补。

## Sources Review 行 reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 Sources Review 行的 80ms 背景过渡没有局部 reduced-motion 覆盖。现保留默认反馈，并在 class/media reduced-motion 下关闭过渡、尊重 `.monaco-enable-motion`；行高、选中、过滤、键盘和动作语义保持。

验证：`npm run transpile-client` exit 0；node wiring 新合同通过（整套 35 passing / 3 个既有断言失败），Chromium path-filter 2 passing、Electron 同范围 2 passing；目标 ESLint 0 errors，`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Sources Changes 行 reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 Sources Changes 的 folder/file 行 80ms 背景过渡没有局部 reduced-motion 覆盖。现保留默认反馈，并在 class/media reduced-motion 下关闭两类行的过渡、尊重 `.monaco-enable-motion`；diff 预览、选中、键盘和文件动作保持。

验证：`npm run transpile-client` exit 0；node wiring 新合同通过（整套 36 passing / 3 个既有 git-write/open-diff double-catch 合同失败），目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Navigator Team inline filter reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 Team inline filter 的输入框和清除按钮没有局部 reduced-motion 覆盖。现将两处过渡统一为 100ms，并在 class/media reduced-motion 下关闭、尊重 `.monaco-enable-motion`；过滤、焦点、清除动作和布局保持。

验证：`npm run transpile-client` exit 0，`navigatorProjectsListCss.test.ts` 6 passing，目标 ESLint 0 errors，`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Sources list filter reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 Sources list filter clear 的 120ms 过渡超过统一交互节奏，input/clear 也没有局部 reduced-motion 覆盖。现将 clear 收敛为 100ms，并在 class/media reduced-motion 下关闭 input/clear 过渡、尊重 `.monaco-enable-motion`；过滤、焦点、清除动作和布局保持。

验证：`npm run transpile-client` exit 0；node wiring 37 passing / 3 个既有 git-write/open-diff 合同失败，目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Sources Changes toolbar reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 Sources Changes toolbar `.monaco-button` 的 120ms 过渡没有局部 reduced-motion 覆盖。现将过渡收敛为 100ms，并在 class/media reduced-motion 下关闭、尊重 `.monaco-enable-motion`；按钮命令、命中区、焦点和布局保持。

验证：`npm run transpile-client` exit 0；node wiring 38 passing / 3 个既有 git-write/open-diff double-catch 合同失败，目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Sources Diff panel actions reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 Diff panel actions 按钮的 120ms 过渡没有局部 reduced-motion 覆盖。现将过渡收敛为 100ms，并在 class/media reduced-motion 下关闭、尊重 `.monaco-enable-motion`；diff 命令、命中区、焦点和布局保持。

验证：`npm run transpile-client` exit 0；node wiring 39 passing / 3 个既有 git-write/open-diff double-catch 合同失败，目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Navigator Team 列表行动效 reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 Team Members/Tasks 列表行的 120ms 背景过渡没有局部 reduced-motion 覆盖。现将两类行过渡收敛为 100ms，并在 class/media reduced-motion 下关闭、尊重 `.monaco-enable-motion`；行高、颜色、圆角、选中、键盘和动作语义保持。

验证：`npm run transpile-client` exit 0，node `navigatorProjectsListCss.test.ts` 7 passing（含 Team rows 合同与错误捕获），目标 ESLint 0 errors，`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Sources conversation diff review toolbar reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 conversation diff review toolbar 按钮的 120ms 过渡没有局部 reduced-motion 覆盖。现将过渡收敛为 100ms，并在 class/media reduced-motion 下关闭、尊重 `.monaco-enable-motion`；review 命令、命中区、焦点和布局保持。

验证：`npm run transpile-client` exit 0；node wiring 40 passing / 3 个既有接线断言失败，目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Sources Changes inline actions reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 Changes inline/group actions 与 commit button 的 100ms 过渡没有局部 reduced-motion 覆盖。现仅补 class/media reduced-motion 关闭规则并尊重 `.monaco-enable-motion`；原过渡、按钮命令、命中区、焦点、行布局和 commit 行为保持。

验证：`npm run transpile-client` exit 0；node wiring 41 passing / 3 个既有 Changes buttons、Review pane void、Review list open-diff double-catch 接线失败，目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

## Activity Bar 拖拽插入指示器 reduced-motion 合同收敛（2026-11-06）

Sol 只读复核发现 Activity Bar composite action 的拖拽插入指示器伪元素仍带有 100ms transition-delay，class 与系统 reduced-motion 规则没有覆盖该反馈。现仅在 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下为 `.composite-bar` action item 的 `::before/::after` 关闭过渡；拖拽插入位置、颜色、命中区、键盘和动作语义保持。

验证：`activitybarCssScan.test.ts` 4 passing（含新增 `::before/::after` selector 合同与 unexpected-errors guard），目标 ESLint 0 errors，`git diff --check` 通过；本窄切片未重跑 `npm run transpile-client`、Chromium/Electron 或默认编辑器多主题人工验收。

## Notifications 正文链接键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现默认编辑器通知正文链接仍通过全局 `a:focus` 使用 `focusBorder` 外圈。现仅让普通主题链接在 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并清除外圈；HC black/light 保留 `1px solid contrastActiveBorder`，不改链接、点击反馈、通知操作或按钮布局。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `notificationsListCss.test.ts` 2 passing（合同与 unexpected-errors guard），目标 ESLint 0 errors，Stylelint exit 0（既有 5 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Visualize 折叠标题键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现可折叠 Visualize header 在普通主题仍以 `focusBorder` 画 1px 外圈，与产品自有 GPT 焦点语言不一致。现仅让普通主题 `:focus-visible` 使用既有 `toolbar-hoverBackground` 的轻量可见反馈并移除 focusBorder 外圈；高对比主题继续保留 `contrastActiveBorder`/`focusBorder` ring，不改折叠/ARIA、几何、键盘动作或内容渲染。

验证：`npm run compile-client` exit 0（compile-src 0 errors）；刷新产物后 focused Node `conversationLensCssScan.test.ts` 45 passing / 1 个既有 `ua-common.css` brace/selector 失败（新增合同通过），目标 ESLint 0 errors（1 个既有 externalized-string warning），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

## Sources 空工作区 Open Folder 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Sources 无工作区空态的 `Open Folder...` 文本按钮在普通主题仍画 `focusBorder` 外圈，与当前 GPT 产品焦点语言不一致。现仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；高对比继续保留 `contrastActiveBorder` ring，不改命令、可见性、布局、键盘动作或空态语义。

验证：刷新产物后 `npm run transpile-client` exit 0；`sourcesWiringScan.test.ts` 41 passing / 3 个既有 Changes stage/unstage、Review pane void、Review open-diff double-catch 基线失败（新增合同通过），目标 ESLint 0 errors（18 个既有 externalized-string warnings），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

## Sources Review 状态焦点合同收敛（2026-11-06）

Sol 只读复核发现 Sources Review state 普通主题仍以 `focusBorder` 画 1px 外圈，与当前 GPT 产品焦点语言不一致。现仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 review state 命令、ARIA、布局或键盘动作。

验证：刷新产物后 `npm run transpile-client` exit 0；`sourcesWiringScan.test.ts` 42 passing / 3 个既有 Changes stage/unstage、Review pane void、Review open-diff double-catch 失败（新增合同通过），目标 ESLint 0 errors（18 个既有 externalized-string warnings），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

## Conversation identity strip 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Conversation identity strip 的 engine/folder identity chips 与 Add Folder 按钮在普通主题仍以 `focusBorder` 画外圈。现仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改命令、只读 pointer、布局或键盘动作。

验证：刷新产物后 `npm run transpile-client` exit 0；focused Node `conversationLensCssScan.test.ts` 46 passing / 1 个既有 `ua-common.css` brace/selector 基线失败（新增合同通过），目标 ESLint 0 errors（1 个既有 externalized-string warning），`git diff --check` 通过；针对生产 CSS 的 Stylelint exit 0，仅有既有 7 个 unknown-variable 与 9 条 design-token suggestions；未跑 Chromium/Electron 或默认窗口人工验收。

## Conversation sub-agent overlay 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Conversation sub-agent overlay 容器在普通主题仍以 `focusBorder` 画外圈。现仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC 继续保留 `contrastActiveBorder` ring，不改 overlay/card/backdrop 或键盘语义。

验证：刷新产物后 focused Node 3 passing，`npm run transpile-client` exit 0，目标 ESLint 0 errors，针对生产 CSS 的 Stylelint exit 0（仅既有 `--ua-ease` unknown variable 与 3 条 design-token suggestions），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

## Sources Files 模式切换键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Sources Files 的 mode toggle 普通主题仍以 `focusBorder` 画外圈。现仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 list/tree 模式命令、`aria-pressed`、布局或键盘动作。

验证：刷新产物后 `npm run transpile-client` exit 0；focused Sources wiring 43 passing / 3 个既有 Changes stage/unstage、Review pane void、Review open-diff double-catch 基线失败（新增合同通过），目标 ESLint 0 errors（18 个既有 warnings），Stylelint exit 0（仅既有 1 个 unknown variable 与 9 条 design-token suggestions），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

## Conversation lens session title 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Conversation lens session title button 在普通主题仍以 `focusBorder` 画外圈。现仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC black/light 显式保留 `contrastActiveBorder` ring，不改标题编辑、命令、布局或键盘动作。

验证：刷新产物后 `npm run transpile-client` exit 0；focused Node `conversationLensCssScan.test.ts` 47 passing / 1 个既有 `ua-common.css` brace/selector 基线失败（新增合同通过），目标 ESLint 0 errors（1 个既有 externalized-string warning），Stylelint exit 0（仅既有 23 个 unknown vars 与 104 条 design-token suggestions），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

## Conversation lens session switcher 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Conversation lens session switcher 的 SelectBox 在普通主题仍以 `focusBorder` 画外圈。现仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC black/light 显式保留 `contrastActiveBorder` ring，不改 SelectBox 命令、chevron 几何、键盘或菜单行为。

验证：刷新产物后 `npm run transpile-client` exit 0；focused Node `conversationLensCssScan.test.ts` 48 passing / 1 个既有 `ua-common.css` brace/selector 基线失败（新增合同通过），目标 ESLint 0 errors（2 个既有 warnings），Stylelint exit 0（既有 23 个 unknown-variable warnings 与 104 条 design-token suggestions），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

## Image Carousel 导航箭头键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Image Carousel 导航箭头普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-activeBackground` 轻量反馈并保持 `opacity: 1`，HC black/light 保留 `contrastActiveBorder` ring，不改导航命令、命中区、图片切换或布局。

验证：`npm run transpile-client` exit 0；focused `imageCarouselCssScan.test.ts` 3 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 5 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Navigator Team status filter 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Navigator Team status filter 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 轻量反馈并保持前景色，HC black/light 保留 `contrastActiveBorder` ring，不改过滤、ARIA、按钮行为或布局。

验证：`npm run transpile-client` exit 0（10152 files）；focused `navigatorTeamStatusFilterCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 2 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Open Editors 未保存计数 badge 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Open Editors 未保存计数 badge 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 与前景色的轻量反馈并清除外圈，HC black/light 保留 `contrastActiveBorder` ring 与 offset，不改 role/button、Enter/Space、点击或布局。

验证：`npm run transpile-client` exit 0（10153 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `openEditorsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 3 条 design-token suggestions），`git diff --check` 通过；首次未设 skip-prelaunch 的 focused 运行因 Electron 动态 import 基线失败，未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Preview category tab 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 preview category tab 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 与前景色的轻量反馈并清除外圈，HC black/light 保留 `contrastActiveBorder` ring，不改 tab、drag、selected 语义或布局。

验证：`npm run transpile-client` exit 0（10154 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `previewCategoryBarCss.test.ts` 3 passing，目标 ESLint 0 errors，Stylelint exit 0，`git diff --check` 通过；首次测试与 transpile 并行导致动态 import 基线失败，刷新产物后已重跑通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Breadcrumbs editor-type picker 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Breadcrumbs editor-type picker 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 与 breadcrumb focusForeground 的轻量反馈并清除外圈，HC black/light 保留 `contrastActiveBorder` ring 与 `-1px` offset，不改 picker 点击、键盘或 ARIA 语义。

验证：`npm run transpile-client` exit 0（10155 files）；顺序运行 `VSCODE_SKIP_PRELAUNCH=1` focused `breadcrumbsControlCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 4 条 design-token suggestions），`git diff --check` 通过；并行运行 test/transpile 曾触发动态 import 基线竞态，顺序重跑已通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Editor add-tab action 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Editor add-tab action 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 与图标前景色的轻量反馈并清除外圈，HC black/light 保留 `contrastActiveBorder` ring 与 `-1px` offset，不改 add-tab command、hover/active 状态、命中区或键盘行为。

验证：`npm run transpile-client` exit 0（10156 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `multiEditorTabsControlCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 6 条 spacing suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Settings editor tab 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Settings editor tab 普通主题仍以 `focusBorder` 的 color-mix box-shadow 画外圈；现改用 `toolbar-hoverBackground` 与前景色的轻量反馈并移除 color-mix 外圈，HC black/light 保留 `contrastActiveBorder` ring，不改 checked、hover 或键盘切换语义。

验证：`npm run transpile-client` exit 0（10157 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `settingsEditor2Css.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 47 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Comments panel 正文链接键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Comments panel 正文链接普通主题仍画 `focusBorder` 外圈；现移除直接 `:focus` 外圈，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量反馈，HC black/light 保留 `contrastActiveBorder` ring，不改链接目标、点击、ARIA 或布局。

验证：`npm run transpile-client` exit 0（10158 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `commentsPanelCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Comments review widget 正文链接键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Comments review widget 的 comment-body 链接普通主题仍画 `focusBorder` 外圈；现移除直接 `:focus` 外圈，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量反馈，HC black/light 保留 `contrastActiveBorder` ring，不改链接点击、ARIA 或评论动作。

验证：`npm run transpile-client` exit 0（10159 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `commentsReviewCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 30 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Getting Started step icon 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Getting Started step icon 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 与前景色的轻量反馈并清除外圈，HC black/light 保留 `contrastActiveBorder` ring，不改展开、步骤、键盘或 ARIA 语义。

验证：`npm run transpile-client` exit 0（10160 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Getting Started category card 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Getting Started category card 普通主题仍画 `focusBorder` 外圈；现新增独立 `:focus-visible` 合同，使用 welcomePage tile hover 背景并清除外圈，HC black/light 保留 `contrastActiveBorder` ring，不改类别点击、展开、键盘或 ARIA 语义。

验证：`npm run transpile-client` exit 0（10161 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedCategoryCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Getting Started step button 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Getting Started step button 普通主题仍画 `focusBorder` inset box-shadow；现改用 tile-hover 背景并移除 inset 外圈，HC black/light 保留 `contrastActiveBorder` ring，不改 `aria-expanded`/`aria-checked`、步骤选择或键盘行为。

验证：`npm run transpile-client` exit 0（10162 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedStepCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Getting Started Start links 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Getting Started Start links 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量反馈并清除外圈，HC black/light 保留 `contrastActiveBorder` ring，不改起始入口命令、链接、键盘或布局。

验证：`npm run transpile-client` exit 0（10163 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedStartCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Getting Started done/next actions 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Getting Started done/next actions 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量反馈并清除外圈，HC black/light 保留 `contrastActiveBorder` ring，不改 Mark Done/Next Section 命令、键盘或布局。

验证：`npm run transpile-client` exit 0（10164 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedDoneNextCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Getting Started 其余正文链接键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Getting Started 其余正文链接普通主题仍通过直接 `:focus` 画 `focusBorder` 外圈；现将非关闭锚点直接 `:focus` 清为无外圈，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量反馈，HC black/light 保留 `contrastActiveBorder` ring，不改链接目标、关闭按钮、键盘或布局。

验证：`npm run transpile-client` exit 0（10165 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedLinksCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Preferences Back to Client Settings 导航焦点合同收敛（2026-11-06）

Sol 只读复核发现 Preferences Back to Client Settings 普通主题仍画 `focusBorder` 外圈；现清除普通主题 focusBorder ring，HC black/light 保留 `contrastActiveBorder` ring，不改导航命令、链接文本、tab strip 布局或键盘行为。

验证：`npm run transpile-client` exit 0（10166 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `preferencesEditorCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 9 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Keybindings editor 搜索动作键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Keybindings editor header action-label 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 与前景色的轻量反馈并清除外圈，HC black/light 保留 `contrastActiveBorder` ring，不改搜索过滤、录制/切换按钮、键盘或布局。

验证：`npm run transpile-client` exit 0（10167 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `keybindingsEditorCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 6 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Terminal hidden chat entry 删除控件键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Terminal hidden chat entry delete control 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground`、保持 `opacity: 1` 并清除外圈，HC black/light 保留 `contrastActiveBorder` ring，不改 `role=button`、Enter/Space 删除行为、显示条件或布局。

验证：`npm run transpile-client` exit 0（10168 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `terminalTabsChatEntryCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 18 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Terminal hidden chat entry 主入口键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 `.terminal-tabs-chat-entry` 普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 轻量反馈并清除外圈，HC black/light 保留 `contrastActiveBorder` ring，不改 `role=button`、Enter/Space 打开隐藏 chat terminal、删除控件或 tab 布局。

验证：`npm run transpile-client` exit 0（10169 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `terminalTabsChatEntryFocusCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 18 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Walkthrough 正文链接键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Walkthrough 正文 anchor 普通主题仍画 `focusBorder` 外圈；现清除直接 `:focus` 外圈，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量反馈，HC black/light 保留 `contrastActiveBorder` ring，不改链接导航、Markdown/输入控件或布局。

验证：`npm run transpile-client` exit 0（10170 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `walkThroughCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 12 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Walkthrough select 控件键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Walkthrough select 控件普通主题仍保留原生 `:focus` 环；现清除原生环，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量反馈，HC black/light 保留 `contrastActiveBorder` ring，不改 select 内容、键盘或表单语义。

验证：`npm run transpile-client` exit 0（10171 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `walkThroughSelectCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 12 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Walkthrough input 控件键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Walkthrough input 控件普通主题仍保留原生 `:focus` 环；现清除原生环，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量反馈，HC black/light 保留 `contrastActiveBorder` ring，不改输入内容、键盘或表单语义。

验证：`npm run transpile-client` exit 0（10172 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `walkThroughInputCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 12 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## SCM 提交动作键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 SCM 输入区提交动作按钮普通主题仍画 `focusBorder` 外圈；现改用 `toolbar-hoverBackground` 与前景色的轻量反馈并清除外圈，HC black/light 保留 `contrastActiveBorder` ring，不改提交/同步命令、disabled 状态、按钮布局或键盘行为。

验证：`npm run transpile-client` exit 0（10173 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `scmButtonCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 28 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Editor watermark preview-category empty action 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Editor watermark preview-category empty action 普通主题仍画 `focusBorder` 外圈；现清除普通主题 focusBorder，复用既有 quiet hover fill，HC black/light 保留 `contrastActiveBorder` ring 与 offset，不改 Open Folder/类别空态按钮命令、键盘或布局。

验证：`npm run transpile-client` exit 0（10174 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `editorGroupViewCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无新增提示），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Pane composite HC 上下焦点指示器合同收敛（2026-11-06）

Sol 只读复核发现 Pane composite action 的 HC black/light 焦点指示器未统一使用对比度边界；现让 header top 与 footer bottom 使用 `contrastActiveBorder`（保留 `focusBorder` fallback），普通主题透明/轻量行为保持，不改导航、checked 或快捷键语义。

验证：`npm run transpile-client` exit 0（10175 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `paneCompositePartCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 13 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Workbench 空列表 HC 焦点合同收敛（2026-11-06）

Sol 只读复核发现 Workbench 空列表 HC black/light 的 focus overlay 未统一使用对比度边界；现改用 `contrastActiveBorder`（保留 `focusBorder` fallback），普通主题及列表结构保持，不改列表键盘导航、选中或空态语义。

验证：`npm run transpile-client` exit 0（10176 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `workbenchStyleCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 10 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Explorer inline rename input 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Explorer inline rename input 普通主题仍画直接 `focusBorder` 外圈；现移除直接轮廓，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量反馈，HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）1px ring，不改 rename、ARIA 或键盘语义。

验证：`npm run transpile-client` exit 0（10177 files）；focused `explorerViewletCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（现有 2 条 design-token suggestions、5px spacing 与 3px radius suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Search view 消息正文链接键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Search view 消息正文链接普通主题缺少与 GPT 视觉一致的焦点反馈；现新增 `:focus-visible` 的 `toolbar-hoverBackground` 与 `textLink-activeForeground` 反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px ring，保留链接语义与既有 hover/active 行为。

验证：`npm run transpile-client` exit 0（10178 files）；focused `searchViewCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Search view replace toggle 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Search view replace 展开/收起控件普通主题缺少与 GPT 视觉一致的焦点反馈；现新增普通主题 `:focus-visible` 的 `toolbar-hoverBackground` 反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px ring，不改变按钮/图标语义。

验证：`npm run transpile-client` exit 0（10179 files）；focused `searchViewToggleCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Search view query-details toggle 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Search view query-details toggle 普通主题缺少与 GPT 视觉一致的焦点反馈；现新增普通主题 `:focus-visible` 的 `toolbar-hoverBackground` 反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px ring，保留既有 tabindex、role 与 ARIA 行为。

验证：`npm run transpile-client` exit 0（10180 files）；focused `searchViewQueryDetailsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Search view replace actions 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Search view replace-container ActionBar action labels 普通主题缺少与 GPT 视觉一致的焦点反馈；现新增普通主题 `:focus-visible` 的 `toolbar-hoverBackground` 反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px ring，保留 ActionBar 既有语义。

验证：`npm run transpile-client` exit 0（10181 files）；focused `searchViewReplaceActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Search provider message links 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Search provider message links 普通主题缺少与 GPT 视觉一致的焦点反馈；现新增 `:focus-visible` 的 `toolbar-hoverBackground` 与 `textLink-activeForeground` 反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px ring，保留链接键盘/点击语义。

验证：`npm run transpile-client` exit 0（10182 files）；focused `searchViewProviderMessageCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Editor placeholder action buttons 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 editor placeholder 操作按钮普通主题缺少与 GPT 视觉一致的焦点反馈；现新增普通主题 `:focus-visible` 的 `toolbar-hoverBackground` 反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）对比环，保留按钮语义与原 `outline-offset: 2px`。

验证：`npm run transpile-client` exit 0（10183 files）；focused `editorPlaceholderCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 2 条 spacing/codicon suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Editor quick access dirty-editor action 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 editor quick access dirty-editor 操作按钮普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 `.dirty-editor:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并移除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留操作按钮语义。

验证：`npm run transpile-client` exit 0（10184 files）；focused `editorQuickAccessCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无 suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Screen reader explanation close action 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 screen-reader explanation 浮层关闭按钮普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 `.screen-reader-detected-explanation .cancel:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并移除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留关闭按钮语义。

验证：`npm run transpile-client` exit 0（10185 files）；focused `editorStatusCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 3 条 font/spacing suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Single editor title actions 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现单编辑器标题栏 title-actions 操作按钮普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 `.title-actions .action-label:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留操作按钮语义。

验证：`npm run transpile-client` exit 0（10186 files）；focused `singleEditorTabsControlCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 1 条 spacing suggestion），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Modal editor title navigation 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现模态编辑器标题导航按钮普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题导航按钮 `:focus-visible:not(.disabled)` 使用 `commandCenter-activeBackground`、保持 `opacity: 1` 并移除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 disabled 排除与导航语义。

验证：`npm run transpile-client` exit 0（10187 files）；focused `modalEditorPartCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 5 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Modal editor title action-label 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现模态编辑器标题 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 action-label `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 ActionBar 语义。

验证：`npm run transpile-client` exit 0（10188 files）；focused `modalEditorActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 5 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Editor group toolbar action-label 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现编辑器组工具栏 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 `.editor-group-container-toolbar .action-label:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并移除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留工具栏语义。

验证：`npm run transpile-client` exit 0（10189 files）；focused `editorGroupToolbarCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无 suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Editor tab actions 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现编辑器标签页 tab-actions 操作按钮普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 tab action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 tab close/pinned/dirty 行为。

验证：`npm run transpile-client` exit 0（10190 files）；focused `multiEditorTabsControlTabActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 6 条 spacing suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Editor tab bar editor-actions 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现编辑器标签栏 editor-actions 顶层操作按钮普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 editor-actions `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留标签栏语义。

验证：`npm run transpile-client` exit 0（10191 files）；focused `multiEditorTabsControlEditorActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 6 条 spacing suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Breadcrumbs-below-tabs item 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现标签下方 breadcrumbs item 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 `.breadcrumbs-below-tabs .monaco-breadcrumb-item:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 breadcrumbs 导航语义。

验证：`npm run transpile-client` exit 0（10192 files）；focused `editorTitleBreadcrumbsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 1 条 spacing suggestion），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Editor watermark toolbar action-label 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 editor watermark 顶部工具栏 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 watermark toolbar `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留工具栏语义。

验证：`npm run transpile-client` exit 0（10193 files）；focused `editorGroupWatermarkToolbarCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无 suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Terminal tabs-list action-label 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Terminal tabs-list 行内 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 tabs-list action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 tabs-list 语义。

验证：`npm run transpile-client` exit 0（10194 files）；focused `terminalTabsActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 18 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Terminal single-terminal-tab 入口键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Terminal single-terminal-tab 入口普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 `.single-terminal-tab:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留入口语义。

验证：`npm run transpile-client` exit 0（10195 files）；focused `terminalSingleTabCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 18 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Terminal tabs-container toolbar action-label 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Terminal tabs-container 顶部 toolbar action-label 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 toolbar action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 toolbar 语义。

验证：`npm run transpile-client` exit 0（10196 files）；focused `terminalTabsToolbarCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 18 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Debug toolbar action-label 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Debug toolbar action-label 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 debug toolbar action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 toolbar 语义。

验证：`npm run transpile-client` exit 0（10197 files）；focused `debugToolBarCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无 suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Debug start configuration dropdown-label 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Debug start configuration dropdown-label 普通主题仍有直接 `focusBorder` 装饰；现移除直接 focusBorder，让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 dropdown 选择语义。

验证：`npm run transpile-client` exit 0（10198 files）；focused `debugViewletCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 12 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Debug tree inline action-label 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Debug 调试树行内 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 debug tree action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留调试树语义。

验证：`npm run transpile-client` exit 0（10199 files）；focused `debugViewletActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 12 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Exception widget action-label 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现编辑器内联异常提示 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 exception widget action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留异常提示操作语义。

验证：`npm run transpile-client` exit 0（10200 files）；focused `exceptionWidgetCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 3 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Exception widget stack-trace link 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现编辑器内联异常提示 stack-trace 链接普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 stack-trace link `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 轻量反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留链接导航语义。

验证：`npm run transpile-client` exit 0（10201 files）；focused `exceptionWidgetStackTraceCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 3 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Breakpoint widget mode action 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现编辑器内联断点提示 mode 按钮普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 breakpoint action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留断点提示操作语义。

验证：`npm run transpile-client` exit 0（10202 files）；focused `breakpointWidgetCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无 suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Debug REPL expression lazy-button 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Debug REPL expression lazy-button 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 lazy-button `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 REPL 操作语义。

验证：`npm run transpile-client` exit 0（10203 files）；focused `replCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 2 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Debug REPL source/group link 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Debug REPL 输出 source/group 链接普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 source links `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 轻量反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 source 导航语义。

验证：`npm run transpile-client` exit 0（10204 files）；focused `replSourceLinksCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 2 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Debug multi-call-stack title link 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Debug multi-call-stack title link 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 call-stack title link `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 title link 语义。

验证：`npm run transpile-client` exit 0（10205 files）；focused `callStackWidgetCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 1 条 spacing suggestion），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Debug multi-call-stack collapse link 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Debug multi-call-stack collapse-button link 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 collapse link `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留折叠链接语义。

验证：`npm run transpile-client` exit 0（10206 files）；focused `callStackWidgetCollapseCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 1 条 spacing suggestion），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Debug multi-call-stack go-to-file link 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Debug multi-call-stack go-to-file 链接普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 file link `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 轻量反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留文件导航语义。

验证：`npm run transpile-client` exit 0（10207 files）；focused `callStackWidgetFileLinkCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 1 条 spacing suggestion），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Debug expression value link 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现 Debug 变量表达式 value link 普通主题缺少与 GPT 视觉一致的焦点反馈；现让普通主题 expression value link `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 轻量反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留变量链接语义。

验证：`npm run transpile-client` exit 0（10208 files）；focused `debugContributionCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 4 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

## Titlebar Command Center Quick Pick 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现标题栏 Command Center Quick Pick 的 `CommandCenterQuickPickItem` 普通主题/HC 焦点分支需要明确；现让普通主题 `:focus-visible` 使用 `commandCenter-activeBackground` / `toolbar-hoverBackground` 背景反馈并移除产品自有 focus ring，HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环与 `-1px` offset，不改 `role=button`、动态 tabindex 或动作焦点管理器语义。

验证：`npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/titlebarPartCss.test.ts` 2 passing；ESLint 通过，Stylelint 通过（既有 6 条 design-token suggestions），两路径 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实键盘聚焦与 HC 对比环仍未覆盖。

## Titlebar adjacent/update toolbar action buttons 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现标题栏 `center-adjacent-toolbar-container` 与 `update-toolbar-container` action-label 普通主题需要与 Command Center 一致的焦点处理；现让普通主题 `:focus-visible` 移除产品自有 focus ring 并使用 `toolbar-hoverBackground` 背景反馈，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，不改 `MenuWorkbenchToolBar`、动态 tabindex 或布局。

验证：`npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/titlebarToolbarCss.test.ts` 2 passing；ESLint 通过，Stylelint 通过（既有 6 条 design-token suggestions），CSS 与合同测试 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实键盘聚焦与 HC 对比环仍未覆盖。

## Titlebar Menubar menu item 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现标题栏 Menubar 菜单项为 `role=menuitem`、动态 tabindex，但普通主题仍需与 GPT 视觉一致的焦点反馈；现让普通主题 `.menubar-menu-button:focus-visible .menubar-menu-title` 移除产品自有 focus ring 并使用 `toolbar-hoverBackground`，HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）对比环，不改菜单语义或动态 tabindex。

验证：`npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/menubarControlCss.test.ts` 2 passing；ESLint、Stylelint 通过，CSS 与合同测试 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实菜单键盘聚焦与 HC 对比环仍未覆盖。

## Titlebar primary action-toolbar 键盘焦点合同收敛（2026-11-06）

Sol 只读复核发现标题栏右侧主 `action-toolbar-container` 由 `TitlebarPart.createActionToolBar()` 的 `WorkbenchToolBar` 渲染，action view item 管理动态焦点；现让普通主题 action-item/label `:focus-visible` 移除产品自有 focus ring 并使用 `toolbar-hoverBackground`，HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）对比环，不改焦点管理或布局。

验证：`npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/titlebarActionsCss.test.ts` 2 passing；ESLint、Stylelint 通过（既有 6 条 design-token suggestions），CSS 与合同测试 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实标题栏键盘聚焦与 HC 对比环仍未覆盖。

## V8 Engine 空卡实施检查点（2026-11-06）

Sol 按 D18 的 V8=A 将 Engine 设置页未连接分区改为按内容高度排版：连接状态横幅出现时，detail body 加上 `is-disconnected`，只把 flex 从 `1 1 auto` 收到 `0 1 auto`；保留 `overflow: auto` 与 shrink，短窗口仍可滚动。连接恢复后移除该状态类，已连接目录、远程连接和 Tools 虚拟列表继续使用原有填充视口合同。空态说明与恢复动作因此保持在同一内容组内，贴近 ChatGPT/Claude 设置页的空态动作节奏；未改连接状态文案、导航、按钮或滚动容器语义。

验证：Node v24.18.0 下 `npm run compile-client` exit 0；`enginePreferencesPane.test.ts` 33 passing（含断开→连接→断开的行为回归）；`enginePreferencesPaneCss.test.ts` 3 passing（含 connected flex 与 disconnected content-height 合同）；`git diff --check` 通过。未启动默认编辑器窗口，浅/深/高对比主题的真实视觉与默认 Electron/WebView 滚动仍需单独人工 gate。
