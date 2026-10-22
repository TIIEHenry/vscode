---
title: "视觉语言以 ChatGPT 为主参照（保留 IDE 密度）"
type: plan
status: draft
phase: N/A
updated: 2026-10-22
summary: "2026-10-21 用户选定视觉以 ChatGPT 为主参照并保留 Cursor 的布局。O1–O4 已写入。最新一条动作行在正文流里常显，更早的不占行高。代码块头、草稿 13px、「+」加上下文已在工作区。设置页导航 22px，私网允许是复选框，Provider 启用标记只读。S0、S5 未做。方案仍 draft，不升 PRD-028。"
---

# 视觉语言以 ChatGPT 为主参照（保留 IDE 密度）

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

没有实测的尺寸不写进规范的数值列。14px、12px、行高 1.75、阅读列 768px 都不在 2026-10-15 的实测里，已从换算表删掉。S0 补齐之前，O1（用户回合形状）不动。

## 3. 设计

总的换算规则写在 [UI 设计原则 §1.1](../../docs/architecture/cross-cutting/ui-design-principles.md#11-chatgpt-到桌面的换算)：结构、层级、比例照取，尺寸换成本仓 token。下面按表面写落点。

### 3.1 色调与表面

- 2026-10-22 用户判定 ChatGPT 配色比 Cursor 好看，浅色改成 ChatGPT 的两种表面：chrome `#F6F6F6`，画布 `conversation.background` 与浮层（菜单、编辑器浮件、Quick Input、通知）`#FFFFFF`。Composer 与用户回合卡已有细边，白底上靠描边分层，不再靠第三种底色。深色不动（S5）。
- 主按钮与发送钮近黑（深色近白）。强调色只给焦点、选中、链接、进度。
- 深色梯度见 S5：先取 ChatGPT 深色的画布、侧栏、抬起表面三档，只在明度阶差不足时改产品主题，组件不写 hex。

### 3.2 对话阅读面

- 正文 13px / 1.5，阅读列 720px，助手回合直接起排，不加头像和标签。
- 用户回合：靠右、不超过 82%、`cornerRadius.large`、输入框底色加 8% 细边、悬停反馈、点卡编辑（2026-10-21 用户选定）。要不要改成 ChatGPT 的填充式无边气泡，见 O1。
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

| 切片 | 内容 | 文件 | 依赖 |
|------|------|------|------|
| S0 | 登录后 ChatGPT 线程，桌面宽 1440px 与 1024px、浅色与深色，记用户回合、动作行、思考行、代码块、Composer、回到底部钮、弹出层、深色三档的计算样式与截图。只在外部对照追加新的一节，不改写 2026-10-15 的实测段。PRD-028 的改动来自 2026-10-21 的选定，不来自那份对照 | `docs/reference/external-chat-ui-density.md` | 需要用户提供登录会话或截图 |
| S1 | 锁住原则八：CSS 扫描断言在线点在线态可见、chevron 常态不透明、思考摘要不 `display: none`、Overview 七类颜色互不相同、Composer 聚焦规则无 `0 0 0 3px`、正文 13px；单测断言完成态 `.codicon-check`。工作区已锁这些项，另加代码块描边，以及最新动作行占正文流而更早的不占。`conversationLens.css` 里超过 100ms 的 `0.12s` / `0.15s` 过渡已收到 100ms | `conversationLensCssScan.test.ts`、`conversationProcessFold.test.ts`、`conversationIdentityStrip.test.ts` | 无 |
| S2 | Connection 首选项导航 22px，按钮和输入框回到 monaco 默认高度与 `cornerRadius.small`，去掉 `!important` 反色主按钮，标题 18px，字段标签 12px，说明 `fontSize.label1`；设备行 24px。设置编辑器页签是上游 CSS（`preferencesEditor.css` 文件头是 Microsoft 版权），原则 §9 与本稿 §8 不改，§4 的编辑器 tab 仍沿用上游。工作区：导航 22px（HEAD 是 28px，不是 34px），输入框和 Engine 测试钮是 `cornerRadius.small`，私网允许是复选框，Provider 启用标记只读且回到 34×20。设备行 CSS 在 HEAD 已是 24px，变的是 `HubDevicesDelegate` 从 36px 收到 24px。状态条、配对框、环境提示和目录横幅回到 `cornerRadius.small`，待配对行回到 `cornerRadius.xSmall` | `connectionPreferencesPane.css`、`connectionDeviceList.css`、`connectionPreferencesPane.ts`（行高常量，如有）、扫描测试 | 无 |
| S3 | 草稿 13px / 行高 20px。「+」加会话上下文，Tool options 用 `tools` 图标并与 Permission、Model 同排。工作区已改。单行输入区仍是 32px 高 | `conversationLens.css`、`conversationLensDock.ts`、`conversationComposerAt.ts`、`conversationLens.test.ts` | 已选定 |
| S4 | 代码块头；动作行在正文下方，最新一条在正文流里常显，更早的不占行高。用户回合保持细边卡片。工作区已改。最新一条的类由时间线宿主打在 article 上；渲染器只把动作行接到正文后面 | `conversationTimelineHost.ts`、`conversationTimelineItemHost.ts`、`conversationTimelineRenderer.ts`、`conversationLens.css`、`conversationLens.test.ts` | 已选定。不依赖 S0 |
| S5 | 深色三档对照；只在阶差不足时改产品主题 | `extensions/theme-defaults/themes/universe-agent-studio-dark.json`、`theming.md` | S0 |
| S6 | 验证（§7） | — | S1–S5 |

S1 与 S2 文件不重叠，可以并行。S3 与 S4 都改 `conversationLens.css`，串行或由同一工位做。

## 7. 验证

- 本地门禁按 [health-gates](../progress/health-gates.md)：`npm run compile-client`（只看改过的文件；全仓现有 123 个与本稿无关的类型错误）、`npx eslint` 改过的文件、`python3 scripts/check-docs-health.py`、对应目录单测。
- 单测基线：`conversationSessionsView.test.ts` 与 HEAD 一致，有 5 个替身服务缺 `onDidChangeSessionRosterDetail`。`conversationLens.test.ts`、`conversationProcessFold.test.ts`、`conversationIdentityStrip.test.ts`、`conversationLensCssScan.test.ts` 相对 HEAD 已有本稿改动，不能写成与 HEAD 一致。`conversationLens.test.ts` 里原先 14 个失败的记录挂在 `2e785907611`：13 个是 `getAgentSelect` 找不到 `select`，另 1 个是透镜 id 跨重新挂载不保留。2026-10-21 重跑了动作行、私网复选框、Provider 只读标记和正文 13px 扫描，这几项通过。本稿不得新增失败。
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
