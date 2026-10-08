---
title: "审查 r07：chat-widget"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "2 条：同一次发送换成新会话后委托退出不再归档父会话；accept 挂起期间销毁 widget 仍会归档。"
---

# 审查 r07：chat-widget

范围：`attachments/`、`widget/`、`widgetHosts/` 中本路已改文件。对照 2026-10-06 审查：隐式芯片重绘、确认 JSON、输入最小宽、芯片冒泡、Quick Chat 活动容器排版已按当时方向改过，不再报。

## r07-1 中

- 症状：开启「委托后退出」时，同一次发送若带着 `newSessionResource`，父会话不会被接受编辑、也不会归档，聊天停在新会话上，旧会话仍留在列表里。
- 位置：`src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts` 第 1934–1950、3574–3581、473–483 行
- 引用：`resolve(false)`；`this.handleDelegationExitIfNeeded(this._lockedAgent, sent.data.agent)`；`this.viewModelDisposables.clear()`
- 为什么是问题：`handleDelegationExitIfNeeded` 没有 await。响应还没完成时，退出逻辑在 `viewModel.onDidChange` 上挂起后就把控制权交回发送路径，下一行 `setModel(newModel)` 立刻换会话。setter 先 `viewModelDisposables.clear()`，旧 view model 被卸掉，等待用的 `onDidChange` 不再派发。30 秒超时走 `resolve(false)`。即便换会话前已经 `resolve(true)`，1948–1950 行的核对看到新的 `sessionResource` 也会直接 return，`archiveLocalParentSession` 不会跑。
- 方向：同一次发送里的 `setModel(newSessionResource)` 仍对捕获的父会话 `accept` 并归档，只跳过 `clear()`；用户另换会话或 widget 已销毁时再整段取消。

## r07-2 低

- 症状：委托退出已经开始接受父会话编辑时，关掉聊天视图，父会话仍会被归档。
- 位置：`src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts` 第 1970–1981 行
- 引用：`await this.chatService.getSession(sessionResource)?.editingSession?.accept()`；`session.setArchived(true)`
- 为什么是问题：销毁和会话核对只在 `accept()` 之前做了一次。`accept()` 挂起时 widget 可以被销毁；返回后没有第二次核对就 `setArchived(true)`。后面的 `clear()` 有核对，归档没有。
- 方向：`accept()` 返回后、`setArchived(true)` 之前再确认 widget 还活着；已销毁则不要归档。
