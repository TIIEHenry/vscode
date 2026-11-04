---
title: "2026-11-01 审查待定项：按设计原则的决定"
type: decision
status: accepted
phase: N/A
updated: 2026-11-01
summary: "用户 2026-11-01 委托 agent:kiro 按设计原则决定审查与签收中留给用户的 40 余项。焦点保持 1px focusBorder（不采纳中性阴影焦点）；列表颜色走主题；Conversation 叶档 450/300；窗口缩放由 Conversation 吸收；回合间距回到 16px；代码侧不回退上游、不为 Agents Window 分叉；PRD-029 升 accepted，PRD-013.4 改为只有本地夹具标 Stub。"
---
# 2026-11-01 审查待定项：按设计原则的决定

状态：当前有效。

决定人：agent:kiro。用户 2026-11-01 在会话里委托「你决定一下，根据设计原则」。下面每一条都可以由用户推翻；推翻时改本页对应行，并改回受影响的签收行。

依据按优先级：[产品愿景](../product/vision.md)体验原则，[UI 设计原则与规范](../architecture/cross-cutting/ui-design-principles.md)（下称「规范」），[ADR-007](../../dev/decisions/007-upstream-sync.md) 上游最小改动，已接受的系统规格（[parts-and-grid](../systems/workbench/parts-and-grid.md)、[lens-and-trajectory](../systems/conversation/lens-and-trajectory.md)、[navigator-tabs-access](../reference/code-oss-b2/navigator-tabs-access.md)、[Sources 概览](../systems/sources/overview.md)）。规范与旧实现冲突时按规范；规范没写的按愿景原则推。

受影响的审查与方案：[UI 组件审查](../../dev/reviews/2026-11-01-ui-components/README.md)（r 编号）、[UI 适配审查](../../dev/reviews/2026-11-01-ui-adaptation/README.md)（a 编号）、[2026-10-30 视觉审查收口](../../dev/plans/ui-visual-review-2026-10-30.md)（V 编号）、[十六路审查 2026-10-30](../../dev/plans/review-2026-10-30.md)、[十六路审查 2026-10-11](../../dev/plans/review-2026-10-11.md)、[消息订阅 UI 审查](../../dev/plans/conversation-stream-ui-review.md)、[ChatGPT 视觉语言](../../dev/plans/chatgpt-visual-language.md)。

## D1 焦点样式

**决定：** 不采纳 UI 组件审查 README 里「用户裁定 2」的中性阴影焦点。键盘焦点照规范原则四：`:focus-visible` 画 1px `--vscode-focusBorder`，输入框聚焦时描边换成 `focusBorder`，高对比用 `contrastActiveBorder`。Composer 卡片的例外不变。

**依据：** 原则一把强调色留给键盘焦点；原则四写定 1px `focusBorder`；原则六阴影只给浮层；反模式 14 明列「聚焦用外圈光环代替描边变化」。裁定 2 的写法是描边加深到前景色 30%、再加前景色 12% 的 2px 外圈；按产品浅色前景约 `#202020` 算，白底上描边约 1.9:1、外圈约 1.3:1，都达不到 WCAG 1.4.11 非文本对比 3:1，违背愿景原则 6「键盘焦点始终可见」。产品主题的 `focusBorder`（`#0069CC`）在白底上约 5.4:1。

**影响：** r01-4、r01-7、r02-4、r02-5、r03-2、a05-6 改按本条实施；不再需要改规范。

## D2 列表悬停、选中与当前项

**决定：** Navigator 与会话列表的悬停、选中用主题的 `list.hoverBackground`、`list.activeSelectionBackground`、`list.inactiveSelectionBackground`，组件 CSS 不再写 `color-mix` 行底。产品主题继承的 2026 主题已经是中性值（浅色悬停前景 8%、有焦点选中约 15%、无焦点 `#DADADA99`）。行圆角 `cornerRadius.small`，过渡不超过 100ms。当前会话用标题 600 字重表示，不画竖条，也不靠底色。`ua-common.css` 里没人用的 `--ua-surface-*`、`--ua-shadow-*` 删掉。

**依据：** 原则一（色值写在产品主题里）；原则四与 §5.3（选中分有焦点 / 无焦点两色，不用深灰整行底）；原则二（层级先用字重）与原则八（状态不只靠颜色，高对比下也成立）；§3.1（行悬停底用 small）；原则七（过渡不超过 100ms）；§9（上游组件经主题对齐）。a05-4 已证实组件 CSS 的特异度压不过列表注入规则。

**影响：** a05-1、a05-4、a05-10、V8 的 Engine 导航行、[ChatGPT 视觉语言](../../dev/plans/chatgpt-visual-language.md) §20（该节对应 CSS 未提交，由作者按本条改后再审）。

## D3 宽度档

**决定：** Conversation 叶档按规范 §5.2、§8 与 lens-and-trajectory：`.is-medium` 450–899、`.is-narrow` < 450、`.is-compact` < 300。删掉 `conversationLens.css` 的 599 容器查询，它独有的几条规则并进 `.is-narrow`。轨迹 inspector 覆盖仍按表格宽 < 600。Engine / Connection 首选项保持 600。设置编辑器的 700 是上游，按 §9 不改；两套阈值并存是有意的。

**依据：** 规范 §5.2、§8 与 lens-and-trajectory 都写 450；可访问性方案「宽度档只由叶级宿主打 class」，容器查询是第二个来源（a01-9）。

**影响：** a01-1、a01-2、a03-8。实施时同刀改：[可访问性方案](../../dev/plans/accessibility-responsive-ui.md) §5 里 Conversation 的「`.is-narrow` < 600」改为 450。

## D4 SessionBar 让位顺序

**决定：** 标题先截断，配 tooltip；同步徽章 `flex-shrink: 0`，窄档最宽 12ch 并省略。8ch 保底挪到标题外层。叶宽 < 300 时透镜 tab 变图标（规范原则三已定），300–449 仍是文字。同步态不改成点。

**依据：** 原则三（标题与路径可以省略，配 tooltip）；原则八（状态常显）；可访问性方案 RWD-1。

**影响：** a01-4。实施时同刀改 lens-and-trajectory §1「仅 `.is-narrow` / `.is-compact` 收到 12ch，且允许收缩」为「不收缩」。

## D5 放不下的动作

**决定：** Files 页的 6 个标题动作放得下时常驻；放不下时从末尾收进行尾 `…`。页签文字不截断。

**依据：** 规范 §5.6「一行放不下时才收成行尾 `…`」；反模式 8（按钮文字不截断）。

**影响：** a02-1。实施时同刀改 Sources 概览里「Files 标题旁常驻」那句。

## D6 路径截断

**决定：** 父路径沿用上游 SCM 的尾部省略，不改成头部或中间省略；没有完整路径 tooltip 的行补上。

**依据：** §9（上游先对齐，不做观感微调）；原则三（路径可以省略并配 tooltip）。

**影响：** a02-4。

## D7 矮高度下的主操作

**决定：** Changes 的提交区钉在底部，不随列表滚出；列表可以缩到 0 行。Sources Part 最小高度抬到放得下标题、工具栏、单行提交区和两行列表。多行提交信息增高时列表让位。

**依据：** 原则三（主操作按钮不截断）；可访问性方案（不用滚动藏主要 CTA）。

**影响：** a02-6。

## D8 Projects 行尾

**决定：** 行尾一个固定宽度的槽：平时显示消息数，悬停、焦点或选中时同一个槽换成行动作，不重排。路径在窄侧栏照样不藏。删掉没有任何 CSS 的 `is-compact` 切换。

**依据：** navigator-tabs-access（路径窄侧栏不藏，悬停或选中时让出消息数）；规范 §5.3 Providers 行「动作始终预留空间，显隐不重排」。

**影响：** a02-10（适配审查）。Navigator 这几份 CSS 有他人未提交改动，等其提交后再改。

## D9 Navigator 打开方式

**决定：** Navigator 所有列表单击打开，Projects 树、Agents 层级树、Team 任务列表补 `openOnSingleClick`。

**依据：** navigator-tabs-access 已写「点会话行切换」「行单击 → setTarget」；相邻列表同一交互。

**影响：** r02-10。

## D10 面板内空态文案

**决定：** 筛选无结果写一行「No {items} match "{query}".」，后面一个 Clear filter 文本按钮（各列表换名词）。Team 无成员写「This session has no team members.」，无任务写「This session has no tasks.」。

**依据：** 规范 §6.1（一行 12px 弱化说明，可带一个文本按钮）、§6.4（说明为什么空、下一步做什么）。PRD-022 没有定这些字符串，不改需求；实施时同刀改 navigator-tabs-access 的空态句。

**影响：** r02-11。

## D11 行内筛选框

**决定：** 五份合成一个组件。输入 22px、`cornerRadius.small`、淡底、无常驻描边、无底部分隔线，聚焦时描边换 `focusBorder`；容器高 30px，常量从一处取。框里有字时 Escape 清空，空时 Escape 把焦点还给列表，DownArrow 进列表第一项。Enter 不打开第一项。

**依据：** 规范 §5.7（面板内小搜索框无常驻描边，聚焦按原则四出现描边）、原则五（不画装饰性分隔线）、§3.1（输入框用 small）、Sources 概览（22px）。Enter 打开第一项会在 Review 里顺手标成已审阅、在会话列表里切会话，副作用大于收益。

**影响：** r02-2、r02-5。实施时同刀改 navigator-tabs-access 的「32px、输入框描边、底部分隔」。

## D12 页签选中态

**决定：** 透镜切换、Sources 页签、Engine 首选项分类用同一套：未选弱化字、无底；悬停 `toolbar.hoverBackground`；选中 `toolbar.activeBackground` 加前景字，不加粗；高对比下选中补 `contrastActiveBorder` 下划线。

**依据：** 规范 §5.7（三处同一套选中样式，选中是中性淡底、不加粗）；原则二（颜色分层）。透镜 tab 现在也是悬停与选中同底，一并改。

**影响：** r02-6。

## D13 芯片

**决定：** Review 归属芯片常态无底无框、弱化字，悬停 `toolbar.hoverBackground`，圆角 `cornerRadius.small`，字号 `fontSize.label2`（11px），焦点按 D1。

**依据：** 原则一（芯片常态无底无框）；§3.1（芯片用 small，10px 只给计数徽标）。

**影响：** r02-4。

## D14 字号 token

**决定：** 13px → `fontSize.body1`，12px → `label1`，11px → `label2`，10px → `label3`（只给计数徽标，其余 10px 改 11px）。Sources、Navigator 与 `conversationLens.css` 各做一次整份替换，不再「改到哪段换到哪段」。

**依据：** 原则二（禁止写死 px）；§3.1。

**影响：** r02-13、r01-11。

## D15 Engine 与 Connection 首选项

**决定：** 以规范为准，不以哪一边为准：导航行 22px、`cornerRadius.small`、选中分有焦点 / 无焦点两色；设置行上下 8px；按钮用 monaco 默认高度，不强制 28px 与 `min-width: 64px`；危险按钮 400 字重；两边引用同一份 CSS。Connection 认可现行「左导航 + 窄宽 Back」形态。

**依据：** §4、原则四、原则二（字重只用 400 与 600，危险按钮不是标题）、反模式 12。规范 §10 已按「Connection 导航 22px」记账，[控件细节精修](../../dev/plans/control-detail-polish.md)已实施 Connection 返回钮，说明这个形态已被接受。

**影响：** r03-9、a03-1。实施时同刀改可访问性方案第 58、87、124 行与 D19(3) 的「Connection 单栏无左导航」。

## D16 高对比加窄屏

**决定：** 窄屏去掉详情卡的内衬与底色，但高对比主题下保留 1px `contrastBorder` 外框。

**依据：** 原则四（高对比保留对比描边）；原则九（容器有边界）。

**影响：** a03-12。

## D17 窗口与网格

**决定：**

- 窗口缩放时由 Conversation 吸收宽度变化，侧栏与右列保持宽度，直到 Conversation 到最小宽；与侧栏在哪一边无关。
- 窗口窄于各可见 Part 最小宽之和时，依次临时收起辅助栏、右列、侧栏；Conversation 不自动收起。临时收起不写入用户的显隐状态，变宽后恢复。这一条另写方案并过规则 16。
- 辅助栏最大化保留 Conversation（parts-and-grid 第 79 行），辅助栏占满其余宽度，Conversation 压到最小宽。
- 面板最大化保持合同（藏右列，Conversation 可见），改用独立标志；按 [2026-10-30 r09-1](../../dev/plans/review-2026-10-30-r09-workbench-shell-plan.md) 补齐禅模式、重载与使用方清单后实施。
- Preview 可见时关闭面板，焦点照上游回到 Preview 活动组；Preview 不可见时按 `focus()` 的顺序（对话、Sources）。

**依据：** 愿景原则 1、2（主流程在对话，中心是 Conversation）；parts-and-grid 第 77、79、83 行；§9（Preview 可见时沿用上游）。上游的编辑器居中区同样吸收缩放。

**影响：** a04-1、a04-2、a04-4、a04-5、2026-10-30 r09-5。

## D18 2026-10-30 视觉审查的待拍板项

| 项 | 决定 | 依据 |
|:---|:-----|:-----|
| V1 | A：类别开关内部横向滚动，组动作始终可见；不加溢出按钮 | 规范 §5.4、ADR-011（七个类别都在这一行） |
| V2 跨区域 | A：身份条改圆点加正常前景色说明；状态栏不再用 warning 底；设置页只留一句和一颗 Open Connection；过程折的 “1 waiting” 与 Inbox 计数保留 | 原则八（说明用前景色，语义色只给图标或圆点）、原则一（语义色不做大面积底）。实施时同刀改 [Conversation 概览](../systems/conversation/overview.md)里身份条与状态栏共用引擎芯片色调那句 |
| V2 同一张卡 | 保留权限座位的 Input needed 徽标，S2 不做 | lens-and-trajectory 写定等待态显示它，[agent-ui](../systems/chat/agent-ui.md) 复用清单点名，原则八不藏状态；规范 §10 嫌的是它的实心蓝，已改成中性淡底 |
| V3 | B：相邻回合间距回到规范 §4 的 comfortable 16px；[ChatGPT 视觉语言](../../dev/plans/chatgpt-visual-language.md) §13.1 的同轮收紧作废 | §4 是「不得更松」的上限，现在的 32px 由 `773eafd007f` 改出、没有写进规范 |
| V4 | A：用户回合的 View in trajectory 绝对定位到卡角，悬停或焦点出现，不占 24px | 原则三（密度）；§5.1（用户回合没有动作行） |
| V6 | A：产品浅色主题把 `button.secondaryBackground` 设为透明、描边前景约 12% | §5.6（次按钮低对比描边、无底）；§9（经主题对齐上游） |
| V7 | A：深色会话画布改成与 Preview 相同的 `#121314`，chrome 保持 `#191A1B` | 原则一（区域之间 2%–4% 明度差）；浅色里两块画布同为白。实施时同刀改规范 §10 与 [theming](../architecture/cross-cutting/theming.md) 的深色画布值 |
| V8 空卡 | A：未连接时分区按内容高度，不撑满 | §6.1（面板内空态不设最小高度） |
| V8 Engine 导航行 | 按 D2、D15 | 同左 |

## D19 高对比下的线型

**决定：** 键盘焦点实线，选中点线，待确认虚线，错误用错误色实线并保留 Retryable 文字徽标。

**依据：** 原则八（状态不只靠颜色）。hc-light 下 `contrastBorder` 与 `contrastActiveBorder` 都是蓝色，只能靠线型区分。

**影响：** a05-9。

## D20 代码侧

| 项 | 决定 | 依据 |
|:---|:-----|:-----|
| 2026-10-30 r08-2 | 不实施 | 上游 39f0d26deb2（#121804）有意删掉 save 透传与脏检查，回退违背 ADR-007 |
| 2026-10-30 r08-4 | 不实施，留作上游缺口 | 换授权键会让旧授权失效、要求重新授权，并与上游存储格式分叉（ADR-007） |
| 2026-10-11 r10-2 残留 | 沙箱自动批准开启时，命中拒绝规则或写到工作区外仍要确认；另写方案 | 显式拒绝规则优先，最小权限 |
| 2026-10-11 r03-4 | 不实施 | 只服务 Agents Window 的云沙箱（愿景第 35 行），且要与 github-ui 分叉（ADR-007） |
| PRD-029 | 升 `accepted` | 方案已签收，S1–S4、S6 已落地；验收 3、4 等 S5（PRD-027 P3），所以不是 `implemented` |

## D21 消息订阅 UI 的 D-1 至 D-4

| 项 | 决定 | 依据 |
|:---|:-----|:-----|
| D-1 | B：宿主 runtime sidecar，作为显式例外。只放显示事实，不参与行身份，上游有对应字段后删除；实施 U2 时另写 ADR 登记 | 原则八要求工具终态、停止原因、子代理状态常显，等上游会让这些继续被丢；[ADR-003](../../dev/decisions/003-engine-adapter-boundary.md) 让宿主做协议适配 |
| D-2 | 允许宿主写 `displayKey`；取不到时退回现行为 | renderer 仍不推断 |
| D-3 | 根页默认只画子代理卡，提供「显示全部代理」开关 | 原则二、三（层级与密度） |
| D-4 | 回合页脚只写非正常结束的原因（截断、取消、出错）；耗时只在引擎给出真实字段时写；token 留在轨迹 | 原则三（降噪）；规范 §1.1「回合没有耗时字段，不写时长」；愿景原则 3（不伪造） |
| C6 | 引擎缓存会话不再标 `Stub ·`；未结束的工具写 Incomplete。PRD-013.4 已同步改写 | Stub 表示本地夹具数据；缓存是真实的断开前快照，已有「断开前快照」提示（愿景原则 3） |
| 配对保持 | 沿用 D304：有遗留内容时 live chrome 保持 | 现有合同与测试 |
| pending | 算「回合进行中」（Stop 可用、宿主 busy），不算「正在执行」（不转圈）；实施前先确认引擎在等待权限时接受取消，不接受就维持旧行为 | 原则八（等待确认是单独的状态） |

## D22 方案归属

| 方案 | 决定 | 依据 |
|:-----|:-----|:-----|
| [browser-owner-draft-graduation](../../dev/plans/browser-owner-draft-graduation.md) | `implemented`：切片 1、2 已落地，3、4 属 Agents Window，不排期，退出条件里的动态证据不再要求 | 愿景第 35 行 |
| [ui-gap-closeout-2026-10-01](../../dev/plans/ui-gap-closeout-2026-10-01.md) | `implemented`：产品部分已落地，Agents Window 切片不计验收 | 同上 |
