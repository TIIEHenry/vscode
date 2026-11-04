---
title: "a05 主题、减弱动效与缩放的适配"
type: reference
status: active
phase: M7
updated: 2026-11-01
summary: "跨 Conversation、Sources、Navigator、首选项的主题 token、高对比、减弱动效与缩放写法问题；路径相对 src/vs/workbench/"
---
# a05 主题、减弱动效与缩放的适配

路径未写前缀时相对 `src/vs/workbench/`。判据和共性根因见 [README](README.md)。焦点样式按 2026-11-01 用户裁定判：新增或改动的焦点不用 `--vscode-focusBorder`，用中性阴影，高对比用 `contrastActiveBorder` 轮廓；现有控件用 focusBorder 的不报。

基线：范围内 34 个 CSS 文件用到的 113 个 `--vscode-*` 变量都能对应到已注册的颜色或尺寸。没有 `color-mix(… white / black …)` 写法。主按钮「中性近黑 / 深色近白」走 `button.*` token。未提交的 5 / 9 / 12% 中性底都用 `:not(.hc-black):not(.hc-light)` 排除了高对比（a05-1 除外）。TS 里没有 `devicePixelRatio` 与 0.5px 写法，几处 `getBoundingClientRect` 计算只比相对位置，不受缩放影响。下面只列问题。

依据之一：`toolbar.hoverBackground`、`toolbar.activeBackground`、`widget.shadow` 在 hcDark / hcLight 下注册为 `null`（`src/vs/platform/theme/common/colors/editorColors.ts:338-359`），主题 CSS 不输出值为 `null` 的变量，`var()` 落到 fallback。

## a05-1 Navigator「当前会话」标识在高对比下消失，浅深色下与选中行同色

状态：成立。优先级 P1。涉及未提交改动。

观察（作者：agent:context-gatherer）：未提交改动删掉了 `contrib/navigator/browser/media/navigatorProjectsList.css` 原有的 `.monaco-list-row:has(.is-active-session)::after { width: 2px; background: var(--vscode-focusBorder) }`，它对所有主题生效。替代规则只有 216 行的非高对比 9% 底，与 212 行 `.selected` 的 9% 相同。TS 只切 `is-active-session` 类（`navigatorProjectsList.ts:246`），没有图标或文字区分。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | `git diff` 该文件：删除 `::after` 竖条；读当前 204-226 行 |

**方案**：高对比补 `.monaco-workbench:is(.hc-black, .hc-light) … .is-active-session` 规则（`contrastActiveBorder` 竖条或描边）；浅深色下当前会话与选中行用不同表达。由改动作者在提交前处理。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D2：当前会话用标题 600 字重表示，不画竖条、不靠底色，高对比下同样成立。由改动作者在提交前处理。

## a05-2 Sources 页签选中态在高对比下不可见

状态：已知。已登记为 [UI 组件审查的 r02-6](../2026-11-01-ui-components/r02-sources-navigator.md)。

补充根因：`contrib/sources/browser/media/sourcesTabs.css:239-251` 的悬停与选中都用 `var(--vscode-toolbar-hoverBackground)` 且没有 fallback，高对比下这个变量为空，背景透明。修 r02-7 的祖先选择器只能恢复下划线，选中底在高对比下本来就为空。修 r02-6 时一并处理。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 已知 | 读 `sourcesTabs.css:235-262`、`editorColors.ts:350-351` |

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。确认「已知」：归并到 UI 组件审查 r02-6（高对比部分）与 r02-7 一起改，补充根因（`toolbar-hoverBackground` 在高对比下为空、选中底透明）在那里一并处理，不另立修复。

## a05-3 toolbar.* fallback 写死白色半透明，hc-light 上按下与勾选态不可见

状态：成立。优先级 P1（hc-light 勾选态）/ P2（其余按下态）。fallback 生效已确认；勾选态是否另有描边待运行时核对。

观察（作者：agent:context-gatherer）：范围内 21 个文件共 53 行 `var(--vscode-toolbar-{hover,active}Background, rgba(255, 255, 255, …))`，其中 `conversationLens.css` 24 处。另有 7 处其他 rgba fallback（`rgba(90, 93, 94, …)`、`rgba(0, 0, 0, 0.06)`）。最关键的是 Sources 过滤动作的勾选态：`sourcesTabs.css:107-110` 用 `toolbar-activeBackground, rgba(255,255,255,0.12)` 表达 `.checked`。hc-light 是白底，叠白色 12% 看不见；hc-black 上很淡；`rgba(0,0,0,0.06)` 在 hc-black 上看不见。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | fallback 成立 | 读 `editorColors.ts:338-359`；grep 计数 53 行 / 21 文件，含其他 rgba 共 60 行 |

要看什么：hc-light 下打开 Sources 过滤，已勾选项的 computed `outline` 与 `background-color`；上游 actionbar 有没有给 `.checked` 画高对比描边。

**方案**：fallback 改为 `color-mix(in srgb, var(--vscode-foreground) N%, transparent)`；勾选与按下态在高对比下补 `outline: 1px solid var(--vscode-contrastActiveBorder)`。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。只签 Sources 过滤动作的按下与勾选态：`.monaco-workbench:is(.hc-black, .hc-light)` 下补 `contrastActiveBorder` 轮廓。排除 60 行 fallback 的全面替换：比例 N 没定，浅深色下 token 都有值、fallback 不生效。另有 6 行别的 rgba fallback，不是 7 行。

## a05-4 未提交的 5% 悬停底被列表组件的注入规则盖掉

状态：成立。优先级 P2；出现白字浅底则 P1。涉及未提交改动。悬停不生效已确认；选中行前景待运行时核对。

观察（作者：agent:context-gatherer）：产品悬停规则形如 `.monaco-workbench:not(.hc-black):not(.hc-light) .navigator-projects-list .monaco-list-row:hover`，特异度 6 个类。列表组件运行时注入 `.monaco-list.list_id_N:not(.drop-target):not(.dragging) .monaco-list-row:hover:not(.selected):not(.focused)`，8 个类（`src/vs/base/browser/ui/list/listWidget.ts:970`），非选中非焦点行的悬停仍是 `list.hoverBackground`。选中行的 9% 底能盖过列表 `:focus .selected`，但列表同时注入的 `color: list.activeSelectionForeground` 不受影响；默认浅色主题里它是白色。涉及 `conversationSessions.css`、`navigatorProjectsList.css`、`navigatorStub.css`、`navigatorTeamList.css` 的未提交改动；四个列表都没传 `overrideStyles`。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 悬停成立 | 读 `listWidget.ts:970`、`navigatorProjectsList.css:208-214` |

要看什么：Light Modern、Dark Modern 和产品默认主题下，聚焦 Navigator 三个列表与会话列表，看 `.selected`、`.selected.focused`、`:hover` 行的 computed `color` 与 `background-color`。

**方案**：通过列表 `overrideStyles` 传中性 hover、selection 与对应前景，不靠低特异度 CSS 覆盖。由改动作者在提交前处理。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D2：悬停与选中改用主题的 `list.*` 颜色，组件 CSS 不再写 `color-mix` 行底；产品主题继承的值已是中性。

## a05-5 5% / 9% 中性底在浅深色下可辨度低

状态：待核对。优先级 P2。涉及未提交改动。

观察（作者：agent:context-gatherer）：按 Dark Modern 估算（侧栏 #181818、前景 #CCCCCC），9% 对底约 1.21:1，5% 约 1.10:1，选中对悬停约 1.09:1；Light Modern 下 9% 对底约 1.17:1，选中对悬停约 1.07:1。非高对比下选中行的描边被 `outline: none !important` 去掉（`navigatorProjectsList.css:6-10`、`navigatorStub.css:46-55`），只在 `:focus-visible .focused` 时恢复。鼠标操作后选中只靠约 1.2:1 的底色。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用估算 | 产品默认主题色值未查 |

要看什么：产品默认浅深主题截图实测。

**方案**：选中底与悬停至少拉开一档，或给选中行加字重或前景变化；可复核 [chatgpt-visual-language](../../plans/chatgpt-visual-language.md) §20 的比例。

签收：待用户。

## a05-6 新建页签按钮的新焦点规则用 focusBorder 与祖先写法

状态：成立。优先级 P2。涉及未提交改动。

观察（作者：agent:context-gatherer）：`browser/parts/editor/media/multieditortabscontrol.css` 新增 `.add-tab-action:focus-visible { outline: 1px solid var(--vscode-focusBorder) }`，与用户裁定不符；高对比规则写成 `:is(.hc-black, .hc-light) .monaco-workbench …`（131 行），不匹配；悬停用无 fallback 的 `toolbar-hoverBackground`，高对比下透明。hc-black 下 focusBorder 与 contrastActiveBorder 默认同色，所以焦点本身仍可见。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | grep 祖先写法命中 `multieditortabscontrol.css:131` |

**方案**：改中性阴影焦点；高对比用 `.monaco-workbench:is(.hc-black, .hc-light) …` 加 `contrastActiveBorder` 轮廓。由改动作者在提交前处理。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D1：`focusBorder` 焦点本身符合规范，不改；只修高对比祖先选择器（并入 a05-17）和悬停 fallback。

## a05-7 Changes 文件夹头选中、焦点、悬停同色

状态：成立。优先级 P2。涉及未提交改动。

观察（作者：agent:context-gatherer）：`contrib/sources/browser/media/sourcesChangesList.css:166-171` 的悬停、选中、焦点都给文件夹头 `list.hoverBackground`，同一行出现两种底色。新增分隔线（约 105 行）用 `sideBarSectionHeader.border` 的 70%，浅深色下该 token 为空，线透明；高对比下把 `contrastBorder` 减淡到 70%。复选框悬停也用 `list.hoverBackground`，与整行悬停叠在一起。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 未逐行读 |

**方案**：文件夹头的选中、焦点继承行的选中背景或透明；高对比下分隔线用不减淡的 `contrastBorder`。分隔线在浅深色下是否本就不打算显示，由改动作者确认。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。只签文件夹头选中与焦点不再用悬停色、高对比下分隔线不再减淡。排除浅深色分隔线：产品主题有意把 `sideBarSectionHeader.border` 设成透明，「token 为空」的说法不对。「涉及未提交改动」已过时，`sourcesChangesList.css` 已在 `b5ec35bd101` 提交。

## a05-8 高对比焦点轮廓与组件 :focus { outline: none } 特异度相同

状态：待核对。优先级 P1（若轮廓被抵消）。

观察（作者：agent:context-gatherer）：`browser/parts/conversation/media/ua-common.css:59-72` 的 `.monaco-workbench.hc-black .part.conversation :focus-visible { outline: 2px solid … }` 是 5 个类级。`contrib/conversation/browser/media/conversationLens.css:1107-1111` 的 Trajectory 搜索框 `:focus { outline: none }` 也是 5 个类级。两者谁生效取决于加载顺序；contrib 后加载时，高对比下这个输入框只剩 15% 前景色阴影。同类写法未逐条列全。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `ua-common.css:59-72` |

要看什么：hc-black 与 hc-light 下 Tab 到 Trajectory 搜索框，看 computed `outline`；再 grep 全部 `:focus { outline: none }` 列清单。

**方案**：组件里的 `outline: none` 限定在 `:not(.hc-black):not(.hc-light)` 下；或提高 ua-common 高对比焦点规则的优先级。

签收：待用户。

## a05-9 高对比下选中与错误只靠颜色区分

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`ua-common.css:74-111` 选中是 `outline: 2px solid contrastBorder; outline-offset: -2px`，113-120 错误是 `outline: 2px solid errorForeground; outline-offset: -2px`，样式相同只换颜色。hc-light 下 `contrastBorder` #0F4A85 与焦点色 #006BBD 都是蓝色，焦点与选中只靠描边内外位置区分。pending 用 dashed，能区分。方案 §6 要求状态不能只靠颜色。错误行若另有图标或文案，则不是唯一区分手段。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `ua-common.css:59-131` |

**方案**：错误改 double 或加粗描边，或配合竖条与图标；选中与焦点在线型上拉开。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D19：高对比下焦点实线、选中点线、待确认虚线、错误用错误色实线并保留 Retryable 徽标。

## a05-10 ua-common 的表面与阴影 token 没人用

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`ua-common.css:24-31` 定义的 `--ua-shadow-sm/md/lg`、`--ua-border-subtle`、`--ua-surface-hover`、`--ua-surface-active`、`--ua-accent` 使用次数为 0，43-49 行的高对比覆盖因此没有效果。各文件改用手写 `color-mix(in srgb, var(--vscode-foreground) N%, transparent)`，N 有 2 / 5 / 6 / 8 / 9 / 10 / 12 / 15 / 25 九种。按下态有 `toolbar.activeBackground`、`list.activeSelectionBackground`、12% 三种写法，悬停也有三种。`--ua-shadow-*` 在已带透明度的 `widget.shadow` 上再乘 25–50%，用上也接近不可见。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `ua-common.css:15-50` |

**方案**：把悬停、选中、按下收敛到 `--ua-surface-*`，高对比由 ua-common 统一替换；修正 `--ua-shadow-*` 的双重衰减。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。按 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D2：`ua-common.css` 里没人用的 `--ua-surface-*`、`--ua-shadow-*` 删掉，中性底统一走主题 `list.*`。

## a05-11 浮层阴影写死黑色，高对比下仍有 fallback 阴影

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`contrib/conversation/browser/media/conversationSubAgentOverlay.css:60-61` 用 `color-mix(in srgb, #000 12%, transparent)` 两层阴影，没用 `widget.shadow`；它的高对比覆盖在 64 行，是祖先写法，不生效。`conversationLens.css:366、4201、4291` 用 `var(--vscode-widget-shadow, rgba(0,0,0,.16))`，高对比下走 fallback，hc-light 上出现阴影。`conversationLens.css:543` 用 `widget-shadow` 作 Snapshots 遮罩底色。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 读 `editorColors.ts:338-340` |

**方案**：阴影统一用不带 fallback 的 `var(--vscode-widget-shadow)`；高对比卡片用正确选择器补 `contrastBorder`；遮罩换专门的中性色。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。只签 `conversationLens.css` 三处阴影去掉 rgba fallback（浅深色 token 有值，外观不变），以及子代理卡片在正确的高对比选择器下去掉阴影。排除子代理卡片浅深色阴影换成 `widget.shadow`（会改外观）和遮罩那一处（「专门的中性色」没指明）。

## a05-12 各文件的 prefers-reduced-motion 规则不尊重显式开启动效

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`connectionPreferencesPane.css:793`、`enginePreferencesPane.css:1724`、`conversationLens.css:4912`、`ua-common.css:136-141` 的媒体查询没有排除 `.monaco-enable-motion`。`browser/media/productAccessibility.css:105` 与 `conversationSessions.css:125` 用了 `.monaco-workbench:not(.monaco-enable-motion)`，`productAccessibility.css:76` 注释写明媒体查询不得覆盖显式开启。用户在设置里把 `workbench.reduceMotion` 设为 `off` 后，这些界面仍然不动。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `connectionPreferencesPane.css:780-801`、`productAccessibility.css:69-105` |

**方案**：四处统一加 `.monaco-workbench:not(.monaco-enable-motion)` 前缀。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。合同依据是 `productAccessibility.css` 的注释与媒体查询写法。`conversationLens.css` 那一处按 a05-13 删掉即可，不必加前缀。README 摘要把设置值写成了 `on`，正文的 `off` 才对。

## a05-13 减弱动效下 spinner 两条规则意图相反

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`conversationLens.css:4908-4916` 在减弱动效下对 loading spinner 写 `animation: none`，注释说「Keep the loading spinner kill」。`productAccessibility.css:90-101` 对 `.part.conversation` 内的 `.codicon-loading` 用 `!important` 强制步进旋转，注释说「Loading spins stay visible」。`!important` 胜出，前一条是死规则。pending 状态不会因此丢失。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读两处规则 |

**方案**：定一个口径（建议保留步进旋转），删掉 `conversationLens.css` 那条或改注释。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。只签删掉 `conversationLens.css` 那条规则，保留 `productAccessibility.css` 的步进旋转口径；不要「或改注释」。设置为 `off`、系统偏好减弱时，lens 这条照样生效，会违背用户的显式开启。

## a05-14 全局减弱动效作用域有遗漏

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`productAccessibility.css:78-84` 的作用域是 `:where(.part.statusbar, .part.conversation, .part.sources, .preferences-editor)`。不在其中、也没有自己规则的过渡：

- Diff 审阅面在 `.part.editor` 内（`contrib/sources/browser/conversationDiffReviewPane.ts:97`），`conversationDiffReviewPane.css:30` 有背景过渡。
- Visualize 浮层挂在 workbench 根上（`contrib/conversation/browser/conversationVisualizeOverlay.ts:61-65`），不在 `.part.conversation` 内。
- 侧栏会话列表（`conversation.contribution.ts:68`），`conversationSessions.css:46` 的行过渡。与 [r02-9](../2026-11-01-ui-components/r02-sources-navigator.md)（Navigator）同类。

都是 80–120ms 背景淡入淡出，危害小。子代理浮层与会话窗口的挂载根未查。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `productAccessibility.css:78-84` |

**方案**：把 Diff 审阅面、Visualize 浮层、侧栏产品视图加进 `:where(...)` 列表，与 r02-9 一起修。

签收：签（收窄）。签收人：agent:kiro（用户委托），日期：2026-11-01。只签 Diff 审阅面与侧栏会话列表两处，选择器写具体；Navigator 与 UI 组件审查 r02-9 合并修。排除 Visualize：生产宿主是时间线槽位，已被 `.part.conversation` 覆盖。

## a05-15 hc-black 下手写主按钮可能没有边界

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：`conversationLens.css:4004-4005、4015-4016` 与 `conversationDiffReviewPane.css:47-48` 直接用 `button-background` / `button-foreground`。`button.background` 在 hcDark 下为 `null`，背景透明；这几处是手写 CSS 按钮，不一定经过 Button 组件的 `button.border`。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 沿用观察 | 未读 |

要看什么：hc-black 下这几个按钮的 computed `border`。

**方案**：补 `border: 1px solid var(--vscode-button-border, var(--vscode-contrastBorder))`。

签收：待用户。

## a05-16 forced-colors 只覆盖 Composer 与两类 chip

状态：待核对。优先级 P2。

观察（作者：agent:context-gatherer）：`ua-common.css:177-202` 只处理 Composer、身份 chip、收件箱 chip。其他靠淡底或阴影表达状态的地方（Navigator 与会话行选中、Sources 页签、中性阴影焦点）在系统强制颜色下底色变 Canvas、阴影被移除。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 待核对 | 读 `ua-common.css:177-202` |

要看什么：`.monaco-workbench` 的 `forced-color-adjust` 策略；`window.autoDetectHighContrast` 自动切到高对比主题后，实际表现是否就是本文件高对比各条。

**方案**：确认根节点策略后，决定补 forced-colors 规则还是只依赖高对比主题。

签收：待用户。

## a05-17 r02-7 之外又有 4 条祖先写法高对比选择器

状态：成立。优先级 P2。

观察（作者：agent:kiro）：[r02-7](../2026-11-01-ui-components/r02-sources-navigator.md) 登记了 contrib 下 13 条 `:is(.hc-black, .hc-light) .monaco-workbench …`。扩大到 `browser/parts/sources/media/` 与编辑器页签 CSS 后又有 4 条：

- `browser/parts/sources/media/sourcesPart.css:114、118、122`：Sources 左边框、顶边框、标题下边框的 `contrastBorder`。
- `browser/parts/editor/media/multieditortabscontrol.css:131`：新建页签按钮焦点（未提交，见 a05-6）。

`sourcesPart.css` 三条的实际影响小：基础规则用的 `sideBar.border` 在高对比下默认就是 `contrastBorder`。

**核对**

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | grep 祖先写法共 17 条，减去 r02-7 的 13 条 |

**方案**：与 r02-7 一起改成 `.monaco-workbench:is(.hc-black, .hc-light) …`。

签收：签。签收人：agent:kiro（用户委托），日期：2026-11-01。范围订正为 20 条：再补 `simpleFindWidget.css`、`notificationsCenter.css`、`editorgroupview.css` 各一处，三处都是本仓产品提交、都在默认窗口。与 r02-7 合并实施。
