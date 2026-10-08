---
title: "方案 r07：chat-widget"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 1，drop 1，weaken 0。销毁后不再归档父会话。不把 Chat 升成产品中心。不升 implemented，不升 PRD。"
---

hold 1，drop 1，weaken 0。r07-1 不改：`newSessionResource` 只来自非本地 untitled 物化；聊天视图先锁定再绑模型，发送用 `agentIdSilent` 指向同一锁定代理，`_shouldExitAfterDelegation` 在同 id 处返回，不会进入归档等待。

## r07-2（hold，低）

问题类：委托退出在 `accept()` 挂起期间销毁 widget 后，仍会把父会话标成已归档。

不变量：`archiveLocalParentSession` 只在 widget 未销毁、且当前 view model 仍是传入的父会话时调用 `setArchived(true)`。`editingSession.accept()` 返回之后，必须再用进入 `accept()` 之前的同一组条件核对一次；任一失败则不再归档。

要动的符号或文件：`ChatWidget.archiveLocalParentSession`（`src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts`）。在 `await this.chatService.getSession(sessionResource)?.editingSession?.accept()` 之后、`this.agentSessionsService.getSession` / `session.setArchived(true)` 之前，重复 `!this.viewModel || this._store.isDisposed || !isEqual(this.viewModel.sessionResource, sessionResource)` 则 return。

明确不改什么：不改 `accept()` 之前的那次核对，不改 `_handleDelegationExit` 的等待、超时和 `clear()`，不改 `editingSession.accept` 的编辑会话行为，不改同一次发送里的 `newSessionResource` / `setModel`，不改「等待响应期间换会话则不归档」。

怎样本地验证：现有 `src/vs/workbench/contrib/chat/test/browser/widget/chatWidget.test.ts` 套件 `ChatWidget - _handleDelegationExit lifecycle` 中的 `archiveLocalParentSession no-ops if widget is disposed or session does not match` 仍须通过。另增断言：`editingSession.accept` 在 resolve 前挂起时，dispose widget 的 `_store` 或把 view model 换成别的会话，`setArchived` 不被调用；widget 仍在且会话仍匹配时，`setArchived` 仍被调用。本地用 `scripts/test.sh --grep "archiveLocalParentSession"`。
