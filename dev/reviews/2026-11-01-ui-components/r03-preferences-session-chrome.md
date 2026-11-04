---
title: "r03 首选项面板与会话外框"
type: reference
status: active
phase: M7
updated: 2026-11-01
summary: "Engine / Connection 首选项、SAS 配对确认、身份条与会话胶囊的交互和视觉问题；路径相对 src/vs/workbench/contrib/conversation/browser/"
---
# r03 首选项面板与会话外框

路径未写前缀时相对 `src/vs/workbench/contrib/conversation/browser/`。审查背景、判据和共性根因见 [README](README.md)。

基线：两个首选项面板主要用平台控件（`Button`、`InputBox`、`Checkbox`、`WorkbenchList`），监听都进了 `_register` 或 `DisposableStore`。窄布局下导航隐藏时焦点会移到返回按钮，`refreshNav` 保留焦点和选中位置。产品主题的主按钮颜色符合原则 6：`universe-agent-studio-light.json` 是 `#1F1F1F`，`universe-agent-studio-dark.json` 是 `#F3F3F3`。

## r03-1 Connection 待配对行能聚焦但不能用键盘选中

状态：成立。优先级 P0。

观察（作者：agent:context-gatherer）：`connectionPreferencesPane.ts:1530-1546`，每行是 `div`，`role="listitem"`、`tabIndex = 0`，只挂了 `click`。Enter 和 Space 不起作用，而 Confirm / Reject 依赖 `selectedPending`，键盘用户因此无法完成配对审批。选中态用 `aria-current="true"`，读屏不会把它当选中。每次点击都 `DOM.clearNode(this.pendingPairsList)` 后重建（第 1529-1530 行），被点的行随之销毁，焦点落到 body。CSS 给这些行做了 `:focus-visible`（`media/connectionPreferencesPane.css:688-698`），键盘能到达，却不能操作。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读第 1514-1550 行。[deferred-gaps](../../progress/deferred-gaps.md) D1338 是收件箱队列行的同类问题，已修；本处没有登记 |

方案：改用 `WorkbenchList`（与同面板的设备列表、配置列表一致），选中走 `onDidChangeSelection`，焦点和 `aria-selected` 由平台维护。若保留手写行，至少补 Enter / Space、`role="option"` + `aria-selected`，重建后把焦点放回同一 pending 的新行。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md)）：收窄：手写行补 Enter / Space，容器改 `listbox`、行改 `option` 加 `aria-selected`，重建后焦点回到同一 pending 的新行；不改用 WorkbenchList。

## r03-2 高对比主题下 Connection 输入框聚焦没有可见变化

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：`media/connectionPreferencesPane.css:413-417` 的聚焦规则 `… > .monaco-inputbox.synthetic-focus, …:focus-within { outline: none; border-color: var(--vscode-focusBorder) !important; }` 去掉了轮廓。随后第 419-421 行与第 763-765 行的高对比规则 `.monaco-workbench:is(.hc-black, .hc-light) … > .monaco-inputbox { border-color: var(--vscode-contrastBorder) !important; }` 特异度相同、同样 `!important`、位置更靠后，把聚焦边框盖回静止色。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读两组规则并算特异度：两边都是 5 个类（`:is()` 取其中最高的一个类），后者胜出。属于样式层叠推导；`inputBox.css` 是否给内部 `<input>` 另加高对比轮廓、实际是否完全看不出，未启动验证 |

方案：两条高对比规则加 `:not(.synthetic-focus):not(:focus-within)`，再补一条高对比聚焦规则：`outline: 1px solid var(--vscode-contrastActiveBorder)`。非高对比下的聚焦现在是 `border-color: var(--vscode-focusBorder) !important`，按用户裁定 2 一并改为中性阴影焦点（写法见 [README](README.md)）。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D1）：高对比两条规则加 `:not(.synthetic-focus):not(:focus-within)` 并补 `contrastActiveBorder` 轮廓；非高对比保持 `focusBorder` 描边，不改阴影。

## r03-3 Connection 返回按钮回到 28px

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：Connection 返回按钮 `height: var(--vscode-spacing-size280, 28px)`（`media/connectionPreferencesPane.css:189`），Engine 是 `spacing-size240, 24px`（`media/enginePreferencesPane.css:292`）。高对比聚焦框也不同：Connection 用 `contrastBorder`（与它的高对比边框同色，看不出），Engine 用 `contrastActiveBorder`。[控件细节精修](../../plans/control-detail-polish.md) 把两个返回按钮统一到了 24px。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读两段规则；`git log -S "spacing-size280, 28px);"` 显示改动来自 `fd764e966b4` 与 `98aa1b2140f`，都晚于精修提交 `180fcdbb4ec`（2026-10-26） |

方案：改回 `spacing-size240, 24px`，高对比聚焦改用 `contrastActiveBorder`，与 Engine 一致。

签收：签。签收人：agent:codex，日期：2026-11-01。

## r03-4 SAS 配对确认框：无可读名称、两个主按钮、关闭后焦点不还原

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：`connectionPreferencesPaneSas.ts`：

- 第 64-65 行设了 `role="dialog"`、`aria-modal="true"`，但没有 `aria-labelledby` / `aria-describedby`，标题和正文节点没有 id。读屏只报「对话框」。
- 第 148、152 行 Confirm 与 Cancel 都是 `new Button(buttonsContainer, defaultButtonStyles)`，两个主按钮并排；Cancel 应为次按钮。
- 打开时 `confirmButton.focus()`，`finally` 只清空宿主，不把焦点还给打开前的元素，关闭后焦点落到 body。

Tab 圈定（`handleConversationOverlayTab`）、`focusin` 拉回和宿主脱离时自动取消都已经有。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读第 51-160 行。配对的加载、超时、重试状态流转本次没有追 |

方案：标题、正文加 id 并挂到对话框；Cancel 用 `{ ...defaultButtonStyles, secondary: true }`；进入时记下 `document.activeElement`，`finally` 里若它仍在文档中就还原焦点。

签收：签。签收人：agent:codex，日期：2026-11-01。

## r03-5 直连地址校验失败只写状态行

状态：成立。优先级 P1。

观察（作者：agent:context-gatherer）：`readDirectAddressForm`（`connectionPreferencesPane.ts:1551-1558`）在 host 或 port 无效时只往 `directAddressStatus` 写 "Enter a valid host and port."。没有 `aria-invalid`，没有 `aria-describedby`，焦点不移到出错字段，`InputBox` 的 `validationOptions` 在本面板没有使用。状态行是 `role="status"`，读屏能听到，但不知道是哪个字段。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读第 1551-1558 行 |

方案：用 `InputBox` 的 `validationOptions` 分别校验 host 与 port，提交失败时聚焦第一个出错字段；状态行只保留连接结果。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md)）：收窄：出错字段加 `aria-invalid`、`aria-describedby` 指向状态行、聚焦第一个出错字段；不用 `validationOptions` 气泡。

## r03-6 Engine 确认气泡关闭后焦点不还原

状态：待核对。

观察（作者：agent:context-gatherer）：`engineConfirmPopover.ts:45-107` 用原始 `button`，有 `role="dialog"` 与 `aria-label`，`danger` 时先聚焦 Cancel，Escape 在捕获阶段处理（第 80-81 行，标准事件，键值换算正确）。关闭时没有把焦点还给 `options.anchor`，Tab 可以离开气泡。危险按钮字重是 600（`media/enginePreferencesPane.css:1232-1235`），Connection 的危险按钮是 400，两处不一致。

要看什么：`IContextViewService` 关闭时是否自己还原焦点。启动后在 Engine 某个删除操作上打开气泡，按 Escape / Cancel，看焦点落在哪里。

## r03-7 身份条 chip 长名称截断但不显示省略号

状态：待核对。

观察（作者：agent:context-gatherer）：`media/conversationIdentityStrip.css:31-46` 的 `.conversation-identity-chip` 是 `display: inline-flex` 加 `text-overflow: ellipsis`，标签是裸文本节点（`conversationIdentityStrip.ts:192-193、208-209`）。裸文本在 flex 容器里成为匿名 flex 项，`text-overflow` 作用在容器上不生效，长文件夹名或分支名会被直接裁掉。有原生 `title` 提示（第 380、418 行），但会话胶囊用的是 `hoverService.setupManagedHover`，两处不一致。

要看什么：打开一个名字很长的文件夹或分支，看 chip 末尾有没有省略号。若没有，把文本包进 `span`，在 `span` 上设 `overflow: hidden; text-overflow: ellipsis; min-width: 0`。

## r03-8 彩色状态点与状态底色

状态：不成立。

观察（作者：agent:context-gatherer）：身份条引擎状态点用 `testing-iconPassed`（绿）、`iconQueued`（黄）、`iconFailed`（红），离线文字用警告色，离线悬停有警告色底（`media/conversationIdentityStrip.css:58-88、106-108、151-153`）。Connection 状态行成功、警告用 12% 彩色底加彩色图标（`media/connectionPreferencesPane.css:461-497`），环境提示常驻警告色底，目录横幅成功时绿色底。Engine 导航的计数徽标是中性色，符合原则 6。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 不成立 | 用户 2026-11-01 在对话中裁定：彩色状态点不算违反原则 6，见 [README](README.md) 用户裁定 1 |

## r03-9 Engine 与 Connection 两个首选项面板已分叉

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：

| 项 | Engine | Connection |
|---|---|---|
| 导航行 | 22px，`padding: 0 10px`，圆角 6px，有图标 | 22px，`padding: 0 size120`，圆角 `cornerRadius-small`（4px），无图标 |
| 选中底 | 8%，列表聚焦时 12% | 始终 8% |
| 标题下间距 | `margin-bottom: 16px; padding-bottom: 0` | `margin-bottom: size160; padding-bottom: size80`，多 8px |
| 设置行 | `padding: 8px 0; column-gap: 12px` | `padding: 14px 0; column-gap: 16px` |
| 按钮 | 只设 `width: auto`，激活分区内 `min-height: 28px` | 面板内所有按钮强制 `height: 28px; padding: 4px 14px; min-width: 64px` |
| 详情容器 | 无边框 | 10% 前景描边、6px 圆角、97% 底色、16px 内边距 |
| 危险按钮 | 字重 600 | 字重 400 |

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读 `enginePreferencesPane.css:132-375、1226-1285、1785-1822`，`connectionPreferencesPane.css:130-470、726-819`。Engine 设置行那一项与各分区是否另有卡片未逐行复读 |

方案：以一份为准定共用尺寸（行高、设置行内边距、按钮高、详情容器样式），抽到两边都引用的公共 CSS。先由用户选以哪一边为基准。

签收：签。签收人：agent:codex，日期：2026-11-01。

决定（agent:kiro 受用户委托，2026-11-01，见 [审查待定项决定](../../../docs/decisions/ui-review-decisions-2026-11-01.md) D15）：以规范为准：导航 22px、`cornerRadius.small`、选中两色；设置行上下 8px；按钮用 monaco 默认高度；危险按钮 400；两边引用同一份 CSS。

## r03-10 CheckboxChip 的读屏名称与禁用原因

状态：待核对。

观察（作者：agent:context-gatherer）：`checkboxChip.ts:75` 把 `aria-label` 设在没有 role 的 `div` 上，读屏会忽略。禁用时先 `checkbox.disable()` 再设 `tabIndex = 0`（第 122-123 行）以保持可聚焦，但原因只写在行的 `title`（第 130-131 行），没有挂到被聚焦的复选框上。这个组件用在 Composer 区。

要看什么：用 Orca 聚焦一个禁用的 chip，听是否读出名称和禁用原因。若没有，把原因写进复选框的 `aria-description` 或 `aria-describedby`。

## r03-11 「Allow private networks」标签与说明没有关联到复选框

状态：成立。优先级 P2。

观察（作者：agent:context-gatherer）：`connectionPreferencesPane.ts:704-719` 的标签和说明是两个带点击处理的 `span`，不是 `<label for>`，说明也没有通过 `aria-describedby` 挂到复选框。`.connection-toggle-row { cursor: pointer }`（`media/connectionPreferencesPane.css:346` 起）覆盖整行，但行本身没有点击处理，空白处显示手形却点不动。复选框本身来自平台 `Checkbox`，Space / Enter 与 `aria-checked` 正常。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 成立 | 读两段代码 |

方案：说明节点加 id 并挂到复选框的 `aria-describedby`；`cursor: pointer` 只留在标签和说明上。

签收：签。签收人：agent:codex，日期：2026-11-01。

## r03-12 身份条与会话胶囊的过渡缺减弱动效

状态：不成立。

观察（作者：agent:context-gatherer）：`media/conversationIdentityStrip.css:46、94` 与 `media/conversationSessionPill.css:23` 的 100ms 过渡没有 `monaco-reduce-motion` 覆盖。

核对

| 轮次 | 核对人 | 判定 | 依据 |
|---|---|---|---|
| 1 | agent:kiro | 不成立 | 两者都在 `.part.conversation` 内，由 `src/vs/workbench/browser/media/productAccessibility.css:78-91` 的全局规则统一处理，同 r01-10 |
