---
title: "方案 r09：chat-browser"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 1，drop 1，weaken 1。待批准行换行数时补发高度；Quick Chat 等快捷输入写完宽度再排，高度钳制沿用现有逻辑。"
---

hold 1，drop 1，weaken 1。

## r09-2 中（hold）

- 问题类：待批准行一直可见时，审批文案的行数变了，列表行高仍停在上一次可见性翻转时的高度。
- 不变量：该行高度与 `AgentSessionsListDelegate.getHeight` 按当前 `label` 算出的值一致。可见性从无到有、从有到无，以及可见期间 `AgentSessionRenderer.getApprovalRowHeight(label)` 的结果变化，都要 `AgentSessionRenderer._onDidChangeItemHeight.fire`。`renderApprovalRow` 第一次用当前模型状态初始化，不为此补发。只切换当前会话（Allow 按钮的 secondary）且行高不变时不发。
- 要动的符号或文件：`AgentSessionRenderer.renderApprovalRow`（`src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsViewer.ts` 第 672–731 行）。在现有 `wasVisible` 之外记下上次的 `getApprovalRowHeight` 结果；`autorun` 末尾比较这个高度，变了就 fire。`AgentSessionsControl` 第 329–332 行已对这次事件调用 `list.updateElementHeight(session, undefined)`，列表会清掉 `lastDynamicHeightWidth` 再量行高。
- 明确不改什么：`getApprovalRowHeight` 的行高 18、开销 14、最多 3 行；`agentsessionsviewer.css` 里单行省略；`AgentSessionApprovalModel.setIfChanged`；按钮文案与 `confirm()`。
- 怎样本地验证：现有 `calculates approval row heights`（`src/vs/workbench/contrib/chat/test/browser/agentSessions/agentSessionsListDelegate.test.ts`）只断言静态高度 32、50、68、68。在 `src/vs/workbench/contrib/chat/test/browser/agentSessions/agentSessionsRenderer.test.ts` 的 `AgentSessionsRenderer` 套件新增断言：审批一直有值，label 从一行换成三行时 `onDidChangeItemHeight` 发出该会话；换成另一条同样一行的 label，或只改变 active session，不发出；从有审批变成无审批仍发出。

## r09-3 低（weaken，原中）

- 问题类：Quick Chat 在主容器 layout 时读到的宽度仍是快捷输入改写 `style.width` 之前的值；之后拖竖直 sash 又把 `registerListeners` 里捕获的那次宽度写回 `widget.layout`。
- 反证：`ChatWidget.updateDynamicChatTreeItemLayout`（`src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts` 第 3915–3930 行）把 `_dynamicMessageLayoutData.enabled` 设为 true，并在 `maxHeight < bodyDimension.height` 时 `layout` 到这个 `maxHeight`。`sash.onDidStart` 关掉动态布局之后，下一次主容器 layout 会重新打开动态布局，并在当前高度超过新的 `maxHeight` 时钳住高度。快捷输入宽度是 `Math.min(dimension.width * 0.62, 600)`（`src/vs/platform/quickinput/browser/quickInputController.ts` 第 67、945–946 行）。窗口已经宽到这项为 600 时，再改窗口宽度不会改变快捷输入宽度。`chatQuick.ts` 第 161 行的 TODO 只标记尚未随窗口尺寸排版。
- 不变量：快捷输入把容器宽度写进 DOM 之后，可见 Quick Chat 的 layout 宽度等于当时的 `parent.offsetWidth`。`sash.onDidChange` 传入的宽度也是这一次的 `parent.offsetWidth`。高度是否钳到 `maxHeight` 仍只由 `updateDynamicChatTreeItemLayout` 里现有的比较决定。
- 要动的符号或文件：`QuickChat.registerListeners`（`src/vs/workbench/contrib/chat/browser/widgetHosts/chatQuick.ts` 第 301–327 行）。把 `onDidLayoutMainContainer` 上的 `updateDynamicChatTreeItemLayout(2, this.maxHeight)` 改挂到 `layoutService.onDidLayoutActiveContainer`。Sessions 工作台在 `src/vs/sessions/browser/workbench.ts` 第 2192–2199 行先发 main、再发 active；`QuickInputService` 在构造时订阅 active 并调用 `controller.layout`（`src/vs/platform/quickinput/browser/quickInputService.ts` 第 102–105 行），Quick Chat 在 `render` 时才订阅，同一次事件上晚于宽度写入。`sash.onDidChange` 使用调用当时的 `parent.offsetWidth`，去掉第 313 行的闭包 `width`。部件不可见时仍设 `_deferUpdatingDynamicLayout`。
- 明确不改什么：不另写一套高度钳制；不改 `updateDynamicChatTreeItemLayout` 的 `enabled: true` 与 `maxHeight` 比较；不改 `sash.onDidReset`；不改快捷输入的 0.62 与 `MAX_WIDTH`；不改 `openChatView`。
- 怎样本地验证：没有 Quick Chat 布局测试。在 `src/vs/workbench/contrib/chat/test/browser/widgetHosts/chatQuick.test.ts` 新增断言：主容器 layout 先跑完，快捷输入容器宽度再改掉，然后跑 active container layout；可见 Quick Chat 的 `widget.layout` 宽度等于改后的 `offsetWidth`。随后 `sash.onDidChange` 传入的宽度仍是这个新宽度。当前高度大于新 `maxHeight` 时，高度变为该 `maxHeight`。快捷输入宽度已是 600 且这次没有变时，不要求为此再调用 `layout`。
