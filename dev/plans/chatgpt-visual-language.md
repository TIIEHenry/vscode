---
title: "视觉语言以 ChatGPT 为主参照"
type: plan
status: accepted
phase: N/A
updated: 2026-11-08
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

状态：已作废（2026-11-05）。D18 的 V3=B 将相邻回合外间距统一收回规范 §4 的 16px；本节保留历史原型、身份门槛和几何证据，12px 同轮候选不再进入产品实施。

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

### §20 D2 窄实施检查点（2026-11-05）

规则16 独立审查为 Critical 0；审查指出 selected 行的 400 规则与 active 标记存在 specificity 竞争，实施改用同一 `.monaco-list-row.conversation-sessions-item-active` 组合选择器，并只把当前会话标题设为 `var(--vscode-fontWeight-semiBold, 600)`。未改行高、圆角、背景/前景、Projects/Team、ARIA、键盘、More、HC 或 reduced-motion；因此只完成 D2 的标题字重子切片，§20 其它视觉范围仍按既有边界保留。

验证：`conversationSessionsView.test.ts` 的 Chromium suite 6 passing（Light+、产品浅色、产品深色、HC 黑、HC 浅及 active filter）；Electron hidden-window runner 2 passing / 5 个既有 focus 主题 pending；Node v24.18 下 `npm run compile-client` exit 0。组件证据不替代默认编辑器窗口宽/窄、浅/深和 HC 的人工观察，也不覆盖真实引擎或 SGLang。

### §22 Activity Bar fallback 窄实施检查点（2026-11-05）

规则16 独立复核为 C0/I0：`activitybarPart.ts` 的标准尺寸已经是 44px 行高 / 20px 图标，compact 仍由 inline 变量覆盖为 28px / 16px；`activityaction.css` 的默认 fallback 原先仍是旧的 48px / 24px。实施只把三处标准 fallback 对齐到 44px / 20px，保留 Activity Bar 宽度 48px、compact/Modern UI inline 覆盖、高对比、badge `top:24px`、拖放指示器和动作语义。

验证：新增 `activitybarCssScan.test.ts` 3 passing（含错误捕获）；`activitybarPart.test.ts` Chromium 26 passing。该窄切片仍需 `compile-client` 与默认编辑器窗口浅/深、宽/窄、键盘焦点人工观察，不能把 CSS fallback 合同当成完整窗口验收。

### §29 Sessions 键盘焦点合同窄实施检查点（2026-11-05）

规则16 的 Sol 独立复核为 Critical 0、Important 1：Sessions 列表的普通主题同时存在通用和非高对比的重复 `focusBorder` 行框，More 也画同样的焦点描边；未选中行若直接改成选中底会在浅色主题形成不足 3:1 的对比，因此保留列表既有 selected / active 状态，不新增低对比背景。

实施只在 `conversationSessions.css` 的 Sessions 列表收敛焦点合同：普通主题移除 row 的 `focusBorder` outline，More 的 `:focus-visible` 使用已有 `toolbar.hoverBackground`；高对比主题保留 `contrastActiveBorder` / `contrastBorder` 行框和 More 行框。More 的出现、菜单锚点、键盘导航和 ARIA 结构未改。

验证：`conversationLensCssScan.test.ts` 44 passing；`conversationSessionsView.test.ts` Chromium 主题 suite 6 passing；`npm run compile-client` 在 Node v24.18 下 exit 0；`git diff --check` 通过。组件与源码合同仍不替代默认编辑器窗口浅/深、窄栏和高对比的人工焦点观察。

### §30 SessionBar lens tabs 焦点合同窄实施检查点（2026-11-06）

Sol 按规则16复核 C0/I1：SessionBar 的 lens tabs 原来在普通主题和 selected tab 的 `:focus-visible` 上重复画 `focusBorder`，但 tab 已有 `toolbar-hoverBackground` 选中/悬停状态。实施将普通主题键盘焦点落到该中性背景，selected tab 继续复用同一背景；高对比主题保留 2px `contrastActiveBorder` / `contrastBorder` 焦点线。tablist、roving tabindex、Arrow/Home/End 和 `aria-selected` 合同未改。

验证：`conversationLensCssScan.test.ts` 45 passing；Chromium `conversationLens.test.ts` 的 tablist-only、SessionBar 切换和 ARIA 用例 3 passing；Node v24.18 `npm run compile-client` exit 0。默认编辑器窗口多主题人工焦点观察仍需独立留证。

### §31 Activity Bar 动效合同窄实施检查点（2026-11-06）

Sol 只读复核发现标准 Activity Bar 图标与选中指示器仍使用 150ms 过渡，超过 UI 规范的 100ms 上限，并缺少该局部组件的 reduced-motion 关闭规则。实施仅将两处过渡收敛为 100ms，并在 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重显式 `.monaco-enable-motion`）下设为 `none`；尺寸、选中状态、badge、拖放和动作语义未改。

验证：`activitybarCssScan.test.ts` 3 passing（含错误捕获），源码断言覆盖 100ms 上限与两种 reduced-motion 入口。尚未替代默认编辑器窗口浅/深、HC、键盘焦点和 reduced-motion 的人工观察，也未宣称完整窗口验收。

### §32 Navigator Projects 行动效合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Projects 列表行已有 100ms 背景过渡，但缺少显式 reduced-motion 覆盖。实施仅在 `navigatorProjectsList.css` 为项目行增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）的 `transition: none`；不改行高、颜色、圆角、ARIA、键盘或菜单动作。

验证：`navigatorProjectsListCss.test.ts` focused suite 4 passing（含错误捕获），独占 `npm run compile-client` exit 0、compile-src 0 errors；源码断言覆盖 100ms、旧时长排除和两种 reduced-motion 入口。默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

### §33 Navigator Projects inline filter 动效合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Projects 内置过滤框的边框和清除按钮仍使用 120ms 过渡，且没有局部 reduced-motion 覆盖；Sessions 过滤框已有 100ms 合同可作同类对照。实施仅将 Projects inline filter 的两处过渡改为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）的 `transition: none`；Agents/Team 过滤器、过滤逻辑、DOM/ARIA、焦点和 HC 未改。

验证：`npm run transpile-client` exit 0；`navigatorProjectsListCss.test.ts` focused suite 5 passing（含错误捕获），源码断言覆盖 100ms、旧时长排除和两种 reduced-motion 入口。该窄切片未重新跑完整 `compile-client`，默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

### §34 Session window 隐藏叶按钮动效合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Session window 的隐藏叶按钮已有 100ms 颜色过渡，但缺少 reduced-motion 覆盖。实施仅在 `conversationSessionWindow.css` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下的 `transition: none`；隐藏叶生命周期、focus/HC、ARIA、命中区和按钮语义未改。

验证：`npm run transpile-client` exit 0；新增 hide-control 源码合同通过，`conversationRegionChromeCss.test.ts` 当前 2 passing / 1 existing failure，失败来自并行 WIP `conversationPart.css` 的 region chrome 28px→36px 几何断言，不属于本切片。默认编辑器浅/深、HC、键盘焦点和 reduced-motion 人工观察仍待补。

### §35 Navigator Agents inline filter 动效合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Agents inline filter 的输入框边框和清除按钮仍使用 120ms 过渡，且没有局部 reduced-motion 覆盖；Projects filter 已有同类 100ms 合同。实施仅将 Agents filter 两处过渡改为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）的 `transition: none`；过滤逻辑、DOM/ARIA、焦点、HC、Projects/Team 未改。

验证：`npm run transpile-client` exit 0；独立 `navigatorAgentsInlineFilterCss.test.ts` 2 passing（含错误捕获），覆盖 100ms、旧时长排除和两种 reduced-motion 入口。未重新跑完整 `compile-client` 或默认编辑器人工观察。

### §36 Navigator Agents 行与行内动作动效合同窄实施检查点（2026-11-06）

Sol 规则16只读复核为 Critical 0：Agents hierarchy/activity 列表行和行内 action 仍使用 120ms 过渡，且没有局部 reduced-motion 覆盖。实施仅将三类背景过渡收敛为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）的 `transition: none`；未改行高、颜色、圆角、焦点、HC、ARIA、动作语义或其它 Navigator WIP。

验证：Sol 的源码合同 5 assertions、ESLint、Stylelint 与 `git diff --check` 通过；`npm run transpile-client` exit 0，编译后 `navigatorStubCss.test.ts` 2 passing（含错误捕获）。Stylelint 仅保留该文件既有 2 条字体 design-token 建议；未重新跑完整 `compile-client` 或默认编辑器人工观察。

### §37 Agent Inspect 行动效合同窄实施检查点（2026-11-06）

Sol 规则16只读复核为 Critical 0：Agent Inspect 列表行仍使用 120ms 过渡，且没有局部 reduced-motion 覆盖。实施仅将该列表行过渡收敛为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）的 `transition: none`；未改 TS、几何、颜色、焦点、HC、ARIA 或其它 Navigator WIP。

验证：Sol 的源码合同 4 assertions、ESLint、Stylelint 与 `git diff --check` 通过；刷新产物后 `npm run transpile-client` exit 0，`agentInspectCss.test.ts` 2 passing（含错误捕获）。Stylelint 仅保留该文件既有 2 条字体 design-token 建议；未重新跑完整 `compile-client` 或默认编辑器人工观察。

### §38 Conversation Agent breadcrumb 动效合同窄实施检查点（2026-11-06）

Sol 规则16只读复核为 Critical 0：Agent hierarchy 面包屑已有 100ms 背景过渡，但缺少局部 reduced-motion 覆盖。实施仅补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）的 `transition: none`；保留 BreadcrumbsWidget 的焦点、键盘、ARIA、导航逻辑及 28px 视觉几何。

验证：Sol 的源码合同 4 assertions、ESLint 与 `git diff --check` 通过；Stylelint 通过但报告该文件既有 `--ua-ease` unknown-variable 提示及 3 条 design-token 建议；刷新产物后 `npm run transpile-client` exit 0，`conversationAgentBreadcrumbCss.test.ts` 2 passing（含错误捕获）。未重新跑完整 `compile-client` 或默认编辑器人工观察。

### §39 Conversation sub-agent overlay 动效合同窄实施检查点（2026-11-06）

Sol 规则16只读复核为 Critical 0：sub-agent overlay 的 action button 已有 100ms 背景过渡，但缺少局部 reduced-motion 覆盖。实施仅补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）的 `transition: none`；不改 overlay 几何、焦点、ARIA、生命周期或动作语义。

验证：Sol 的源码合同 4 assertions、ESLint 与 `git diff --check` 通过；Stylelint 通过但报告该文件既有 `--ua-ease` unknown-variable 及 3 条 design-token 建议；刷新产物后 `npm run transpile-client` exit 0，`conversationSubAgentOverlayCss.test.ts` 2 passing（含错误捕获）。未重新跑完整 `compile-client` 或默认编辑器人工观察。

### §40 Connection Preferences reduced-motion opt-in 合同窄实施检查点（2026-11-06）

Sol 规则16只读复核为 Critical 0：Connection Preferences 的 `prefers-reduced-motion` 媒体规则没有尊重显式 `.monaco-enable-motion`，会错误覆盖用户的动效启用选择。实施仅为五个媒体 selector 加 `.monaco-workbench:not(.monaco-enable-motion)`，保留 class 规则及布局、颜色、焦点、ARIA、TS。

验证：Sol 的源码合同 4 assertions、ESLint 与 `git diff --check` 通过；Stylelint 通过但报告该大文件既有 `--ua-*` unknown-variable 及 21 条 design-token 建议；刷新产物后 `npm run transpile-client` exit 0，`connectionPreferencesPaneCss.test.ts` 2 passing（含错误捕获）。未重新跑完整 `compile-client` 或默认编辑器人工观察。

### §41 ua-common motion opt-in 合同窄实施检查点（2026-11-06）

Sol 规则16只读复核为 Critical 0：全局 `.ua-motion` 的 `prefers-reduced-motion` 规则没有尊重显式 `.monaco-enable-motion`，与 `productAccessibility.css` 的 motion opt-in 语义冲突。实施仅将媒体 selector 改为 `.monaco-workbench:not(.monaco-enable-motion) .ua-motion`；保留 class reduced-motion、所有创建点及布局、焦点、ARIA。

验证：Sol 的源码合同 5 assertions、ESLint 与 `git diff --check` 通过；Stylelint 通过但报告该文件既有 5 个 `--ua-status-*` unknown-variable 及 1 条 stroke token 建议；刷新产物后 `npm run transpile-client` exit 0，`uaCommonMotionContract.test.ts` 3 passing（含错误捕获）。未重新跑完整 `compile-client` 或默认编辑器人工观察。

### §42 Sessions inline filter reduced-motion opt-in 合同窄实施检查点（2026-11-06）

Sol 规则16只读复核为 Critical 0：Sessions inline filter 清除按钮已有 100ms 过渡和 class reduced-motion 规则，但缺少 `prefers-reduced-motion` 媒体覆盖。实施仅补 `.monaco-workbench:not(.monaco-enable-motion)` 的媒体 selector；不改输入框、焦点、ARIA、列表行为或 100ms 合同。

验证：Sol 的源码合同 3 assertions、ESLint 与 `git diff --check` 通过；Stylelint 通过但报告该文件既有 `--ua-ease` unknown-variable 及 5 条 design-token 建议；刷新产物后 `npm run transpile-client` exit 0，`conversationSessionsInlineFilterCss.test.ts` 2 passing（含错误捕获）。未重新跑完整 `compile-client` 或默认编辑器人工观察。

### §43 Conversation Visualize Card disclosure ARIA 合同窄实施检查点（2026-11-06）

Sol 规则16只读复核发现折叠 header button 只有 `aria-expanded`，body 没有可引用的 `id`，屏幕阅读器无法建立 disclosure 控制目标关系。实施为每个 body 生成 `conversation-visualize-body-${turnId}`，并将 header 的 `aria-controls` 指向该 id；折叠逻辑、布局、CSS、焦点和其它 ARIA 状态保持。

验证：Chromium focused browser test 2 passing，覆盖展开状态、点击折叠/展开及 `aria-controls`/body id 匹配；`npm run transpile-client` exit 0，ESLint（2 files）与 `git diff --check` 通过。首次默认 Firefox runner 因缺失 Playwright Firefox 可执行文件且未刷新产物而失败，随后 Chromium 复跑通过；未宣称完整多浏览器或默认编辑器人工验收。

### §44 Conversation Engine History disclosure ARIA 合同窄实施检查点（2026-11-06）

Sol 规则16只读复核发现 History 触发按钮已有 `aria-expanded`/`aria-haspopup=dialog`，但没有 `aria-controls`，dialog overlay 也没有可引用的稳定 id。实施为每个实例生成 `conversation-lens-history-overlay-N`，并让 button 与 overlay 通过该 id 关联；open/close、focus trap、布局和其它 ARIA 状态保持。

验证：focused Electron 测试 2 passing（含 `assertCleanState`），Chromium DOM 合同 1 passing；刷新产物后 `npm run transpile-client` exit 0，新增测试 ESLint 与 `git diff --check` 通过。生产 TS 全文件 lint 仍报告未触碰的既有 line 381 `querySelectorAll` warning，不能归因于本切片；默认编辑器人工验收仍待补。

### §45 Conversation Engine Snapshots disclosure ARIA 合同窄实施检查点（2026-11-06）

Sol 规则16只读复核发现 Snapshots 触发按钮已有 `aria-expanded`/`aria-haspopup=dialog`，但没有 `aria-controls`，dialog overlay 也没有可引用的稳定 id。实施为每个实例生成 `conversation-lens-snapshots-overlay-N`，并让 button 与 overlay 通过该 id 关联；open/close、focus、布局和其它 ARIA 状态保持。

验证：focused Electron 测试 2 passing（含 `assertCleanState`），Chromium DOM 合同 1 passing；刷新产物后 `npm run transpile-client` exit 0，新增测试 ESLint 与 `git diff --check` 通过。生产 TS 全文件 lint 仍报告未触碰的既有 line 379/703 `querySelectorAll` warnings，不能归因于本切片；默认编辑器人工验收仍待补。

### §46 Conversation Engine MCP tabpanel ARIA 合同窄实施检查点（2026-11-06）

Sol 只读复核确认 Engine MCP 的 Definitions/Runtime 切换原有选中与显隐逻辑，但 tab 与 panel 缺少稳定的 `aria-controls` / `aria-labelledby` 关系。实施为每个实例生成唯一 tab/panel id，补齐 `role=tabpanel`、`aria-controls`、`aria-labelledby`，不改 tab 切换、运行时内容、布局或动作语义。

验证：focused Electron 测试 2 passing（含 `assertCleanState`）；Chromium DOM 合同 1 passing，覆盖 tablist、双 tab/panel 关系、初始选中/显隐与 Runtime 点击切换；刷新产物后 `npm run transpile-client` exit 0，新测试 ESLint 与 `git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §47 ConversationLens 多实例 ARIA ID 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 ConversationLens 的 tab/panel 使用静态 DOM id；多个编辑器或 leaf lens 共存时，`aria-controls` / `aria-labelledby` 可能指向重复节点。实施为每个 ConversationLens 实例生成唯一 `conversation-lens-N-*` 前缀，并让 SessionBar tabs、timeline panel、trajectory panel 与 projection helper 共享该前缀；不改 lens 切换、roving tabindex、内容投影、布局或动作语义。

验证：`npm run compile-client` exit 0（src tsconfig 0 errors）；Chromium `conversationLensSessionBar.test.ts` 14 passing，`conversationLens.test.ts` focused 1 passing；Electron focused 1 passing；新旧目标 ESLint 仅保留 ConversationLeafSessionBar 未触碰的 3 条 `querySelector` warnings，`git diff --check` 通过。默认编辑器多实例、多主题人工验收仍待补。

### §48 ConversationTrajectory overview disclosure ARIA 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Trajectory overview toggle 只有 `aria-expanded`，overview track 没有可引用的目标 id。实施为每个 overview track 生成唯一 `conversation-lens-trajectory-overview-N` id，并让 toggle 设置匹配的 `aria-controls`；保留折叠状态、隐藏行为、布局、键盘和 segment 动作。

验证：Chromium `conversationTrajectoryUi.test.ts` 全套 13 passing（含新增 overview 断言），Electron focused 1 passing；刷新产物后 `npm run transpile-client` exit 0，目标 ESLint 0 errors（生产文件仅保留未触碰的既有 `querySelector` warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §49 Conversation process-fold disclosure ARIA 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 process-fold 外层 header 只有展开状态，children 容器没有稳定目标 id；Trajectory 自有 renderer 也需要同一关系。实施在通用 process-fold 与 TrajectoryFoldRenderer 中分别为每个 children 容器生成唯一 id，并让 header 补 `aria-controls`；保留折叠、布局、工具行、键盘和内容渲染逻辑。

验证：Chromium `conversationProcessFold.test.ts` 全套 49 passing、`conversationTrajectoryUi.test.ts` 全套 13 passing，`conversationTimelineRenderer.test.ts` 全套 31 passing，Electron focused process-fold 1 passing；刷新产物后 `npm run transpile-client` exit 0，目标 ESLint 0 errors（仅保留 Trajectory 生产文件未触碰的 2 条 `querySelector` warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §50 Sources tabs 多实例 ARIA ID 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 SourcesTabsHost 的 tab/panel 使用静态 id，多个 Sources 宿主共存时可能发生 `aria-controls` / `aria-labelledby` 交叉引用。实施为每个宿主生成唯一 `sources-N-*` 前缀，并让三类 Sources tabs、tabpanel 与 focus helper 共享该前缀；不改选中 tab、存储恢复、键盘、内容面板或动作语义。

验证：`npm run compile-client` exit 0（compile-src 0 errors）；Chromium `sourcesPartFocus.test.ts` 9 passing，Electron Sources focus suite 10 passing（含 `assertCleanState`）；目标 ESLint 0 errors，`git diff --check` 通过。默认编辑器多宿主、多主题人工验收仍待补。

### §51 Navigator Team 子视图 aria-hidden 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Navigator Team 的 Members/Tasks 子视图切换只更新 active class，未同步非活动内容的 `aria-hidden`。实施在 `updateSubviewVisibility` 中让活动 body 设置 `aria-hidden=false`、非活动 body 设置 `aria-hidden=true`；保留切换命令、空状态、列表内容、布局和其它 Navigator WIP。

验证：Chromium `navigatorTeamSubviews.test.ts` 全套 58 passing，Electron focused defaults+switch 2 passing；刷新产物后 `npm run transpile-client` exit 0，目标 ESLint 0 errors，`git diff --check` 通过。生产文件中的其它既有 WIP 未扩大范围；默认编辑器多主题人工验收仍待补。

### §52 Navigator Agents 子视图 aria-hidden 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Navigator Agents 的 Hierarchy/Activity 切换只更新 active class，未同步非活动内容的 `aria-hidden`。实施仅在 `updateSubviewVisibility` 为活动 body 设置 false、非活动 body 设置 true；保留切换命令、列表内容、布局和其它 Navigator WIP。

验证：定向 Chromium defaults+switch 2 passing，Electron 同范围 2 passing；刷新产物后 `npm run transpile-client` exit 0，目标 ESLint 0 errors，`git diff --check` 通过。完整 Chromium 46 中 6 个既有 error-path 用例仍因 `ReferenceError: process is not defined` 失败，未触碰本切片；默认编辑器多主题人工验收仍待补。

### §53 Sources Review 路径过滤计数 live-region 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources Review 路径过滤计数 span 会随过滤结果变化，但没有 live-region 语义。实施为该计数补 `aria-live=polite` 与 `aria-atomic=true`，保留过滤计算、文案、布局和键盘行为。

验证：Chromium targeted path-filter 2 passing，Electron 同范围 2 passing；刷新产物后 `npm run transpile-client` exit 0，目标 ESLint 0 errors（仅保留测试文件未触碰的既有 `in` operator warning），`git diff --check` 通过。完整 sources suite 68 passing / 7 个既有 `ReferenceError: process is not defined` error-path 失败；默认编辑器多主题人工验收仍待补。

### §54 Activity Bar compact menubar reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Activity Bar compact menubar 的 More toggle 有 80ms 背景过渡，但没有局部 reduced-motion 覆盖。实施仅为该 toggle 补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下的 `transition: none`；不改命中区、菜单动作、颜色或已有 100ms Activity Bar 合同。

验证：刷新产物后 `npm run transpile-client` exit 0；`activitybarCssScan.test.ts` 4 passing，目标 ESLint 0 errors，`git diff --check` 通过。直接 Stylelint 因仓库未为该文件提供配置而返回 ConfigurationError，未计为有效门禁；默认编辑器浅/深、高对比、键盘焦点和 reduced-motion 人工验收仍待补。

### §55 Sources 文件行 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources 文件行有 80ms 背景过渡，但没有局部 reduced-motion 覆盖。实施保留默认反馈，并在 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下关闭该过渡；不改文件行布局、选中状态、键盘或打开动作。

验证：刷新产物后 `npm run transpile-client` exit 0；Chromium SourcesFilesList 全套 39 passing（新增 5-theme 断言均通过），node `sourcesWiringScan.test.ts` 33 passing；目标 ESLint 0 errors，`git diff --check` 通过。完整 browser suite 的 2 个、node suite 的 3 个旧 `ReferenceError: process is not defined`/source-contract failures 未触碰本切片；默认编辑器多主题人工验收仍待补。

### §56 Sources Review 行 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources Review 行有 80ms 背景过渡，但没有局部 reduced-motion 覆盖。实施保留默认反馈，并在 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下关闭该过渡；不改行高、选中、过滤、键盘或动作语义。

验证：刷新产物后 `npm run transpile-client` exit 0；node `sourcesWiringScan.test.ts` 新合同通过（整套 35 passing / 3 个既有断言失败），Chromium path-filter 2 passing、Electron 同范围 2 passing；目标 ESLint 0 errors，`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §57 Sources Changes 行 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources Changes 的 folder/file 行有 80ms 背景过渡，但没有局部 reduced-motion 覆盖。实施保留默认反馈，并在 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下关闭两类行的过渡；不改 diff 预览、选中、键盘或文件动作。

验证：刷新产物后 `npm run transpile-client` exit 0；node `sourcesWiringScan.test.ts` 新合同通过（整套 36 passing / 3 个既有 git-write/open-diff double-catch 合同失败），目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §58 Navigator Team inline filter reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Navigator Team inline filter 的输入框和清除按钮仍使用过渡，但没有局部 reduced-motion 覆盖。实施将两处过渡统一为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下的 `transition: none`；不改过滤逻辑、焦点、清除动作或布局。

验证：刷新产物后 `npm run transpile-client` exit 0；`navigatorProjectsListCss.test.ts` 6 passing，目标 ESLint 0 errors，`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §59 Sources list filter reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources list filter 的 clear 过渡仍为 120ms，input/clear 也没有局部 reduced-motion 覆盖。实施将 clear 收敛为 100ms，并为 input/clear 补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下的 `transition: none`；不改过滤逻辑、焦点、清除动作或布局。

验证：刷新产物后 `npm run transpile-client` exit 0；node `sourcesWiringScan.test.ts` 37 passing / 3 个既有 git-write/open-diff 合同失败（新合同通过），目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §60 Sources Changes toolbar reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources Changes toolbar `.monaco-button` 的过渡仍为 120ms，且没有局部 reduced-motion 覆盖。实施将过渡收敛为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下的 `transition: none`；不改按钮命令、命中区、焦点或布局。

验证：刷新产物后 `npm run transpile-client` exit 0；node `sourcesWiringScan.test.ts` 38 passing / 3 个既有 git-write/open-diff double-catch 合同失败（新合同通过），目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §61 Sources Diff panel actions reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources Diff panel actions 的按钮过渡仍为 120ms，且没有局部 reduced-motion 覆盖。实施将过渡收敛为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下的 `transition: none`；不改 diff 命令、按钮命中区、焦点或布局。

验证：刷新产物后 `npm run transpile-client` exit 0；node `sourcesWiringScan.test.ts` 39 passing / 3 个既有 git-write/open-diff double-catch 合同失败（新合同通过），目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §62 Navigator Team 列表行动效 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Navigator Team Members/Tasks 列表行背景过渡仍为 120ms，且没有局部 reduced-motion 覆盖。实施将两类行过渡收敛为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下的 `transition: none`；不改行高、颜色、圆角、选中、键盘或动作语义。

验证：刷新产物后 `npm run transpile-client` exit 0；node `navigatorProjectsListCss.test.ts` 7 passing（含新 Team rows 合同与错误捕获），目标 ESLint 0 errors，`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §63 Sources conversation diff review toolbar reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 conversation diff review toolbar 按钮过渡仍为 120ms，且没有局部 reduced-motion 覆盖。实施将过渡收敛为 100ms，并补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下的 `transition: none`；不改 review 命令、按钮命中区、焦点或布局。

验证：刷新产物后 `npm run transpile-client` exit 0；node `sourcesWiringScan.test.ts` 40 passing / 3 个既有 Changes stage/unstage、Review pane fire-and-forget、Review open-diff double-catch 接线断言失败（新增合同通过），目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §64 Sources Changes inline actions reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources Changes inline/group actions 与 commit button 虽已有 100ms 过渡，但没有局部 reduced-motion 覆盖。实施仅补 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下的 `transition: none`，保留原过渡、按钮命令、命中区、焦点、行布局和 commit 行为。

验证：刷新产物后 `npm run transpile-client` exit 0；node `sourcesWiringScan.test.ts` 41 passing / 3 个既有 Changes buttons、Review pane void、Review list open-diff double-catch 接线失败（新增合同通过），目标 ESLint 0 errors（仅保留既有 externalized-string warnings），`git diff --check` 通过。默认编辑器多主题人工验收仍待补。

### §65 Activity Bar 拖拽插入指示器 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Activity Bar composite action 的拖拽插入指示器伪元素仍带有 100ms transition-delay，class 与系统 reduced-motion 规则没有覆盖该反馈。实施仅在 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion`）下为 `.composite-bar` action item 的 `::before/::after` 关闭过渡，保留拖拽插入位置、颜色、命中区、键盘和动作语义。

验证：`activitybarCssScan.test.ts` 4 passing（含新增 `::before/::after` selector 合同与 unexpected-errors guard），目标 ESLint 0 errors，`git diff --check` 通过；本窄切片未重跑 `npm run transpile-client`、Chromium/Electron 或默认编辑器多主题人工验收。

### §74 Notifications 正文链接键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器通知正文链接仍通过全局 `a:focus` 使用 `focusBorder` 外圈。实施仅让普通主题链接在 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并清除外圈；HC black/light 保留 `1px solid contrastActiveBorder`，不改链接、点击反馈、通知操作或按钮布局。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `notificationsListCss.test.ts` 2 passing（合同与 unexpected-errors guard），目标 ESLint 0 errors，Stylelint exit 0（既有 5 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §66 Visualize 折叠标题键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现可折叠 Visualize header 在普通主题仍以 `focusBorder` 画 1px 外圈，与产品自有 GPT 焦点语言不一致。实施仅让普通主题 `:focus-visible` 使用既有 `toolbar-hoverBackground` 的轻量可见反馈并移除 focusBorder 外圈；高对比主题继续保留 `contrastActiveBorder`/`focusBorder` ring，不改折叠/ARIA、几何、键盘动作或内容渲染。

验证：`npm run compile-client` exit 0（compile-src 0 errors）；刷新产物后 focused Node `conversationLensCssScan.test.ts` 45 passing / 1 个既有 `ua-common.css` brace/selector 失败（新增合同通过），目标 ESLint 0 errors（1 个既有 externalized-string warning），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

### §67 Sources 空工作区 Open Folder 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources 无工作区空态的 `Open Folder...` 文本按钮在普通主题仍画 `focusBorder` 外圈，与当前 GPT 产品焦点语言不一致。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；高对比继续保留 `contrastActiveBorder` ring，不改命令、可见性、布局、键盘动作或空态语义。

验证：刷新产物后 `npm run transpile-client` exit 0；`sourcesWiringScan.test.ts` 41 passing / 3 个既有 Changes stage/unstage、Review pane void、Review open-diff double-catch 基线失败（新增合同通过），目标 ESLint 0 errors（18 个既有 externalized-string warnings），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

### §68 Sources Review 状态焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources Review state 普通主题仍以 `focusBorder` 画 1px 外圈，与当前 GPT 产品焦点语言不一致。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 review state 命令、ARIA、布局或键盘动作。

验证：刷新产物后 `npm run transpile-client` exit 0；`sourcesWiringScan.test.ts` 42 passing / 3 个既有 Changes stage/unstage、Review pane void、Review open-diff double-catch 失败（新增合同通过），目标 ESLint 0 errors（18 个既有 externalized-string warnings），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

### §69 Conversation identity strip 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Conversation identity strip 的 engine/folder identity chips 与 Add Folder 按钮在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改命令、只读 pointer、布局或键盘动作。

验证：刷新产物后 `npm run transpile-client` exit 0；focused Node `conversationLensCssScan.test.ts` 46 passing / 1 个既有 `ua-common.css` brace/selector 基线失败（新增合同通过），目标 ESLint 0 errors（1 个既有 externalized-string warning），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

### §70 Conversation sub-agent overlay 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Conversation sub-agent overlay 容器在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC 继续保留 `contrastActiveBorder` ring，不改 overlay/card/backdrop 或键盘语义。

验证：刷新产物后 focused Node 3 passing，`npm run transpile-client` exit 0，目标 ESLint 0 errors，针对生产 CSS 的 Stylelint exit 0（仅既有 `--ua-ease` unknown variable 与 3 条 design-token suggestions），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

### §71 Sources Files 模式切换键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Sources Files 的 mode toggle 普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 list/tree 模式命令、`aria-pressed`、布局或键盘动作。

验证：刷新产物后 `npm run transpile-client` exit 0；focused Sources wiring 43 passing / 3 个既有 Changes stage/unstage、Review pane void、Review open-diff double-catch 基线失败（新增合同通过），目标 ESLint 0 errors（18 个既有 warnings），Stylelint exit 0（仅既有 1 个 unknown variable 与 9 条 design-token suggestions），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

### §72 Conversation lens session title 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Conversation lens session title button 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC black/light 显式保留 `contrastActiveBorder` ring，不改标题编辑、命令、布局或键盘动作。

验证：刷新产物后 `npm run transpile-client` exit 0；focused Node `conversationLensCssScan.test.ts` 47 passing / 1 个既有 `ua-common.css` brace/selector 基线失败（新增合同通过），目标 ESLint 0 errors（1 个既有 externalized-string warning），Stylelint exit 0（仅既有 23 个 unknown vars 与 104 条 design-token suggestions），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

### §73 Conversation lens session switcher 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Conversation lens session switcher 的 SelectBox 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并移除外圈；HC black/light 显式保留 `contrastActiveBorder` ring，不改 SelectBox 命令、chevron 几何、键盘或菜单行为。

验证：刷新产物后 `npm run transpile-client` exit 0；focused Node `conversationLensCssScan.test.ts` 48 passing / 1 个既有 `ua-common.css` brace/selector 基线失败（新增合同通过），目标 ESLint 0 errors（2 个既有 warnings），Stylelint exit 0（既有 23 个 unknown-variable warnings 与 104 条 design-token suggestions），`git diff --check` 通过；未跑 Chromium/Electron 或默认窗口人工验收。

### §75 Image Carousel 导航箭头键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Image Carousel 导航箭头在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用既有 `toolbar-activeBackground` 的轻量可见反馈并保持 `opacity: 1`；HC black/light 继续保留 `contrastActiveBorder` ring，不改导航命令、命中区、图片切换或布局。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `imageCarouselCssScan.test.ts` 3 passing（含普通/HC 合同与 unexpected-errors guard），目标 ESLint 0 errors，Stylelint exit 0（既有 5 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §76 Navigator Team status filter 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Navigator Team status filter 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 的轻量可见反馈并保持前景色；HC black/light 继续保留 `contrastActiveBorder` ring，不改过滤、ARIA、按钮行为或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10152 files）；focused `navigatorTeamStatusFilterCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 2 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §77 Open Editors 未保存计数 badge 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Open Editors 未保存计数 badge 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量可见反馈并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring 与 offset，不改 role/button、Enter/Space、点击或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10153 files）；focused `openEditorsCss.test.ts` 在 `VSCODE_SKIP_PRELAUNCH=1` 下 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 3 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。首次未设 skip-prelaunch 的 focused 运行因 Electron 动态 import 基线失败，已与通过结果分开记录。

### §78 Preview category tab 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 preview category tab 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量可见反馈并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 tab、drag、selected 语义或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10154 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `previewCategoryBarCss.test.ts` 3 passing，目标 ESLint 0 errors，Stylelint exit 0，`git diff --check` 通过；首次测试与 transpile 并行导致动态 import 基线失败，刷新产物后已重跑通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §79 Breadcrumbs editor-type picker 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Breadcrumbs editor-type picker 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 与 breadcrumb focusForeground 的轻量可见反馈并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring 与 `-1px` offset，不改 picker 点击、键盘或 ARIA 语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10155 files）；顺序运行 `VSCODE_SKIP_PRELAUNCH=1` focused `breadcrumbsControlCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 4 条 design-token suggestions），`git diff --check` 通过；并行运行 test/transpile 曾触发动态 import 基线竞态，顺序重跑已通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §80 Editor add-tab action 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Editor add-tab action 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 与图标前景色的轻量可见反馈并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring 与 `-1px` offset，不改 add-tab command、hover/active 状态、命中区或键盘行为。

验证：刷新产物后 `npm run transpile-client` exit 0（10156 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `multiEditorTabsControlCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 6 条 spacing suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §81 Settings editor tab 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Settings editor tab 在普通主题仍以 `focusBorder` 的 color-mix box-shadow 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量可见反馈并移除 color-mix 外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 checked、hover 或键盘切换语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10157 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `settingsEditor2Css.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 47 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §82 Comments panel 正文链接键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Comments panel 正文链接在普通主题仍以 `focusBorder` 画外圈。实施仅移除普通主题直接 `:focus` 的外圈，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量可见反馈；HC black/light 继续保留 `contrastActiveBorder` ring，不改链接目标、点击、ARIA 或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10158 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `commentsPanelCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §83 Comments review widget 正文链接键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Comments review widget 的 comment-body 链接在普通主题仍以 `focusBorder` 画外圈。实施仅移除普通主题直接 `:focus` 的外圈，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量可见反馈；HC black/light 继续保留 `contrastActiveBorder` ring，不改链接点击、ARIA 或评论动作。

验证：刷新产物后 `npm run transpile-client` exit 0（10159 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `commentsReviewCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 30 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §84 Getting Started step icon 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Getting Started step icon 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 step codicon `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量可见反馈并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改展开、步骤、键盘或 ARIA 语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10160 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §85 Getting Started category card 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Getting Started category card 在普通主题仍以 `focusBorder` 画外圈。实施在同一 CSS 中新增独立 category card `:focus-visible` 合同，使用 welcomePage tile hover 背景并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改类别点击、展开、键盘或 ARIA 语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10161 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedCategoryCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §86 Getting Started step button 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Getting Started `.step-list-container button` 在普通主题仍以 `focusBorder` inset box-shadow 画外圈。实施仅让普通主题 `:focus-visible` 使用 tile-hover 背景并移除 inset 外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 `aria-expanded`/`aria-checked`、步骤选择或键盘行为。

验证：刷新产物后 `npm run transpile-client` exit 0（10162 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedStepCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §87 Getting Started Start links 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Getting Started `.start-container .button-link` 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量可见反馈并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改起始入口命令、链接、键盘或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10163 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedStartCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §88 Getting Started done/next actions 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Getting Started `.done-next-container .button-link` 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量可见反馈并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 Mark Done/Next Section 命令、键盘或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10164 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedDoneNextCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §89 Getting Started 其余正文链接键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Getting Started 其余正文链接在普通主题仍通过直接 `:focus` 画 `focusBorder` 外圈。实施仅将非关闭锚点直接 `:focus` 清为无外圈，让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量可见反馈；HC black/light 继续保留 `contrastActiveBorder` ring，不改链接目标、关闭按钮、键盘或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10165 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `gettingStartedLinksCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 38 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §90 Preferences Back to Client Settings 导航焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Preferences `.back-to-client-settings` 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 清除 focusBorder ring；HC black/light 继续显式保留 `contrastActiveBorder` ring，不改导航命令、链接文本、tab strip 布局或键盘行为。

验证：刷新产物后 `npm run transpile-client` exit 0（10166 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `preferencesEditorCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 9 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §91 Keybindings editor 搜索动作键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Keybindings editor header action-label 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量可见反馈并清除外圈；HC black/light 继续显式保留 `contrastActiveBorder` ring，不改搜索过滤、录制/切换按钮、键盘或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10167 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `keybindingsEditorCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 6 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §92 Terminal hidden chat entry 删除控件键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Terminal hidden chat entry delete control 在普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground`、保持 `opacity: 1` 并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 `role=button`、Enter/Space 删除行为、显示条件或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10168 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `terminalTabsChatEntryCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 18 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §93 Terminal hidden chat entry 主入口键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 `.terminal-tabs-chat-entry` 普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 `role=button`、Enter/Space 打开隐藏 chat terminal、删除控件或 tab 布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10169 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `terminalTabsChatEntryFocusCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 18 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §94 Walkthrough 正文链接键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Walkthrough 正文 anchor 在普通主题仍以 `focusBorder` 画外圈。实施仅清除普通主题直接 `:focus` 外圈，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 的轻量可见反馈；HC black/light 继续保留 `contrastActiveBorder` ring，不改链接导航、Markdown/输入控件或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10170 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `walkThroughCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 12 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §95 Walkthrough select 控件键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Walkthrough select 控件在普通主题仍保留原生 `:focus` 环。实施仅清除普通主题原生环，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量可见反馈；HC black/light 继续保留 `contrastActiveBorder` ring，不改 select 内容、键盘或表单语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10171 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `walkThroughSelectCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 12 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §96 Walkthrough input 控件键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Walkthrough input 控件在普通主题仍保留原生 `:focus` 环。实施仅清除普通主题原生环，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量可见反馈；HC black/light 继续保留 `contrastActiveBorder` ring，不改输入内容、键盘或表单语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10172 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `walkThroughInputCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 12 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §97 SCM 提交动作键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 SCM 输入区 `.button-container > .monaco-button-dropdown > .monaco-button` 普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量可见反馈并清除外圈；HC black/light 继续保留 `contrastActiveBorder` ring，不改提交/同步命令、disabled 状态、按钮布局或键盘行为。

验证：刷新产物后 `npm run transpile-client` exit 0（10173 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `scmButtonCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 28 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §98 Editor watermark preview-category empty action 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Editor watermark preview-category empty action 普通主题仍以 `focusBorder` 画外圈。实施仅让普通主题 `:focus-visible` 清除 focusBorder，复用既有 quiet hover fill；HC black/light 继续保留 `contrastActiveBorder` ring 与 offset，不改 Open Folder/类别空态按钮命令、键盘或布局。

验证：刷新产物后 `npm run transpile-client` exit 0（10174 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `editorGroupViewCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无新增提示），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §99 Pane composite HC 上下焦点指示器合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Pane composite action 的 HC black/light 焦点指示器未统一使用对比度边界。实施仅让 header top 与 footer bottom 的 HC 指示器使用 `contrastActiveBorder`（保留 `focusBorder` fallback），普通主题透明/轻量行为保持，不改导航、checked 或快捷键语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10175 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `paneCompositePartCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 13 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §100 Workbench 空列表 HC 焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Workbench 空列表在 HC black/light 下的 focus overlay 未统一使用对比度边界。实施仅让空列表 HC focus overlay 使用 `contrastActiveBorder`（保留 `focusBorder` fallback），普通主题及列表结构保持，不改列表键盘导航、选中或空态语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10176 files）；`VSCODE_SKIP_PRELAUNCH=1` focused `workbenchStyleCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（该文件既有 10 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §101 Explorer inline rename input 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Explorer inline rename input 在普通主题仍以直接 `focusBorder` 画外圈。实施仅移除普通主题直接轮廓，让 `:focus-visible` 使用 `toolbar-hoverBackground` 与前景色的轻量可见反馈；HC black/light 继续保留 `contrastActiveBorder`（fallback `focusBorder`）1px ring，不改 rename、ARIA 或键盘语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10177 files）；focused `explorerViewletCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（现有 2 条 design-token suggestions、5px spacing 与 3px radius suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §102 Search view 消息正文链接键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Search view 消息正文链接在普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅新增普通主题 `:focus-visible` 的 `toolbar-hoverBackground` 与 `textLink-activeForeground` 反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px ring，保留链接语义与既有 hover/active 行为。

验证：刷新产物后 `npm run transpile-client` exit 0（10178 files）；focused `searchViewCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §103 Search view replace toggle 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Search view replace 展开/收起控件普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅新增普通主题 `:focus-visible` 的 `toolbar-hoverBackground` 反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px ring，不改变按钮/图标语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10179 files）；focused `searchViewToggleCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §104 Search view query-details toggle 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Search view `.query-details .more[role=button]` 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅新增普通主题 `:focus-visible` 的 `toolbar-hoverBackground` 反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px ring，保留既有 tabindex、role 与 ARIA 行为。

验证：刷新产物后 `npm run transpile-client` exit 0（10180 files）；focused `searchViewQueryDetailsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §105 Search view replace actions 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Search view replace-container ActionBar action labels 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅新增普通主题 `:focus-visible` 的 `toolbar-hoverBackground` 反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px ring，保留 ActionBar 既有语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10181 files）；focused `searchViewReplaceActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §106 Search provider message links 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 `.text-search-provider-messages .providerMessage a` 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅新增普通主题 `:focus-visible` 的 `toolbar-hoverBackground` 与 `textLink-activeForeground` 反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px ring，保留链接键盘/点击语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10182 files）；focused `searchViewProviderMessageCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 11 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §107 编辑器占位页操作按钮键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 editor placeholder 操作按钮普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅新增普通主题 `:focus-visible` 的 `toolbar-hoverBackground` 反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）对比环，保留原按钮语义与 `outline-offset: 2px`。

验证：刷新产物后 `npm run transpile-client` exit 0（10183 files）；focused `editorPlaceholderCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 2 条 spacing/codicon suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §108 编辑器快速访问 dirty-editor 操作按钮键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器快速访问 dirty-editor 操作按钮普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 `.dirty-editor:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并移除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留操作按钮语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10184 files）；focused `editorQuickAccessCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无 suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §109 屏幕阅读器说明浮层关闭按钮键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器屏幕阅读器说明浮层关闭按钮普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 `.screen-reader-detected-explanation .cancel:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并移除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留关闭按钮语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10185 files）；focused `editorStatusCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 3 条 font/spacing suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §110 单编辑器标题栏 title-actions 操作按钮键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器单编辑器标题栏 title-actions 操作按钮普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 `.title-actions .action-label:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留操作按钮语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10186 files）；focused `singleEditorTabsControlCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 1 条 spacing suggestion），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §111 模态编辑器标题导航按钮键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器模态标题导航按钮普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题导航按钮 `:focus-visible:not(.disabled)` 使用 `commandCenter-activeBackground`、保持 `opacity: 1` 并移除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 disabled 排除与导航语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10187 files）；focused `modalEditorPartCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 5 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §112 模态编辑器标题 action-label 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器模态标题 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 action-label `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 ActionBar 语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10188 files）；focused `modalEditorActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 5 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §113 编辑器组工具栏 action-label 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器组工具栏 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 `.editor-group-container-toolbar .action-label:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并移除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留工具栏语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10189 files）；focused `editorGroupToolbarCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无 suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §114 编辑器标签页 tab-actions 操作按钮键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器标签页 tab-actions 操作按钮普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 tab action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 tab close/pinned/dirty 行为。

验证：刷新产物后 `npm run transpile-client` exit 0（10190 files）；focused `multiEditorTabsControlTabActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 6 条 spacing suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §115 编辑器标签栏 editor-actions 顶层操作按钮键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器标签栏 editor-actions 顶层操作按钮普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 editor-actions `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留标签栏语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10191 files）；focused `multiEditorTabsControlEditorActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 6 条 spacing suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §116 编辑器标签下方 breadcrumbs item 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器标签下方 breadcrumbs item 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 `.breadcrumbs-below-tabs .monaco-breadcrumb-item:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 breadcrumbs 导航语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10192 files）；focused `editorTitleBreadcrumbsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 1 条 spacing suggestion），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §117 编辑器 watermark 顶部工具栏 action-label 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 watermark 顶部工具栏 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 watermark toolbar `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留工具栏语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10193 files）；focused `editorGroupWatermarkToolbarCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无 suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §118 Terminal tabs-list 行内 action-label 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Terminal tabs-list 行内 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 tabs-list action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 tabs-list 语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10194 files）；focused `terminalTabsActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 18 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §119 Terminal single-terminal-tab 入口键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Terminal single-terminal-tab 入口普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 `.single-terminal-tab:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留入口语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10195 files）；focused `terminalSingleTabCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 18 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §120 Terminal tabs-container 顶部 toolbar action-label 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Terminal tabs-container 顶部 toolbar action-label 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 toolbar action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 toolbar 语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10196 files）；focused `terminalTabsToolbarCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 18 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §121 Debug toolbar action-label 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Debug toolbar action-label 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 debug toolbar action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 toolbar 语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10197 files）；focused `debugToolBarCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无 suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §122 Debug start configuration dropdown-label 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Debug start configuration dropdown-label 普通主题仍有直接 `focusBorder` 装饰。实施仅移除直接 focusBorder，让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 dropdown 选择语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10198 files）；focused `debugViewletCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 12 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §123 Debug 调试树行内 action-label 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Debug 调试树行内 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 debug tree action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留调试树语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10199 files）；focused `debugViewletActionsCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 12 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §124 编辑器内联异常提示 action-label 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器内联异常提示 action-label 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 exception widget action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留异常提示操作语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10200 files）；focused `exceptionWidgetCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 3 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §125 编辑器内联异常提示 stack-trace 链接键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器内联异常提示 stack-trace 链接普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 stack-trace link `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 轻量反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留链接导航语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10201 files）；focused `exceptionWidgetStackTraceCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 3 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §126 编辑器内联断点提示 mode 按钮键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器内联断点提示 mode 按钮普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 breakpoint action `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留断点提示操作语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10202 files）；focused `breakpointWidgetCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（无 suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §127 Debug REPL expression lazy-button 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Debug REPL expression lazy-button 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 lazy-button `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 REPL 操作语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10203 files）；focused `replCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 2 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §128 Debug REPL 输出 source/group 链接键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Debug REPL 输出 source/group 链接普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 source links `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 轻量反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 source 导航语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10204 files）；focused `replSourceLinksCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 2 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §129 Debug multi-call-stack title link 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Debug multi-call-stack title link 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 call-stack title link `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 title link 语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10205 files）；focused `callStackWidgetCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 1 条 spacing suggestion），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §130 Debug multi-call-stack collapse-button link 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Debug multi-call-stack collapse-button link 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 collapse link `:focus-visible` 使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留折叠链接语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10206 files）；focused `callStackWidgetCollapseCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 1 条 spacing suggestion），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §131 Debug multi-call-stack go-to-file 链接键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Debug multi-call-stack go-to-file 链接普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 file link `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 轻量反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留文件导航语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10207 files）；focused `callStackWidgetFileLinkCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 1 条 spacing suggestion），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §132 Debug 变量表达式 value link 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Debug 变量表达式 value link 普通主题缺少与 GPT 视觉一致的焦点反馈。实施仅让普通主题 expression value link `:focus-visible` 使用 `toolbar-hoverBackground` 与 `textLink-activeForeground` 轻量反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留变量链接语义。

验证：刷新产物后 `npm run transpile-client` exit 0（10208 files）；focused `debugContributionCss.test.ts` 2 passing，目标 ESLint 0 errors，Stylelint exit 0（既有 4 条 design-token suggestions），`git diff --check` 通过；未启动默认编辑器/Chromium/Electron 窗口，真实 HC 仍未覆盖。

### §133 标题栏 Command Center Quick Pick 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器标题栏 Command Center Quick Pick 的 `CommandCenterQuickPickItem` 需明确普通主题与 HC 的焦点分支。实施仅让普通主题 `:focus-visible` 使用 `commandCenter-activeBackground` / `toolbar-hoverBackground` 背景反馈并去除产品自有 focus ring；HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环与 `-1px` offset，不改 `role=button`、动态 tabindex 或动作焦点管理器语义。

验证：刷新产物后 `npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/titlebarPartCss.test.ts` 2 passing；目标 ESLint 通过，Stylelint 通过（既有 6 条 design-token suggestions），两路径 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实键盘聚焦与 HC 对比环仍未覆盖。

### §134 标题栏 center-adjacent/update toolbar action buttons 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器标题栏 `center-adjacent-toolbar-container` 与 `update-toolbar-container` 的 action-label 普通主题需要与 Command Center 一致的焦点处理。实施仅让普通主题 `:focus-visible` 去除产品自有 focus ring 并使用 `toolbar-hoverBackground` 背景反馈；HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，不改 `MenuWorkbenchToolBar`、动作焦点管理器动态可聚焦行为或布局。

验证：刷新产物后 `npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/titlebarToolbarCss.test.ts` 2 passing；目标 ESLint 通过，Stylelint 通过（既有 6 条 design-token suggestions），CSS 与合同测试 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实键盘聚焦与 HC 对比环仍未覆盖。

### §135 标题栏 Menubar 菜单项键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器标题栏 Menubar 菜单项为 `role=menuitem`、动态 tabindex，但普通主题仍需与 GPT 视觉一致的焦点反馈。实施仅让普通主题 `.menubar-menu-button:focus-visible .menubar-menu-title` 去除产品自有 focus ring 并使用 `toolbar-hoverBackground`；HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）对比环，不改菜单语义或动态 tabindex。

验证：刷新产物后 `npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/menubarControlCss.test.ts` 2 passing（合同匹配收紧后复跑）；目标 ESLint、Stylelint 通过，CSS 与合同测试 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实菜单键盘聚焦与 HC 对比环仍未覆盖。

### §136 标题栏右侧主 action-toolbar 动作键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器标题栏右侧主 `action-toolbar-container` 由 `TitlebarPart.createActionToolBar()` 的 `WorkbenchToolBar` 渲染，action view item 管理动态焦点；普通主题仍需与 GPT 视觉一致的轻量反馈。实施仅让普通主题 action-item/label `:focus-visible` 去除产品自有 focus ring 并使用 `toolbar-hoverBackground`，HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）对比环，不改动作焦点管理或布局。

验证：刷新产物后 `npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/titlebarActionsCss.test.ts` 2 passing；目标 ESLint、Stylelint 通过（既有 6 条 design-token suggestions），CSS 与合同测试 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实标题栏键盘聚焦与 HC 对比环仍未覆盖。

### §137 Statusbar entry 键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Statusbar entry 的 `.statusbar-item-label` 由 `StatusbarItem` 声明为 `role=button`、`tabIndex=-1`，并由 StatusbarPart 的 entry focus API 程序化聚焦；普通主题仍需与 GPT 视觉一致的轻量反馈。实施仅让普通主题 `:focus-visible` 去除产品自有 focus ring，使用 `statusBarItem-hoverBackground`（fallback `toolbar-hoverBackground`）背景反馈；HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，不改 statusbar entry 的 ARIA、键盘导航或 focus API。

验证：刷新产物后 `npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/statusbarPartCss.test.ts` 2 passing；目标 ESLint、Stylelint 通过（既有 10 条 design-token suggestions），CSS 与合同测试 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实状态栏键盘聚焦与 HC 对比环仍未覆盖。

### §138 Statusbar 根容器键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Statusbar 根容器由 `StatusbarPart` 创建为 `role=status`、`aria-live=off`、`tabIndex=0`，普通主题仍会落入产品自有 focus ring。实施仅让普通主题根容器 `:focus-visible` 去除装饰性 outline；HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，不改 Statusbar entry focus API、ARIA 或键盘导航。

验证：刷新产物后 `npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/statusbarRootCss.test.ts` 2 passing；目标 ESLint、Stylelint 通过（既有 10 条 design-token suggestions），CSS 与合同测试 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实状态栏根焦点与 HC 对比环仍未覆盖。

### §139 工作台横向 ActionBar 高对比焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器通用横向 `monaco-action-bar` 普通主题已复用 `toolbar-hoverBackground` 并清除 outline，但该规则同样覆盖 HC；实施仅在 HC black/light 为 action-label 与 dropdown-with-primary 的 `:focus`/`:focus-visible` 恢复 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留 disabled 排除、动作焦点管理与原有普通主题 hover 语义。

验证：刷新产物后 `npm run transpile-client` 通过；`VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh --run src/vs/workbench/test/node/workbenchActionBarFocusCss.test.ts` 2 passing；目标 ESLint、Stylelint 通过（既有 10 条 design-token suggestions），CSS 与合同测试 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实横向 ActionBar 键盘聚焦与 HC 对比环仍未覆盖。

### §140 屏幕阅读器说明浮层操作链接键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器屏幕阅读器说明浮层 `.buttons a` 操作链接已有按压反馈，但普通主题缺少与 GPT 视觉一致的键盘焦点反馈；实施仅让普通主题使用 `toolbar-hoverBackground` 轻量反馈并清除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，保留链接语义与 §109 已覆盖的取消按钮行为。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorStatusLinksCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实屏幕阅读器浮层键盘聚焦与 HC 对比环仍未覆盖。

### §141 空编辑器组容器键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器空组容器由 `EditorGroupView.focus()` 程序化聚焦，旧规则直接依赖 `editorGroup-focusedEmptyBorder`，普通主题 token 为空时语义不够明确，而 HC 仅回退到 `focusBorder`。实施仅显式收敛普通主题空组焦点为无装饰性 outline，并在 HC black/light 使用 `editorGroup-focusedEmptyBorder`，缺失时回退 `contrastActiveBorder`（再回退 `focusBorder`）；保留最后一个空组不画 outline、拖放状态与焦点恢复语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorGroupEmptyFocusCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实空编辑器组键盘聚焦与 HC 对比环仍未覆盖。

### §142 编辑器标签本体键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器标签本体由 `MultiEditorTabsControl` 以 `role=tab`、roving `tabIndex` 管理，普通主题仍会命中工作台通用 focus ring；实施仅让标签本体 `:focus-visible` 在普通主题移除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环并保留原有 `-2px` inset offset，不改 `aria-selected`、Tab/Arrow 导航、拖放或标签动作语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `multiEditorTabsControlTabFocusCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实标签键盘聚焦与 HC 对比环仍未覆盖。

### §143 面包屑选择器行键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 breadcrumbs picker 的文件/符号行由 `WorkbenchDataTree` 管理 `.monaco-list-row.focused`，普通主题仍会显示工作台通用 focus ring；实施仅让普通主题聚焦行移除装饰性 outline，保留列表自身的 focus background，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，不改 breadcrumbs picker 的树键盘导航、选择语义、ARIA 或已有按压背景。

验证：刷新产物后 `npm run transpile-client` 通过；focused `breadcrumbsPickerFocusCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 breadcrumbs picker 键盘聚焦与 HC 对比环仍未覆盖。

### §144 单编辑器内联面包屑项键盘焦点合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器单标签内联 breadcrumbs 的 `.monaco-breadcrumb-item` 由 `BreadcrumbsWidget` 以 `role=listitem` 与 roving `tabIndex=-1` 管理，普通主题此前只有按压反馈；实施仅为 `.title.breadcrumbs` 内联项补上普通主题 `toolbar-hoverBackground` 轻量焦点反馈并移除装饰性 outline，HC black/light 使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环，不改面包屑的焦点/选择事件、ARIA 或路径分隔符。

验证：刷新产物后 `npm run transpile-client` 通过；focused `singleEditorTabsControlCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实单编辑器内联面包屑键盘聚焦与 HC 对比环仍未覆盖。

### §145 单编辑器标题动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现单编辑器标题动作按钮的普通主题 hover/focus 反馈使用 `background-color` 过渡，而全局 reduced-motion 规则未覆盖 editor part。实施仅为标题动作 `action-label` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、动作焦点管理或 ARIA。

验证：刷新产物后 `npm run transpile-client` 通过；focused `singleEditorTabsControlCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 标题动作与 HC 键盘聚焦仍未覆盖。

### §146 多编辑器标签状态过渡 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现多编辑器标签本体使用 `background-color` 过渡来切换 active/selected 状态，而 editor part 未被全局 reduced-motion 选择器覆盖。实施仅为 `.tabs-container > .tab` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变标签的 roving `tabIndex`、`aria-selected`、普通主题焦点反馈或 HC 对比环。

验证：刷新产物后 `npm run transpile-client` 通过；focused `multiEditorTabsControlTabFocusCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 标签切换与 HC 键盘聚焦仍未覆盖。

### §147 多编辑器 Add Tab 动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现多编辑器 Add Tab action-label 使用 `background-color` 过渡，editor part 未被全局 reduced-motion 选择器覆盖。实施仅为 `.tabs-bar-add-tab .action-label` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变 Add Tab 的禁用态、普通主题焦点反馈或 HC 对比环。

验证：刷新产物后 `npm run transpile-client` 通过；focused `multiEditorTabsControlCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion Add Tab 与 HC 键盘聚焦仍未覆盖。

### §148 多编辑器标签动作按钮 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现多编辑器已有标签内 `.tab-actions .action-label.codicon` 使用 `background-color` 过渡，而 editor part 未被全局 reduced-motion 选择器覆盖。实施仅为标签动作按钮增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变动作显示/隐藏、普通主题焦点反馈或 HC 对比环。

验证：刷新产物后 `npm run transpile-client` 通过；focused `multiEditorTabsControlTabActionsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 标签动作与 HC 键盘聚焦仍未覆盖。

### §149 面包屑编辑器类型动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 breadcrumbs 的 `.breadcrumbs-editor-type` 使用 `background-color`/`color` 过渡，而 editor part 未被局部 reduced-motion 选择器覆盖。实施仅为该编辑器类型动作增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、编辑器类型菜单或 ARIA 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `breadcrumbsControlCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 面包屑编辑器类型动作与 HC 键盘聚焦仍未覆盖。

### §150 面包屑 picker 行 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现 breadcrumbs picker 的 `.picker-item` 使用 `background-color` 过渡，而 picker 局部未被 reduced-motion 选择器覆盖。实施仅为 picker 行项增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变 picker 的普通主题焦点反馈、HC 对比环、列表导航或 ARIA 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `breadcrumbsPickerFocusCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion picker 行与 HC 键盘聚焦仍未覆盖。

### §151 单编辑器标题标签 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器单标签标题 `.title-label` 使用 `background-color` 过渡来呈现 active 反馈，而 editor part 未被局部 reduced-motion 选择器覆盖。实施仅为单标签标题增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变 active 背景、普通主题焦点反馈、HC 语义或标题点击行为。

验证：刷新产物后 `npm run transpile-client` 通过；focused `singleEditorTabsControlCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 单标签标题与 HC 键盘聚焦仍未覆盖。

### §152 单编辑器内联面包屑项 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现单编辑器标题内联 breadcrumbs 的 `.monaco-breadcrumb-item` 使用 `color` 过渡，而 editor part 未被局部 reduced-motion 选择器覆盖。实施仅为内联面包屑项增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、路径导航或 ARIA 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `singleEditorTabsControlCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 内联面包屑与 HC 键盘聚焦仍未覆盖。

### §153 编辑器标签标题链接 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现编辑器标签标题链接（单编辑器 title label 与多编辑器 tab label）使用 `opacity` 过渡来呈现按压反馈，而 editor part 未被局部 reduced-motion 选择器覆盖。实施仅为两类标题链接增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变链接指针、按压透明度、普通主题焦点、HC 语义或打开动作。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorTabsControlCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 标签标题链接与 HC 键盘聚焦仍未覆盖。

### §154 标签下方面包屑项 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现多编辑器标签下方 breadcrumbs 的 `.monaco-breadcrumb-item` 使用 `background-color` 过渡，而 editor title control 未被局部 reduced-motion 选择器覆盖。实施仅为 `.breadcrumbs-below-tabs` 面包屑项增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、路径导航或 ARIA 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorTitleBreadcrumbsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 标签下方面包屑与 HC 键盘聚焦仍未覆盖。

### §155 编辑器快速访问 dirty-editor 动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器快速访问 dirty-editor 动作按钮使用 `background-color` 过渡，而 editor quick access 局部未被 reduced-motion 选择器覆盖。实施仅为 dirty-editor 动作增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、dirty 状态或打开/关闭动作。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorQuickAccessCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion dirty-editor 动作与 HC 键盘聚焦仍未覆盖。

### §156 编辑器占位页操作按钮 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器占位页操作按钮使用 `background-color` 过渡，而 editor placeholder 局部未被 reduced-motion 选择器覆盖。实施仅为占位页操作按钮增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、按钮语义或点击动作。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorPlaceholderCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 占位页动作与 HC 键盘聚焦仍未覆盖。

### §157 编辑器状态说明关闭动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器屏幕阅读器说明浮层关闭按钮使用 `background-color` 过渡，而 editor status 局部未被 reduced-motion 选择器覆盖。实施仅为 `.screen-reader-detected-explanation .cancel` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、关闭语义或可见状态。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorStatusCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 状态说明关闭动作与 HC 键盘聚焦仍未覆盖。

### §158 编辑器状态说明动作链接 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器屏幕阅读器说明浮层动作链接使用 `background-color` 过渡，而 editor status 局部未被 reduced-motion 选择器覆盖。实施仅为 `.screen-reader-detected-explanation .buttons a` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、链接语义或动作导航。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorStatusLinksCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 状态说明链接与 HC 键盘聚焦仍未覆盖。

### §159 编辑器 watermark 动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器空组 watermark 工具栏 `.action-label` 使用 `background-color` 过渡，而 editor group view 局部未被 reduced-motion 选择器覆盖。实施仅为 watermark 工具栏动作增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、空组动作或 ARIA 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorGroupWatermarkToolbarCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion watermark 动作与 HC 键盘聚焦仍未覆盖。

### §160 编辑器组容器工具栏动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器空组容器 toolbar `.action-label` 使用 `background-color` 过渡，而 editor group view 局部未被 reduced-motion 选择器覆盖。实施仅为 `.editor-group-container-toolbar .action-label` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、空组工具栏动作或 ARIA 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorGroupToolbarCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 组容器 toolbar 与 HC 键盘聚焦仍未覆盖。

### §161 模态编辑器导航按钮 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器模态编辑器导航按钮使用 `background-color` 过渡，而 modal editor 局部未被 reduced-motion 选择器覆盖。实施仅为 `.modal-editor-nav-button` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、禁用态或导航动作。

验证：刷新产物后 `npm run transpile-client` 通过；focused `modalEditorPartCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 模态编辑器导航与 HC 键盘聚焦仍未覆盖。

### §162 模态编辑器标题栏动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器模态编辑器标题栏动作 `.action-label` 使用 `background-color` 过渡，而 modal editor action 局部未被 reduced-motion 选择器覆盖。实施仅为标题栏动作增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、动作语义或导航能力。

验证：刷新产物后 `npm run transpile-client` 通过；focused `modalEditorActionsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 模态标题栏动作与 HC 键盘聚焦仍未覆盖。

### §163 模态编辑器侧栏切换动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器模态编辑器侧栏切换动作继承 action bar 的 `background-color`/`color` 过渡，而 modal editor 侧栏切换局部未被 reduced-motion 选择器覆盖。实施仅增加 `.modal-editor-sidebar-toggle .action-label` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，继续复用工作台普通主题与 HC action bar 焦点语义，不改变侧栏切换动作或 ARIA 行为。

验证：刷新产物后 `npm run transpile-client` 通过；focused `modalEditorSidebarToggleCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 模态侧栏切换与 HC 键盘聚焦仍未覆盖。

### §164 编辑器组预览空态动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 editor group 预览分类空态动作按钮在 hover/focus 背景变化时没有局部过渡契约。实施仅为 `.preview-category-empty-action-button` 增加轻量 `background-color` 过渡，并提供 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支；保持普通主题静默焦点、HC 对比环、按钮语义和点击能力不变。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorGroupViewCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 预览空态动作与 HC 键盘聚焦仍未覆盖。

### §165 多编辑器标签栏 editor actions reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器多编辑器标签栏的 editor actions 动作标签继承 action bar 过渡，而 `.editor-actions` 局部未被 reduced-motion 选择器覆盖。实施仅增加 `.editor-actions .action-item .action-label` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变普通主题焦点反馈、HC 对比环、动作命令或标签布局。

验证：刷新产物后 `npm run transpile-client` 通过；focused `multiEditorTabsControlEditorActionsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion editor actions 与 HC 键盘聚焦仍未覆盖。

### §166 编辑器拖放目标移动过渡 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器拖放目标 overlay 的移动指示器在启用 motion 时使用位置与透明度过渡，而 reduced-motion 分支没有显式覆盖。实施仅为 `.editor-group-overlay-indicator.overlay-move-transition` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变拖放命中、普通主题布局或 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorDropTargetCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 拖放指示器与 HC 键盘聚焦仍未覆盖。

### §167 编辑器拖放目标提示 opacity reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器拖放目标的 drop-into prompt 在启用 motion 时使用 opacity 过渡，而提示本身没有 reduced-motion 覆盖。实施仅为 `.editor-group-overlay-drop-into-prompt` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变拖放提示文本、命中区域、普通主题布局或 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorDropTargetCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 拖放提示与 HC 键盘聚焦仍未覆盖。

### §168 编辑器拖放目标 overlay opacity reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器拖放目标 overlay 指示器在启用 motion 时使用 opacity 过渡，而指示器本体没有 reduced-motion 覆盖。实施仅为 `.editor-group-overlay-indicator` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变拖放目标布局、提示内容或 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `editorDropTargetCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion 拖放 overlay 与 HC 键盘聚焦仍未覆盖。

### §169 Quick Input 最近工作区动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Quick Input 最近工作区动作 `dirty-workspace`/`opened-workspace` 使用 `background-color` 过渡，而 workbench actions 局部未被 reduced-motion 选择器覆盖。实施仅增加两类动作的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，继续复用共享 action bar 的普通主题与 HC 焦点语义，不改变最近工作区动作或图标。

验证：刷新产物后 `npm run transpile-client` 通过；focused `quickInputWorkspaceActionsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion Quick Input 工作区动作与 HC 键盘聚焦仍未覆盖。

### §170 Screencast keyboard overlay reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Screencast keyboard overlay 在启用 motion 时使用 opacity 过渡，而 overlay 本身没有 reduced-motion 覆盖。实施仅增加 `.screencast-keyboard` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变键盘提示内容、pointer-events、普通主题布局或 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `screencastKeyboardCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion Screencast overlay 与 HC 键盘聚焦仍未覆盖。

### §171 Notifications center/list 动作 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器工作台 notifications center/list 工具栏动作标签使用 `background-color` 过渡，而 notifications actions 局部未被 reduced-motion 选择器覆盖。实施仅为通知列表与通知中心两类 `.action-label` 增加 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，继续复用共享 action bar 的普通主题与 HC 焦点语义，不改变通知动作或 ARIA 行为。

验证：刷新产物后 `npm run transpile-client` 通过；focused `notificationsActionsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion notifications 动作与 HC 键盘聚焦仍未覆盖。

### §172 Notifications toast 入场过渡 reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器工作台 notification toast 入场使用 transform/opacity 过渡，已有 `.monaco-reduce-motion` 分支但缺少系统 `prefers-reduced-motion` 兜底。实施仅增加 `@media (prefers-reduced-motion: reduce)` 且尊重 `.monaco-enable-motion` 的 `transition: none` 分支，不改变 toast 动画状态、布局、普通主题样式或 HC 对比语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `notificationsToastsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion toast 入场与 HC 键盘聚焦仍未覆盖。

### §173 Views pane header reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 views pane header 在按压反馈时使用 `background-color` 过渡，而 pane viewlet 局部未被 reduced-motion 选择器覆盖。实施仅增加 `.monaco-pane-view .pane > .pane-header` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，不改变 pane 展开动作、视图布局或 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `paneViewletCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion pane header 与 HC 键盘聚焦仍未覆盖。

### §174 Notifications list row reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 notifications list row 在按压反馈时使用 `background-color` 过渡，而列表行局部未被 reduced-motion 选择器覆盖。实施仅增加 `.notifications-list-container .monaco-list-row` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留现有 active selection 背景、列表布局、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `notificationsListCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion notifications list row 与 HC 键盘聚焦仍未覆盖。

### §175 Notifications list action buttons reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 notifications list action buttons 与下拉按钮在按压反馈时使用 `background-color`/`filter` 过渡，而按钮局部未被 reduced-motion 选择器覆盖。实施仅增加按钮与下拉按钮的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留现有 pressed filter、按钮焦点间距、列表布局、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `notificationsListCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion notifications list action buttons 与 HC 键盘聚焦仍未覆盖。

### §176 Notifications message link reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 notifications message link 的按压反馈使用 `opacity` 过渡，而消息链接局部未被 reduced-motion 选择器覆盖。实施仅增加消息链接的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留现有通知链接焦点反馈、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `notificationsListCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion notifications message link 与 HC 键盘聚焦仍未覆盖。

### §177 Global composite bar account avatar reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器工作台 global composite bar 账户头像按压反馈使用 `opacity` 过渡，而头像动作局部未被 reduced-motion 选择器覆盖。实施仅增加 `.monaco-action-bar .action-label .accounts-avatar` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留现有 active opacity、账户动作语义、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `globalCompositeBarCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion account avatar 与 HC 键盘聚焦仍未覆盖。

### §178 Pane composite title actions reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 pane composite title actions 的按压反馈使用 `background-color` 过渡，而标题动作局部未被 reduced-motion 选择器覆盖。实施仅增加 title actions、global actions 与 global actions-left 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留现有 active 背景、HC 焦点指示器、动作布局与普通主题语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `paneCompositePartCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion pane composite title actions 与 HC 键盘聚焦仍未覆盖。

### §179 Pane composite bar action-item reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 pane composite title/header composite bar action-item 的按压反馈使用 `background-color` 过渡，而 composite bar item 局部未被 reduced-motion 选择器覆盖。实施仅增加 title 与 header/footer composite bar action-item 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留现有 active 背景、拖拽指示器、HC 焦点指示器与布局语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `paneCompositePartCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion pane composite bar action-item 与 HC 键盘聚焦仍未覆盖。

### §180 Pane composite drag indicator reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 pane composite 拖拽边界伪元素使用 100ms 延迟来显示边界指示，而该延迟局部未被 reduced-motion 选择器覆盖。实施仅为 title 与 header/footer composite bar action-item 的 `::before`/`::after` 在 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）下设 `transition: none`，保留 dragged-over 显隐、拖拽位置语义、HC 焦点指示器与布局行为。

验证：刷新产物后 `npm run transpile-client` 通过；focused `paneCompositePartCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion pane composite 拖拽指示与 HC 键盘聚焦仍未覆盖。

### §181 Pane composite empty action reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 pane composite 空态消息链接与按钮的按压反馈使用 `background-color`/`filter` 过渡，而空态动作局部未被 reduced-motion 选择器覆盖。实施仅增加空态消息链接与按钮的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留现有 pressed filter/opacity、空态布局、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `paneCompositePartCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion pane composite 空态动作与 HC 键盘聚焦仍未覆盖。

### §182 Sidebar title action reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 sidebar title action 的按压反馈使用 `background-color` 过渡，而 sidebar 标题动作局部未被 reduced-motion 选择器覆盖。实施仅增加 `.part.sidebar .title-actions .action-label` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留现有 active 背景、sidebar 布局、普通主题与 HC 焦点语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `sidebarPartCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion sidebar title action 与 HC 键盘聚焦仍未覆盖。

### §183 Sidebar collapsible header action reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 sidebar 可折叠视图 header action 的按压反馈使用 `background-color` 过渡，而 header action 局部未被 reduced-motion 选择器覆盖。实施仅增加 `.viewlet .collapsible.header .action-label` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留折叠视图布局、active 背景、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `sidebarPartCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion sidebar collapsible header action 与 HC 键盘聚焦仍未覆盖。

### §184 Views empty message link reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 views 空态消息链接的按压反馈使用 `opacity` 过渡，而 views message link 局部未被 reduced-motion 选择器覆盖。实施仅增加 `.tree-explorer-viewlet-tree-view .message p > a` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留现有 active opacity、链接焦点、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `viewsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion views 空态消息链接与 HC 键盘聚焦仍未覆盖。

### §185 Views welcome link reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 views welcome-view 空态正文链接的按压反馈使用 `opacity` 过渡，而 welcome link 局部未被 reduced-motion 选择器覆盖。实施仅增加 `.pane > .pane-body .welcome-view-content a` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留现有 active opacity、welcome 布局、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `viewsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion views welcome link 与 HC 键盘聚焦仍未覆盖。

### §186 Views welcome button layout reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 views welcome 空态按钮容器在宽度展开时使用 `max-width` 过渡，而布局动画局部未被 reduced-motion 选择器覆盖。实施仅增加 welcome button container 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留 wide 状态、空态布局、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `viewsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion views welcome button layout 与 HC 键盘聚焦仍未覆盖。

### §187 Views welcome button reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 views welcome 空态按钮按压反馈使用 `background-color`/`filter` 过渡，而 welcome button 局部未被 reduced-motion 选择器覆盖。实施仅增加 welcome button 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留 pressed filter、wide 布局、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `viewsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion views welcome button 与 HC 键盘聚焦仍未覆盖。

### §188 Custom view node action reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 custom view tree 节点 action-label 的按压反馈使用 `background-color` 过渡，而节点动作局部未被 reduced-motion 选择器覆盖。实施仅增加 custom view node action-label 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留节点动作显隐、active 背景、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `viewsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion custom view node action 与 HC 键盘聚焦仍未覆盖。

### §189 Custom view node checkbox reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 custom view tree 节点 checkbox 的按压反馈使用 `background-color` 过渡，而 checkbox 局部未被 reduced-motion 选择器覆盖。实施仅增加 custom view node checkbox 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留选中态边框、pressed 背景、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `viewsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion custom view node checkbox 与 HC 键盘聚焦仍未覆盖。

### §190 Custom view node row reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 custom view tree 节点主体行的 active selection 使用 `background-color` 过渡，而节点行局部未被 reduced-motion 选择器覆盖。实施仅增加 custom view node row 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留 active selection、树布局、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `viewsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion custom view node row 与 HC 键盘聚焦仍未覆盖。

### §191 Views pane filter action reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 views pane filter toolbar action-label 的按压反馈使用 `background-color` 过渡，而 filter action 局部未被 reduced-motion 选择器覆盖。实施仅增加 `.viewpane-filter > .viewpane-filter-controls .monaco-action-bar .action-label` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留过滤动作、active 背景、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `viewsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion views pane filter action 与 HC 键盘聚焦仍未覆盖。

### §192 Views empty message button reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 views 空态消息按钮与 welcome 按钮共用 `background-color`/`filter` 过渡，但此前 reduced-motion 覆盖仅落在 welcome 按钮，消息按钮仍会保留按压动效。实施仅为 `.tree-explorer-viewlet-tree-view .message .button-container > .monaco-button` 补齐 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留消息按钮的 active filter、命中区、动作语义、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `viewsCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion views 空态消息按钮与 HC 键盘聚焦仍未覆盖。

### §193 Panel composite title action reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 panel composite title action-label 使用 `color` 过渡来呈现 hover/focus 状态，而 panel 局部此前没有 reduced-motion 覆盖。实施仅增加 `.part.panel > .title > .composite-bar-container > .composite-bar > .monaco-action-bar .action-item .action-label` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留 active 背景、panel title active 前景、动作命中区、普通主题与 HC 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `panelPartCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion panel composite action 与 HC 键盘聚焦仍未覆盖。

### §194 Auxiliary bar title action reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 auxiliary bar 标题操作 action-label 使用 `background-color` 过渡，而 auxiliary bar 局部此前没有 reduced-motion 覆盖。实施仅增加 `.part.auxiliarybar .title-actions .action-label` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留 active 背景、标题前景、HC 对比轮廓、动作命中区与现有 auxiliary bar 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `auxiliaryBarPartCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion auxiliary bar title action 与 HC 键盘聚焦仍未覆盖。

### §195 Statusbar entry reduced-motion 合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器状态栏条目标签使用 `background-color` 过渡来呈现按压/焦点反馈，而 statusbar 局部此前没有 reduced-motion 覆盖。实施仅增加 `.part.statusbar > .items-container > .statusbar-item > .statusbar-item-label` 的 `.monaco-reduce-motion` 与 `prefers-reduced-motion`（尊重 `.monaco-enable-motion` 显式启用）两条 `transition: none` 分支，保留 active 背景、普通主题焦点反馈、HC 对比环与状态栏 entry 语义。

验证：刷新产物后 `npm run transpile-client` 通过；focused `statusbarPartCss.test.ts` 合同测试通过，目标 ESLint、Stylelint 与 `git diff --check` 通过；未启动默认编辑器/HC 窗口，真实 reduced-motion statusbar entry 与 HC 键盘聚焦仍未覆盖。

### §196 标题栏左侧导航与 Logo 清理合同窄实施检查点（2026-11-06）

用户收窄范围后，Sol 只读复核确认默认编辑器标题栏的 Go Back / Go Forward 原先仅挂在 `MenuId.CommandCenter`，且 Windows/Linux 自定义标题栏仍创建 `window-appicon`。实施新增专用 `MenuId.TitleBarNavigation`，将两个历史导航动作移出 Command Center，交给标题栏左侧 `MenuWorkbenchToolBar`；保留动作原有 `canNavigateBack` / `canNavigateForward` precondition、平台快捷键与 disabled 状态。同步移除 `window-appicon` 创建、对应 CSS 以及 Electron 原生标题栏子类对旧 `appIcon` 的拖拽/双击接线，保留 `titlebar-drag-region`、窗口控制容器顺序和辅助窗口标题栏路径；Projects/Navigator 未改。

验证：刷新产物后 `npm run transpile-client` 通过；focused `titlebarNavigationContract.test.ts` 合同测试通过，Stylelint 与 `git diff --check` 通过；目标 ESLint 仅保留既有 `titlebarPart.ts` `querySelector` warning；未启动默认编辑器/HC 窗口，真实标题栏左侧导航键盘路径、禁用态、拖拽区以及 Windows/Linux/macOS/辅助窗口对照仍未覆盖。

### §197 Conversation/Trajectory lens tab 视觉 surface 收敛合同窄实施检查点（2026-11-06）

截图反馈确认默认编辑器 Conversation/Trajectory 标签的选中与按压灰色背景几乎铺满 32px 标签，圆角呈大胶囊。实施保留 tab button 的 32px 命中区、`role="tab"`、`aria-selected`、tabIndex 与既有键盘切换；将 hover、active、selected 与普通主题 focus-visible 背景移到内缩的 `::before` surface（`inset: 3px 2px`、`cornerRadius.small`），保留 HC focus-visible 对比环，并同步清零 reduced-motion 下 pseudo surface 的过渡。未改变 Conversation/Trajectory 切换语义，也未修改 Projects/Navigator。

验证：刷新产物后 `npm run transpile-client` 通过；focused `conversationLensCssScan.test.ts` 的 tab 合同断言通过（49 passing）；目标 Stylelint 与 `git diff --check` 通过，ESLint 仍命中既有 `contribution.includes("querySelector('.conversation-timeline')")` 的 unexternalized-string warning。未启动默认编辑器/HC 窗口，真实 32px 命中区、普通主题选中/按压范围与 HC 键盘焦点仍未覆盖。

### §198 Composer ghost/send action 普通主题焦点反馈合同窄实施检查点（2026-11-06）

Sol 只读复核当前 dirty diff 后发现默认编辑器 Conversation Composer 的 add/tune/more/exit ghost action 与 send action 仍以产品自有 `focusBorder` 外圈作为普通主题键盘反馈，和 GPT 风格的轻量表面反馈不一致。实施仅将普通主题 ghost action 的 `:focus-visible` 改为 `toolbar-hoverBackground` 背景、send action 保留实心圆并使用同一深浅层级的背景变化；HC black/light 继续保留 `contrastActiveBorder`（fallback `focusBorder`）对比环，按钮命中区、disabled 状态、ARIA/键盘动作与 reduced-motion 选择器不变。

验证：刷新产物后 `npm run transpile-client` 通过；focused `conversationLensCssScan.test.ts` 的 Composer 焦点合同断言通过（49 passing）；Stylelint 退出 0（既有未知变量与 104 条 design-token suggestions），`git diff --check` 与 docs-health（0 errors/37 baseline warnings）通过；ESLint 仍仅命中既有 `contribution.includes("querySelector('.conversation-timeline')")` 的 unexternalized-string warning。未启动默认编辑器/HC 窗口，真实 Composer 普通主题键盘焦点、HC 对比环与窄叶命中仍未覆盖。

### §199 Composer 按压态层级合同窄实施检查点（2026-11-06）

Sol 复核发现 Composer 的 ghost/filled/send 控件在普通主题按下时同时满足 `:active` 与 `:hover`，后声明的 hover 规则会覆盖同等 specificity 的按压反馈；因此鼠标按住时仍停留在 hover 色，按压层级不明显。实施仅在各 variant 的 hover 规则之后补回 ghost/filled 的 `toolbar-activeBackground` 与 send 圆按钮的 75% foreground mix 按压色；不改 28px 按钮几何、外扩命中区、disabled、ARIA、键盘动作或 reduced-motion。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `conversationLensCssScan.test.ts` 的 Composer 按压合同通过（49 passing）；Stylelint exit 0（既有 unknown-variable/design-token suggestions），目标 ESLint 仅保留既有 unexternalized-string warning，`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实按压色与高对比人工观察仍待补。

### §200 Composer maximize action 按压反馈合同窄实施检查点（2026-11-06）

Sol 复核发现 Composer 输入框右上角的 maximize action 只有 hover/focus surface，没有独立的 `:active` 表面；鼠标按住时不会像其它输入栏动作一样给出明确的 pressed 反馈。实施仅为 `.conversation-lens-dock-maximize-input-button` 增加 `:active:not(.disabled)` 的 `toolbar-activeBackground`，保留 22px 几何、显示/隐藏门控、焦点、ARIA、键盘动作与 reduced-motion。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `conversationLensCssScan.test.ts` 的 maximize 按压合同通过（49 passing）；Stylelint exit 0（既有 unknown-variable/design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 maximize 按压和高对比观察仍待补。

### §201 Composer @ mention option hover/按压反馈合同窄实施检查点（2026-11-06）

Sol 复核发现 Composer 的 `@` mention listbox 选项只有键盘 `is-active` 选中背景，没有普通主题的 pointer hover 或按住反馈；鼠标浏览候选项时列表表面不随指针变化，点击也缺少即时 pressed 层级。实施仅为非活动选项增加 `list-hoverBackground` hover/focus surface，为选项增加 `toolbar-activeBackground` 按压 surface；保留 `aria-activedescendant`、listbox/option 角色、键盘上下切换、候选选择和活动项背景，不改变 ARIA 或数据行为。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `conversationLensCssScan.test.ts` 的 @ mention hover/按压合同通过（49 passing）；Stylelint exit 0（既有 unknown-variable/design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 @ mention 候选 hover、按压与高对比观察仍待补。

### §202 Composer reference chip remove focus feedback合同窄实施检查点（2026-11-06）

Sol 复核发现 Composer 引用 chip 的 Remove button 普通主题仍使用产品自有 `focusBorder` 外圈，和已收敛的 Composer 轻量表面反馈不一致；hover/active 表面已经存在。实施仅让普通主题 `:focus-visible` 使用 `toolbar-hoverBackground` 并清除外圈，高对比主题继续保留 `contrastActiveBorder` 对比环；不改 22px 命中区、引用删除、`aria-label`、键盘激活或 reduced-motion。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `conversationLensCssScan.test.ts` 的 reference remove 焦点合同通过（49 passing）；Stylelint exit 0（既有 unknown-variable/design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实引用 chip 键盘焦点与高对比观察仍待补。

### §203 Composer permission/Agent/Model selector focus feedback合同窄实施检查点（2026-11-06）

Sol 复核发现 Composer 底栏的 Permission、Agent、Model 原生 SelectBox 普通主题 `:focus-visible` 仍画 `focusBorder` 外圈，和同一输入栏已收敛的轻量表面焦点反馈不一致；hover/active 表面已存在。实施仅让普通主题选择器使用 `toolbar-hoverBackground` 并清除外圈，高对比主题保留 `contrastActiveBorder` / `focusBorder` fallback 对比环；不改选择值、下拉行为、28px 行高、禁用态、ARIA 或键盘操作。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `conversationLensCssScan.test.ts` 的 selector 焦点合同 49 passing；Stylelint exit 0（既有 unknown-variable/design-token suggestions），`git diff --check` 通过。目标 ESLint 仅保留既有 unexternalized-string warning；未启动默认编辑器/HC 窗口，真实选择器键盘焦点与高对比观察仍待补。

### §204 Composer More/Add popup focus feedback合同窄实施检查点（2026-11-06）

Sol 复核发现 Composer 的 More/Add 弹出菜单选项普通主题 `:focus-visible` 仍使用产品自有 `focusBorder` 外圈，尽管同一规则已经提供菜单选中背景；这会让键盘移动时出现额外矩形环。实施仅让普通主题 popup option 焦点沿用菜单选择表面并清除外圈，高对比主题继续保留 2px `contrastActiveBorder` ring；不改菜单项命令、角色、Escape 关闭、选择状态或 reduced-motion。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `conversationLensCssScan.test.ts` 的 popup 焦点合同 49 passing；Stylelint exit 0（既有 unknown-variable/design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 More/Add 菜单键盘焦点与高对比观察仍待补。

### §205 Composer Tune popup Open action 反馈合同窄实施检查点（2026-11-06）

Sol 复核发现 Composer Tune popup 的 “Open Engine Preferences” button 只有 hover surface，没有独立的普通主题 `focus-visible` 或 pressed surface；键盘进入或按住时反馈不完整。实施仅补 `toolbar-hoverBackground` focus-visible（去除装饰性 outline）与 `toolbar-activeBackground` pressed surface，高对比保留 2px `contrastActiveBorder` ring；不改按钮命令、角色、Escape 关闭、24px 几何或 reduced-motion。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `conversationLensCssScan.test.ts` 的 Tune popup Open 合同 49 passing；Stylelint exit 0（既有 unknown-variable/design-token suggestions），`git diff --check` 通过。目标 ESLint 仅保留既有 unexternalized-string warning；未启动默认编辑器/HC 窗口，真实 Tune popup 键盘焦点、按压与高对比观察仍待补。

### §206 Composer reference session-pill 焦点反馈合同窄实施检查点（2026-11-06）

Sol 复核发现 Composer 引用 chip 内的 session-pill 链接仍沿用全局 `focusBorder` 外圈；§202 已收敛旁边的 Remove button，但链接本身在键盘进入时仍出现额外矩形环。实施仅为 Composer chip 内链接补普通主题的轻量 foreground 表面并清除装饰性 outline，高对比保留 `contrastActiveBorder` 对比环；不改链接激活、资源解析、Remove button、22px 几何或 reduced-motion。

验证：刷新产物后 `npm run transpile-client` exit 0；focused `conversationLensCssScan.test.ts` 的 Composer reference session-pill 焦点合同 49 passing；Stylelint exit 0（既有 `--ua-ease` unknown-variable 与 5 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实引用链接键盘焦点、按压与高对比观察仍待补。

### §207 Conversation/Trajectory tab 按压层级合同窄实施检查点（2026-11-06）

用户反馈标签按压范围违和。复核发现 tab 的 `:active::before` 声明在 `:hover::before` 之前，指针按住时 hover 会覆盖按压表面；实施将按压表面声明移到 hover 之后，保留 32px 可访问命中区与 `inset: 3px 2px` 的内缩视觉面，让按住反馈与选中/hover 面保持同一标签边界，不改 tab 切换、ARIA、键盘、HC 或 reduced-motion。

验证：focused `conversationLensCssScan.test.ts` 增加声明顺序合同并通过；将继续运行 `npm run transpile-client`、Stylelint 与 `git diff --check`。未启动默认编辑器/HC 窗口，真实按压范围与高对比观察仍待补。

### §208 SessionBar controls 键盘焦点表面合同窄实施检查点（2026-11-06）

Sol 复核发现 Conversation SessionBar 的 New/Delete/More、History/Snapshots 与 leaf window-nav 等 `.monaco-button` 普通主题 `:focus-visible` 仍绘制 `focusBorder` 外圈，与同一栏已收敛的轻量 GPT 表面不一致。实施让普通主题焦点沿用 `toolbar-hoverBackground` 并移除装饰性 outline；HC black/light 保留 `contrastActiveBorder` / `contrastBorder` 对比环，不改按钮命中区、命令、键盘、ARIA、disabled 或 reduced-motion。

验证：`npm run transpile-client` 成功（10233 files）；focused `conversationLensCssScan.test.ts` 50 passing；`npm run stylelint -- src/vs/workbench/contrib/conversation/browser/media/conversationLens.css` exit 0（仅既有 unknown-variable 与 104 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 SessionBar 控件焦点与高对比观察仍待补。

### §209 Engine Preferences 通用按钮焦点表面合同窄实施检查点（2026-11-06）

Sol 只读复核发现默认编辑器 Engine Preferences 的 Test Engine、Open Connection 及各 section action buttons 仍依赖通用 `focusBorder` 外圈，和 GPT 风格轻量表面反馈不一致。实施让普通主题 `.engine-preferences-pane .monaco-button:focus-visible` 使用 `toolbar-hoverBackground` 并清除装饰性 outline；HC black/light 保留 `contrastActiveBorder` / `focusBorder` fallback 对比环。不改按钮命令、命中区、disabled、ARIA、键盘动作或 reduced-motion；更具体的 icon-action focus 规则继续优先。

验证：`npm run transpile-client` 成功（10234 files）；focused `enginePreferencesPaneCss.test.ts` 2 passing；`npm run stylelint -- src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css` exit 0（既有 unknown-variable 与 34 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Engine Preferences 按钮焦点与高对比观察仍待补。

### §210 Engine Preferences Back 行级焦点表面合同窄实施检查点（2026-11-06）

Sol 只读复核发现 Engine Preferences 的自定义 Back 行级控件有更具体的 `focusBorder` 焦点规则，会压过 pane 通用按钮的 GPT 风格 quiet surface；Test Engine、Open Connection 与 section action buttons 的 §209 规则不变。实施仅将普通主题 `.engine-preferences-back:focus-visible` 改为 `toolbar-hoverBackground` 并清除装饰性 outline，HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）对比环；不改返回动作、命中区、disabled、ARIA、键盘行为或 reduced-motion。

验证：`enginePreferencesPaneCss.test.ts` focused 1 passing；`npm run transpile-client`、目标 Stylelint 与 `git diff --check` 通过。默认编辑器/HC 窗口未启动，真实 Back 行级焦点与高对比观察仍待补。

### §211 Conversation/Trajectory tab 视觉按压面收窄合同（2026-11-06）

用户反馈标签按压范围仍显得违和。当前 tab 保留 32px 的按钮命中区与 `line-height`，但选中、hover、按压和普通主题键盘焦点统一绘制到 `::before` 内缩视觉面；本轮将视觉面从 `inset: 3px 2px` 收窄为 `inset: 4px 3px`，让高缩放窗口下的背景不再读成整行填充。未改 tab 切换、ARIA、键盘方向键、HC 对比环或 reduced-motion。

验证：刷新产物后 `npm run transpile-client` 通过（10235 files / 2047 resources）；focused `conversationLensCssScan.test.ts` 51 passing；目标 Stylelint exit 0（既有 unknown-variable 与 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实视觉仍需人工窗口复核。

### §212 Engine Preferences Test Engine 焦点表面合同（2026-11-06）

复核发现 Engine Preferences 底部 Test Engine 行的更具体按钮焦点规则仍在普通主题绘制 `focusBorder` 外圈，覆盖了面板已收敛的 GPT 轻量焦点表面。实施仅让普通主题使用 `toolbar-hoverBackground` 并清除装饰性 outline；HC black/light 保留 `contrastActiveBorder`（fallback `focusBorder`）对比环与原有偏移。不改 24px 命中区、Test Engine 命令、ARIA、键盘动作、disabled 或 reduced-motion。

验证：刷新产物后 focused `enginePreferencesPaneCss.test.ts` 2 passing；目标 Stylelint 与 `git diff --check` 通过。默认编辑器/HC 窗口未启动，真实 Test Engine 键盘焦点、按压和高对比观察仍待补。

### §213 Trajectory 搜索框普通主题焦点表面合同（2026-11-06）

Sol 只读复核发现默认编辑器 Conversation 的 Trajectory 搜索框仍在普通主题 `:focus-visible` 绘制 `focusBorder` 外圈；输入框自身已有轻量边框与阴影反馈，额外外圈与 GPT 风格不一致。实施仅移除普通主题搜索框焦点外圈，保留输入框现有 `:focus` 边框/阴影、高对比 `contrastActiveBorder` 对比环、24px 高度、文本输入和键盘行为；不改 Trajectory 筛选逻辑、ARIA 或布局。

验证：刷新产物后 focused `conversationLensCssScan.test.ts` 的 Trajectory 搜索焦点合同通过；目标 Stylelint、ESLint 与 `git diff --check` 通过。未启动默认编辑器/HC 窗口，真实搜索框键盘焦点、窄列和高对比观察仍待补。

### §214 Activity Bar 普通主题键盘焦点表面合同（2026-11-06）

Sol 复核发现 Activity Bar 的普通主题 `.action-item:focus` 会沿用选中项的 `activityBar-activeBackground`，导致键盘移动到未选中的图标时出现过重的选中块；鼠标点击后的 `.clicked:focus` 也会保留这层背景。实施仅将未选中且非鼠标点击的普通主题焦点改为 `toolbar-hoverBackground`，选中项继续保留 active background，高对比边框、44px 命中区、命令和拖拽语义不变。

验证：Node 24 focused `activitybarCssScan.test.ts` 5 passing；目标 Stylelint exit 0（既有 10 条 design-token suggestions）；`transpile-client` 10235 files / 2047 resources；docs-health 0 errors；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Activity Bar 键盘焦点与高对比观察仍待补。

### §215 Navigator 项目/会话列表普通主题键盘焦点表面合同（2026-11-06）

复核发现截图对应的 Navigator 项目与会话列表仍在普通主题 `:focus-visible` 绘制 `focusBorder` 外圈，键盘移动到未选中行时视觉重量高于 GPT 列表行。实施让普通主题 focused 未选中行使用 `toolbar-hoverBackground` 并清除外圈；选中行保留选中背景，HC black/light 保留 `contrastActiveBorder` 对比环、列表键盘导航、行操作与 24px 行布局不变。

验证：Node 24 focused `navigatorProjectsListCss.test.ts` 10 passing（含后续 Team 行焦点与 pressed-focus 合同）；目标 Stylelint exit 0（既有 `--ua-navigation-font-size` unknown-variable 与 1 条 design-token suggestion）；未启动默认编辑器/HC 窗口，真实 Navigator 行焦点与高对比观察仍待补。

### §216 Navigator Team 状态筛选 pressed-focus 层级合同（2026-11-06）

复核发现 Team 状态筛选按钮的普通主题通用 `:focus-visible` 规则会覆盖 `aria-pressed="true"` 的 active surface，键盘聚焦已选筛选项时会误读成普通 hover。实施新增更具体的 pressed-focus 覆盖，让已按下筛选项继续使用 `toolbar-activeBackground`；未改筛选命令、ARIA、命中区或 HC 对比环。

验证：Node 24 focused `navigatorProjectsListCss.test.ts` 10 passing；目标 Stylelint exit 0（既有 2 条 design-token suggestions）；`transpile-client` 10235 files / 2047 resources；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Team 状态筛选键盘焦点仍待补。

### §217 Navigator Agents 层级/活动列表普通主题键盘焦点表面合同（2026-11-06）

复核发现 Navigator Agents 层级树与活动列表的普通主题 `:focus-visible` 仍绘制 `focusBorder` 外圈，未选中行的焦点重量高于 GPT 列表行。实施让普通主题 focused 未选中行使用 `toolbar-hoverBackground` 并清除外圈；HC black/light 保留 `contrastActiveBorder` 对比环，选中背景、状态 glyph、行操作和列表键盘导航不变。

验证：Node 24 focused `navigatorStubCss.test.ts` 3 passing；目标 Stylelint exit 0（既有 2 条 design-token suggestions）；`transpile-client` 10235 files / 2047 resources；docs-health 0 errors；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Agents 列表焦点与高对比观察仍待补。

### §218 Auxiliary Bar 普通主题复合动作焦点/悬停表面合同（2026-11-06）

复核发现 Auxiliary Bar 的复合动作普通主题 hover 与 checked 状态仍绘制 `contrastActiveBorder` 实线/虚线轮廓，视觉重量高于 GPT 工具栏。实施将普通主题未选中 hover/focus-visible 改为 `toolbar-hoverBackground` 并清除轮廓；HC black/light 保留 `contrastActiveBorder` 对比环；不改选中语义、命令或命中区。

验证：Node 24 focused `auxiliaryBarPartCss.test.ts` 3 passing；目标 Stylelint exit 0；`transpile-client` 10235 files / 2047 resources；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Auxiliary Bar 焦点与高对比观察仍待补。

### §219 Conversation turn action bar 紧凑 token 合同（2026-11-06）

Sol 复核 Conversation timeline 的现有动作栏，确认只保留复制、重新生成、删除和在轨迹中查看四个已有动作：最新助手回合动作行常显，更早回合不占行高，悬停或键盘焦点时出现。22px 紧凑命中区保持 O2 约定；间距、图标字号与按钮圆角分别收归 `spacing.size20`、`codiconFontSize` 和 `cornerRadius.small` token。保留 `focus-within` 键盘显现、HC 对比焦点环和 `.monaco-reduce-motion` / `prefers-reduced-motion` 无过渡规则，不新增 ChatGPT 专属动作或改变动作路由。

验证：`conversationLensCssScan.test.ts` 52 passing；`conversationTimelineRenderer.test.ts` 32 passing；`npm run compile-client` exit 0（compile-src 0 errors）；目标 Stylelint exit 0（仅既有 design-token suggestions），docs-health 0 errors，`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实悬停、键盘焦点、窄列和高对比观察仍待补。

### §220 Panel composite title action GPT surface 合同窄实施检查点（2026-11-07）

Sol 复核发现默认编辑器 Panel 顶部 Problems/Output/Debug Console/Terminal 等 composite title actions 仅改变前景色并清除通用 outline，普通主题悬停与键盘焦点没有 GPT 风格的轻量表面，键盘进入时也缺少明确层级。实施让非高对比主题的未禁用 action 在 hover 与 `:focus-visible` 使用 `toolbar-hoverBackground`、保留 panel active foreground；HC black/light 继续使用 `contrastActiveBorder`（fallback `focusBorder`）1px 对比环。同步把现有颜色过渡纳入背景色并沿用既有 reduced-motion 分支；不改面板 tab 选中指示、命令、ARIA、方向布局或命中区。

验证：Node 24.18 focused `panelPartCss.test.ts` 4 passing（含 pressed surface 声明顺序合同）；`npm run transpile-client` exit 0（10222 files / 2047 resources）；目标 Stylelint exit 0（4 条既有 stroke design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Panel 悬停、键盘焦点与高对比观察仍待补。

### §221 Statusbar entry 按压覆盖 hover 的层级合同窄实施检查点（2026-11-08）

Sol 复核发现默认编辑器状态栏条目的普通主题 `:active` 背景声明先于通用 `:hover`，指针按住时后声明的 hover surface 会覆盖 active surface。实施仅在状态栏通用 hover 规则之后补充 `a:active:hover:not(.disabled)` 的 `statusBarItem-activeBackground` 覆盖，保留 statusbar entry 的 22px 几何、ARIA/键盘导航、HC 对比环与 reduced-motion 过渡合同，不改入口命令或排序。

验证：Node 24.18.0 focused `statusbarPartCss.test.ts` 4 passing（含 pressed-over-hover 声明顺序合同）；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（10 条既有 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实状态栏按压层级与高对比观察仍待补。

### §222 Conversation/Trajectory tab 按压视觉面进一步收窄合同（2026-11-08）

用户反馈标签按压范围仍显得违和。保留 32px 的按钮命中区、`role="tab"`、键盘切换和 HC 对比焦点环，仅把选中、hover、按压与普通主题键盘焦点共用的 `::before` 视觉面从 `inset: 4px 3px` 收窄为 `inset: 6px 4px`，让背景更贴近文字标签，避免在高缩放窗口中读成整行填充。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts` 52 passing；`npm run transpile-client` exit 0（10223 files / 2047 resources）；未启动默认编辑器/HC 窗口，真实按压范围与高对比观察仍待补。

### §223 Conversation 回合动作键盘焦点轻量表面合同（2026-11-08）

只读复核发现助手回合的复制、重新生成、删除和轨迹动作按钮，普通主题仍在 22px 命中区外画 `focusBorder` 外圈；动作行已有 `focus-within` 显现和 `toolbar-hoverBackground` 表面，额外外圈增加视觉重量且与已收敛的 Composer、SessionBar、Engine Preferences 焦点策略不一致。实施仅在普通主题为 `.conversation-lens-turn-actions .monaco-button:focus-visible` 清除外圈并保留 `toolbar-hoverBackground`，高对比 black/light 继续使用 `contrastActiveBorder` 对比环；不改动作命令、ARIA、键盘顺序、命中区或 reduced-motion 合同。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts` 通过（新增 ordinary quiet-surface 与 HC 保留断言）；`npm run transpile-client` 与 `git diff --check` 通过。未启动默认编辑器窗口，真实普通主题、窄列和高对比键盘焦点仍待补。

### §224 Conversation Agent breadcrumb 按压覆盖 hover 的层级合同（2026-11-08）

只读复核发现 Conversation Agent hierarchy 面包屑项的 `:active` 背景声明先于非当前项的 `:hover`/键盘 focused 表面，指针按住路径项时后声明的 hover 背景会覆盖 `toolbar-activeBackground`，按压层级不清晰。实施仅将既有 `:active` 规则移到 hover/focused 规则之后，保留 22px 面包屑行、Arrow/Enter 导航、`aria-current`、不可点击当前项和 reduced-motion 合同，不改路径选择或 DOM 语义。

验证：Node 24 focused `conversationAgentBreadcrumbCss.test.ts` 2 passing（含 reduced-motion 与 pressed-over-hover 声明顺序合同）；`npm run transpile-client` 通过（10223 files / 2047 resources），目标 Stylelint exit 0（仅既有 `--ua-ease` unknown-variable 与 3 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实面包屑按压范围与高对比观察仍待补。
### §225 Conversation chrome 按压覆盖 hover 的层级合同（2026-11-08）

Sol 复核发现 Conversation 顶部 title actions 与 SessionBar/window-nav 的 `:active` 背景声明先于 hover/focus 表面；鼠标按住时后声明的 hover 或普通主题焦点背景会覆盖 `toolbar-activeBackground`，按压层级不清晰。实施仅将两组既有 active 规则移到 hover/focus/HC 规则之后，保留 28px 动作命中区、SessionBar/window-nav 命令、键盘/ARIA、HC 对比环和 reduced-motion 合同，不改布局或路由。

验证：Node 24 focused `conversationRegionChromeCss.test.ts` 4 passing（含 title action 与 SessionBar pressed-over-hover 顺序合同）；`npm run transpile-client` 通过（10223 files / 2047 resources）；目标 Stylelint exit 0（仅既有 3 个 `--vscode-conversation-background` unknown-variable 与 1 条 design-token suggestion），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Conversation chrome 按压范围与高对比观察仍待补。

### §226 Visualize expand 按压覆盖 hover 的层级合同（2026-11-08）

Sol 复核发现可视化卡片的 Expand diagram 24px 图标按钮 `:active` 声明先于 `:hover`，指针按住时 hover 表面会覆盖 `toolbar-activeBackground`，按压层级不清晰。实施仅将既有 `:active` 规则移到 hover 之后，保留按钮命中区、普通主题 quiet focus、HC `contrastActiveBorder` 对比环与 reduced-motion 合同，不改展开动作、ARIA 或布局。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts --grep 'visualize expand keeps pressed surface above hover'` 1 passing；全文件 53 passing；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（仅既有 `--ua-ease` unknown-variable 与 19 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实可视化按钮按压范围、普通主题焦点与高对比观察仍待补。

### §227 Connection Preferences 导航行按压覆盖 hover 的层级合同（2026-11-08）

Sol 复核发现 Connection Preferences 左侧导航行的 `:active` 背景声明先于未选中行 `:hover`，指针按住导航项时 hover 表面会覆盖 `toolbar-activeBackground`。共享工作区已将既有 active 规则移到 hover 之后；保留现有导航行几何、列表键盘/ARIA、普通主题焦点表面、HC `contrastActiveBorder` 对比环与 reduced-motion 合同，不改选中语义或导航动作。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts --grep 'connection preferences nav keeps pressed surface above hover'` 1 passing；全文件 54 passing；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（仅既有变量提示与 22 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Connection Preferences 导航行按压范围、键盘焦点与高对比观察仍待补。

### §228 Conversation identity chip 按压覆盖 hover 的层级合同（2026-11-08）

Sol 复核发现 Conversation identity chip 的通用 `:active` 背景声明先于普通 hover 与 engine-offline 状态 hover，指针按住 chip 时 hover 表面会覆盖 `toolbar-activeBackground`。实施仅将既有 active 规则移到两个 hover 表面之后，保留 engine/offline 状态色、只读 chip 的不可交互语义、键盘焦点、HC 对比环与 reduced-motion 合同，不改身份动作或布局。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts --grep 'identity chips keep pressed surface above hover'` 1 passing；全文件 55 passing；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（仅既有变量提示与 9 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 identity chip 按压范围、键盘焦点与高对比观察仍待补。

### §229 Conversation lens session title 按压覆盖 hover 的层级合同（2026-11-08）

Sol 复核发现 Conversation lens session title 按钮的 `:active` 背景声明先于同一按钮的 `:hover`，指针按住标题时 hover 表面会覆盖 `toolbar-activeBackground`。实施仅将既有 active 规则移到 hover 之后，保留 20px 命中区、标题编辑与键盘动作、普通主题 quiet focus、HC 对比环和 reduced-motion 合同，不改会话切换或标题保存语义。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts --grep 'session title keeps pressed surface above hover'` 1 passing；全文件 56 passing；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（仅既有变量提示与 98 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 session title 按压范围、键盘焦点与高对比观察仍待补。

### §230 Conversation 回合轨迹动作按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 user turn 右上角 `.conversation-lens-turn-header-trajectory .monaco-button` 的 `:active` 背景声明先于同一按钮的 hover/focus 表面；鼠标按住轨迹入口时，后声明的 hover/focus 会覆盖 `toolbar-activeBackground`，按压反馈不稳定。实施仅将既有 active 规则移到 hover/focus 之后，并加入声明顺序合同；保留 22px 命中区、轨迹导航命令、ARIA、普通主题 quiet focus、HC 对比环与 reduced-motion 合同，不改回合布局或导航语义。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts` 58 passing；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（仅既有 unknown-variable 与 98 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 user turn 轨迹按钮按压范围、键盘焦点与高对比观察仍待补。

### §231 Engine Preferences MCP tab 按压覆盖 hover 的层级合同（2026-11-08）

Sol 只读复核发现 Engine Preferences 的 MCP tab `:active` 背景声明先于 `:hover`，指针按住 tab 时 hover 表面会覆盖 `toolbar-activeBackground`，按压层级不清晰。实施仅将既有 active 规则移到 hover 之后，并补声明顺序合同；保留 24px tab 命中区、活动 tab 选择语义、键盘/ARIA、普通主题与 HC 状态和 reduced-motion 合同，不改 MCP 切换逻辑或布局。

验证：Node 24.18.0 focused `enginePreferencesPaneCss.test.ts` 5 passing（含 MCP tab pressed-over-hover 合同）；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（保留既有 `--ua-*` unknown-variable 与 34 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 MCP tab 按压范围、键盘焦点与高对比观察仍待补。

### §232 Session leaf hide 按压覆盖 hover/focus 的层级合同（2026-11-08）

只读复核发现 Conversation session leaf 的 Hide 控件 `:active` 背景声明先于普通主题 `:focus-visible` 与 HC 焦点表面；指针按住一个已获键盘焦点的 Hide 控件时，后声明的焦点表面会覆盖 `toolbar-activeBackground`，按压反馈不稳定。实施仅将既有 active 规则移到 hover 与 focus-visible 规则之后，并补 Node 合同锁住声明顺序；保留 28px 命中区、隐藏会话动作、键盘/ARIA、HC 对比环和 reduced-motion 合同，不改关闭语义或布局。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts` 58 passing（含 session leaf hide pressed-over-hover/focus 合同）；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（仅既有 `--ua-ease` unknown-variable 提示），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Hide 控件按压范围、键盘焦点与高对比观察仍待补。
### §233 Conversation session title 按压覆盖键盘焦点表面合同（2026-11-08）

Sol 复核发现 Conversation Session title 的 `:active` 背景虽已在 hover 之后，但仍先于普通主题 `:focus-visible`；鼠标按住已聚焦的会话标题时，键盘焦点表面会覆盖 `toolbar-activeBackground`。实施仅将既有 active 规则移到 hover 与普通/高对比 focus 规则之后，保留会话标题编辑/选择行为、20px 几何、HC 对比环和 reduced-motion 合同，不改会话路由或键盘语义。

验证：Node 24 focused `conversationLensCssScan.test.ts` 58 passing（新增 session-title pressed-over-focus 顺序合同）；`npm run transpile-client` 通过（10223 files / 2047 resources）；目标 Stylelint exit 0（仅既有 unknown-variable 与 98 条 design-token suggestions），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实会话标题按压范围与高对比观察仍待补。

### §234 Conversation review 导航按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 只读复核发现 Conversation review 导航按钮的 `:active` 背景声明先于 hover 与普通/高对比 focus 表面；鼠标按住已获键盘焦点的 Review 入口时，后声明的 hover/focus 会覆盖 `toolbar-activeBackground`，按压反馈不稳定。实施仅将既有 active 规则移到 hover 与 focus 规则之后，并补声明顺序合同；保留 review 导航命令、键盘焦点、HC `contrastActiveBorder` 对比环、文字下划线与 reduced-motion 合同，不改布局或导航语义。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts --grep 'review navigation keeps pressed surface above hover and focus'` 1 passing；全文件 59 passing；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（98 条既有 design-token suggestions 与既有 unknown-variable 提示），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 review 导航按压范围、键盘焦点与高对比观察仍待补。

### §235 Trajectory inspector Close 按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 只读复核发现 Trajectory inspector 的 Close 22px 图标按钮 `:active` 背景声明先于普通主题与高对比 `:focus-visible` 表面；鼠标按住已获键盘焦点的 Close 控件时，后声明的 focus surface 会覆盖 `toolbar-activeBackground`，按压反馈不稳定。实施仅将既有 active 规则移到 hover 与 focus 规则之后，并补声明顺序合同；保留 Close 动作、22px 命中区、普通主题静默焦点、高对比 `contrastActiveBorder` 对比环与 reduced-motion 合同，不改 inspector 布局或返回语义。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts --grep 'trajectory inspector close keeps pressed surface above hover and focus'` 1 passing；全文件 60 passing；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（98 条既有 design-token suggestions 与既有 unknown-variable 提示），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Trajectory inspector Close 按压范围、键盘焦点与高对比观察仍待补。

### §236 Trajectory record row 按压覆盖 hover 的层级合同（2026-11-08）

Sol 复核发现 Trajectory table 未选中记录行的 `:active` 背景声明先于 `:hover`，指针按住行时 hover surface 会覆盖 `list-activeSelectionBackground`，按压反馈不稳定。实施仅将记录行 active 规则移到未选中 hover 之后，同时保持 selected 行规则继续覆盖 active；保留 22px 行高、列表选择/聚焦语义、轨迹导航与 reduced-motion 合同，不改行点击或键盘行为。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 61 passing（含新增按压层级合同）；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（98 条既有 design-token suggestions 与既有 unknown-variable 提示），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Trajectory row 按压范围、选择态与高对比观察仍待补。

### §237 Inbox message queue 行按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 Inbox message queue 的 `.queue-item:active` 背景声明先于普通主题 `:focus-visible`；指针按住已获键盘焦点的队列行时，后声明的 quiet focus surface 会覆盖 `toolbar-activeBackground`，按压反馈不稳定。实施仅将既有 active 规则移到 hover 与普通/高对比 focus 规则之后，并补声明顺序合同；保留队列行现有内容布局、点击/键盘语义、失败与 hold-editing 状态和 reduced-motion 合同，不改队列动作或状态投影。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts --grep 'message queue items keep pressed surface above hover and focus'` 1 passing；全文件 62 passing；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions），目标 ESLint 0 errors（1 条既有 externalized-string warning），`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Inbox queue 行按压范围、键盘焦点与高对比观察仍待补。

### §238 Inbox message queue 顶部操作按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 Inbox message queue 顶部 `Clear/Retry` 操作按钮的 `:active` 背景声明先于普通主题与高对比 `:focus-visible` 表面；按住已获键盘焦点的操作按钮时，后声明的 hover/focus 会覆盖按压反馈。实施仅将既有 `.queue-bar-action:not(:disabled):active` 规则移到 hover、普通焦点与 HC 焦点之后，并补 `conversationLensCssScan.test.ts` 声明顺序合同；保留 22px 命中区、Clear 错误色 hover、队列清理/重试动作、键盘/ARIA、disabled 与 reduced-motion 合同，不改队列状态或布局。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts` 63 passing（含 queue bar action pressed-over-hover/focus 合同）；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 保留 1 条既有 externalized-string warning、无 error；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实队列顶部操作按压范围、键盘焦点与高对比观察仍待补。

### §239 Agent 下拉菜单项按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 Conversation SessionBar 的 direct-child agent 下拉菜单项只有菜单 hover/focus surface，没有独立的 pointer-down pressed surface；按住菜单项时反馈与悬停/键盘状态无法区分。实施仅为 `.conversation-agent-down-item:active` 增加 `toolbar-activeBackground` pressed surface，并置于 hover/focus 规则之后；保留约 28px 可用命中区（`padding: 4px 12px` + `line-height: 20px`）、menu/menuitem 角色、上下方向键、Escape、打开子会话动作与既有菜单选中前景色，不改弹层定位或导航语义。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts --grep 'agent picker menu items keep a usable target and pressed surface above hover and focus'` 1 passing；全文件 64 passing；`npm run transpile-client` exit 0（10223 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；`git diff --check` 通过。默认编辑器、HC 主题与真实 agent 下拉菜单的按压/焦点观察仍待补。

### §240 Sessions 列表 More 按钮按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 Sessions 列表行尾 More 按钮已有 hover 与普通/高对比 focus surface，却没有独立的 pointer-down pressed surface；按住已获焦点的 More 时，反馈与悬停/键盘状态无法区分。实施仅为 `.conversation-sessions-item-more:active` 增加 `toolbar-activeBackground` pressed surface，并置于 focus/hover 规则之后；保留 28px 命中区、More 菜单展开与会话行键盘语义、HC `contrastActiveBorder` 对比环和 reduced-motion 合同，不改会话选择或菜单动作。

验证：Node 24.18.0 focused `conversationSessionsCss.test.ts` 2 passing；相关 `conversationLensCssScan.test.ts` 全文件 64 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 `--ua-navigation-font-size` unknown-variable 与 2 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Sessions More 按压范围、键盘焦点与高对比观察仍待补。

### §241 Trajectory overview 折叠按钮按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 只读复核发现 Trajectory overview 的折叠/展开按钮 `:active` 背景声明先于普通主题与高对比 `:focus-visible` 表面；按住已获键盘焦点的 toggle 时，后声明的 focus surface 会覆盖 `toolbar-activeBackground`，按压反馈不稳定。实施仅将既有 `.conversation-lens-trajectory-overview-toggle:active` 规则移到 hover 与普通/高对比 focus 规则之后，并补源码声明顺序合同；保留 22px 命中区、`aria-expanded`/`aria-controls`、折叠 transform、键盘动作、HC `contrastActiveBorder` 对比环与 reduced-motion 合同，不改 overview track 或 segment 行为。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 65 passing（含新增 overview toggle pressed-over-hover/focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；`npm run stylelint -- src/vs/workbench/contrib/conversation/browser/media/conversationLens.css` exit 0（既有 23 条 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 0 errors、1 条既有 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 overview toggle 按压范围、键盘焦点与高对比观察仍待补。

### §242 Conversation/Trajectory tab 视觉按压面再次收窄合同（2026-11-08）

用户反馈标签按压范围仍显得违和。保留 32px 的按钮命中区、`role="tab"`、键盘切换和 HC 对比焦点环，仅把选中、hover、按压与普通主题键盘焦点共用的 `::before` 视觉面从 `inset: 6px 4px` 收窄为 `inset: 7px 6px`，让背景贴近文字行并降低整行填充感；不改 tab 切换语义、ARIA 或 reduced-motion。

验证：Node 24.18.0 focused `conversationLensCssScan.test.ts` ConversationLens 套件 39 passing（含 lens tab 32px target / inset 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint 与 `git diff --check` 待父窗口收口复核。未启动默认编辑器/HC 窗口，真实 tab 按压范围与高对比观察仍待补。

### §243 Trajectory overview segment 交互面覆盖 per-kind 底色合同（2026-11-08）

Sol 复核发现 Trajectory overview segment 的 hover、选中与按压规则位于各 `data-segment-kind` 底色之前；相同特异性下，user/assistant/tool 等类型底色会覆盖交互反馈，导致按压时看不到 `toolbar-activeBackground`，悬停与选中也无法稳定覆盖类型底色。已将交互 surface 规则移到所有 per-kind 底色之后，保留 12px segment 几何、类型 glyph、键盘导航、focus-visible ring 与各类型颜色语义，不改轨迹定位或 ARIA 行为；新增源码顺序合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 66 passing（含 segment interaction-over-kind 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 无 error、保留 1 条既有 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 overview segment 按压、悬停与高对比观察仍待补。

### §244 Process fold 轨迹跳转按压覆盖 reveal/focus 的层级合同（2026-11-08）

Sol 复核发现 process fold 的轨迹跳转按钮 `.conversation-process-fold-trajectory-jump:active` 位于行 hover、focus-within 和按钮 focus-visible 表面之前；按住已显示或已获焦点的跳转按钮时，后声明的 hover/focus surface 会覆盖 `toolbar-activeBackground`。已将 active surface 移到 reveal、普通主题 focus 与 HC focus 规则之后，并补 `conversationLensCssScan.test.ts` 顺序合同；保留 22px 命中区、行 hover/focus-within 显示门控、`pointer-events`、轨迹定位命令、ARIA/键盘行为、HC 对比环与 reduced-motion，不改 process fold 内容或布局。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 67 passing（含 process fold trajectory jump pressed-over-reveal/focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 保留 1 条既有 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 process fold 跳转按钮按压、键盘焦点与高对比观察仍待补。

### §245 Composer reference remove 按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 Composer 引用 chip 的 remove 按钮 `.conversation-composer-ref-remove:active` 位于普通主题与高对比 `:focus-visible` 表面之前；按住已获键盘焦点的移除按钮时，后声明的 focus surface 会覆盖 `toolbar-activeBackground`。已将 active surface 移到 hover、普通主题 focus 与 HC focus 规则之后，并补 `conversationLensCssScan.test.ts` 顺序合同；保留 22px 命中区、引用移除动作、键盘/ARIA、HC 对比环与 reduced-motion，不改引用数据或 Composer 布局。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 68 passing（含 reference remove pressed-over-hover/focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 保留 1 条既有 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实引用移除按钮按压、键盘焦点与高对比观察仍待补。

### §246 Composer selector 按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 Composer 底栏 permission、agent、model 三个 SelectBox 的 `:active` 背景位于 hover 与普通/高对比 focus surface 之前，且基础 `background: transparent !important` 会使普通 active 声明失效；按住选择器时看不到稳定的 `toolbar-activeBackground`。已将三组 SelectBox 的 active surface 移到 hover/focus 之后并设为 `!important`，保留 28px 高度、原生 SelectBox 键盘/可访问性、模型/agent/permission 语义、HC 对比环与 disabled 状态；新增源码顺序与重要性合同，不改选择菜单或布局。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 69 passing（含 composer selector pressed-over-hover/focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 保留 1 条既有 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 permission/agent/model selector 按压、键盘焦点与高对比观察仍待补。

### §247 Composer popup 项按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 Composer More/Add popup 项的 `:active` 背景位于 hover、普通主题 focus 与高对比 focus surface 之前；按住已获焦点的 popup 项时，后声明的菜单选择表面会覆盖 `toolbar-activeBackground`。已将 `.conversation-lens-dock-more-item` 与 `.conversation-lens-dock-add-option` 的 active surface 后置到 hover/focus 规则之后，保留 popup 项的可达命中区、菜单选择前景色、键盘/ARIA、HC 对比环与 disabled 状态，不改弹层定位或选项动作；新增源码声明顺序合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 70 passing（含 popup item pressed-over-hover/focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 `git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 popup 项按压、键盘焦点与高对比观察仍待补。

### §248 Conversation 回合操作按钮按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 Conversation 回合操作栏 `.conversation-lens-turn-actions .monaco-button:active` 位于普通主题与高对比 `:focus-visible` 表面之前；按住已获键盘焦点的复制、重试、删除等回合操作时，后声明的 focus surface 会覆盖 `toolbar-activeBackground`。已将 active surface 移到 hover、普通主题 focus 与 HC focus 规则之后，并补 `conversationLensCssScan.test.ts` 顺序合同；保留 22px 命中区、动作命令、键盘/ARIA、HC 对比环与 disabled 语义，不改操作栏布局或 reveal 门控。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 71 passing（含 turn action pressed-over-hover/focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实回合操作按钮按压、键盘焦点与高对比观察仍待补。

### §249 Confirmation action 按压覆盖 focus 的层级合同（2026-11-08）

Sol 复核发现 Confirmation seat 的 Allow/Skip 等 `.conversation-lens-confirmation-actions .monaco-button:active` 位于普通与高对比 `:focus-visible` 表面之前；按住已获键盘焦点的确认操作时，后声明的 focus surface 会覆盖 `toolbar-activeBackground`。已将 active surface 后置到普通/高对比 focus 规则之后，并补 `conversationLensCssScan.test.ts` 顺序合同；保留按钮尺寸、确认动作、键盘/ARIA、HC 对比环、disabled 与 reduced-motion，不改确认状态或布局。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 72 passing（含 confirmation action pressed-over-focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实确认按钮按压、键盘焦点与高对比观察仍待补。

### §250 Markdown code block copy 按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 Markdown code block 的 Copy 按钮 `.conversation-code-block-copy:active` 位于普通与高对比 `:focus-visible` 表面之前；按住已获键盘焦点的复制按钮时，后声明的 focus surface 会覆盖 `toolbar-activeBackground`。已将 active surface 后置到 hover、普通主题 focus 与 HC focus 规则之后，并补 `conversationLensCssScan.test.ts` 顺序合同；保留 22px 命中区、复制动作、键盘/ARIA、HC 焦点环、颜色语义与 reduced-motion，不改 Markdown 渲染或代码块布局。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 73 passing（含 code block copy pressed-over-hover/focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 保留 1 条既有 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实代码块复制按钮按压、键盘焦点与高对比观察仍待补。

### §251 Composer soft control 按压覆盖 hover 的层级合同（2026-11-08）

Sol 复核发现 Composer 底栏 soft 圆形控制的 `:active` 只由通用 control 规则提供，位于 soft control 的 hover 表面之前；按住 soft 控制时 hover 的 `toolbar-activeBackground` 会覆盖按压状态。已在 soft hover 规则之后补充 soft control active surface，保留 28px 命中区、soft 控制语义、键盘/ARIA、HC 与 disabled 行为，并补 `conversationLensCssScan.test.ts` 顺序合同，不改 Composer 布局或命令。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 74 passing（含 soft composer control pressed-over-hover 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 保留 1 条既有 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 soft 控制按压、键盘焦点与高对比观察仍待补。

### §252 Inbox chip 按压覆盖 hover/focus 的层级合同（2026-11-08）

Sol 复核发现 Inbox chip 的 `:active` 与 `aria-pressed` 共用规则，位于普通主题与高对比 `:focus-visible` 表面之前；按住已获键盘焦点的 chip 时，后声明的 focus surface 会覆盖 `toolbar-activeBackground`。已保留 `aria-pressed` 的持久选中面，并将 pointer-down active surface 后置到 hover、普通主题 focus 与 HC focus 之后；保留 22px 命中区、Inbox 操作、键盘/ARIA、HC 对比环与 reduced-motion，不改队列状态或布局。新增 `conversationLensCssScan.test.ts` 顺序合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 75 passing（含 inbox chip pressed-over-hover/focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 保留 1 条既有 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Inbox chip 按压、键盘焦点与高对比观察仍待补。

### §253 Composer send 按压层级覆盖 hover/focus 的合同（2026-11-08）

Sol 复核发现 Composer send button 的早期 `:active` 声明位于普通主题 `:focus-visible` 与 hover 表面之前，后续重复声明虽维持颜色，却让按压层级合同不清晰；已删除早期重复 active 规则，只保留位于 hover、普通主题 focus 之后的 send 专用按压面，实际使用 75% 前景色与编辑器背景的 `color-mix` 覆盖通用 filled control 颜色，保留 28px 实心发送按钮、发送动作、键盘/ARIA、HC、disabled 与 reduced-motion。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 75 passing（含 send pressed-over-hover/focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 保留 1 条既有 line 903 externalized-string warning；`git diff --check` 通过。send 专用按压面实际使用 75% 前景色与编辑器背景的 `color-mix`，覆盖通用 filled control 的颜色；未启动默认编辑器/HC 窗口，真实发送按钮按压、键盘焦点与高对比观察仍待补。

### §254 Review navigation 按压面收窄合同（2026-11-08）

用户反馈“按压范围太违和”。Sol 复核发现 review navigation 是整行 block 命中目标，active/hover/focus 背景直接覆盖整个行宽；已保留整行按钮命中区、review 路由、键盘/ARIA、HC 焦点环与 reduced-motion，将可见 hover、普通主题 focus 和 active 面移到 `::before` 的 `inset: 2px 4px` 小表面，降低整行填充感。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 75 passing（含 review navigation inset pressed-face 与两套 reduced-motion 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 保留既有 line 903 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 review navigation 按压、键盘焦点与高对比观察仍待补。

### §255 User bubble 按压面收窄合同（2026-11-08）

用户反馈“按压范围太违和”。Sol 复核发现可编辑用户消息气泡 `.conversation-lens-turn-body--clickable:active` 直接将整块阅读气泡染成 active 背景；已保留 role=button 的完整气泡命中区、编辑动作、ARIA/键盘、HC 焦点与 reduced-motion，将 hover 与 active 可见面移到气泡内缩 1px 的 `::before` 面，降低整块阅读卡的按压填充感。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 75 passing（含 user bubble inset pressed-face 与两套 reduced-motion 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 98 条 design-token suggestions）；目标 ESLint 保留既有 line 911 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实用户气泡按压、键盘焦点与高对比观察仍待补。

### §256 Trajectory record row 按压面收窄合同（2026-11-08）

用户反馈“按压范围太违和”。Sol 复核发现 Trajectory record row 的未选中 `:active` 直接使用整行 `list-activeSelectionBackground`；已保留 22px list row 命中区、键盘/列表语义、选中行的完整持久选中面、HC/reduced-motion，将未选中 hover/active 面移到内缩 1px 4px 的 `::before` 视觉面，避免按压时整行填充。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 75 passing（含 unselected trajectory row inset pressed-face 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 99 条 design-token suggestions）；目标 ESLint 保留既有 line 911 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 trajectory row 按压、选中态、键盘焦点与高对比观察仍待补。

### §257 Trajectory process-fold header 按压面收窄合同（2026-11-08）

用户反馈“按压范围太违和”。Sol 复核发现 Trajectory 中 `.conversation-process-fold-header` 被布局规则扩展为整行宽度，通用 hover/focus/active 背景因此覆盖整行；已保留 22px 折叠 header 命中区、折叠命令、ARIA/键盘、HC 焦点与 reduced-motion，将 trajectory header 的可见 hover/focus/active 面移到内缩 `1px 4px` 的 `::before`，避免整行填充。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 75 passing（含 trajectory process-fold header inset pressed-face 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 100 条 design-token suggestions）；目标 ESLint 保留既有 line 918 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 process-fold header 按压、键盘焦点与高对比观察仍待补。

### §258 Message queue item 按压面收窄合同（2026-11-08）

用户反馈“按压范围太违和”。Sol 复核发现 queue item 的 hover/active 直接填充整块消息卡；已保留 queue item 的完整命中区、hold-editing、queue-failed/upload-failed 状态、键盘/ARIA、HC/reduced-motion，将普通 queue item 的 hover/active 面移到内缩 `1px 4px` 的 `::before`，特殊 hold/failed 状态继续保留整行状态面。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 75 passing（含 queue item inset pressed-face、hold-editing 状态与 reduced-motion 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 100 条 design-token suggestions）；目标 ESLint 保留既有 line 924 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 queue item 按压、hold/failed 状态、键盘焦点与高对比观察仍待补。

### §260 Visualize header 与 queue focus 按压面收窄合同（2026-11-08）

用户反馈“按压范围太违和”。Sol 审计发现 Visualize disclosure header 的 active/focus 面覆盖卡片头部整行，queue item 的普通主题 `:focus-visible` 仍直接铺满消息卡；已保留完整命中区、展开/队列状态、ARIA/键盘、HC 焦点与 reduced-motion，将 Visualize header 的 active/focus 面和 queue item 的 normal focus 面移到内缩视觉面。队列 hold/failed 状态继续保留整行状态语义。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 75 passing（含 Visualize header inset face、queue focus face 与两套 reduced-motion 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 100 条 design-token suggestions）；目标 ESLint 保留既有 line 924 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Visualize header、queue focus、hold/failed 状态与高对比观察仍待补。

### §261 Visualize header hover 与 Engine utility row 按压面收窄合同（2026-11-08）

Sol 复核发现 Visualize header row hover 仍直接铺满卡片头部，Engine triggers/clipboard/context rows 的未选中 hover/active 也直接覆盖整行；已将 Visualize header row hover、Engine utility row hover/active 移到内缩 `::before` 视觉面，保留完整命中区、selected 状态、ARIA/键盘、HC/reduced-motion。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 76 passing（含 Visualize header hover、Engine utility row inset face 与两套 reduced-motion 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 153 条 design-token suggestions）；目标 ESLint 保留既有 line 924 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Visualize/Engine 行按压、selected/键盘焦点与高对比观察仍待补。

### §262 Engine navigation 与 utility focus 面收窄合同（2026-11-08）

Sol 复核发现 Engine navigation row 的未选中 hover/active，以及 Engine utility row 的普通主题 `:focus-visible` 仍直接铺整行；已将这些普通交互面移到内缩 `::before`，保留 22/24px 命中区、selected 状态、列表/ARIA/键盘、HC ring 与 reduced-motion。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 76 passing（含 Engine nav/utility inset hover-active-focus、S9 host-transparent/pseudo-hover 合同与两套 reduced-motion 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 34 条 engine design-token suggestions）；目标 ESLint 保留既有 line 926 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Engine row selected/按压、键盘焦点与高对比观察仍待补。

### §263 Process-fold tool header 按压面收窄合同（2026-11-08）

Sol 复核发现 process-fold tool header 的 hover/focus/active 仍直接铺在按钮命中区；已保留 button 的原生命中区、ARIA/键盘与 HC contrast ring，将普通主题交互面迁移到内缩 `::before`，并为 pseudo 面补齐 workbench 与 prefers reduced-motion 过渡关闭合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 77 passing（新增 process-fold tool header 命中区/内缩 pressed face 顺序与两套 reduced-motion 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 101 条 design-token suggestions）；目标 ESLint 保留既有 line 926 externalized-string warning；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 process-fold tool header 按压、键盘焦点与高对比观察仍待补。

### §264 Sessions list row 按压面收窄合同（2026-11-08）

Sol 复核发现 Sessions list 普通未选中 row 的 hover/focus/active 仍直接铺满列表行；已保留 group row、selected 状态、列表命中区、ARIA/键盘与 HC focus ring，将普通 row 的交互面迁移到内缩 `::before`，并为 pseudo 面补齐 workbench 与 prefers reduced-motion 过渡关闭合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 78 passing，`conversationSessionsCss.test.ts` 2 passing（新增 Sessions row 命中区/内缩 pressed face 与两套 reduced-motion 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（Sessions CSS 既有 2 条 unknown-variable 提示与 2 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Sessions row selected/按压、键盘焦点与高对比观察仍待补。

### §265 Connection preferences nav row 按压面收窄合同（2026-11-08）

Sol 复核发现 Connection preferences nav 普通未选中 row 的 hover/focus/active 仍直接铺满 32px 导航行；已保留 selected 状态、HC selected marker/focus ring、列表命中区与 ARIA/键盘语义，将普通 row 的交互面迁移到内缩 `::before`，并为 pseudo 面补齐 workbench 与 prefers reduced-motion 过渡关闭合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 79 passing（新增 Connection preferences row 命中区/内缩 pressed face 与 selected/两套 reduced-motion 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（Connection preferences CSS 既有 18 条 unknown-variable 提示与 22 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Connection nav row selected/按压、键盘焦点与高对比观察仍待补。

### §266 SubAgent overlay focus 面收窄合同（2026-11-08）

Sol 复核发现 SubAgent overlay 根节点的普通主题 `:focus-visible` 直接给全区铺 `toolbar-hoverBackground`；已保留 overlay 根节点的可聚焦命中区、ARIA/键盘与 HC contrast ring，将普通主题视觉反馈收至 overlay card 的 inset 1px box-shadow，action button 与 reduced-motion 语义保持不变，并补 CSS scan 合同。

验证：Node 24.18.0 `conversationSubAgentOverlayCss.test.ts` 3 passing（含 setup）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 1 条 unknown-variable 提示与 3 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 SubAgent overlay 键盘焦点与高对比观察仍待补。

### §267 Timeline item focus 面收窄合同（2026-11-08）

Sol 复核发现 timeline roving tabindex article 的普通主题 `:focus-visible` 仍绘制产品自有 `focusBorder` outline；已改为 3% foreground compact background，保留 article 命中区、ARIA/键盘 roving 语义，并为 HC 明确保留 `contrastActiveBorder/contrastBorder` ring。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 79 passing（timeline focus 合同改为 normal compact surface + HC ring）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（Timeline CSS 既有 5 条 unknown-variable 提示与 1 条 design-token suggestion）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 timeline keyboard focus 与高对比观察仍待补。

### §268 Timeline focus 面迁移至 inset pseudo 合同（2026-11-08）

Sol 复核确认 §267 的普通主题 compact background 仍落在整篇 timeline article；已保留 article 命中区与 roving tabindex 语义，将 3% focus 面迁移至 `::before` inset 1px 4px，HC ring 与 reduced-motion 边界保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 79 passing（新增 timeline article anchored face/pseudo focus 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（Timeline CSS 既有 5 条 unknown-variable 提示与 1 条 design-token suggestion）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 timeline keyboard focus 与高对比观察仍待补。

### §269 Conversation/Lens/Engine 相邻交互只读审计（2026-11-08）

Sol 复核当前 HEAD：top lens tabs、Sessions、Trajectory、queue、Connection nav、process-fold、timeline article 与 SubAgent overlay 的普通主题整行面均已有 inset/compact 合同；剩余 Engine catalog list hover 与 agent breadcrumb 面缺少完整 selected/focus/active 语义合同，继续迁移会扩大状态风险。本轮无安全代码改动，保留现状并待真实窗口复核。

验证：复用 Node 24.18.0 `conversationLensCssScan.test.ts` 79 passing、既有 Stylelint/docs-health/git diff check 结果；未启动默认编辑器/HC 窗口，Engine catalog/breadcrumb 的真实状态覆盖仍待补。

### §270 Agent breadcrumb 非 current 按压面收窄合同（2026-11-08）

Sol 根据 breadcrumb 的 `aria-current="location"`、focused class 与 root keyboard arrows/Enter/Space 接线复核，确认可安全迁移非 current item 的 hover/focused/active 面；已保留 current 行 `pointer-events:none`、完整命中区、键盘语义与 reduced-motion，普通面迁移到 `::before` inset 1px 4px。

验证：Node 24.18.0 `conversationAgentBreadcrumbCss.test.ts` 3 passing（含 setup）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 2 条 unknown-variable 提示与 3 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 breadcrumb current/键盘/高对比观察仍待补。

### §271 Engine catalog/skills/agents list hover 面收窄合同（2026-11-08）

Sol 建立 Engine catalog/skills/agents list 状态映射：这些 list row 由 `monaco-list` 管理 focused/selected 命中区，技能/工具/agent 选择另有 toggle 或 detail selection；本轮仅迁移普通未选中 hover 到 `::before`，selected hover 继续保留原 host 面，未改变 toggle/selection 语义。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 80 passing（新增三类 list row anchored face、selected hover 保留与两套 reduced-motion 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（Engine CSS 既有 unknown-variable 提示与 34 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Engine catalog/skills/agents focused/selected/toggle 与高对比观察仍待补。

### §272 Engine MCP tab 按压面收窄合同（2026-11-08）

Sol 复核确认 MCP tabs 是明确 `role=tab`/`aria-selected` 控件，hover/active 可安全迁移；已将普通 hover/active 面迁移到 `::before` inset 1px 2px，active tab 的 `aria-selected` host 面、键盘命中区与 reduced-motion 保持。

验证：Node 24.18.0 `enginePreferencesPaneCss.test.ts` 7 passing（含 setup），`conversationLensCssScan.test.ts` 80 passing；随后修正真实共享接线：`engineMcpSection.ts` 与 `engineAgentsSection.ts` 都创建 `.engine-mcp-tab-bar .monaco-button` 并设置 `role=tab`/`aria-selected`，CSS/合同现以该共享选择器与 `aria-selected="true"` 为准，不再依赖不存在的 `.engine-mcp-tab` class；再以 pane-specific cascade override 保证 selected host 与 active host 透明规则胜过全局/后导入 button skin，按下背景只落在 inset pseudo。`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（Engine CSS 既有 unknown-variable 提示与 34 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 shared Engine MCP/Agents tab selected/按压、键盘焦点与高对比观察仍待补。

### §273 Engine provider status row hover 面收窄合同（2026-11-08）

Sol 复核确认 provider status row 是 `role=listitem` 状态展示行，没有 selected/focus/active 控件语义；仅将普通 hover 面迁移到 `::before` inset 1px 4px，保留 status/error 内容、row actions、ARIA/键盘与 reduced-motion。

验证：Node 24.18.0 `enginePreferencesPaneCss.test.ts` 6 passing（含 setup）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（Engine CSS 既有 unknown-variable 提示与 34 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 provider status/error/action 与高对比观察仍待补。

### §274 Engine provider preset row hover 面收窄合同（2026-11-08）

Sol 复核确认 provider preset row 是 `role=listitem` 展示项，附带独立 add action，无 selected/focus/active row 语义；仅将普通 hover 面迁移到 `::before` inset 1px 4px，保留 add action、status/confirm 边界与 reduced-motion。

验证：Node 24.18.0 `enginePreferencesPaneCss.test.ts` 7 passing（含 setup）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（Engine CSS 既有 unknown-variable 提示与 34 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 provider preset/add action 与高对比观察仍待补。

### §276 Sources tabs 普通交互面收窄合同（2026-11-08）

Sol 复核确认 Sources tabs 是真实 `.sources-tab` tab button，selected class 与 HC `::after` marker 语义明确；已保留 selected host 面与 HC marker，将普通未选中 hover/focus/active 面迁移到 `::before` inset 1px 2px，保留命中区、键盘/ARIA 与 reduced-motion。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 全文件 80 passing（新增 Sources tab inset hover/focus/active 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（Sources CSS 既有 9 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Sources selected/键盘焦点与高对比观察仍待补。

### §277 Navigator Projects row 面收窄合同（2026-11-08）

Sol 复核真实 Projects list row 状态：monaco-list 负责 selected/focused，active session 有独立 label，notes/static row 与 row actions 明确排除；已将普通未选中、非 active-session、非 note 的 hover/focus/active 面迁移到 `::before` inset 1px 4px，保留 selected/active-session host 面、notes、actions、HC ring 与 reduced-motion。

验证：Node 24.18.0 `navigatorProjectsListCss.test.ts` 10 passing（含 setup）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（Navigator CSS 既有 1 条 unknown-variable 提示与 1 条 design-token suggestion）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Projects selected/active-session/actions 与高对比观察仍待补。

### §275 Conversation/Trajectory tab 按压面收窄合同（2026-11-08）

针对截图中 Conversation tab 视觉面覆盖整颗 32px 控件的问题，保留 `button.conversation-lens-lens-tab` 的 32px 键盘/鼠标命中区，将 hover、selected、focus-visible 与 active 的颜色只绘制在 `::before` 的 inset 4px 8px 面，并明确宿主背景透明，避免通用 button skin 再次铺满；Engine MCP/Agents tab 同步补齐普通主题 focus-visible 的宿主透明与 inset hover 面，HC 对比环保持不变。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 80 passing、`enginePreferencesPaneCss.test.ts` 7 passing（均含 setup）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint 与 `git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Conversation/Trajectory tab 的鼠标按压、键盘焦点及 HC 观察仍待补。
### §278 Engine catalog selected hover 面收窄合同（2026-11-08）

Sol 复核确认 Engine catalog/skills/agents list row 已有 `::before` 内缩面，但 selected row 的 hover 规则仍直接给整行铺 `toolbar-hoverBackground`；保留 monaco-list 的 selected/focused 命中区、选择语义、toggle/detail 行为与 reduced-motion，将 selected hover 面也迁移到 `::before` inset 1px 4px。该切片不改变 selected 基础面或键盘焦点边界。

验证：Node 24.18.0 `./scripts/test.sh --run src/vs/workbench/contrib/conversation/test/node/conversationLensCssScan.test.ts` 80 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 34 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Engine catalog/skills/agents selected hover、键盘焦点与高对比观察仍待补。

### §279 Sources Review row 按压面收窄合同（2026-11-08）

Sol 复核确认 Sources Review 的真实 list row 仍把 pointer-down 的 `list-activeSelectionBackground` 直接铺到整行内容容器；已保留 list row 命中区、review state / attribution chip 的独立按钮语义与打开动作，将 row 按压面迁移到 `::before` inset 1px 4px，并补 workbench 与 prefers reduced-motion 的 pseudo transition 合同。

验证：Node 24.18.0 `sourcesWiringScan.test.ts` 47 passing（含新增 row hit-target/inset-face 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 12 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Sources Review row 按压、键盘焦点与高对比观察仍待补。

### §280 Sources Changes folder row 面收窄合同（2026-11-08）

Sol 复核确认 Changes 虚拟列表中的 folder row hover、collapsed selected/focused 状态仍直接覆盖 22px 行；已保留 folder toggle、checkbox、列表命中区与 ARIA/键盘动作，将普通状态面迁移到 `::before` inset 1px 4px，并补 pointer-down active 面及 workbench / prefers reduced-motion 合同。

验证：Node 24.18.0 `sourcesWiringScan.test.ts` 48 passing（含 folder row hit-target/inset-face 合同）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 3 条 unknown-variable 提示与 21 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Sources Changes folder row 折叠/选中/按压与高对比观察仍待补。

### §281 Conversation/Trajectory tab 垂直按压面回调合同（2026-11-08）

Sol 几何复核确认 32px 命中区内的 `inset: 8px 8px` 会把视觉面压成 16px 高，12px 标签上下几乎没有呼吸；保留水平 8px 内缩，将 Conversation/Trajectory tab 的 selected、hover、focus-visible 与 active 视觉面调整为 `::before` `inset: 4px 8px`，得到 24px 高的紧凑面。命中区、tab/ARIA/键盘语义、HC 对比环、reduced-motion 与 Navigator 均不变。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 80 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 提示与 101 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Conversation/Trajectory tab 按压、键盘焦点与高对比观察仍待补。

### §282 Conversation QuestionSeat 选项交互面收窄合同（2026-11-08）

Sol 复核真实 `ConversationQuestionSeat` 的 `role="radio"` / `role="checkbox"` 选项由 `wireConversationSeatOptionKeys` 保持 roving tabindex、方向键与 Enter/Space 语义；未选中选项的 hover、focus、active 原先直接填充整行，已保留完整命中区、ARIA、已选和禁用状态，将可见交互面迁到 `::before` `inset: 1px 4px`。选中态仍使用原有状态面，HC 焦点环与 reduced-motion 合同保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 81 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 102 条 design-token suggestions）；`git diff --check`、docs-health、wiki check 均通过。未启动默认编辑器/HC 窗口，真实 QuestionSeat 选项 hover、按压、键盘焦点与高对比观察仍待补。

### §283 Conversation file-edit path 交互面收窄合同（2026-11-08）

Sol 复核真实 `conversationProcessFold.ts`：可打开 diff 的路径节点是原生 `button.conversation-file-edit-path`，静态路径是 `div.is-static`，按钮保留 `aria-controls` 指向 diff 区与原生键盘语义。已将可点击路径的 hover、focus、active 视觉面从整条 24px 行迁到 `::before` `inset: 1px 4px`，静态路径、完整命中区、HC 焦点轮廓与 reduced-motion 保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 82 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 102 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 file-edit path 按压、键盘焦点与高对比观察仍待补。

### §284 Conversation Inbox pending button 交互面收窄合同（2026-11-08）

Sol 复核真实 `ConversationInboxOverlay` 的待确认入口是原生 `button.conversation-lens-inbox-pending`，保留点击回到待确认回合、Tab/Enter/Space、禁用与 HC 语义；已将整颗 22px 按钮的 hover、focus、active 视觉面迁到 `::before` `inset: 1px 4px`，并补 workbench / prefers-reduced-motion transition 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 83 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 102 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Inbox pending 按压、键盘焦点与高对比观察仍待补。

### §285 Conversation Inbox queue chip 交互面收窄合同（2026-11-08）

Sol 复核真实 `ConversationInboxOverlay` 的队列入口是 `button.conversation-lens-inbox-chip.conversation-lens-inbox-queue`；`aria-pressed` 表示队列浮层是否打开，`aria-disabled` 表示不可打开。保留 pressed/disabled 状态面，仅将未按下普通 hover、focus、active 视觉面迁到 `::before` `inset: 1px 4px`，并补 workbench / prefers-reduced-motion transition 合同。

验证：Node 24.18.0 在包含 §285、§286 的完整 `conversationLensCssScan.test.ts` 复跑为 85 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 102 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 queue chip 按压、键盘焦点与高对比观察仍待补。

### §286 Conversation Inbox Goal/Stop button 交互面收窄合同（2026-11-08）

Sol 复核 Goal 与 Stop 是 Inbox 内真实 Button 控件，保留命令、禁用与键盘语义；将可用态 hover、focus、active 的整颗 22px 面迁到 `::before` `inset: 1px 4px`，保留 HC 对比轮廓与 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 85 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 102 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Goal/Stop 按压、键盘焦点与高对比观察仍待补。

### §287 Conversation/Trajectory tab visual face refinement（2026-11-08）

用户反馈当前 `::before` `inset: 4px 8px` 仍显得过大；真实节点仍是 32px `button`、`role="tab"`、`aria-selected`，保留键盘切换与 HC 对比轮廓，仅将 hover、selected、focus、active 可见面收至 `::before` `inset: 7px 6px`。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 85 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 102 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 tab 按压、键盘焦点与高对比观察仍待补。

### §288 Trajectory overview segment focus 面收窄合同（2026-11-08）

Sol 复核真实 12px overview segment 为可键盘聚焦控件，保留 `::before inset: -6px 0` 命中区、kind colors、ARIA/键盘与 HC 对比轮廓；普通主题 `:focus-visible` 去掉 `focusBorder`，改由 `::after inset: 1px 0` 的 compact foreground surface 表达，并补 workbench / prefers-reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 85 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 overview segment 键盘焦点与高对比观察仍待补。

### §289 Conversation user bubble keyboard focus 面收窄合同（2026-11-08）

Sol 复核真实用户气泡节点为 `role="button"`、`tabIndex=0`；时间线 article 继续负责 roving focus，普通主题气泡自身 `:focus-visible` 从 `focusBorder` 改为既有 `::before` compact foreground surface，HC 对比环与 article focus 抑制规则保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 85 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实用户气泡键盘焦点与高对比观察仍待补。

### §290 Conversation error details toggle focus 面收窄合同（2026-11-08）

Sol 复核真实错误详情入口是 `button.conversation-lens-turn-error-details-toggle`；保留命中区与键盘展开动作，普通主题 `focus-visible` 从整段文本宿主背景迁到 `::before inset: 0 2px`，HC 对比环与 reduced-motion 保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 86 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实错误详情焦点与高对比观察仍待补。

### §291 Conversation message queue bar action faces 收窄合同（2026-11-08）

Sol 复核真实队列头部 Clear/Retry 为 `.queue-bar-action` 原生按钮，保留错误色、禁用、键盘和 HC 语义；普通主题 focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 86 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实队列头部动作焦点、按压与高对比观察仍待补。

### §292 Conversation Composer reference remove face 收窄合同（2026-11-08）

Sol 复核真实 22px `button.conversation-composer-ref-remove`，保留删除动作、键盘/ARIA 与 HC 环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 86 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实引用移除按压、焦点与高对比观察仍待补。

### §293 Conversation Composer maximize input button face 收窄合同（2026-11-08）

Sol 复核真实 22px `.conversation-lens-dock-maximize-input-button.monaco-button`，保留命中区、放大命令、键盘和 HC 焦点环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 86 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实放大输入按钮焦点、按压与高对比观察仍待补。

### §294 Conversation user turn fold button face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-lens-turn-fold-button`，保留折叠动作、命中区、键盘和 HC 焦点环；普通主题 focus/active 面迁到 `::before inset: 0 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 87 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实折叠按钮焦点、按压与高对比观察仍待补。

### §295 Conversation Trajectory inspector Back face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-lens-trajectory-inspector-back`，保留回退动作、ARIA/键盘和 HC 焦点环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 88 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Inspector Back 焦点、按压与高对比观察仍待补。

### §296 Conversation turn action button faces 收窄合同（2026-11-08）

Sol 复核真实 `.conversation-lens-turn-actions .monaco-button`（Copy/Retry/Delete 等），保留命令、22px 命中区、键盘/ARIA 与 HC 焦点环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 88 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实回合 action 焦点、按压与高对比观察仍待补。

### §297 Conversation Trajectory inspector Retry face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-lens-trajectory-inspector-retry`，保留重试动作、命中区、键盘和 HC 焦点环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 89 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Retry 焦点、按压与高对比观察仍待补。

### §298 Conversation Trajectory overview toggle face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-lens-trajectory-overview-toggle`，保留展开状态、命中区、键盘/ARIA 与 HC 焦点环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 89 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 overview toggle 焦点、按压与高对比观察仍待补。

### §299 Conversation Session title face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-lens-session-title`，保留改名入口、命中区、键盘/ARIA 与 HC 焦点环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 89 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Session title 焦点、按压与高对比观察仍待补。

### §300 Conversation timeline scroll-down face 收窄合同（2026-11-08）

Sol 复核真实滚动回到底部入口 `.conversation-timeline-scroll-down`，保留 28px 圆形命中区、滚动动作、键盘与 HC 焦点环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 89 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 22 条 unknown-variable 提示与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 scroll-down 焦点、按压与高对比观察仍待补。

### §301 Conversation Trajectory inspector close face 收窄合同（2026-11-08）

Sol 复核真实 22px `button.conversation-lens-trajectory-inspector-close`，保留关闭动作、ARIA/键盘与 HC 焦点环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 90 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Inspector Close 焦点、按压与高对比观察仍待补。

### §302 Conversation SessionBar control faces 收窄合同（2026-11-08）

Sol 复核真实 `.conversation-lens-session-controls .monaco-button`（New/Delete/More/Snapshots/History 等），保留命令、28px 命中区、键盘/ARIA 与 HC 焦点环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 90 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 SessionBar 控件焦点、按压与高对比观察仍待补。

### §303 Codicon pseudo-layer reliability fix（2026-11-08）

复核发现 SessionBar controls、turn-actions、Composer maximize Button 由 `Button.icon` 添加 codicon 类，图标占用宿主 `::before`；已将这三组交互面迁到 `::after`，避免覆盖图标，保留命中区、ARIA/键盘、HC 与 reduced-motion。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 90 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实图标与按压观察仍待补。

### §304 Conversation error retry button face 收窄合同（2026-11-08）

Sol 复核真实 `.conversation-lens-turn-error-retry .monaco-button`，用 `::after` 避开潜在 codicon `::before`，普通主题 hover/focus/active 面迁到 `inset: 1px 2px`；保留命中区、重试动作、HC 与 reduced-motion。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 91 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Retry 焦点、按压与高对比观察仍待补。

### §305 Conversation History close face 收窄合同（2026-11-08）

Sol 复核 History 浮层关闭控件为 codicon Button，普通主题 hover/focus/active 面迁到 `::after inset: 1px 2px`，避免覆盖 `::before` 图标层；保留 24px 命中区、关闭动作、键盘/ARIA、HC 与 reduced-motion。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 92 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 History close 焦点、按压与高对比观察仍待补。

### §306 Conversation SessionBar delete error face 收窄合同（2026-11-08）

Sol 复核 Delete 控件保留错误色语义，将 hover/active 宿主背景迁到既有 `::after` inset 面（16%/28% errorForeground），保留 codicon `::before`、命中区、键盘/ARIA、HC 与 reduced-motion。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 93 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Delete 焦点、按压与高对比观察仍待补。

### §307 Conversation Snapshots close face 收窄合同（2026-11-08）

Sol 复核 Snapshots 浮层关闭控件为 codicon Button，普通主题 hover/focus/active 面迁到 `::after inset: 1px 2px`，保留 24px 命中区、关闭动作、键盘/ARIA、HC 与 reduced-motion。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 94 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Snapshots close 焦点、按压与高对比观察仍待补。

### §308 Conversation turn trajectory action face 收窄合同（2026-11-08）

Sol 复核真实 `.conversation-lens-turn-header-trajectory .monaco-button` codicon Button，普通主题 hover/focus/active 面迁到 `::after inset: 1px 2px`，避免覆盖 `::before` 图标层；保留 22px 命中区、跳转动作、键盘/ARIA、HC 与 reduced-motion。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 94 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实轨迹跳转焦点、按压与高对比观察仍待补。

### §309 Conversation pinned user copy face 收窄合同（2026-11-08）

Sol 复核真实 `conversationTimelineHost.ts` 的 `Button.icon` 复制控件（Codicon.copy、ariaLabel），保留 20px 命中区、复制动作、键盘/ARIA 与 HC 焦点环；普通主题 hover/focus/active 面迁到不遮挡 Codicon `::before` 的 `::after inset: 1px 2px`，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 95 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实复制图标、按压与高对比观察仍待补。

### §310 Conversation process-fold tool cancel face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-process-fold-tool-cancel`（执行中工具取消入口，Codicon.debugStop、`aria-label`/`aria-disabled`），保留 22px 命中区与取消动作；普通主题 hover/focus/active 面迁到不遮挡 Codicon `::before` 的 `::after inset: 1px 2px`，HC 对比环与 reduced-motion 合同保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 96 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实取消图标、按压与高对比观察仍待补。

### §311 Conversation process-fold tool respond face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-process-fold-tool-respond`（执行中工具响应入口，Codicon.reply、`aria-label`/`aria-disabled`/`aria-busy`），保留 22px 命中区与响应动作；普通主题 hover/focus/active 面迁到不遮挡 Codicon `::before` 的 `::after inset: 1px 2px`，HC 对比环与 reduced-motion 合同保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 97 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实响应图标、按压与高对比观察仍待补。

### §312 Conversation process-fold trajectory jump face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-process-fold-trajectory-jump`（Codicon.listTree、`aria-label`），保留 22px 命中区、跳转动作与悬停显现逻辑；普通主题 hover/focus/active 面迁到不遮挡 Codicon `::before` 的 `::after inset: 1px 2px`，HC 对比环与 reduced-motion 合同保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 98 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实跳转图标、按压与高对比观察仍待补。

### §313 Conversation thinking process-fold header face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-process-fold-thinking-header`（`aria-controls` 展开入口），保留展开动作、22px+ 命中区与 HC 焦点环；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，不改变过程折叠显现与 reduced-motion 语义。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 99 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实思考折叠焦点、按压与高对比观察仍待补。

### §314 Conversation diff toggle 只读审计（2026-11-08）

Sol 复核 `.conversation-lens-turn-diff-toggle` 后确认当前仓库只有 `conversationLens.css` 中的遗留样式与 reduced-motion 列表命中，`src/` 没有对应 DOM、TS、button 或 ARIA 构造；无法证明真实命中区与行为语义，因此本轮不做 CSS 改动，死样式清理另待独立范围。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 99 passing；`git diff --check` 通过。

### §315 Conversation process-fold header face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-process-fold-header`（`role="button"`、`aria-controls`、Chevron 与展开动作），保留命中区与展开行为；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，轨迹模式专用面、HC 对比环与 reduced-motion 合同保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 100 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实折叠焦点、按压与高对比观察仍待补。

### §316 Conversation inbox queue chip 只读审计（2026-11-08）

Sol 复核真实 `button.conversation-lens-inbox-chip.conversation-lens-inbox-queue` 已有 queue 专用 `::before inset: 1px 4px`，并按 `aria-pressed`、`aria-disabled`、Goal/Stop 子控件区分选中与禁用状态；本轮不改 CSS，避免破坏状态语义。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 100 passing；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 queue chip 按压、焦点与高对比观察仍待补。

### §317 Conversation review navigation 只读审计（2026-11-08）

Sol 复核真实 `button.conversation-review-nav` 保留原生 type、`data-turn-id/kind`、`aria-label` 与 disabled fallback；现有 `::before inset: 2px 4px` 已承载普通 hover/focus/active，HC ring 与 reduced-motion 合同齐全，本轮不改 CSS。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 100 passing；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 review navigation 按压、焦点与高对比观察仍待补。

### §318 Conversation composer @ option face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-composer-at-option`，保留 `role="option"`、`aria-selected`、`tabIndex=-1` 与 textarea `aria-activedescendant` 键盘语义；普通未选中 hover/focus/active 面迁到 `::before inset: 1px 4px`，`.is-active` 选中面保留，并补 reduced-motion 合同。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 101 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实组合框焦点、按压与高对比观察仍待补。

### §319 Conversation Tune popup open face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-lens-dock-tune-open`，保留原生 type、打开 Engine 工具命令与 24px 命中区；普通主题 hover/focus/active 面迁到 `::before inset: 1px 4px`，HC 焦点环与 reduced-motion 保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 102 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Tune 按压与高对比观察仍待补。

### §320 Conversation More menu action face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-lens-dock-more-item[role="menuitem"]`，保留 `aria-label`、命令与 disabled 语义；排除 `menuitemradio` session 行后，普通 hover/focus/active 面迁到 `::before inset: 1px 4px`，HC 与 reduced-motion 保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 103 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 More 按压与高对比观察仍待补。

### §321 Conversation Add menu action face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-lens-dock-add-option[role="menuitem"]`，保留 `addComposerContextRef` 命令、menuitem 语义与命中区；普通 hover/focus/active 面迁到 `::before inset: 1px 4px`，HC 与 reduced-motion 保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 104 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 Add 按压与高对比观察仍待补。

### §322 Conversation code block copy face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-code-block-copy`，保留 22px 命中区、Codicon.copy/check 切换、`aria-label`/title 与复制命令；普通主题 hover/focus/active 面迁到不遮挡 Codicon `::before` 的 `::after inset: 1px 2px`，HC 焦点环与 reduced-motion 保持。

验证：Node 24.18.0 `conversationLensCssScan.test.ts` 105 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 与 103 条 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实复制图标、按压与高对比观察仍待补。

### §323 Conversation remaining dock/identity faces 只读审计（2026-11-08）

Sol 复核剩余直接 host 面后确认 Composer dock soft/filled 控件是有意的圆形/实心语义，ghost 控件与既有命中区 pseudo 共享，identity chip 还承载 offline/failed/readonly 状态；继续迁移会改变产品造型或状态层，本轮不做安全 CSS 改动。

### §324 Conversation confirmation/send state 只读审计（2026-11-08）

Sol 复核确认 CTA（`conversationConfirmationSeat.ts:250+`）使用 Button primary/secondary 实心语义，Composer send（`conversationLensDock.ts:413`）是 28px 圆形实心按钮并带 disabled 状态；普通 host hover/active 面不适合直接收窄，否则会削弱主次与可用性语义，本轮不做安全 CSS 改动。

验证：沿用当前 Node 24 `conversationLensCssScan.test.ts` 105 passing、既有 transpile-client、目标 Stylelint 与 `git diff --check` 结果；未启动默认编辑器/HC 窗口，真实 CTA/send 按压与高对比观察仍待补。

### §325 Sub-agent overlay action faces 收窄合同（2026-11-08）

Sol 复核子 Agent 浮层的 Open as tab、Maximize、Close 真实 `Button` 图标按钮，保留命中区、命令、ARIA 与 HC 焦点环；普通主题 hover/focus/active 面迁到不遮挡 Codicon `::before` 的 `::after inset: 1px 2px`，host 保持透明并补 reduced-motion。

验证：`conversationSubAgentOverlayCss.test.ts` CSS 合同测试通过；目标 Stylelint exit 0（既有 `--ua-ease` unknown-variable 与 design-token suggestions）；未启动默认编辑器/HC 窗口，真实浮层按钮图标、按压与高对比观察仍待补。

验证：沿用当前 `conversationLensCssScan.test.ts` 105 passing 与既有 Stylelint/diff-check 结果；未修改 Navigator、未 stage/commit/push。默认窗口和高对比人工观察仍待补。

### §326 Conversation session pill interaction face 收窄合同（2026-11-08）

Sol 复核时间线与 Composer 引用创建的真实 `a.conversation-session-pill`，保留链接、点击/Enter/Space 处理、`aria-label` 与文本胶囊；普通主题 hover/focus/active 将更强的交互色迁到 `::before inset: 1px 2px`，外层保留基础胶囊面，HC 焦点环与 reduced-motion 保持。

验证：Node 24 `conversationLensCssScan.test.ts` 105 passing；目标 Stylelint exit 0（既有 `--ua-ease` unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实链接按压与高对比观察仍待补。

### §327 Session leaf hide action face 收窄合同（2026-11-08）

Sol 复核会话叶真实 `button.conversation-session-leaf-hide`，保留 28px 命中区、`type="button"`、`aria-label` 与 Codicon.remove；普通主题 hover/focus/active 面迁到不遮挡 Codicon `::before` 的 `::after inset: 1px 2px`，host 保持透明，HC 焦点环与 reduced-motion 保持。

验证：Node 24 `conversationLensCssScan.test.ts` 105 passing、`conversationRegionChromeCss.test.ts` 4 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 `--ua-ease` unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实隐藏按钮按压与高对比观察仍待补。

### §328 Visualize expand action face 收窄合同（2026-11-08）

Sol 复核真实 `button.conversation-visualize-expand`，保留 24px 命中区、`type="button"`、`aria-label` 与展开命令；普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，host 保持透明，HC 焦点环与 reduced-motion 保持。

验证：Node 24 `conversationLensCssScan.test.ts` 105 passing；目标 Stylelint exit 0（既有 `--ua-ease` unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实展开按钮按压与高对比观察仍待补。

### §329 Visualize overlay header action faces 收窄合同（2026-11-08）

Sol 复核 Visualize overlay 的 Reset/Close 真实 `Button` 图标控件，保留小型 secondary 语义、命中区、命令与焦点环；普通主题 hover/focus/active 面迁到不遮挡图标的 `::after inset: 1px 2px`，host 保持透明并补 reduced-motion。

验证：Node 24 `conversationLensCssScan.test.ts` 106 passing；目标 Stylelint exit 0（既有 `--ua-ease` unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未启动默认编辑器/HC 窗口，真实 overlay action 按压与高对比观察仍待补。

### §330 Engine catalog/trigger action faces 收窄合同（2026-11-08）

Sol 复核 Engine triggers 与 catalog icon actions 的真实 `Button` ghost 控件，确认它们只提供小型操作入口，不承载 selected、error 或实心按钮状态；保留 22px 命中区、Codicon/ARIA/键盘与 HC 边框，将普通主题 hover/focus/active 面迁到不遮挡图标的 `::after inset: 1px 2px`，host 保持透明并补 workbench 与 prefers reduced-motion。

验证：`enginePreferencesPaneCss.test.ts` 8 passing、`conversationLensCssScan.test.ts` 106 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 `--ua-ease` unknown-variable 与 design-token suggestions）；`git diff --check` 通过。未修改 Navigator、未 stage/commit/push，真实默认编辑器/HC 窗口与图标按压观察仍待补。

### §331 Engine narrow-detail Back action face 收窄合同（2026-11-08）

Sol 复核窄面板详情页的真实原生 `button.engine-preferences-back`：它只承担返回导航，没有 selected/error 状态；保留 `type=button`、aria-label、点击回导航、24px 命中区与 HC 对比环，将次按钮的 resting/hover/active/普通主题 focus 面迁到 `::before inset: 1px 2px`，宿主保持透明，HC 保留 contrast border，并为 workbench 与 prefers reduced-motion 清除 pseudo transition。

验证：`enginePreferencesPaneCss.test.ts` 9 passing；`npm run transpile-client` exit 0（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 `--ua-ease` unknown-variable 与 34 条 design-token suggestions）；`git diff --check` 通过。未修改 Navigator、Connection，未 stage/commit/push；真实窄面板与高对比观察仍待补。

### §332 Conversation/Trajectory tab face micro-shrink（2026-11-08）

用户继续反馈 tab 视觉面偏大。Sol 复核确认 `button.conversation-lens-lens-tab` 仍保持 32px 命中区、`role=tab`、`aria-selected`、键盘切换与 HC focus ring，且没有后续覆盖；将共用的 selected/hover/focus/active `::before` 面从 `inset: 7px 6px` 收窄为 `inset: 8px 7px`，只减少视觉面，不改命中区或语义。

验证：`conversationLensCssScan.test.ts` 106 passing；目标 Stylelint exit 0（既有 103 条 design-token suggestions）；`git diff --check` 通过。真实 tab 按压、键盘与高对比观察仍待补。

### §333 Conversation SessionBar ordinary action active face（2026-11-08）

SessionBar 的 New/More/History/Snapshots 是真实普通 `Button` 图标操作，不承载 selected、error 或实心状态；保留 28px 命中区、Codicon、ARIA/键盘与 HC/reduced-motion，将旧的整颗 host active 背景收窄为透明 host，并把 `toolbar-activeBackground` 只绘制到既有 `::after` inset 面；Delete 错误色控件继续保留独立 error 语义。

验证：`conversationLensCssScan.test.ts` 107 passing；目标 Stylelint exit 0（既有 103 条 design-token suggestions）；`npm run transpile-client` exit 0（10224 files / 2047 resources）；`git diff --check` 通过。未修改 Navigator、Connection，未 stage/commit/push；真实默认窗口与高对比观察仍待补。

### §334 Engine confirmation cancel action face（2026-11-08）

Engine 确认弹窗的 Cancel 是普通次级原生 button，确认按钮继续保留实心主操作语义。保留 Cancel 的 24px 命中区、type 与点击关闭行为，将普通主题 hover/focus/active 面迁到 `::before inset: 1px 2px`，宿主保持透明，HC 焦点环与 reduced-motion 保持。

验证：`enginePreferencesPaneCss.test.ts` 10 passing；`npm run transpile-client` exit 0；目标 Stylelint exit 0（既有 unknown-variable 与 34 条 design-token suggestions）；`git diff --check` 通过。未修改 Navigator、Connection，未 stage/commit/push；真实默认窗口与高对比观察仍待补。
### §335 Engine provider write-toolbar hover face（2026-11-08）

Provider 模型区的真实 write-toolbar buttons 同时带有 `engine-catalog-icon-actions` 的内缩伪元素，但更具体的 provider hover 规则仍给宿主铺满 24px 背景。将该 provider hover host 改为透明，让既有 `::after inset: 1px 2px` 承载可见面，保留按钮命令、命中区、Codicon、ARIA、键盘与 HC/reduced-motion。

验证：`enginePreferencesPaneCss.test.ts` 11 passing；刷新 `npm run transpile-client` 通过（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 unknown-variable 与 34 条 design-token suggestions）；`git diff --check` 通过。未修改 Navigator、Connection，未 stage/commit/push；真实默认窗口与高对比观察仍待补。

### §336 Conversation/Engine remaining ordinary faces read-only audit（2026-11-08）

审查确认 agent-down popup item 是标准 menu selection，整行 selection background 属于菜单语义；session-select 是原生 SelectBox，保留宿主 hover 以维持下拉与键盘反馈；turn-diff-toggle 只有 CSS、没有 TS/DOM/ARIA 引用；Composer dock soft/filled、selected tabs 与实心主操作继续保留其状态面。本轮无安全代码改动，未修改 Navigator、Connection，未 stage/commit/push。

### §337 Conversation/Engine remaining ordinary faces second read-only audit（2026-11-08）

复查剩余直接 host hover/active/focus 面后，agent-down popup 仍是标准菜单整行 selection，session-select 仍是原生 SelectBox，Composer dock soft/filled、selected tabs 与实心主操作继续承载状态语义；`conversation-lens-turn-diff-toggle` 仍只有 dead CSS，没有 TS/DOM/ARIA 引用。本轮无安全代码改动，未修改 Navigator、Connection，未 stage、commit、push。

### §338 Conversation/Engine remaining ordinary faces third read-only audit（2026-11-08）

基于当前 HEAD 复查 Engine generic Button active/focus 规则与 Conversation 直接宿主面，具体 icon actions、MCP tabs、Test Engine、确认弹窗、原生 SelectBox、标准菜单 selection、Composer 状态控件和实心主操作均已有更具体规则或明确状态语义。未发现可安全迁移的普通 ghost action。本轮无代码改动，未修改 Navigator、Connection，`git diff --check` 通过。

### §339 Conversation/Engine ordinary face audit fourth pass（2026-11-08）

再次扫描当前 HEAD 的普通 hover/active/focus 面，确认剩余直接宿主面仍属于标准菜单 selection、原生 SelectBox、Composer 状态控件或实心操作语义；具体 icon actions、MCP tabs、Test Engine 与确认弹窗已有独立规则。未发现可安全迁移的普通 ghost action，本轮无代码改动，未修改 Navigator、Connection。

### §340 Conversation/Engine ordinary face audit fifth pass（2026-11-08）

复查当前 HEAD 的 Conversation、Engine、Settings 普通 hover/active/focus 面。剩余直接宿主面仍属于标准菜单 selection、原生 SelectBox、Composer 状态控件、Save 等次级实心操作或已由更具体 icon-action 规则覆盖。未发现可安全迁移的普通 ghost action，本轮无代码改动，未修改 Navigator、Connection。

### §341 Sources changes inline action face（2026-11-08）

Sources Changes 的真实 `Button` inline/group actions 保留 22px 命中区、图标、ARIA/键盘与 HC 焦点环。普通主题 hover/focus/active 宿主背景迁到不遮挡 Button icon 的 `::after inset: 1px 2px`，并补 reduced-motion 合同。

验证：`sourcesWiringScan.test.ts` 48 passing；目标 Stylelint exit 0（既有 unknown-variable 与 21 条 design-token suggestions）；`git diff --check` 通过。未修改 Navigator、Connection，未 stage、commit、push；真实 Sources Changes 窗口与高对比观察仍待补。

### §342 Titlebar navigation action face（2026-11-08）

标题栏左侧的 Back/Forward 是真实导航 action，保留 28px 命中区、命令、键盘/ARIA 与 HC 焦点环。普通主题 hover/focus/active 宿主背景迁到不遮挡图标的 `::after inset: 1px 2px`，补 reduced-motion 合同，不添加 Logo。

验证：`titlebarNavigationContract.test.ts` 3 passing；目标 Stylelint exit 0（既有 6 条 design-token suggestions）；`git diff --check` 通过。未修改 Navigator、Connection，未 stage、commit、push；真实默认窗口与高对比观察仍待补。

### §343 Sources title action face（2026-11-08）

Sources 标题栏的真实 icon action 保留 22px 命中区、图标、键盘/ARIA 与 HC 焦点环。普通主题 hover/focus/active 宿主背景迁到不遮挡图标的 `::after inset: 1px 2px`，并补 reduced-motion 合同。

验证：`sourcesWiringScan.test.ts` 49 passing；目标 Stylelint exit 0（既有 2 条 design-token suggestions）；`git diff --check` 通过。未修改 Navigator、Connection，未 stage、commit、push；真实 Sources 标题栏与高对比观察仍待补。

### §344 Titlebar right toolbar action face（2026-11-08）

标题栏右侧 center-adjacent/update toolbar 的真实 action labels 保留原有命中区、命令、键盘/ARIA 与 HC 焦点环。普通主题 hover/focus/active 宿主背景迁到不遮挡图标的 `::after inset: 1px 2px`，并补 reduced-motion 合同。

验证：`titlebarNavigationContract.test.ts` 4 passing；刷新 `npm run transpile-client` 通过（10224 files / 2047 resources）；目标 Stylelint exit 0（既有 6 条 design-token suggestions）；`git diff --check` 通过。未修改 Navigator、Connection，未 stage、commit、push；真实默认窗口与高对比观察仍待补。

### §345 Pane composite title action faces（2026-11-08）

Pane composite 的 title-actions、global-actions 与 global-actions-left 是普通工具栏操作，保留原生命中区、命令、ARIA/键盘与 HC 反馈。普通主题 hover/focus/active 面从完整 action-label 宿主迁到不遮挡图标的 `::after inset: 1px 2px`，复合 tab 与 checked 状态保持原有语义，并补 reduced-motion 合同。

验证：`paneCompositePartCss.test.ts` 6 passing；目标 Stylelint exit 0（既有 13 条 design-token suggestions）；`npm run transpile-client` 通过（10224 files / 2047 resources）；`git diff --check` 通过。未修改 Navigator、Connection，未 stage、commit、push；真实默认窗口与高对比观察仍待补。

### §346 Editor watermark toolbar action face（2026-11-08）

Editor 空态 watermark 的普通 icon action 保留原生命中区、命令、ARIA/键盘与 HC 焦点。普通主题 hover/focus/active 宿主背景迁到不遮挡图标的 `::after inset: 1px 2px`，并补 reduced-motion 合同。

验证：`editorGroupWatermarkToolbarCss.test.ts` 4 passing；刷新 `npm run transpile-client` 通过（10224 files / 2047 resources）；目标 Stylelint exit 0；`git diff --check` 通过。未修改 Navigator、Connection，未 stage、commit、push；真实默认窗口与高对比观察仍待补。

### §347 Workbench remaining ordinary face read-only audit（2026-11-08）

复查 Panel composite、AuxiliaryBar、ActivityBar、Editor placeholder/status 与其他工作台普通 hover/active/focus 面。Panel/AuxiliaryBar composite 项含 checked/selected 语义，ActivityBar 含 selected/status pseudo layers，Editor placeholder/status 与 modal action 是次级或状态操作。未发现可安全迁移的普通 ghost action，本轮无代码改动，未修改 Navigator、Connection。

### §348 AuxiliaryBar title action face（2026-11-08）

AuxiliaryBar 标题栏的普通 `title-actions` 是未承载 checked/selected 语义的工具栏操作。保留命中区、命令、ARIA/键盘和 HC 焦点，将普通主题 hover/focus/active 面迁到不遮挡图标的 `::after inset: 1px 2px`，并补 reduced-motion 合同。

验证：`auxiliaryBarPartCss.test.ts` 4 passing；目标 Stylelint exit 0；`git diff --check` 通过。未修改 Navigator、Connection，未 stage、commit、push；真实默认窗口与高对比观察仍待补。

### §349 Workbench status and composite state face read-only audit（2026-11-08）

复查 statusbar、Panel composite、AuxiliaryBar 与 ActivityBar 的直接 hover/active/focus 面。status item 承载 status、warning、error、prominent 语义，Panel/AuxiliaryBar composite actions 承载 checked/tab 语义，ActivityBar 使用 selected/status 伪层。未发现可安全迁移的普通 ghost action，本轮无代码改动，未修改 Navigator、Connection。

### §350 Workbench stateful face audit second pass（2026-11-08）

复查 statusbar、Panel composite、ActivityBar、AuxiliaryBar 与 Editor 的直接宿主面，确认 status item 的 warning/error/prominent 状态、composite checked/tab 状态和 ActivityBar selected/status 伪层仍是产品语义。Editor 与 modal action 为次级或状态操作，未发现可安全迁移的普通 ghost action，本轮无代码改动，未修改 Navigator、Connection。
### §351 Editor group toolbar action face（2026-11-08）

Editor group container toolbar 的普通 action-label 保留命中区、图标、命令、ARIA/键盘与 HC 焦点。普通主题 hover/focus/active 宿主背景迁到不遮挡图标的 `::after inset: 1px 2px`，并补 reduced-motion 合同。

验证：`editorGroupToolbarCss.test.ts` 4 passing；刷新 `npm run transpile-client` 通过（10224 files / 2047 resources）；目标 Stylelint exit 0；`git diff --check` 通过。未修改 Navigator、Connection，未 stage、commit、push；真实默认窗口与高对比观察仍待补。
