---
title: "审查 r09：chat-browser"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "Quick Chat 迁入主视图会丢掉未完成回合；审批行高度不随文案更新；拖拽改高后宽度冻在打开时。"
---

# 审查 r09：chat-browser
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围：`src/vs/workbench/contrib/chat/browser`（排除 `chatEditing` / `widget` / `attachments`）。对照已有 r01–r16 发现稿（尤其 r07 chat）；下列条目均来自本次读到的活码。

## r09-1 高

- 症状：「在 Chat 视图中打开」Quick Chat 时，尚未完成（无 `response.value` / `result`）的提问回合不会出现在目标会话时间线里；Quick Chat 关闭后这些内容也找不回。
- 位置：`src/vs/workbench/contrib/chat/browser/widgetHosts/chatQuick.ts` 第 341–387 行
- 引用：

```341:387:src/vs/workbench/contrib/chat/browser/widgetHosts/chatQuick.ts
		for (const request of model.getRequests()) {
			if (request.response?.response.value || request.response?.result) {
				// ... addCompleteRequest ...
			} else if (request.message) {

			}
		}
```

- 为什么是问题：`else if (request.message)` 分支为空。进行中、失败或尚无结果的请求有正文却不被 `addCompleteRequest`，随后 `openInChatView` 会关掉 Quick Chat 并 dispose 模型，用户可见历史缺口。
- 方向：对无完整响应的请求也写入目标会话（或至少保留用户消息），不要留空分支。

## r09-2 中

- 症状：会话列表里某条已展开的「待批准」行，审批文案行数变化（换一条工具确认、命令行变长等）后，行高不跟着变，内容被裁切或与下一行重叠。
- 位置：`src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsViewer.ts` 第 685–730 行
- 引用：

```685:730:src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsViewer.ts
		template.elementDisposable.add(autorun(reader => {
			buttonStore.clear();
			const info = approvalModel.getApproval(session.element.resource).read(reader);
			const visible = !!info;
			template.approvalRow.classList.toggle('visible', visible);
			if (info) {
				// ... 按 label 行数渲染 ...
			}
			if (wasVisible !== visible) {
				wasVisible = visible;
				this._onDidChangeItemHeight.fire(session.element);
			}
		}));
```

- 为什么是问题：高度通知只在 `visible` 翻转时发出。`AgentSessionApprovalModel` 可在保持有审批的情况下更换 `label` / `approvalId`（见同目录 `agentSessionApprovalModel.ts` 的 `setIfChanged`），列表仍用旧 `getApprovalRowHeight`，虚拟列表行高过时。
- 方向：在 `info` 存在且 `label`（或行数）变化时也 `fire` 高度变更。

## r09-3 中

- 症状：Quick Chat 用竖直 sash 拖高后，再改主窗口宽度，对话区仍按打开时的宽度排版，出现横向裁切或空白；窗口变矮时若已关掉动态高度，也容易高出可用区域。
- 位置：`src/vs/workbench/contrib/chat/browser/widgetHosts/chatQuick.ts` 第 301–327 行
- 引用：

```301:327:src/vs/workbench/contrib/chat/browser/widgetHosts/chatQuick.ts
		this._register(this.layoutService.onDidLayoutMainContainer(() => {
			if (this.widget.visible) {
				this.widget.updateDynamicChatTreeItemLayout(2, this.maxHeight);
			} else {
				this._deferUpdatingDynamicLayout = true;
			}
		}));
		this._register(this.widget.onDidChangeHeight((e) => this.sash.layout()));
		const width = parent.offsetWidth;
		this._register(this.sash.onDidStart(() => {
			this.widget.isDynamicChatTreeItemLayoutEnabled = false;
		}));
		this._register(this.sash.onDidChange((e) => {
			if (e.currentY < QuickChat.DEFAULT_MIN_HEIGHT || e.currentY > this.maxHeight) {
				return;
			}
			this.widget.layout(e.currentY, width);
			this.sash.layout();
		}));
```

- 为什么是问题：`width` 在 `registerListeners` 时抓一次，sash 拖拽始终用旧宽度。`onDidStart` 关掉动态布局后，主容器 layout 只更新 `maxHeight` 约束，不会把当前高度钳回新的 `maxHeight`，文件头也有「be responsive to window size」的 TODO。
- 方向：layout / sash 变更时用当前 `parent.offsetWidth`，并在窗口尺寸变化时钳制高度、必要时重新打开动态布局。
