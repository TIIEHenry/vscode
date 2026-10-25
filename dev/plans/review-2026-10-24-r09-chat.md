---
title: "审查 r09：chat"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；检查点把重命名折成普通编辑后写错路径，取消或失败的工具被标成已完成，编辑工具会把未完成报成成功并写到最后一条请求，未完成的外部编辑组吞掉后续文本编辑。"
---

## r09-1 高
- 症状：同一请求里对一个文件既改内容又重命名后，撤销或重做会把快照写到重命名之后的路径，原路径上的文件不会被移回去。
- 位置：`src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSnapshotController.ts` 第 429–455 行
- 引用：
```429:455:src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSnapshotController.ts
function mergeFileEdit(prev: IToolCallFileEdit, next: IToolCallFileEdit): IToolCallFileEdit {
	const startsAbsent = prev.kind === FileEditKind.Create;
	const endsAbsent = next.kind === FileEditKind.Delete;

	let kind: FileEditKind;
	if (startsAbsent && endsAbsent) {
		kind = FileEditKind.Edit; // create+delete collapses to no-op
	} else if (startsAbsent) {
		kind = FileEditKind.Create;
	} else if (endsAbsent) {
		kind = FileEditKind.Delete;
	} else {
		kind = FileEditKind.Edit;
	}

	return {
		kind,
		resource: next.resource,
		originalResource: next.originalResource ?? prev.originalResource,
		beforeContentUri: prev.beforeContentUri,
		afterContentUri: next.afterContentUri,
		undoStopId: prev.undoStopId,
		diff: next.diff ?? prev.diff,
	};
}
```
- 为什么是问题：合并只看“开始是不是创建、结束是不是删除”。重命名两边都还在，kind 被收成 `Edit`，`originalResource` 虽留着，但 `_writeCheckpointContent` 的 `Edit` 分支（第 375–379 行、第 403–407 行）只对 `edit.resource` 读写，不 `move`。撤销把旧内容写进新路径；重做在新路径再写一份，原路径还在。检查点因此改到错文件。
- 方向：合并结果若跨过重命名，撤销和重做先按原路径移动文件，再写对应内容。

## r09-2 高
- 症状：工具在 `invoke` 之前被取消，或 `invoke` 抛错，卡片仍变成已完成，并沿用准备阶段的过去时文案。
- 位置：`src/vs/workbench/contrib/chat/browser/tools/languageModelToolsService.ts` 第 798–806 行
- 引用：
```798:806:src/vs/workbench/contrib/chat/browser/tools/languageModelToolsService.ts
			toolResult ??= { content: [] };
			toolResult.toolResultError = err instanceof Error ? err.message : String(err);
			if (activeTool.data.alwaysDisplayInputOutput) {
				toolResult.toolResultDetails = { input: this.formatToolInput(dto), output: [{ type: 'embed', isText: true, value: String(err) }], isError: true };
			}

			throw err;
		} finally {
			toolInvocation?.didExecuteTool(toolResult, true);
```
- 为什么是问题：`finally` 带着 `final: true` 调用 `didExecuteTool`。`chatToolInvocation.ts` 第 373–389 行在 `final` 为真或已有 `toolResultError` 时走 `_setCompleted`，状态是 `Completed`，不读取 `toolResultError`。准备阶段取消时，确认 Promise 只被解成 Denied（`chatService.ts` 第 964–967 行），调用仍停在 `WaitingForConfirmation`，这里再被收成已完成。`chatToolProgressPart.ts` 第 44–46 行把 `pastTenseMessage` 画成完成文案。未执行或已失败的调用看起来像已经做完。
- 方向：取消或抛错时收成 Cancelled，或完成态带上错误；不要在 `finally` 里强制 Completed。

## r09-3 高
- 症状：代码映射被取消或没有 `errorMessage` 时，编辑工具仍向模型返回 “The file was edited successfully”。
- 位置：`src/vs/workbench/contrib/chat/common/tools/builtinTools/editFileTool.ts` 第 109–137 行
- 引用：
```109:137:src/vs/workbench/contrib/chat/common/tools/builtinTools/editFileTool.ts
		if (result?.errorMessage) {
			throw new Error(result.errorMessage);
		}

		let dispose: IDisposable;
		await new Promise((resolve) => {
			// The file will not be modified until the first edits start streaming in,
			// so wait until we see that it _was_ modified before waiting for it to be done.
			let wasFileBeingModified = false;

			dispose = autorun((r) => {
				const entries = editSession.entries.read(r);
				const currentFile = entries?.find((e) => isEqual(e.modifiedURI, uri));
				if (currentFile) {
					if (currentFile.isCurrentlyBeingModifiedBy.read(r)) {
						wasFileBeingModified = true;
					} else if (wasFileBeingModified) {
						resolve(true);
					}
				}
			});
		}).finally(() => {
			dispose.dispose();
		});

		return {
			content: [{ kind: 'text', value: 'The file was edited successfully' }]
		};
```
- 为什么是问题：`mapCode` 在 token 已取消时直接返回 `undefined`（`chatCodeMapperService.ts` 第 70–71 行），这里不看 token。调用前写入的空 `textEdit`（第 75–79 行）会让会话把该文件标成正在修改（`chatEditingModifiedFileEntry.ts` 第 361–363 行）。响应取消后流被 `complete()`，标志落下，等待就 resolve，并报编辑成功。这次映射可以没有写入任何内容。
- 方向：映射被取消或文件没有被这次调用改动时返回失败。

## r09-4 中
- 症状：`vscode_editFile` 和子代理把文本编辑进度写进会话的最后一条请求，而不是这次调用的 `chatRequestId`。
- 位置：`src/vs/workbench/contrib/chat/common/tools/builtinTools/editFileTool.ts` 第 51–52 行
- 引用：
```51:52:src/vs/workbench/contrib/chat/common/tools/builtinTools/editFileTool.ts
		const model = this.chatService.getSession(invocation.context.sessionResource) as ChatModel;
		const request = model.getRequests().at(-1)!;
```
- 为什么是问题：第 90 行把 `invocation.chatRequestId` 只交给 `mapCode`，第 94–96 行的 `textEdit` 仍写进第 52 行取到的最后一条请求。`runSubagentTool.ts` 第 150 行同样取最后一条，第 261 行把子代理的 `textEdit` 写进去。那条若是另一个未完成回合，编辑进它的 response，再由其 editing observer 落到工作区；那条若已完成，`acceptResponseProgress` 在 `chatModel.ts` 第 3273–3274 行抛错，这次编辑中断。
- 方向：用 `chatRequestId` 定位请求，对不上就停止写入。

## r09-5 中
- 症状：同一文件上，未完成的外部编辑组会吞掉后面的普通文本编辑，这些编辑不再写入缓冲区。
- 位置：`src/vs/workbench/contrib/chat/common/model/chatModel.ts` 第 1074–1080 行
- 引用：
```1074:1080:src/vs/workbench/contrib/chat/common/model/chatModel.ts
	private _mergeOrPushTextEditGroup(uri: URI, edits: TextEdit[], done: boolean | undefined, isExternalEdit: boolean | undefined): void {
		for (const candidate of this._responseParts) {
			if (candidate.kind === 'textEditGroup' && !candidate.done && isEqual(candidate.uri, uri)) {
				candidate.edits.push(edits);
				candidate.done = done;
				return;
			}
```
- 为什么是问题：合并只认 URI 且该组未 `done`，不看 `isExternalEdit`，标志留在第一批。`startExternalEdits` 的开场 `textEdit` 是 `done: false` 且 `isExternalEdit: true`（`chatEditingSession.ts` 第 141–146 行）。后面的普通编辑被并进同一组。observer 在 `chatEditingServiceImpl.ts` 第 317–319 行跳过整个外部组，缓冲区收不到这批编辑。`chatModel.test.ts` 第 1134–1157 行把“标志保持第一批”锁成了期望。笔记本编辑组在第 1085–1090 行是同一合并。
- 方向：外部批次和普通批次分开累积，observer 只跳过外部批次。
