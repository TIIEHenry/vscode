---
title: "方案 r10：chat-widget"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 2，drop 0，weaken 2。隐式芯片主题重绘残留与确认 JSON 展开失败拆入口仍成立；输入宽度与附件点击焦点降级。"
---
# 方案 r10：chat-widget

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 2，drop 0，weaken 2。

## r10-1 中（hold）

- 问题类：带 light/dark 双路径图标的隐式上下文，在颜色主题变化时再 `append` 芯片，旧节点留在附件容器里，监听已卸。
- 不变量：同一次 `render()` 之后，`attachedContextContainer` 里属于这个 widget 的 `.chat-attached-context-attachment.implicit` 数量等于本次实际画出的条数。同一容器里后挂上的普通附件芯片还在。颜色主题切换不会把已禁用的旧芯片留在树上。
- 要动的符号或文件：`ImplicitContextAttachmentWidget.render`、`ImplicitContextAttachmentWidget.renderMainContext`。`render()` 开头卸掉本实例上次 append 的节点，再 `renderDisposables.clear()`。节点名单只记录本实例创建的 `contextNode`。
- 明确不改什么：`dom.clearNode(this.domNode)`。`domNode` 就是 `ChatInputPart.renderAttachedContext` 传入的 `attachedContextContainer`，普通附件随后也 append 在同一节点上。`ChatInputPart` 第 4026–4028 行的 `onDidFileIconThemeChange` → `renderAttachedContext()`。`DefaultChatAttachmentWidget` 第 908–910 行就地重设标签的做法。
- 怎样本地验证：没有覆盖这条的测试名。新增断言：双路径 `iconPath` 的隐式上下文与一条普通附件同在一个容器里，触发 `onDidColorThemeChange` 后，`.implicit` 芯片只有一条，普通附件仍在，旧节点上的切换监听不再留下。

## r10-2 中（hold）

- 问题类：工具确认 JSON 的「See more」在 `JSON.parse` 失败后仍移除链接，折叠的单行无法再被这个入口展开。
- 不变量：`canSeeMore` 为真时，解析失败则链接仍在，编辑器文本、`wordWrap: 'off'`、`tabFocusMode` 保持点击前的值。解析成功才 `JSON.stringify(parsed, null, 2)`、把 `wordWrap` 设为 `'on'`、把 `tabFocusMode` 设为 `false`，然后移除链接。
- 要动的符号或文件：`ToolConfirmationSubPart.createContentElement` 里 `canSeeMore` 分支的 mousedown 监听（第 284–294 行）。把 `seeMore.root.remove()` 放进 `try`，且放在 `setValue` 成功之后。`catch` 里保留链接，并把该链接的 title 设为 JSON 无效。
- 明确不改什么：第 271–276 行把解析失败的输入写回 `rawInput` 的忽略。第 177–179 行消息区的 “Show More” 与 `SHOW_MORE_MESSAGE_HEIGHT_TRIGGER`。`json.validate` 的 marker 调度。
- 怎样本地验证：没有覆盖这条的测试名。新增断言：折叠态模型值不是合法 JSON 时点击 “See more”，链接仍在且 `getValue()` 不变；值是合法多行 JSON 被压成一行后点击，模型变为两格缩进，链接被移除。

## r10-3 中（weaken，原中）

- 问题类：`_layout` 把未做下限的编辑器宽度交给 `layout`；compact 同行工具栏或 sessions 水平垫片使减法 ≤0 时，编辑器被收到观察器的 5px 地板。
- 反证：`ElementSizeObserver.measureReferenceDomElement` 第 111–112 行把观察到的宽和高钳成至少 5，负数到不了 `outerWidth`。`ChatWidget.layout` 第 3811 行只有 `Math.min(width, 950)`。`getLayoutData` 第 5166–5168 行在 sessions 使用 64 的水平垫片，compact 计入整条工具栏宽度。compact 工具栏已有 `ChatInputPickerResponsiveLayout`，第 4049–4054 行在工具栏尺寸变化时调用 `layoutForToolbarChange`。`Math.max(5, newEditorWidth)` 与观察器地板相同，画面不变。
- 不变量：交给 `_inputEditor.layout` 的宽度等于 `max(INPUT_EDITOR_MIN_WIDTH, 减法结果)`。`INPUT_EDITOR_MIN_WIDTH` 大于 5。减法结果已经不低于该常数时，宽度与现在的减法相同。compact 下减法结果低于该常数时，先把计入的 `toolbarsWidth` 收到「可用宽度 − 该常数」，再沿现有工具栏 overflow 重算一次，然后用重算结果做同一次下限。
- 要动的符号或文件：`ChatInputPart._layout`、`getLayoutData` 里的 `getToolbarsWidthCompact`。在 `INPUT_EDITOR_LINE_HEIGHT` 旁增加 `INPUT_EDITOR_MIN_WIDTH = 20`。compact 低于下限时调用现有 `inputActionsToolbar` 的 relayout，不新写溢出菜单。
- 明确不改什么：`ElementSizeObserver` 的 5px 地板。`ChatWidget.layout` 的 950 上限。第 5104–5105 行 `followupsContainer.style.width`。compact 容器的 `overflow`（`chat.css` 第 1164–1169 行写明 compact 不能用 `overflow: hidden`，否则和工具栏 ResizeObserver 循环）。
- 怎样本地验证：没有覆盖这条的测试名。新增断言：compact 下工具栏宽度使减法为负数时，`_inputEditor.layout` 收到的 width 为 `INPUT_EDITOR_MIN_WIDTH`；减法结果大于该常数时，收到的 width 等于减法结果。

## r10-4 中（weaken，原中）

- 问题类：诊断芯片、带 `commandId` 的字符串芯片、调试事件芯片的点击会冒泡到附件容器，同一次 click 里调用 `inputEditor.focus()`。
- 反证：容器监听在 `chatInputPart.ts` 第 3542 行，无条件 `inputEditor.focus()`，这点成立。无 `filterUri` 的诊断点击（第 921–923 行）和 `commandId` 点击（第 935–938 行）没有 `stopPropagation`，这点成立。文件芯片经 `registerOpenEditorListeners`（`editor.ts` 第 29 行 `EventHelper.stop`）停掉冒泡，这点成立。诊断命令走 `FocusViewAction.run`（`viewsService.ts` 第 599–600 行），`openView` 在 `await openComposite` 之后才 `view.focus()`（第 316–318 行），而芯片监听没有 await `executeCommand`，所以容器的 `focus()` 发生在视图聚焦之前。`commandId` 路径 await 的是扩展主机回调（`mainThreadChatContext.ts` 第 39 行），同样晚于这次冒泡。成功聚焦目标时，输入框焦点是同一次 click 中的中间态，不是这段调用序本身证明的最终焦点。
- 不变量：上述芯片的 click 不冒泡到 `attachmentsContainer` 的监听，因此这次 click 不调用 `inputEditor.focus()`。点附件区空白仍聚焦输入框。文件芯片打开编辑器的停冒泡保持原样。命令和视图各自的聚焦时机不改。
- 要动的符号或文件：`DefaultChatAttachmentWidget` 构造函数里三处 click：无 `filterUri` 的诊断（第 921–923 行）、`commandId`（第 935–938 行）、`debugEvents`（第 944–948 行，同一构造函数里同样未停冒泡）。三处都 `EventHelper.stop`。
- 明确不改什么：第 3542 行容器监听本身。`registerOpenEditorListeners`。带 `filterUri` 因而走 `addResourceOpenHandlers` 的诊断。清除按钮的点击。
- 怎样本地验证：没有覆盖这条的测试名。新增断言：点击无 `filterUri` 的诊断芯片、带 `commandId` 的字符串芯片、调试事件芯片时，`inputEditor.focus` 不被容器监听调用；点击 `attachmentsContainer` 内芯片以外的区域时仍调用。
