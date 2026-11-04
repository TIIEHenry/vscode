---
title: "视觉语言以 ChatGPT 为主参照"
type: plan
status: accepted
phase: N/A
updated: 2026-11-04
summary: "Conversation视觉逐轮落地；2026-11-04用户修订为产品自有界面全面复刻GPT视觉与输入框，文件管理器和代码编辑器保留原版字号/行高，产品自有焦点不画焦点框描边；本计划保留历史切片与实施证据，真实窗口待验。"
---

# 视觉语言以 ChatGPT 为主参照
状态：执行中。负责：agent:codex。
签收：签，签收人：agent:codex，日期：2026-11-01。
覆盖需求：PRD-007、PRD-015、PRD-018、PRD-027、PRD-028。

## 0. 2026-11-04 用户修订

本计划的长期视觉与交互边界以 [GPT 视觉复刻与产品密度边界](../../docs/decisions/ui-gpt-visual-replication-2026-11-04.md) 和 [UI 设计原则与规范](../../docs/architecture/cross-cutting/ui-design-principles.md) 为准：产品自有界面全面复刻 GPT 的颜色、圆角、图标、输入框、菜单和 item 高度；VS Code 文件管理器与代码编辑器保留原版字号和行高；产品自有界面不画 `focusBorder`、`outline`、内描边或外圈焦点框，键盘定位改由背景、文字、图标和激活态表达。下文较早的 focusBorder、旧紧凑尺寸与取样记录保留为历史证据，不再作为当前合同。


本次菜单细节实施见 §16，近邻表面见 §15，中线/摘要见 §14，分析与原型结论见 §13；§12为首次分析交付，§10/§11保留取样前后判断与修订轨迹，不作为新的实施签收。

本次菜单细节实施见 §16，近邻表面见 §15，中线/摘要见 §14，分析与原型结论见 §13；§12为首次分析交付，§10/§11保留取样前后判断与修订轨迹，不作为新的实施签收。

需求：[PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度)（`accepted`；2026-10-21 用户选定 ChatGPT 主参照，增补验收 12）。规格：[UI 设计原则与规范](../../docs/architecture/cross-cutting/ui-design-principles.md) §1.1 换算表、原则八「状态清晰」、原则九「容器有边界」、§7 反模式 11–14。相关：[主题与 token](../../docs/architecture/cross-cutting/theming.md)、[Composer 与 Inbox](../../docs/systems/conversation/composer-and-inbox.md)、[透镜与轨迹](../../docs/systems/conversation/lens-and-trajectory.md)、[外部对话界面密度对照](../../docs/reference/external-chat-ui-density.md)。前一份观感方案是 [向 Cursor 靠齐](cursor-visual-alignment.md)（`implemented`），本稿不重做它已落的弹出层与错误态；浅色三档表面在 2026-10-22 收成两种（§3.1）。

## 1. 起因

2026-10-21 用户评审工作区里一轮未提交的「现代极简」改动，判为回退：

- 把极简做成了拿掉元素：Composer 透明边框加 6% 淡底，没有轮廓；在线绿点 `display: none`；工具完成不画勾；思考摘要隐藏、chevron 默认透明；轨迹 Overview 六类抹成同一种灰。
- 把 ChatGPT 的移动端尺寸搬进桌面：对话正文 16px、用户气泡 15px、会话列表 34px、设置页 36px 反色大按钮，聚焦是一圈 3px 暗环。
- 静态记录做了悬停变色。用户回合能点进编辑，这一处保留。

同日已在工作区把这些改回规范（未提交）：正文 13px / 1.5，Composer 20px 圆角加 10% 发丝边、聚焦加深描边，在线点、完成勾、chevron、思考摘要、轨迹七色恢复，会话列表 22px，Engine 首选项导航 22px、目录行 24px。用户随后要求视觉以 ChatGPT 为主参照整体设计，并写进规范。

用户对 ChatGPT 的理解是 Deference（内容为主）和 Clarity（状态清晰），这和 Apple HIG 的说法一致。本稿据此写设计，不照搬尺寸。

## 2. 参照基线

| 项 | 来源 | 可信度 |
|----|------|--------|
| 画布 `rgb(252,252,252)`、字 `rgb(13,13,13)`、Composer 高 48px / 圆角 28px / 0.5px 边 / 淡投影、输入 16px / 24px、侧栏行 44px / 16px 字 / 16px 圆角 | [外部对照 §2](../../docs/reference/external-chat-ui-density.md#chatgpt)，2026-10-15，未登录，500px 视口 | 实测，但不是桌面宽度，也没有登录后的线程 |
| 用户回合靠右浅灰填充、助手无头像、消息下方动作行、思考一行加 chevron、代码块语言与复制头、回到底部圆钮 | 公开界面观察 | 结构可信，尺寸未测 |
| 深色梯度 | 未取样 | 无 |

没有实测的尺寸不写进规范的数值列。14px、12px、行高 1.75、阅读列 768px 都不在 2026-10-15 的实测里，已从换算表删掉。O1 已于 2026-10-21 选定并有源码实现，不再以 S0 为前置；S0 只支撑新的外部尺寸/主题推导。

## 3. 设计

总的换算规则写在 [UI 设计原则 §1.1](../../docs/architecture/cross-cutting/ui-design-principles.md#11-chatgpt-到桌面的换算)：结构、层级、比例照取，尺寸换成本仓 token。下面按表面写落点。

### 3.1 色调与表面

- 2026-10-22 用户判定 ChatGPT 配色比 Cursor 好看，浅色改成 ChatGPT 的两种表面：chrome `#F6F6F6`，画布 `conversation.background` 与浮层（菜单、编辑器浮件、Quick Input、通知）`#FFFFFF`。Composer 与用户回合卡已有细边，白底上靠描边分层，不再靠第三种底色。深色不动（S5）。
- 主按钮与发送钮近黑（深色近白）。强调色只给焦点、选中、链接、进度。
- 深色梯度见 S5：先取 ChatGPT 深色的画布、侧栏、抬起表面三档，只在明度阶差不足时改产品主题，组件不写 hex。

### 3.2 对话阅读面

- 正文 13px / 1.5，阅读列最大 720px，助手回合直接起排，不加头像和标签。720px 是上限，不代表分组后实际可用宽度，后续按 §10 核对。
- 用户回合：靠右、不超过 82%、`cornerRadius.large`、输入框底色加 8% 细边、悬停反馈、点卡编辑（2026-10-21 用户选定）。O1 已选定保持细边卡，不再把无边气泡作为待决项。当前回合编辑将同一张 Composer 放到该用户行，保留 Exit、输入与发送，底栏不跟入、不留第二输入；队列编辑仍在列底，以 [Composer 规格](../../docs/systems/conversation/composer-and-inbox.md) 为准。
- 助手回合动作行：`.conversation-lens-turn-actions`（复制、重新生成、删除、在轨迹中查看）在正文下方一行，左对齐，幽灵图标 16px、命中 22px、间距 2px。最新一条在正文流里常显。更早的绝对定位，不占行高，悬停或焦点时叠在回合下方的间距里。
- 代码块：加头部。左侧语言名（11px 弱化字），右侧复制幽灵图标钮；头部比代码区深一档，中间不画线；容器 `cornerRadius.medium` 加 8% 描边。只动对话正文里的 Markdown 代码块，不动过程折里的 Diff 块（它们已有文件名头）。
- 过程折：chevron 常驻，摘要可见，`Stub ·` 前缀只在没有引擎时出现。工具行状态图标常显。不加思考微光动画。
- 回到底部：沿用现有 Scroll to Bottom 圆钮。浅色与深色都有 8% 发丝边和 `widget.shadow` 投影；高对比改为对比描边、不投影。鼠标点击不画环，键盘焦点是 1px `focusBorder`。

### 3.3 Composer

- 20px 圆角、10% 发丝边、极淡投影；聚焦描边加深到约 20%，投影深一档。
- 进行中空稿的输入仍是一行 32px。工具、权限、模型在下面的底栏，模型名在底栏里截断。底栏 28px、控件 24px、发送 24px。
- 左下角按钮的图标见 O3，草稿字号见 O4。
- 生成中的 Stop 留在 Inbox 右簇，不与发送合并（2026-09-28 用户确认，不在本稿重议）。

### 3.4 列表与设置页

- 侧栏和列表只取 ChatGPT 的「标题一行、整行淡底悬停、当前项中性底」，行高仍是 22px（导航）/ 24px（目录、弹出层）。
- 2026-10-22 工作区：会话列表当前项去掉左侧竖线，选中用列表自己的背景。行图标按等待确认、进行中、失败区分，空闲仍是对话图标。有 `lastAccessedAt` 时副标题改成相对时间，待确认计数保留。悬停卡片列出项目目录、时间和消息数。行尾 `···` 打开原来的右键菜单。有最后访问时间的会话按今天、昨天、更早分组，组头不可选；都没有时间时列表保持平铺。过程折收起时摘要带失败和等待计数，头部在进行中或失败时有图标。
- Connection 首选项、设备列表、设置编辑器页签按 §4 与 §5.6 收回（S2）。

### 3.5 状态元素清单（原则八）

| 状态 | 落点 | 当前工作区 |
|------|------|------------|
| 引擎在线 / 离线 / 失败 | 身份条引擎芯片前静态圆点 | 已改回，在线点可见 |
| 工具进行中 / 完成 / 失败 / 取消 | 过程折工具行图标，接通时加文字后缀 | 已改回，完成画勾 |
| 思考可展开、流式中 | chevron 常驻，摘要可见，`· Loading` | 已改回 |
| 轨迹类型 | Overview 七色加形状 | 已改回 |
| 等待确认 | 权限座位，Inbox 待确认链接色 | 未改动 |

## 4. 底线（本稿不得突破）

- §4 密度上限：导航 22px，目录与弹出层 24px，标题条不高于 28px，Composer 底栏不高于 28px，对话正文 13px。
- PRD-015：Composer 控件是加上下文、Tools、Permission、空会话才有的 Agent、Model、放大输入、发送；PreFirst 草稿至少两行；Stop 不与发送合并。
- PRD-007：没有引擎时不画假完成、假进度；`Stub ·` 前缀保留。
- PRD-018 / 原则四：键盘焦点始终可见，鼠标点击不强制焦点环。
- PRD-027 / ADR-011：Preview 七类别条不改。
- PRD-028 验收 9：不复制 ChatGPT 的商标、图标与像素级外观。
- 原则七：除发送钮外按压不形变；过渡只作用于颜色与透明度，不超过 100ms；不加循环动画。

## 5. 已选定（2026-10-21）

用户按推荐选定了 O1、O2、O4。O3 先按「图标必须对得上功能」否掉了把 Tool options 画成「+」。随后用户说明 ChatGPT 和 Cursor 的「+」是加附件或加上下文，本仓也要这条，工具按钮另放。于是「+」只加已经能随消息提交的会话引用，不假装能上传文件。

| # | 选定 | 写回 |
|---|------|------|
| O1 | 用户回合保持细边卡片（8px 圆角、输入框底色、8% 描边、悬停反馈）。这是 Cursor 的输入卡片，不是 ChatGPT 的无边填充气泡 | 原则 §5.1、§3.2 |
| O2 | 最新一条助手回合的动作行常显，更早的悬停或焦点才出现。按钮只有复制、重新生成、删除、在轨迹中查看 | 原则三、§5.1、§1.1。动作行在正文下方 |
| O3 | 「+」是加上下文：列出会话，选中后成为引用芯片。Tool options 用 `tools` 图标，跟 Permission、Model 排在一起。不画文件上传 | PRD-015 依赖段、Composer 规格、`conversationLensDock.ts`、`conversationComposerAt.ts` |
| O4 | 草稿 13px、行高 20px，与正文相同。空会话输入区仍至少 52px | Composer 规格、外部对照 §4、`conversationLens.css` |

Cursor 一起留下的是布局，不是它的按钮清单：用户回合像输入卡片，进行中空稿收成一行，Model 留在输入栏，侧栏 22px，过程折是动词加对象。ChatGPT 留下的是阅读：助手正文直接起排，发丝边输入框，最新一条动作行常显，状态不悬停也看得见。

不画的对方控件：麦克风、赞、踩、朗读、分享、导出，以及任何会把 Stop 并进发送钮的做法。本仓多出来的、必须留在明处的：Permission（Ask / Agent / Permit）、空会话才有的 Agent、在轨迹中查看、删除回合、Inbox 的 Stop / Goal / 队列、放大输入。完整对照表在 [UI 设计原则 §5.2](../../docs/architecture/cross-cutting/ui-design-principles.md)。

## 6. 切片

S1–S4 保留 2026-10-21/22 的实施切片与当时工作区/HEAD 对照，不把其中 HEAD 数值视作今天基线；当前事实与下一步见 §10。

| 切片 | 内容 | 文件 | 依赖 |
|------|------|------|------|
| S0 | 登录后 ChatGPT 线程，桌面宽 1440px 与 1024px、浅色与深色，记用户回合、动作行、思考行、代码块、Composer、回到底部钮、弹出层、深色三档的计算样式与截图。只在外部对照追加新的一节，不改写 2026-10-15 的实测段。PRD-028 的改动来自 2026-10-21 的选定，不来自那份对照 | `docs/reference/external-chat-ui-density.md` | 需要用户提供登录会话或截图 |
| S1 | 锁住原则八：CSS 扫描断言在线点在线态可见、chevron 常态不透明、思考摘要不 `display: none`、Overview 七类颜色互不相同、Composer 聚焦规则无 `0 0 0 3px`、正文 13px；单测断言完成态 `.codicon-check`。工作区已锁这些项，另加代码块描边，以及最新动作行占正文流而更早的不占。`conversationLens.css` 里超过 100ms 的 `0.12s` / `0.15s` 过渡已收到 100ms | `conversationLensCssScan.test.ts`、`conversationProcessFold.test.ts`、`conversationIdentityStrip.test.ts` | 无 |
| S2 | Connection 首选项导航 22px，按钮和输入框回到 monaco 默认高度与 `cornerRadius.small`，去掉 `!important` 反色主按钮，标题 18px，字段标签 12px，说明 `fontSize.label1`；设备行 24px。设置编辑器页签是上游 CSS（`preferencesEditor.css` 文件头是 Microsoft 版权），原则 §9 与本稿 §8 不改，§4 的编辑器 tab 仍沿用上游。工作区：导航 22px（HEAD 是 28px，不是 34px），输入框和 Engine 测试钮是 `cornerRadius.small`，私网允许是复选框，Provider 当时启用标记只读且回到 34×20（历史）；2026-10-26 已改为 Configured / Enabled / Disabled 只读文字，窄行自然增高，见 §10。设备行 CSS 在 HEAD 已是 24px，变的是 `HubDevicesDelegate` 从 36px 收到 24px。状态条、配对框、环境提示和目录横幅回到 `cornerRadius.small`，待配对行回到 `cornerRadius.xSmall` | `connectionPreferencesPane.css`、`connectionDeviceList.css`、`connectionPreferencesPane.ts`（行高常量，如有）、扫描测试 | 无 |
| S3 | 草稿 13px / 行高 20px。「+」加会话上下文，Tool options 用 `tools` 图标并与 Permission、Model 同排。工作区已改。单行输入区仍是 32px 高 | `conversationLens.css`、`conversationLensDock.ts`、`conversationComposerAt.ts`、`conversationLens.test.ts` | 已选定 |
| S4 | 代码块头；动作行在正文下方，最新一条在正文流里常显，更早的不占行高。用户回合保持细边卡片。工作区已改。最新一条的类由时间线宿主打在 article 上；渲染器只把动作行接到正文后面 | `conversationTimelineHost.ts`、`conversationTimelineItemHost.ts`、`conversationTimelineRenderer.ts`、`conversationLens.css`、`conversationLens.test.ts` | 已选定。不依赖 S0 |
| S5 | 深色三档对照；只在阶差不足时改产品主题 | `extensions/theme-defaults/themes/universe-agent-studio-dark.json`、`theming.md` | S0 |
| S6 | 当前产品验证（§7），与外部取样分开：不必等待 S0/S5 才验证现有产品 | — | 按已变化的 S1–S4；S5 有变化后单独补验 |

S1 与 S2 文件不重叠，可以并行。S3 与 S4 都改 `conversationLens.css`，串行或由同一工位做。

## 7. 验证

- 本轮只分析与取证：第一阶段静态/文档核对见 §10，续轮隔离窗口取样见 §11；未编译共享输出、未重跑产品套件、未启动或刷新用户日常窗口。
- 后续实施按 [health-gates](../progress/health-gates.md) 选最小关联检查。CSS 扫描只证明规则存在；交互改动补组件行为测试；实际视觉、焦点、宽度必须由对应运行界面验证。记录源码 SHA/dirty diff、输出摘要、主题 include 链、窗口/叶宽、缩放、状态与输入方式。
- 2026-10-21 的 123 条类型错误、14 条 Lens 失败与 SessionsView 缺 roster 事件仅是历史基线，不再作为当前已知红项。2026-10-24 [迭代记录](../progress/status.md) 已记 Lens 146 passing、SessionsView 43 passing；2026-10-27 后续定向结果也只适用于各自来源/范围。没有本轮复验时不声称当前全仓通过或仍有同数错误；可疑失败需在匹配 HEAD 复现再归因。
- 按 [Agents 测试配置](../../docs/guides/test-profile.md) 启动默认编辑器窗口，浅色与深色各截：PreFirst、进行中会话（单行与两行 Composer、聚焦与未聚焦）、含思考与工具的回合（进行中与完成）、代码块、轨迹 Overview、Engine 与 Connection 首选项。
- 不悬停走一遍原则八的状态清单；键盘 Tab 走一遍焦点；叶宽小于 450px 看截断。

## 8. 不做

- 不改密度上限，不引入 13px 与 18px 之间的新字号。
- 不加思考微光、流式文字淡入、呼吸灯等循环动画。
- 不合并 Stop 与发送。
- 不改上游组件 CSS（§9），上游只经主题对齐。
- 不复制 ChatGPT 的图标、商标、字体。

## 9. 审查

2026-10-21 用 Grok 做了只读审查（规则 16）。没有 Critical。Important 已改入本稿和规范：更早的动作行改为绝对定位，不再占行高；§10 改成工作区事实（代码块头和最新动作行已落地，导航是 22px 不是 34px）；§7 不再把已改的四个测试文件写成与 HEAD 一致。

2026-10-22 第二次只读审查没有 Critical。Important：S4 把最新助手标记写成 `conversationTimelineRenderer.ts`，该类实际由 `conversationTimelineHost.ts` 传给 `conversationTimelineItemHost.ts`，渲染器只追加动作行。文件列已改。Minor：原则 §10 的表头仍写 HEAD，2026-10-21 新增行写的是工作区；已在该节标明。方案仍是 `draft`。O1–O4 已选定。S0、S5 未做。


## 10. 2026-10-27 静态分析检查点（取样前）

本轮只分析默认编辑器窗口，`src/vs/sessions/` 不纳入产品视觉验收。维持 ChatGPT 的内容与状态层次、Cursor 的空间布局、IDE 的密度；不扩大字号，不删除状态，不重议 O1–O4。以下是待评估优化，不构成新的需求签收或实施完成。

### 10.1 证据与边界

| 类别 | 本轮核对内容 | 能说明什么 / 不能说明什么 |
| --- | --- | --- |
| 当前源码 | `extensions/theme-defaults/themes/universe-agent-studio-light.json`：chrome `#F6F6F6`、Conversation `#FFFFFF`、主按钮 `#1F1F1F`；产品深色 Conversation `#191A1B`、主按钮 `#F3F3F3`；`dark_modern.json` 中近白主按钮是现有 WIP | 主题声明事实；实际合成色、继承链和边界对比需运行测量。浅色方向已有，不再提“整套重做配色” |
| 当前源码 | `conversationLens.css`：正文 13px/1.5；H1 `heading2` 18px，H2–H6 `heading3` 13px，均 600；代码 13px/1.55；Composer 圆角 20px、草稿 13px/20px；用户卡正文在用户回合祖先下由更高特异性选择器约束 `fit-content` / `max-width: 82%`，同一元素的通用规则为 100%；最新助手动作在流内常显，旧动作绝对定位后悬停/焦点显露 | 通用 100% 并非最终计算值；须核对选择器优先级，不能推断成内外两层或误报 82% 失效。H2–H6 同字号符合既定 token，不能仅据此判排版失败；长文层次仍需代表内容 |
| 当前规格/源码 WIP | [UI 规范 §5.1](../../docs/architecture/cross-cutting/ui-design-principles.md#51-对话阅读面conversation-时间线) 和 Composer 规格已选定行内回合编辑；只读 Agent 限定隐藏 select chevron；上下文菜单有消息数等副信息 | 后续评审按当前合同，不采用通用技能中“编辑永远留在底部”的默认偏好。工作区实现不是当前运行输出已刷新证明 |
| 已有组件运行证据 | [2026-10-26 verification](../progress/default-editor-visual-state-followup-evidence/verification.md)：350 Electron、14 Chrome 原生焦点项，状态对比、选择色、Provider 文字与几何 | 该来源的组件/CSS/行为证据；明确未连真引擎、不是完整窗口实拍，也没有完整产品主题 include 链。不能替代 S0/S5 |
| 已有后续修复 | [当前迭代记录](../progress/status.md)：D1380 未知 Stub 状态与 D1381 Provider 碰撞已后修闭合；[Provider 方案](provider-status-row-layout.md) 与 UI §4/§5.6 允许窄行按 24px 轨自然增高，动作预留 22px 命中区 | 10/26 [825 checkpoint](../progress/ui-visual-review-2026-10-26-evidence/825-merge-visual-review.md) 的两项 Important 是当时发现，不能照抄成今天仍 open；宽行 24px 不等于所有窄行固定 24px |
| 已有本地图片与测量 | 本轮查看 `.build/visual-review-20261027/conversation/stable-vs-1440.png`、`stable-vs-dark-1024.png`、`.build/visual-review-20261027/after.png`；读取 `stable-matrix.json` 和 `readonly-chevron.json` | 前两张含 Stub 内容且右侧 settings.json 显示异常内容，后一张是 Session unavailable 局部验证；不把取样fixture当典型成品窗口。chevron 记录只读 block→none，Permission/Model 仍 block、盒尺寸不变；这些是既有运行产物，无本轮源码/输出绑定，不能宣称当前完整视觉通过。原图保留本地，不提交 |

本轮没有获取新的登录后 ChatGPT 样本，也未重新运行产品；S0 与 S5 保持未做。10/15 外部尺寸仅作历史参照。特殊多组测试截图只用于提出空间分配假设，不当作正常默认布局的缺陷证据。

### 10.2 优化顺序与最小切片

| 优先级 / 切片 | 问题与依据 | 建议机制与取舍 | 最小验收与退出条件 |
| --- | --- | --- | --- |
| P0 / V0 绑定基线 | 工作区有大量 WIP，旧文档、组件证据和旧窗口来源不同；未经绑定会把已修问题重提或把局部通过扩大为整体验收 | 先记录来源与产物一致性，用同一内容状态建立当前窗口浅/深、1440/1024基线；沿用已有证据目录与验证指南，不另造一套规范 | 对所有拟修改点有 before 截图、计算样式/盒测量及来源清单；无法绑定的点只保留为假设。只读分析可先完成，不为补样本扰动日常窗口 |
| P1 / V1 有效阅读宽度 | 最大720px并不能保证叶宽；多分组、空 Preview/编辑区占宽时，阅读与底栏容易被压缩。特殊旧测试状态支持调查方向，尚未证明正常布局存在问题 | 先检查正常单组、双组与有/无成品时的空间预算，再决定是否在现有布局机制中调整比例/最小宽或折叠策略；不为视觉统一新增固定栏，也不扩大字体补偿空间 | 分别记录窗口宽、Conversation叶宽/阅读列宽、Preview/Sources占宽、Composer各控件盒；常用操作文字不截断，状态可辨，键盘可达。若正常配置无问题则不改；空区收缩不得破坏用户手动分组与恢复合同 |
| P1 / V2 阅读节奏 | H2–H6目前同13px/600，短Stub内容无法证明长回答的分段是否清楚；既有fixture图片又有用户→过程→回答→权限卡的较大块间空隙。可能同时存在段内层次弱、块间归组散，不能笼统判“太紧”。代码、列表、引用和回合间距的叠加比单个字号更可能改变阅读负担，属待验证假设 | 用现有13/18 heading token、400/600字重、段前后距和局部对齐比较；按内容归组分配留白，既比较过密也比较过散，不整体增加间距。优先调整层次节奏而非增加字号。避免同时把所有容器加边/加投影 | 同一中英长回答覆盖H1/H2/H3、嵌套列表、长路径、表格、代码块，720与窄阅读列对照。保留代码横滚、复制头、链接与语义；浅深/HC可读。没出现清晰收益就保持现状，不虚构效率提升 |
| P2 / V3 状态主次与阅读起点 | 已有Stub截图中同一“待确认”分布于过程折、权限座位、Inbox；身份条与底栏也有连接/不可用提示。可能增加扫描噪声，但它们有不同导航与操作职责 | 先列明每处状态的对象、责任和下一步。权限座位保留对象及Allow/Skip，Inbox保留计数入口，过程折保留步骤结果；只考虑缩短重复解释和层级差，不删除状态/入口，不把运行时不可用当静态不支持隐藏 | 不悬停能分辨离线、会话未就绪、进行中、失败、取消、等待确认；从Inbox定位权限座位并操作，快速切换/恢复无旧状态。若涉及提示归属或行为变化，先更新对应PRD/规格后另开实施，不在视觉CSS中改状态源 |
| P2 / V4 边界与动作细节 | 白画布已有细边；最新动作常显、旧动作悬浮契约已定；只读chevron是已修局部问题 | 检查用户卡/代码块/Composer边界是否清楚、旧动作是否遮住相邻回合，菜单标题/副信息是否抢主项；只用现有token与颜色/透明度反馈，不重复实施已有修复 | 浅深/HC、键盘Tab、旧动作悬停、窄列、长同名会话菜单；盒不碰撞、焦点可见、只读无伪选择线索。历史组件通过不代替当前完整窗口此项 |
| P3 / V5 深色层次与外部取样 | S0登录桌面样本缺失；当前深色已有中性主按钮，不能写成深色完全未适配 | 产品自身先验证画布/chrome/抬起表面可辨与对比；只有拟从ChatGPT推导新的深色阶差时才依赖S0，再进入S5。外部登录不可用不阻塞V1–V4 | 产品深色与Dark Modern分别标主题；比较实际合成色与控件边界，HC另走对比描边；有来源数据且存在实际缺口才提主题token改动，不在组件写hex |

推荐下一刀是 V0 后的 V1：先确认空间分配，再用同一内容判断 V2。V3 涉及状态职责，不能借降噪直接删除；V4 只修新的运行反例；V5 不阻塞本地产品优化。上述切片均未实施；当时方案继续 `draft`，不提升 PRD-028。

### 10.3 第一阶段检查与审查

第一阶段改动仅此方案；未改产品代码、未提交。`check-docs-health.py` 为 0 errors / 37 既有 warnings，目标 `git diff --check` 通过；未改目录结构、方案状态与生成列，无需更新索引或生成状态。规则16已派独立只读 reviewer：Critical 0、Important 1、Minor 1；Important 经核对 `conversationLens.css` 用户回合选择器和 renderer 后改入，纠正 82%/100% 是同一元素的特异性覆盖，并保留运行计算值待验；Minor 已将证据节标题改为“证据与边界”。审查结论为修正后可接受，当时方案仍 `draft`。已核对现有源码、主题声明、规格和上述本地图片；未做新的运行、引擎链路、登录外部对照或用户效率测量。


## 11. V0/V1/V2 运行取样（2026-10-27）

[证据checkpoint](../progress/ui-visual-review-2026-10-26-evidence/20261027-reading-checkpoint.md) 保留来源、20组矩阵、测量与复现入口；原始截图留在本地 `.build/visual-v0-v2-20261027/`。使用独立空profile和虚拟显示、真实默认编辑器及产品Light/Dark完整主题链；最终进程用现有 `UNIVERSE_AGENT_HOME` 指向空目录，确认无引擎连接。仅注入内存中英长回答fixture，无CSS覆盖、无消息发送或写RPC。

V0已为本次取样建立关键范围绑定：四份源码/输出做内存转译对照、七份CDP已加载JS（含四份关键Conversation文件与布局模块）与out摘要一致、Lens CSS源/out/实际加载恢复字节一致；没有刷新共享输出，也不冒称全量构建/类型检查通过。主题include链、DPR1/scale1、原生1440/1024×1000、所有时间线scrollTop0均有记录。独立fresh1200×800对照为Part752/右列400；矩阵宽度沿用此分配，未拖sash，不能称每种窗口的独立初始默认比例。

| 前轮假设 | 实证与修订 | 后续优先级 |
| --- | --- | --- |
| V1：空Preview可能占用阅读预算 | 单组正文696px；双组每叶正文342px（Part752、叶376、阅读容器366）。Preview空/有未命名编辑器/仅隐藏Preview均不改变宽度，因为Sources仍保留右列。隐藏整个右列后，1440窗口正文每叶662px，1024为454px。没有测到布局越界或需自动折叠的反例 | 由“先改布局”收为现有布局开关的发现性与真实任务取舍评估；不自动改比例/折叠，不强制叶宽450。Part最低450不等于每叶最低450 |
| V2：H2–H6同13px可能削弱长文层次 | 本fixture的H1/H2/H3、段落、列表、代码头与表格可辨；计算正文13/19.5、H1为18/24.3、H2/H3为13/17.55，标题靠600及段前后距区分。窄列增加换行与代码横滚，容器仍稳定 | 撤回“同字号本身就是缺陷”与整体放大字号方向。本轮没有证据支持普遍加间距。保留混合思考/工具/权限与更深标题的节奏假设，不立即开排版实施 |
| 旧短Stub图块间过散 | 长回答fixture没有相同混合过程构成，无法用该图证明或否定过程/权限与回答之间的归组问题 | V3仍待任务场景取样；不能删待确认/取消等状态换取简洁 |

本阶段未证实需要立即实施的视觉缺陷；后续混合状态补样与最终方向已在 §12 收口。本阶段建议优先补真实任务反馈（用户是否能发现右列开关、何时需要并置材料与双会话），以及确有需求时的混合过程阅读样本；不为扩大覆盖继续跑全面UI测试。S0登录后ChatGPT对照和S5外部深色取样仍未做；现有产品深色实拍不冒充外部取样完成。当时方案继续 `draft`，PRD-028不升。

续轮规则16独立只读审查为 Critical 0 / Important 0 / Minor 1；Minor已清理来源JSON的探索性比较标签并说明最终static-block选项。docs-health 0 errors / 37既有warnings，目标diff-check通过。[清理记录](../progress/ui-visual-review-2026-10-26-evidence/20261027-reading-source.json) 确认仅关闭自有临时profile窗口及Xvfb，旧PID1444798仍存活。未提交、未修改产品代码。


## 12. 持续分析最终方向与交付边界

本次分析完成V0–V5中可独立核验的部分：关键来源绑定、20组长文布局取样、5组混合状态、标题栏开关与动作边界审查、已有产品深色证据汇总。[证据报告](../progress/ui-visual-review-2026-10-26-evidence/20261027-reading-checkpoint.md#混合状态与操作边界补样v3v5) 与 [混合测量](../progress/ui-visual-review-2026-10-26-evidence/20261027-reading-mixed.json) 留出真实流式、离屏定位、用户研究和外部登录样本的边界。取样未触发引擎任务、权限答复或产品写文件动作，只更新隔离fixture与本主题分析/证据。

| 分类 | 结论与下一步 |
| --- | --- |
| 本轮证实的问题 | 没有证实需立刻修复的产品视觉缺陷。已修正文档过时、CSS特异性误读与证据来源不匹配；不能把它们包装成产品UI回归。普通双叶窄、代码横滚、摘要截断属于空间取舍，样本中关键内容与动作仍可达 |
| 首选设计试验 C1 | 同一回合内“过程→回答→权限”的归组节奏。现样本工具末端→回答约50px，回答正文末端→权限卡约72px（包含最新动作行），与跨回合旧回答→下一用户卡约74px接近。未来比较现状A与仅收紧组内间距的B，使用现有token，保持组间节奏、13px字号、状态/边界与动作命中区。以实际turn/既有timeline身份判同回合，不靠CSS相邻关系猜业务归属；用相同内容的正常/窄叶、展开/收起、浅深截图与键盘路径验证。若不更清楚或动作碰撞/显拥挤，撤回B。当前只提出方向，未决定新间距数值 |
| 次选设计试验 C2 | 窄叶过程摘要的结果优先文案。现有实现已保住 `1 waiting` / `1 failed` / `1 cancelled`，完整ARIA也在，不是可访问性缺陷。可比较步骤数+结果计数与现有动词对象串，完整工具信息保留在既有详情/提示和可访问名称，不加面板、不删状态、不抬行高；实施前按PRD/规格顺序审查摘要合同。若识别具体工具更困难则保持现状 |
| 应保留现状 | 正文13px/1.5、现有heading token、细边用户卡和20px Composer；最新动作常显/旧动作hover或focus出现；状态不靠悬停；权限座位对象+Allow/Skip、Inbox计数定位、过程结果的不同职责；现有布局开关与中性浅深主题。五场景旧动作94×24px且与下一item无相交；聚焦/Tab可显露；不需要为美观删除入口 |
| 需要真实任务反馈 | 标题栏Conversation/Preview/Sources各22px常显，ARIA/tooltip有名称与Ctrl+Shift+Alt+C/P/S，F1命令也已注册。因此不先判“入口藏太深”；控件存在不等于用户能发现。是否需要布局预设、更多可见文字、改变默认比例，应由真实双会话/并置材料任务反馈决定，不冒称已经完成用户研究 |
| 后续证据与实现验收 | 无引擎fixture的running/pending不渲染live spinner/Cancel，符合showLiveChrome约束；真实流式强制展开/取消、目标离屏时Inbox定位仍未运行验收。本轮产品深色有真实样本，但S0登录后ChatGPT及S5外部深色未做；HC/所有合成对比度也未新增量化。它们属于未来相关实现的验收，不阻塞本次分析交付，也不升PRD |

V3样本验证了状态呈现的职责分离与混合阅读的可用基线；C1/C2是明确场景、可回滚、带退出条件的审美试验，不因当前无功能bug就取消优化方向。未来实施另走需求/规格与实施检查；当时本稿仍 `draft`；现已签收为 `accepted`，不把“本次分析完成”误写成“所有切片已实施”或PRD-028完成。

最终规则16独立只读审查为 Critical 0 / Important 0 / Minor 0；reviewer实际查看混合浅深窄叶截图并核对五组JSON与盒间距离。文档健康0 errors / 37既有warnings，主题差异检查通过。自有Electron与Xvfb已清理，旧进程及既有引擎保持，见来源JSON的 `mixedCheckpoint.cleanup`。本次持续分析及Sol文档更新交付完成；产品方案随后已签收为 `accepted`；C1/C2尚未实施，未提交。


## 13. C1/C2 A/B原型结论与具体候选方案

续轮目标是把§12建议变成可评审对照，本轮不进入生产实现。[A/B证据](../progress/ui-visual-review-2026-10-26-evidence/20261027-reading-checkpoint.md#c1c2-单候选ab原型2026-10-27续轮) / [26项矩阵与检查](../progress/ui-visual-review-2026-10-26-evidence/20261027-reading-ab.json) 记录A、单一C1-B、单一C2-B、来源及限制。重新核对当前WIP，两CSS仍与out和前轮摘要相同；没有把前轮事实直接当今天运行结果。

### 13.1 推荐C1-B的视觉目标，保留实施前身份门槛

问题是同一轮过程、结论、权限之间的停顿接近跨轮停顿。候选B只将**明确同轮的过程根与回答根**的article margin-bottom从当前32px换为现有 `spacing.size120`（12px），即过程→回答、回答→权限两处；用户卡后24px和其他跨轮32px外间距不变。正文13px/1.5、标题token、权限卡样式、动作行及命中区不动，不新增框、分区或状态源。

实测展开工具内容末端→回答由50px变30px，回答正文末端→权限卡由72px变52px（原动作行仍占流），跨轮旧回答→下一user卡保持74px。浅深、正常/窄、展开/收起对照显示B更像连续的一轮工作，仍有清楚停顿；旧动作没有覆盖下一项，键盘Tab与按钮尺寸保留。推荐B作为后续实现的视觉目标，代价是组内留白减少；这是主观视觉判断加几何证据，不是效率提升测量。

**身份合同不可省略**：本次只使用fixture侧显式round关系表与精确root ID，绝不从CSS邻居推断同轮。fixture投影没有保留输入turnId，当前TimelineItem/HostRoot也未公开覆盖过程/回答/权限的统一round合同，不能直接搬原型data属性进产品。实施前须先在admitted frame/既有会话身份中确定可靠的presentation group及其来源；不确定、混合根、迟到权限或代理归属冲突时保持A。不得用“最近user之后都算同轮”替代此合同。

后续最小实施方案须满足：

1. 先在正式模型/投影层定义并验证组身份与边类型，再由 `conversationTimelineHost.ts` / `conversationTimelineItemHost.ts` 将经过判定的组内边投影为样式类；CSS只消费该类并引用12px token，不管业务归属。`conversationTimelineTypes.ts` 等是否需要扩展以合同评审结果为准，不提前承诺新协议/RPC。
2. 仅在有可靠同组的相邻**已排序roots**时赋“组内连续”边；顺序、组身份、权限归属任一不符即保留A间距。最后一条、跨组、被裁剪后的未知上文不压缩。多个assistant消息、一个fold含混合归属、并行子代理/多个permission必须作为反例测试，不能凭本fixture视作已覆盖。
3. §13.1的12px是推荐视觉值，不改变其他32/24px默认节奏。新增/删除/流式更新/展开/行内编辑/分页prepend/会话切换后重新计算边标记，复用现有timeline身份与reconcile，不写第二份状态；离线缓存缺身份按A。
4. 真正实施前按PRD→规格→方案顺序更新间距/归组合同，并完成规则16；实施后再验角色/状态/焦点、旧动作不相交、权限完整、窄叶与HC/reduced-motion及真实流式。当前原型没有覆盖这些未来实施条件，不能直接作为合入证据。

本段为已可评审的具体视觉候选与实施约束；组身份来源尚待正式合同决策，因此**不直接进入产品改码**。

### 13.2 否决本次C2-B，维持当前摘要

C2-B将可见步骤串缩为 `Stub · 4 steps`，waiting/failed/cancelled计数保留，完整ARIA/提示和展开工具对象保留；没有改计数、状态源或工具语义。但当前自适应布局下结果计数落入第二行，header从23.39px增到46.78px；浅深/正常窄/展收及失败取消反例一致，不满足不抬行高。并且折叠时少了对象线索。否决该单候选，不在本轮追加CSS补丁或第二文案；保留A的摘要与完整ARIA。

若未来用户反馈主要痛点是定位结果而非具体工具，再单独设计一行宽度预算与文案合同；那是另一个方案，不把本次失败原型包装成可实施优化。

### 13.3 交付与可见对照

本次交付是A/B视觉原型和推荐/否决结论，未改产品代码、未刷新共享输出、未连接引擎、未提交。图片在本地 `/home/clarence/Projects/Agents/vscode/.build/visual-ab-20261027/`：浅色正常展开 `light-normal-expanded-A.png` / `light-normal-expanded-C1-B.png`；深色窄收起 `dark-narrow-collapsed-A.png` / `dark-narrow-collapsed-C1-B.png`；C2否决 `dark-narrow-collapsed-C2-B.png`。来源与复现探针在上述证据链接，不把临时覆盖当生产修复。

本轮规则16独立只读审查 Critical 0 / Important 0 / Minor 1；Minor已据矩阵纠正动作按钮22×22px与旧动作行容器94×24px的区别，不将容器高度称按钮命中区。reviewer实际查看A/C1-B/C2-B三图并核26记录。docs-health 0 errors / 37既有warnings，主题diff-check通过；自有Electron/Xvfb已清理，旧PID1444798仍存活，原型style/标签/摘要已先恢复A，见source JSON `abCheckpoint`。当时方案仍 `draft`；现已签收为 `accepted`，PRD-028不升，未提交。


## 14. 默认编辑器细节实现：底栏中线与过程摘要行（2026-10-27）

本轮已授权实际细节优化。范围限Conversation的两个CSS修正，C1同轮身份/大布局、C2失败原型、引擎/权限/只读语义均不进入实施。基于现有全部WIP追加，不覆盖已改样式。

### 14.1 实测问题与修改

| 项 | 当前测量 | 修改与边界 | 验收 |
| --- | --- | --- | --- |
| Composer控件中线 | add/tune/send图标按钮24×24，但block宿主包inline-flex后有基线尾隙，盒高25.203px；permission/model仍24px，中心比图标低约0.594px，底栏33.203px | 仅三个宿主 `.conversation-lens-dock-add` / `-tune` / `-send` 设display:flex/align-items:center，去掉匿名行盒尾隙。按钮24px、16px字形、select24px、leading的padding4/margin-4和按钮伪元素上下扩命中保持；More本就只在窄叶display:flex，不改显隐 | 浅深正常/窄叶中可见底栏控件中心差≤0.1px；三个宿主24px、按钮/select原尺寸；底栏正常32px、窄叶不增高，键盘焦点和hit test正常；More宽时隐藏、窄时可用 |
| 过程摘要整数节奏 | 12px字×1.45=17.4px行盒，加上下3px padding形成23.3906px点击行，chevron16px居中但处于小数像素 | header/thinking-header行高改1.5（当前12px字号计算18px），仍12px字、相同padding/gap、摘要/结果计数/完整ARIA。单行变24px，居中16px图标，两侧各4px视觉空间；长状态允许既有自然换行，不强制高度裁剪 | 相同内容浅深正常/窄叶默认密度单行24px；既有compact上下padding2px时为22px；失败/取消/待确认文字完整，展开/收起与Enter可达；24px是单行，不以高度上限掩盖长状态/本地化 |

顶部工具栏tab/标题/图标钮的中心实测均48.5px，保留现状。底栏root codicon计算字号16px；既有后代 `.dock-control .codicon {font-size:13px}` 未匹配这些根按钮，不通过全局替字面数值假装改进。

### 14.2 实施与最小验证

先规则16只读审查本节，再只改 `conversationLens.css` 两处规则。CSS已有其他WIP，实施前后核对仅追加本节内容。无需行为/状态TS改动；这类可逆局部CSS不新增只镜像实现的测试。补PreFirst与turnEdit共用Composer检查。运行已有 `conversationLensCssScan` 定向套件，针对本轮变更做stylelint基线对照；真实隔离默认窗口浅/深×正常/窄记录before/after截图、computed盒、中线、焦点、elementFromPoint命中。刷新仅该CSS输出时持编译锁并记录源/out/实际加载摘要，不把单CSS刷新写成全量构建通过。

视觉验收不改产品密度上限、不强制所有控件高度相等；本轮只消除inline基线的无意义尾隙、给摘要单行确定整数节奏。未连接引擎的fixture不渲染live spinner，仍保留此前边界。实际结果、规范/status与证据在实施后按diff补写；不提交。

本节实施前规则16只读审查：Critical 0 / Important 0 / Minor 2。Minor已对齐单位行高1.5、默认24px/compact22px与补PreFirst/turnEdit取样。reviewer确认窄叶add/tune隐藏优先级、More独立显隐及leading命中扩展不受这两处规则影响。


### 14.3 实际落地与验证

两处CSS已在原WIP基础追加，独立差异仅line-height1.45→1.5与三个宿主flex居中。[实施证据](../progress/ui-visual-review-2026-10-26-evidence/20261027-detail-verification.md) / [测量与来源](../progress/ui-visual-review-2026-10-26-evidence/20261027-detail-results.json)。浅深正常752px/窄375.5px下控件中心差0.59375→0px、宿主25.203→24px、底栏正常33.203→32px/窄29.203→28px、摘要23.39→24px；PreFirst只读Agent和行内turnEdit共用Composer已取样，More/摘要键盘焦点及扩展命中保持。compact局部class检查22px，没有完整HC或真引擎验收。

已有扫描改前/后都39 passing / 2既有failing，定向stylelint前后同15变量提示/179建议、exit0；不称全绿、不扩修旧断言。未新增镜像实现的测试，未跑全仓编译。顶部中心已一致不改、root图标本来16px不改、C1/C2保持原型结论。UI规范已只补本轮实际对齐/单行节奏，PRD与方案总状态不升，未提交。

实施收尾独立只读复核 Critical 0 / Important 0 / Minor 0；本轮独立CSS差异、几何/焦点/命中与测试边界可接受。docs-health 0 errors / 37既有warnings，主题diff-check通过；status179行。自有Electron/Xvfb已清理，旧PID1444798仍存活，记录见detail-results的cleanup。


## 15. 近邻表面细节：引用删除命中与助手动作按压（2026-10-27）

本轮核消息卡、代码头、助手动作与引用芯片，前轮§14两项保持。真实Add context菜单选Comparison leaf产生引用，删除钮实际16×16px、hover透明，芯片高26px；代码Copy已22×22px、16px字形、语言与图标中心协调、focus内描1px未被overflow裁剪。助手动作hover稳定后为rgba(0,0,0,0.12)，按下180ms后仍相同，尽管active token为#d6d6d8；源码`:active`非important被基础透明/后续hover important覆盖。

### 15.1 两个候选与保留项

- **引用删除**：仅 `.conversation-composer-ref-remove` 改22×22px并保留16px关闭字形；不缩小flex、small圆角、补中性hover/active及focus-visible内描，HC保留2px强焦点并内描，用contrastActiveBorder回退focusBorder。芯片高26px不增加，宽度预算多6px。before长名窄叶实测chip334px、anchor350px（content-box宽另加padding），remove右439px越过叶右424px；因此本候选同时仅给 `.conversation-composer-ref-chip > a` 加min-width:0和单行省略（沿用content-box，避免把min-height22+padding4的26px卡压成22px），链接为不缩小的22px删除钮让位，保完整DOM/ARIA/托管hover，不影响正文pill；after必须核无横溢/移除对象可辨。删除仍走原有事件/模型逻辑，不改链接导航、删除身份或对话提交。
- **动作按压**：不重写现有ghost基础important（其同时约束Button通用样式），仅把active规则置于hover后，同级important恢复activeBackground，显式排除aria-disabled/原生disabled。hover/focus/selected状态不改，不缩放不位移；禁用态不能借按压出现可点击反馈。评估过移除基础important，但它会扩大到所有Button基底层叠，超出本轮，故保留当前保证并局部补足同级优先级。
- **保留**：用户卡内边距/82%边界、代码头语言8px与代码正文16px的层次、复制22px与内描焦点、助手动作22px命中/旧动作显隐均无本轮需改反例，不为了数字不同去统一。

### 15.2 实施前门禁与验收

本节先规则16只读审查，再改CSS，不动TS状态语义。before/after使用同一正常752px叶/窄375.5px叶、浅深主题，补HC深/浅窄叶反例。记录ref remove按钮/芯片盒、长名资源、hover/active/focus、代码边界、旧动作无碰撞；删除通过真实按钮完成本地draft引用移除、核不触发会话导航。动作press测试按住后移出再释放，不实际复制/重生成/删除。已有扫描与stylelint对照原基线，必要关联行为套件只跑相关面，不扩修旧失败；隔离输出仅此CSS刷新并核实际加载，清理自有窗口。不提交。

§15实施前只读审查：首轮C0/I0；长名反例补审提出border-box压缩26px高度的Important，已实测并撤回border-box，仅保留min-width:0和省略规则，最终C0/I0/M0后进入实施。


### 15.3 实际落地与结果

两项已在生产CSS追加。[实施证据](../progress/ui-visual-review-2026-10-26-evidence/20261027-nearby-verification.md) / [前后数据与独立diff](../progress/ui-visual-review-2026-10-26-evidence/20261027-nearby-results.json)。窄叶chip334×26，删除钮before16px且右439越叶424，after22px且右403留在chip内；链接308×26省略、chip/row无横溢，正常宽只多6px、芯片仍26高。只加min-width:0和省略，**没有border-box**。六场景浅深正常/窄和HC窄焦点/命中已验；点击删除一次使引用0但会话/可见叶不变。

助手hover不变，press浅色rgb214/214/216、深色rgba255255255/0.2已区分；aria-disabled+强制active反例保持透明/pointer-none/.4，仅证明样式排除，不冒称能力恢复验证。代码头/消息卡/正文引用已协调项保持。扫描前后同39过2既有失败，stylelint前后15变量/179建议、exit0，无新增；未全编译、不提升PRD、不提交。

§15实施后独立只读复核 Critical 0 / Important 0 / Minor 0，reviewer查看窄引用前后、HC焦点与pressed图；docs-health 0 errors / 37既有warnings，主题diff-check通过。自有Electron/Xvfb已清、旧PID1444798仍在；无额外关联业务套件，本次真实删除实测覆盖本地引用行为。未提交，生产其他WIP保留。


## 16. 自定义菜单细节：键盘定位与标题/副信息层级（2026-10-27）

真实断连fixture检查Add context、窄叶More及History/Tools可用入口，不伪造注册模型或权限写入。Add context 280px宽、24px行，标题/消息数目前同12px；规范§5.5要求名称13px/说明12px，未查到本类菜单已签12px例外。HC Dark中实际Tab到Add item后focus-visible为true，但outline none、透明底且无边，用户无法定位焦点；现有同组More行也清outline。

### 16.1 两项实现与保留范围

1. **显式键盘定位**：仅Add option与More启用item的focus-visible补1px focusBorder内描；HC用2px contrastActiveBorder回退focusBorder、offset -2px。排除原生disabled与aria-disabled，保持hover/已选check/禁用原因与颜色。菜单不是整行选中态替代，focus描边仅在键盘聚焦时出现。搜索输入已通过focusBorder边表达焦点，先保留。
2. **规范内的文字层级**：Add/More行名称从12px改为 `fontSize.body1` 13px；Add meta显式 `fontSize.label1` 12px，行高仍24px、容器尺寸/间距/标题meta flex截断不改。More Agent只读note保持12px。最长标题与大消息数的真实本地fixture对比盒、左右预算和完整title/ARIA，若新字号致操作不可达则回退/收窄，不放大整个产品字体。

More当前真实宽约209px，正常文字未越窗，缺少真实长Agent条件时不通过伪造引擎去证明溢出，也不盲加新宽度。当前Ask check为正确✓，保留；History断连只读空/不可用内容、Model/Permission不可用均如实显示，不启用它们来造测试。菜单行中线/24px命中、Add标题省略与消息数同行已有规则，保留。

### 16.2 验收与门禁

规则16预审后只改CSS两类样式，不碰菜单事件/状态TS。用一个隔离窗口，正常752/窄375.5叶的产品浅/深，以及HC深/浅窄叶，对同一十条本地session（含长标题/长消息数）取before/after：真实Add菜单和filter、More真实启用项焦点/disabled菜单项、菜单盒位于viewport、行24px、title13/meta12、文本/计数可省略但完整提示保留。窄叶从More→Add真实入口进入；More Esc关闭与触发器焦点核对，History/Tools只读内容归档保留理由。

现有扫描/stylelint对照，不扩修既有失败；仅本CSS锁内输出刷新并绑定实际加载，不编译全仓，不提交。前轮§14/§15产品改动与其他WIP原样保留。

§16实施前规则16只读审查 Critical 0 / Important 0 / Minor 0；确认名称13/meta12符合当前§5.5，focus-visible规则必须位于清outline的hover/focus规则之后，HC用主题根类与内描避免overflow裁剪。


### 16.3 实际落地与后续边界

两项CSS已落地。[证据](../progress/ui-visual-review-2026-10-26-evidence/20261027-popup-verification.md) / [前后数据与独立diff](../progress/ui-visual-review-2026-10-26-evidence/20261027-popup-results.json)。六个浅深正常/窄与HC窄场景：Add/More普通1px、HC2px内描明确可见；名称13/meta12，所有行仍24px，Add280×314.203尺寸前后相同；长标题/大消息数仍独立省略、不相交、完整title保留，搜索返回仍1项，菜单在viewport内。禁用权限项、More只读note、正确Ask check、Tools/History断连说明和原生不可用选择器保持。

扫描前后同39过2既有失败，stylelint变量提示同15、token建议179→178，exit0；未全编译、不扩业务套件、不提升PRD、不提交。实际进入菜单项后Esc焦点回BODY的独立行为缺口已定位：ComposerAt约92–97/174、ComposerChrome的registerPopupEscape约183–191及More约363/415只close/清句柄，未按dismiss原因恢复owner。下一切片先审“Esc恢复实际触发器、动作打开子层不抢焦点、失效owner合法回退”合同再补行为测试；本轮未把它混入CSS实现，也不将History既有返回通过扩大为所有菜单返回通过。

§16实施后独立只读复核 Critical 0 / Important 0 / Minor 0；reviewer核HC前后/普通与More截图、独立diff及验证边界。docs-health 0 errors / 37既有warnings，主题diff-check通过，status181行。自有Electron/Xvfb已清、旧PID1444798仍活，source结果JSON保留cleanup；未提交、全部其他WIP保留。


## 17. 菜单 Esc 返回实际触发器（2026-10-27）

§16真实菜单内焦点Esc后落BODY，是本轮唯一修复目标。PRD-018验收4与Composer系统规格先补小合同，不提升整体需求状态。

### 17.1 实施合同与边界

复用就近 `conversationContextViewEvent.ts` 放一个小型Composer弹层Esc注册函数，供Add/More/Tools三处调用，替换现有重复close-only监听；不建全局focus manager。打开时捕获实际anchor、绑定session，Esc同步close后比较绑定未换，再返回可连接、可见、启用的原anchor；原anchor隐藏/销毁时仅尝试当前同host输入框。输入框也不可用则不强行设焦点。窄More→Add/Tools回More，不回隐藏Add/Tools；关闭路径不把owner跨会话缓存。

仅Esc callback恢复，不在onHide统一恢复；点击菜单动作、切换下级、Preferences、外点关闭仍交给原动作处理。保留现有document capture监听与标准KeyCode归一，不改Tab/焦点进入策略，不改引擎/权限/密度/视觉CSS。

### 17.2 最小验证

先新增实际DOM菜单行为回归，真实聚焦搜索框/菜单项后Esc，改前确认失败再实施。覆盖Add输入与item、More item、窄More→Add/Tools实际owner、动作和Preferences不抢焦点、owner隐藏/销毁同host输入回退、session切换不跳旧owner。测试用本地fixture或测试桩，不伪造生产注册模型/引擎写入。

规则16预审后实施；锁内仅刷新受影响TS输出并记录来源，定向lint/types与浏览器测试，不跑全仓。复用隔离默认窗口真实正常Add和窄More→Add（浅/深代表），焦点确实先进入弹层才Esc；记录before/after焦点与必要截图，不再做视觉矩阵。清理仅自有窗口，保留全部WIP，不提交。

§17实施前规则16只读审查 Critical 0 / Important 0 / Minor 0；已核合同与测试边界，按真实可见/连接、原生disabled与aria-disabled四项判断owner可用性。

### 17.3 实际落地与验证

三TS中的Esc监听已实现小型共享助手，onHide/动作逻辑不变；新增`test/browser/conversationComposerPopup.test.ts`九项真实DOM回归。[实施证据](../progress/ui-visual-review-2026-10-26-evidence/20261027-popup-escape-verification.md) / [来源与焦点结果](../progress/ui-visual-review-2026-10-26-evidence/20261027-popup-escape-results.json)。红1过8败→当前路径9过，正常浅1440/752叶、窄深1024/375.5叶的真实菜单内Tab→Esc分别回Add/More，窄More→Add回More；before均BODY。三模块runtime fetch/output/current源码转换摘要相等。仅锁内局部输出刷新，不称全编译。

定向types0（仓库选项加测试assert所需Node ambient），ESLint3条均本轮前已有Chrome querySelector/HTMLSelectElement警告，新增helper/测试无诊断；无CSS变化不重复视觉扫描。Tools/Preferences用真实点击handler的单测桩验证目的地，未向生产注入工具注册/未验真引擎；会话切换与失效owner边界由回归覆盖。2026-10-28恢复核验并收尾，未提交。

§17实施后独立只读复核 Critical 0 / Important 0 / Minor 0，核实际diff、红绿与runtime摘要及窄深More焦点图；docs-health 0 errors / 37既有warnings、主题diff-check通过，status182行。自有Electron1250410/Xvfb1239847已核身份清理且均退出，其他WIP原样保留，不提交。


## 19. 会话列表与SessionBar：可见焦点和compact标题预算（2026-10-28）

本轮实际取样：SessionBar标题focus-visible=true却outline none，因`:focus`的important压过`:focus-visible`。正常/375.5叶可见，约293px双叶（1024且Sessions侧栏打开）title-wrap宽0、按钮仍Tab可达且鼠标受tabs/controls拦截。只修焦点环不能称修复零宽问题。列表行22px、More22px且focus可见；长名与副信息分别省略，待确认铃常显、完整计数在hover，选中色沿用近期修复，不重复修改。

### 19.1 两项候选与边界

1. 标题button的focus-visible与现有focus none统一优先级：普通1px内描，HC保持现有SessionBar同类1px主题focusBorder内描；不改字号/高度/hover/按压。
2. 仅<300 compact两透镜标签改24px语义图标（Conversation commentDiscussion，Trajectory listTree，与轨迹入口相同）。`mountLensTablist`添加默认隐藏的aria-hidden图标span，原DOM文本保留，增加完整title/aria-label；compact字号0仅视觉隐藏文本，图标16px，padding0/width24；>=300样式和文本宽度不变。原选中、Arrow键与tabIndex不改。临时DOM/CSS原型已使同一compact主/次叶title-wrap 0→91.5/65.5px，保留标题与原改名输入；需生产after再次证实，不能靠原型签收。

不新增菜单改名/隐藏tabs/删Tab目标，不更改引擎与状态。PRD-018验收5与Composer系统合同先落，规则16审后实现两处局部CSS+图标装饰，不建新布局系统。编辑器tablist与leafbar共用mounter，作用范围由part.conversation/is-compact限定；无副作用只声明取样覆盖。

### 19.2 验收

一个隔离空profile/空engine-home窗口；浅正常752、深窄375.5、HC窄及真实compact293px反例，记录实际叶宽、title/wrap与input、24px图标命中、元素中心与未遮挡；真实Tab焦点、Enter进入改名、Esc不写、左右Arrow切换选中再返回，tooltip完整名称，完整ARIA不重复图标朗读。改名前后几何/截图与>=300保持对照；列表选中/hover/More焦点与长状态保留覆盖。最小现有SessionBar单测/定向CSS扫描与lint/types，锁内只刷新本TS/CSS输出并绑定来源，不全编译、保留其他WIP，清自有窗口。


§19实施前规则16只读审查 Critical 0 / Important 0 / Minor 0；原型只支持方向，生产after必须再证实改名输入、无重复朗读名称与>=300不受影响。

§19验收补充（收尾最后一项）：真实Arrow未切换，根因mounter传原生KeyboardEvent而projection比较归一化KeyCode；旧测试也伪造归一化DOM keyCode。仅该handler改用event.key的ArrowLeft/ArrowRight/Home/End，更新原用例为真实key/keyCode，并核焦点/选中往返。属于本轮compact键盘承诺的必要收口，不扩其他键盘监听。补只读小审后实施。

键盘补审 Critical 0 / Important 0 / Minor 1；Minor编号归属已移回§19。按原生event.key实现四键，不改选择/焦点状态机。


### 19.3 实际落地

两项视觉改动与必要原生四键收口已落地。[证据](../progress/ui-visual-review-2026-10-26-evidence/20261028-sessionbar-verification.md) / [来源与结果](../progress/ui-visual-review-2026-10-26-evidence/20261028-sessionbar-results.json)。原生标题焦点none→1px，compact292.5叶title-wrap0→91.5（次叶65.5）、input91.5且鼠标命中true；真实Enter/Esc、ArrowRight/Left往返选中焦点通过，title/ARIA完整、装饰图标aria-hidden；>=300保留文字。列表原22px行/More焦点、截断/待确认铃和hover信息保留，不改颜色/状态。

SessionBar13过，原生键旧用例改真实DOM键后红0/1→绿1；扫描前后39过2旧失败；四文件定向types0，ESLint bar/test0、projection/Lens.test仅既有重复import警告1且命令非零。锁内两TS/CSS输出刷新，source/output/runtime摘要相等，不称全编译。读屏/真引擎未验，限上述隔离fixture取样。


§19实施后独立只读复核 Critical 0 / Important 0 / Minor 0；docs-health 0 errors/37既有warnings，定向diff-check通过。自有Electron323987/Xvfb323931已核身份退出，无新任务。


## 18. 收尾：行内 Composer 实例归属（2026-10-28）

行内编辑现有 WIP 曾把 Composer DOM 放进 Renderer 模块全局指针，A/B 同时编辑后，A 重画可能把 B 的输入节点搬入 A。独立 Astra 确认为本 WIP Important 阻断；依既有每叶一张输入与上下文归属合同，收尾改沿 Chrome → TimelineHost → Renderer 实例链提供 Composer：`setEditingTurnId(turnId, composer?)` 在重画前登记本 Renderer，退出/queueEdit/dispose 只清自己的引用，不加全局 Map 或服务，不改协议与保存语义。

新增真实双 TimelineHost 同 turnId 的生产组件回归，经双方真实内容 patch 触发用户行重建，核 DOM 对象归属与每叶一张输入；A 退出及销毁后 B 仍只持有自己的节点。它是组件测试，不能写成双 Lens 默认窗口实拍，也不证明“编辑中直接销毁”与真实引擎退订。原单叶 XOR / Chrome 放置 / 发送门闩继续保留。最小代价为三生产调用链和一测试文件的实例归属调整，无迁移、无新设置。

本条窄修复已获独立设计/源码审查，当前尚未运行；最终来源、实际定向结果及限制由[本次收尾证据](../progress/session-closeout-2026-10-28-evidence/README.md)记录。本条尚未运行；全视觉方案已签收为 `accepted`，PRD 不升。

## 20. Navigator 与会话列表中性选中态（2026-11-01）

状态：已实施，整体视觉方案已签收为 `accepted`，仍保持草案中的未实施切片边界。

默认编辑器窗口的 Projects、Agents、Team 与 Sessions 列表收拢到 ChatGPT 主参照的近白表面语言：列表行使用 `cornerRadius.medium`，悬停使用前景色约 5% 的淡底，选中使用约 9% 的中性整行底色，按压再加深到约 12%。Projects 的工作目录行使用更清楚的文件夹层级，会话行保留缩进，当前会话按同一中性胶囊渲染；行尾 Open / Delete / New session 操作保持原语义并收成轻量图标按钮。Projects 的活动会话不再画左侧蓝色竖条，状态图标、待确认计数、键盘焦点和 22/24px 密度保持不变。规则只落在自有 Navigator/Conversation CSS，不调整上游 Activity Bar 尺寸或 Sessions 窗口壳。

本轮验证范围：定向 stylelint、`git diff --check` 与源码级 CSS contract 检查。定向 test-node 在加载测试套前被缺少 `@parcel/watcher-linux-x64-glibc` 阻塞；未启动默认窗口、未做浅深主题实拍、未运行全仓编译。若后续实拍发现深色对比不足，沿主题 token 调整表面，不把移动端的大行高搬入桌面。

## 签收复核（agent:kiro，2026-11-01）

本稿已由 agent:codex 整篇签成 `accepted`。agent:kiro 受用户委托做同一轮签收审查，结论：签（收窄）。

- 排除 §20。它对应的 CSS 还没提交，没过规则 16 只读审查，也没有实拍；行圆角改成 `cornerRadius-medium`、当前会话行改成 `cornerRadius-large`，与 [ui-design-principles](../../docs/architecture/cross-cutting/ui-design-principles.md) §3.1（行悬停底用 `cornerRadius.small`，large 只给浮层与用户回合卡）和 §1.1 侧栏一行冲突；保留的 `0.12s` 过渡超过原则七的 100ms。按 DOCUMENTATION 规则 16，未审的部分不能标成签收完成。
- 排除 §13 的 C1-B（前提「同轮组身份合同」未定）与 C2-B（已否决），它们是原型结论，不是实施承诺。
- 签收覆盖 S1–S4、§14–§19 的已落地部分（`773eafd007f`、`0d5a910b6f0`、`ae8297add7f`、`1246e0ca354`）。S0、S5 等用户提供登录取样；S6 剩下的验证见 §12。
- 文字待修：summary 仍写「未提交」、updated 曾是 10-28；文首一句重复了两次；§18 排在 §19 后；§18 写「当前尚未运行」已过时。PRD-028 已是 `accepted`，不改状态。

agent:codex 的签收行原样保留，等用户决定。

## 按设计原则的决定（2026-11-01）

用户委托 agent:kiro 按设计原则决定上面复核留下的项，依据见 [审查待定项决定](../../docs/decisions/ui-review-decisions-2026-11-01.md)。

- §20：不按现稿提交。按 D2 改：Navigator 与会话列表的悬停、选中走主题 `list.*` 颜色，行圆角 `cornerRadius.small`，过渡不超过 100ms，当前会话用标题 600 字重、不画竖条。由 §20 的作者改完对应 CSS 后补一次规则 16 只读审查。
- §13.1 的 C1-B（同轮 12px）：作废。相邻回合间距按 D18 的 V3 回到规范 §4 的 16px。
- 其余按上面「签收复核」：S1–S4、§14–§19 签收，S0、S5 等外部取样。

## 21. 2026-11-02 用户修订：会话列表舒展尺度

本节覆盖 §3.4、§4、§8 对 Sessions / Projects 的紧凑上限；其余既定行为不变。以用户附件为视觉参考，不把截图缩放后的像素声称为实测 CSS。

- Sessions / Projects：虚拟列表 delegate 与 CSS 同步改为 40px；组头同轨，项目组头 52px（上方 12px 留白，内部 40px 行轨；包括第一组），其它行 40px。行内左右 12px、圆角 xLarge（12px），按钮 28px、图标 16px。窄栏维持高度，长标题省略并保留提示。
- Sessions 空闲重复会话图标不占位；进行中、失败、等待确认图标仍常显。Projects 空闲会话图标去掉，项目文件夹、展开箭头保留。
- Projects 行尾由 Open / Delete 两个图标改为一个更多按钮，菜单复用原动作与禁用原因、删除确认；当前工作目录 New Session 保留，不新增钉住。Sessions 沿用已有更多菜单，调整命中区。更多在 hover / focused / focus-within 显露，选中但未交互时保留时间。
- 键盘沿用列表键盘导航与菜单机制；右键和键盘上下文菜单也接相同动作。主题颜色与高对比焦点保留，不改 Sessions 产品入口。
- 只修改这两个列表，先跑定向 compile / eslint 与现有行样式、Projects / Sessions 测试；将旧行高断言明确改成 40px，圆角 medium 改为 xLarge。实际窗口尚未复验时不宣称像素复刻完成。

审查：同会话只读 reviewer C0/I3，已核验并纳入：Projects 新增 tree.onContextMenu，更多入口始终可展开，禁用原因在菜单动作中可读；菜单捕获打开时的 sessionId，行回收不能改写目标，动作执行时再次核对连接。Esc 关闭菜单返回列表。

明确替换：conversationSessionsView.test.ts 普通/compact 22px → 40px；navigatorProjectsList.test.ts workdir 24px → 52px（含组前12px）；navigatorProjectsListCss.test.ts medium → xLarge。Projects 原按钮测试改为展开菜单后验证 Open/Delete 及禁用原因。保留 list 主题色与高对比焦点，不用硬编码灰色覆盖主题。实施：执行中。

实现窄复核（2026-11-02）：review_list_plan C0/I1，旧菜单跨连接归属意见已采纳：捕获 engineIdentityId / linkId / 连接修订，执行时失配拒绝；新增同ID旧菜单连接变化回归。Minor 采纳：只在取消菜单且视图可见时主动恢复列表焦点。

本轮实施记录：本地验证：最新两个组件测试88 passing / 5 pending，Projects CSS检查3 passing，定向ESLint 0 errors（Sessions相关3 warnings）。compile-client曾于本轮19:33通过；末轮重跑仅在其它并发WIP engineToolsSection.ts:177报 Toggle 缺inputActiveOptionForeground，当前组合树编译未通过，未修改该文件。docs-health/wiki check无错误。实际默认窗口视觉/键盘复验未完成，未提交。

## 22. 默认窗口视觉续补：按 UA 功能适配 GPT

状态：执行中；本节为用户要求继续的实施范围，待规则16只读审查后开代码。

- 活动栏：仅Modern UI标准档从36px行/列改为48px，维持8px纵向组距，图标24px；选中/hover底为居中的40px圆角矩形，12px圆角。compact显式设置保留。badge、溢出、拖动提示、四区域与Accounts/Manage入口不变；JS尺寸与CSS共用变量。
- 侧栏：沿用产品浅灰主题与上一节40px列表；不改成GPT功能导航。列表右侧菜单/状态保留；不改Sources/工程树的密度。
- 阅读区：在Conversation区域声明800px共享宽度变量；时间线正文、身份条、陈旧快照说明、空会话hero、Composer外框同列居中，窄叶16px内衬。不改变时间线测量/滚动、Tray/Trajectory布局。
- 空会话：添加本地化标题“What would you like to work on?”作为非交互heading，身份/工作目录依旧在输入上方，避免CSS order造成键盘顺序变化；空会话不画假对话。
- Composer：单一卡片与原移动/行内编辑生命周期不变。20px圆角与细边、柔和阴影；文本左内衬16px。底栏44px，图标/发送/select命中32px，图标16px，左侧上下文/Tools/Permission/可选Agent，右侧Model/发送。窄叶底栏允许按DOM顺序换行，不缩小按钮；模型长名截断带原tooltip。输入至少两行/活动空稿单行/放大逻辑不变。
- UA功能约束：Stop、Goal和队列留在Inbox，权限/工具/模型不可用与离线原因保留，Permit警告保留；不加麦克风/插件/钉住，无引擎仍诚实降级。仅改变视觉，不改RPC和会话归属。
- 断言更新点名：conversationLensCssScan.test.ts 的 Composer bar28→44、send24→32、cluster内衬与宽度改为共享变量；activitybarPart.test.ts Modern UI标准静态期望36→48。原UA行为断言保留。
- 验证：compile-client、定向eslint；activitybarPart、conversationLens、Composer chrome、行样式测试；隔离默认编辑器窗口截图，浅/深、窄/宽、键盘焦点。通过.launch技能创建临时配置，不连真实引擎，不拿无引擎截图冒充真实引擎验收。已发现/tmp空间不足，改用/sdd/tmp临时目录，失败临时副本已清理。

审查：review_list_plan只读审查C0/I3，已核验采纳。宽度仅白名单：timeline-content/stream、pinned-user-inner/pinned-inner、identity、stale、hero、composer、gate/inbox及回到底部定位；Trajectory list/body的720px保留。800px指外框border-box，标准横向内衬16px。底栏44px是min-height，leading/trailing同步自动增高/换行，清除末尾narrow/compact固定24px及overflow-y:hidden限制；293px叶宽、Permit/长模型组合须检查。活动栏compact设置仍为28px行（floating列28px）；Modern UI compact仅收间距/lane，标准activityBar尺寸仍48px，不误认为同一设置。新增heading不参与active/行内编辑，最大化时隐藏标题。

补充：SessionBar及part级region-chrome同步40px，lens tab32px、标题操作28px；CSS flex与ResizeObserver负责内容再布局。History/Snapshots/Trajectory/隐藏入口保留。相关测试旧标题28px/tab24px断言依次改为40/32，仅Conversation作用域，不动Sources/Engine tabs。

实施：执行中。

§22补充核验：默认窗口实测Modern UI关闭，因此同一产品样式文件为非Modern UI标准活动栏补同样4px内缩/12px圆角选中底；不强制开启实验开关。显式compact维持原行列尺寸。组件断言补充点名：conversationLens.test.ts T2 bottomBarMinHeight28→44、sendHeight24→32，与DockStrings导出控件高度32一致；activitybarPart.test.ts stride标准44→56、Modern UI紧凑密度40→52（含原间距）。Session controls宿主32px/overflow visible修正只读实现复核I1裁切，28px按钮完整显示。阻碍组合编译的Engine Tools Toggle缺参数仅补inputActiveOptionForeground，不改其并发实现。

## 23. 用户纠偏：高度过大（2026-11-02）

状态：执行中。用户指出上一版高度太大，本节优先于§21/§22尺寸。Sessions/Projects行40→32px，项目组52→44px（仍含12px组前留白），行尾28px保持；Conversation标题40→36px，tab32保持（紧凑宽也32），标题操作28与宿主32保持。Composer按钮/select/发送32→28px，底栏min-height44→36px，内衬4px 12px（总高至少36），卡片顶8px、内间距8px；活动空稿输入32px保留，空会话输入52px保留，正常空会话约106px。只读Agent长原因单行截断、full title/aria保留，并允许宿主收缩；中宽度leading不再因原因文本换成两行，真实窄叶仍可换行。800px共享列、主题、功能/状态、菜单、UA保存和权限门控不变。

明确断言同步：Sessions两个行高40→32；Projects组高52→44；Lens T2 min-height44→36/send32→28/DockStrings32→28；Lens CSS scan同项同步。ActivityBar48标准行列不扩大。要检验窄叶无横向溢出、原因可读与焦点命中完整。待同会话只读核验后执行。

§23规则16只读审查review_list_plan C0/I1已核验采纳：leading/trailing最小高度32→28，Permission/Agent/Model宿主24→28；只读Agent宿主min-width0/flex-shrink允许，span单行省略、title与aria不丢。总高106仅估算，以实测为准。实施：执行中。

## 24. 同屏参考图与用户明确范围：列表行

状态：执行中。用户补图并明确回答「列表行太高」。本轮继续收紧仅限列表：Sessions/Projects 30px行，项目组42px（含12px组前留白），28px行尾命中保留，13px标题字号不缩小；32px行是中间稿。输入区保持§23当前实现，不再因这条反馈继续缩小。row delegate/CSS/普通与compact断言同步30，Projects组高断言42。参考图用于视觉比例，不声称实测对方CSS。

## 25. 同屏差异全部修复与 Terra 对比审查

状态：执行中。用户指出上一轮不像，要求全部修复，并在修复完成后由Terra对比审查。

- Sessions/Projects：标题14px局部导航变量，30px行保留，8px列表外留白、12px行内衬、12px圆角。delegate/layout宽度与CSS外留白同步减16px，窄栏不溢出；列表hover为前景2.5%、选中4%，高对比走主题与焦点线。
- Sessions标题起排；尾部紧凑状态：waiting铃铛+数字、running转圈、failed错误常显；idle无图标，有访问时间时仅短时间。不再渲染No messages/完整消息数，已有hover与ARIA继续完整。More未显示时不预留28px空位，hover或真正键盘focus时出现；状态不因此消失。日期分组保留，组头42px含12px留白，非选择项。
- Projects保留真实工作目录分组与树折叠。可见组标题去重复current session后缀（用已有workDirGroupLabel(path,false)，底层label/ARIA不变），路径在原title/ARIA可查。会话消息数详情不占标题；通过真实roster的tone/pending渲染尾部状态，生命周期与原菜单归属检查不变。组头42px内部30px，文件夹16px；父子缩进控制为12px，沿用tree组件，不手绘假项目或把Sessions强改项目组。
- 仅Sessions/Projects所在侧栏title取消大写样式，18px半粗标题；搜索保留原功能、正常14px字。浅色产品sidebar背景FAFAFA，主区白，活动栏仍F6F6F6；其余主题用token，不把来源/失败状态抹成灰。
- 活动栏标准项48→44px步距、图标24→20px、选中底36×36居中（Modern UI标准也44、gap0）。栏宽仍48；两个compact概念保留：显式activity compact仍28px/16图标，Modern UI compact仅保留紧间距。JS composite/overflow/badge预算同步，产品CSS内实现，不改业务图标含义，也不复制GPT专有图标。
- 不再调整Composer高度；此前UA上下文/工具/权限/模型、独立Stop/Goal/队列、引擎与工作根身份条保持。
- 明确更新测试：Sessions No messages/1 message可见副标题→空可见副标题但ARIA/hover保留；projection count测试转验证ARIA计数随详情刷新、可见pending数仍1；compact用ARIA区分同名项。Activitybar标准actionHeight48→44/icon24→20，Modern stride56→44、compact-density52→48，其它维度依原公式。Projects CSS检查路径仍有title、状态常显且hover不隐藏、外边距预算一致。
- 完成代码与本地验证后，开启指定`gpt-6.1-terra`只读对比审查：原参考图`/tmp/codex-clipboard-847e2988-7306-4621-9d95-5af8255f288b.png`、原GPT其它参考与新1440/1024浅深实拍、实际尺寸、源码diff。审查关注比例/状态/操作，Critical/Important修复并复审。不把无引擎取样写成真引擎验收。

规则16方案只读审查：待完成，未开始代码。

§25规则16只读审查C0/I1已采纳：Sessions header delegate42px/session30px，layoutList回退按entry逐条求和，不按条数乘固定高度；补至少两组日期偏移/末行可达测试。More用列表focus-visible+focused行或按钮focus-within，不用focused独立常驻；CSS容器外留白缩宽一次，layoutBody按outerwidth减16，layoutList按已缩小clientWidth直用。状态回idle清空计数与glyph。实施开始。

§25测试合同补充：Projects compact可见workdir名从“live · current session”改为“live”，title继续包含完整旧标签/路径；行操作测试改按完整title找到工作目录，不再假定可见文本包含旧后缀。日期组DOM/末行回归已过。

§25实际盒修正：Projects原twistie将深度计入padding（根30px、子38px），现保留原生indent span的实测深度，但让其参与flex并将twistie固定16px，避免重复计入。原生折叠/键盘行为保留；组头42px的12px空白移至row外padding，内部标签明确30px，消除42px继承line-height裁切。菜单展开时保持More锚点可见，取消恢复列表焦点，避免渐进显示改动导致菜单锚点消失。

Terra首次完成后对比审查（gpt-6.1-terra，只读）：Critical0/Important0/Minor1，确认Sessions排版/活动栏比例与状态/菜单保持；不称像素复刻，真实引擎组与运行失败目视未验。Minor采纳：Local folders路径也不占行内标题，原资源title与树ARIA保留；追加真实240px侧栏截图后交Terra复核。

## 26. 输入卡整体验证与视觉修复（2026-11-02）

状态：执行中。用户补上UA/下GPT输入框同屏图，指出视觉相差很大。本节不重开已完成的导航修正，Terra在输入修复完成后一并复审。

- 卡片：20→24px局部圆角；普通描边前景8%（当前10%），聚焦10%（当前20%），保留1px细边与HC强边。阴影改为低透明度2/4与8/32px两层，聚焦仅轻微加深；不画外圈光环。
- 排版：input、Permission、Model字号局部14px，草稿line-height24px。输入box-sizing border-box，padding 8px 36px 8px 12px；base min-height48px。placeholder浅色弱化，深色/HC仍沿主题token，禁用控件状态不抹掉。
- 活动空稿：仍走原is-single-line条件，仅把输入盒32→48px；卡顶8px、gap0、40px底栏、边框约2px，合计约98px。输入有一行文本时base48px+gap8，约106px；原有单实例、自动增高和行内编辑生命周期不变。
- 空会话：输入min-height64px，容纳两行24px文字+16px内衬，整卡约122px；实际高度依内容/引用增加。不能为抄高度截断文本、引用、失败/不可用说明。
- 底栏：40px最小高度，padding4px 8px 8px；按钮与select仍28px，图标16px，chevron12px。enabled幽灵按钮前景色与文字一致，禁用沿原状态。模型仍靠右，send圆尺寸与已有状态不变；UA Tools、权限、可选Agent保留，Stop/Goal/队列仍独立Inbox。
- 窄叶：取消多余input-row左右8px叠加；leading flex 1 1 auto、trailing 0 1 auto，在More+Model/Send能放下时同一行，放不下才wrap。原narrow More功能内容、权限门控和模型截断不变。
- 明确断言：conversationLensCssScan.test.ts S5/single-line旧32px→48px，输入padding旧4/32/0/16→8/36/8/12；卡片radius20→24、shadow两层与focus10%，bar36→40/padding4/12→4/8/8；send28不变。conversationLens.test.ts T2 bar36→40；保留293px More+长模型/发送不溢出、Submit/Busy/队列/编辑/放大行为断言。
- 验证：先规则16只读方案审查；compile-client/eslint、相关组件与CSS扫描；隔离默认窗相同CSS缩放下拍活动空稿/输入文字/空会话/聚焦未聚焦/浅深/窄叶，记录实际盒。对照新reference.png，颜色需区分GPT正在生成与UA无引擎的不同状态，不能把蓝色Stop当成禁用Send应有颜色。完成后指定Terra只读对比，C/I闭环。

审查：review_list_plan只读审查C0/I0/M2；两项均采纳：同步旧single-line padding/line-height及窄叶flex-basis/input-row内衬。已实施，验证中。

§25/26完成本地实施与截图比较：272组件通过5pending、编译通过、CSS41过2个D17旧Engine断言。Terra完成后复审C0/I0/M0，导航路径Minor关闭；证据见dev/progress/conversation-gpt-visual-evidence/verification.md。无真引擎黄金路径验收，整体PRD不升，未提交。

## 27. 圆角图标轮廓与内衬（2026-11-02）

状态：执行中。用户追加侧栏与输入卡局部图，要求1:1复刻圆角、图标质感和padding。参考截图是栅格图，未提供原SVG；以相同文字/行尺度重建轮廓，不宣称取得原始图标资产。

- 继续使用frontend-design、pc-web-ui-interaction；用户截图优先于通用密度默认。30px列表、14px字、28px按钮、24px输入卡壳/40px底栏保持，避免反复放大缩小。参考侧栏背景胶囊约60截图像素高，对应30px本地行；圆角约22–24截图像素，对应12px，本轮不将整行改成全圆胶囊。
- 新建workbench/browser/media/uaRoundedIcons.css，由Lens、Sessions、Projects各自引入。局部现有codicon类的::before使用本地SVG data mask：16px画布、1.5px圆头/圆连接描边，currentColor着色。仅覆盖这些UA表面的add、ellipsis、folder、arrowUp、permission shield与模型chevron；Tools重画为同线宽圆连接工具轮廓。保留原图标类、DOM、title/ARIA、监听器与状态/禁用门控；不全局替换Codicon、不依赖字体描边滤镜。
- 加号有效轮廓12px居中16px；More为三颗等径圆点、中心对称。文件夹开口弧线与圆连接重画；Permission沿原warning语义换盾牌感叹号，不引入麦克风或pin功能。原图pin只作为有对应功能时的视觉参考，现有UA无pin入口则不造按钮。运行/失败glyph不受影响。
- 输入底栏left/right8px，28px按钮/8px组间距保持，输入左12px；模型chevron12px画布、1.5px描边，避免字体的细小锯齿与假粗。Sessions More圆形hover命中底与弱化中性前景；Projects actions同样28px圆底，状态常显。
- 验证：编译或快速transpile保证CSS引入生效；现有Sessions/Projects/Lens组件与CSS扫描。隔离默认窗浅深、hover/菜单/窄栏实拍并测mask命中区与padding；用户指定Terra完成后只读对照本次两张reference。截图无法消除未知原始缩放或证明像素级资产一致；不伪造蓝色Stop与pin。

§27只读review_list_plan审查C0/I1/M3：I1采纳，mask规则只在非HC且forced-colors:none生效，高对比与强制颜色保留原Codicon；验证发送/More/权限焦点。M采纳明确宿主白名单、空content/居中mask、许可证与引入核验。

§27完成：局部SVG轮廓与3入口样式引入，HC/forced-colors原图标回退；实际More菜单、浅深/窄窗取样完成，238组件过5pending，compile-client通过，Terra只读C0/I0/M0。参考SVG不可得，仅重绘轮廓，不称像素原资产一致。证据见verification.md的§27记录。

## 28. 菜单视觉参照（2026-11-02）

状态：执行中。用户补菜单主层及子菜单截图要求复刻；只匹配视觉，继续UA功能范围。

- Sessions/Projects原contextMenuService delegate增加getMenuClassName，白名单ua-rounded-menu及各自归属类。新uaRoundedMenus.css三个入口引入，只作用这些菜单及Composer自有Add/More/Tools/Templates浮层，保留原菜单引擎与键盘/鼠标/取消/锚点算法，不改全局Menu。
- 截图文字约28像素与本地14px对应，仅作尺度归一假设：14px菜单文字，行最小30px（长禁用原因允许增高），shell圆角16px，4px内衬，行圆角12px/水平8px、图标16px、标签间8px；最小宽184px（最多视口减16），正常前景8%细边、widget.shadow柔和投影，HC/forced保留主题强边和焦点。hover/focused用中性淡灰，shortcut12px弱化右对齐，分隔线8px外留白。
- 原生菜单本身没有暴露Action图标渲染选项，不扩散改基础Menu。当前固定动作菜单按归属类/固定动作位渲染装饰::before（Sessions仅Open beside，Projects依次Open/Delete）；装饰无语义/不接收事件、不占checked槽；测试现有动作次序合同与委托类。图形使用局部圆头SVG，HC/forced使用同语义Codicon；不按中文文本选取。今后菜单内容变化须同步图标位映射。
- UA无重命名/置顶/未读/移动项目/归档菜单合同，不引入截图专属操作、假快捷键或空子菜单。现有快捷键如有由原服务提供，子菜单样式只继承壳层，保留原生左右翻转和定位，不为复制间隙用transform破坏锚点。
- 验证现有Sessions/Projects/Lens测试与CSS扫描，新增委托class断言纳入已有菜单用例；隔离默认窗浅深More菜单/键盘Escape焦点/Composer Add/窄窗/forced-colors；无真引擎Projects菜单仅组件验证不冒充实际窗口。完成后Terra对照复审。

§28只读审查C0/I0/M3已采纳：行/label长原因同时解锁高度与white-space；图标位限定直接动作列表不影响子菜单；Composer Add的搜索/分组/hidden原结构保持。

§28本地完成：238组件过5pending、compile-client与lint无错误；CSS41过2个D17旧Engine断言。浅深/窄窗/forced菜单实拍与Escape焦点完成，最终壳186×40/行30，去除内层重复border。Terra C0/I0/M0，真实Projects多项/子菜单与长不可用说明仅代码/组件合同覆盖，未真窗实拍。未提交，证据见verification.md §28。
