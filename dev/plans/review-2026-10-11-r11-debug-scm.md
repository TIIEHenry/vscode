---
title: "审查 r11：debug-scm"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "5 条；未保存的评论草稿在合并时被拼成 [object Object]，原文丢失。"
---
# 审查 r11：debug-scm

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r11-1 高

- 症状：同一评论线程上已有未提交草稿，又恢复另一段不互相包含的待发评论时，编辑器里的草稿变成 `[object Object]` 加换行再加新正文，原来键入的正文没有了。
- 位置：`src/vs/workbench/contrib/comments/browser/commentsController.ts` 第 1117–1127 行
- 引用：

```1117:1127:src/vs/workbench/contrib/comments/browser/commentsController.ts
			const existingPendingComment = matchedZones[0].getPendingComments().newComment;
			// We need to try to reconcile the existing pending comment with the incoming pending comment
			let pendingComment: languages.PendingComment;
			if (!existingPendingComment || thread.comment.body.includes(existingPendingComment.body)) {
				pendingComment = thread.comment;
			} else if (existingPendingComment.body.includes(thread.comment.body)) {
				pendingComment = existingPendingComment;
			} else {
				pendingComment = { body: `${existingPendingComment}\n${thread.comment.body}`, cursor: thread.comment.cursor };
			}
			matchedZones[0].setPendingComment(pendingComment);
```

`getPendingComments().newComment` 与上面两支用的是带 `body` 的对象。`commentReply.ts` 第 170–184 行把待发评论做成 `{ body, cursor }`，`setPendingComment` 再 `setValue(pending.body)`。

- 为什么是问题：两边正文互不包含时，模板字符串插值的是整个对象，不是 `existingPendingComment.body`。对象会变成 `[object Object]`，随后写回评论框，用户已经输入的草稿被盖掉。
- 方向：合并时拼接 `existingPendingComment.body` 与 `thread.comment.body`。

## r11-2 中

- 症状：当前没有调试会话时执行 Run to Line，临时断点会在第一次变成 Stopped 时被删掉；若启动结束后会话已经停住，接着还会对该线程 `continue()`，停不住目标行。
- 位置：`src/vs/workbench/contrib/debug/browser/debugService.ts` 第 1382–1436 行
- 引用：

```1382:1404:src/vs/workbench/contrib/debug/browser/debugService.ts
		const removeTempBreakPoint = (state: State): boolean => {
			if (state === State.Stopped || state === State.Inactive) {
				if (breakpointToRemove) {
					this.removeBreakpoints(breakpointToRemove.getId());
				}
				return true;
			}
			return false;
		};
		// ...
		if (this.state === State.Inactive) {
			const listener = this.onDidChangeState(state => {
				if (removeTempBreakPoint(state)) {
					listener.dispose();
				}
			});
			await this.startDebugging(launch, configOrName, undefined, true);
		}
```

```1405:1436:src/vs/workbench/contrib/debug/browser/debugService.ts
		if (this.state === State.Stopped) {
			// ...
			await thread.continue();
```

- 为什么是问题：冷启动这条监听把第一次 `Stopped`（入口暂停、异常或正好停在目标行）都当成临时断点已经完成并删除。`startDebugging` 返回后若全局状态仍是 `Stopped`，下面的分支无条件 `continue()`。已经暂停的会话那条路径会先看到目标线程跑起来再删断点，冷启动没有这道门闩。
- 方向：冷启动也要等目标线程先离开暂停再停住，才删除临时断点，并且不要在刚停在目标行时立刻 continue。

## r11-3 中

- 症状：输出通道打开时日志文件连续增长，面板里同一段日志会再贴一次，文件读取偏移却不往前走。
- 位置：`src/vs/workbench/contrib/output/common/outputChannelModel.ts` 第 199–207 行、第 229–244 行、第 605–614 行
- 引用：

```199:207:src/vs/workbench/contrib/output/common/outputChannelModel.ts
			if (stat.etag !== this.etag) {
				++this.contentGeneration;
				this.etag = stat.etag;
				if (isNumber(stat.size) && this.endOffset > stat.size) {
					this.reset(0);
					this._onDidReset.fire();
				} else {
					this._onDidAppend.fire();
```

```229:244:src/vs/workbench/contrib/output/common/outputChannelModel.ts
			const generation = ++this.contentGeneration;
			const readOffset = this.endOffset;
			const fileContent = await this.fileService.readFile(this.resource, { position: readOffset });
			// ...
						if (generation !== this.contentGeneration || this._store.isDisposed || this.endOffset !== readOffset) {
							return;
						}
						this.endOffset += fileContent.value.byteLength;
```

```605:614:src/vs/workbench/contrib/output/common/outputChannelModel.ts
			const { content, consume } = await this.outputContentProvider.getContent();
			if (token.isCancellationRequested) {
				return;
			}
			consume();
			this.doAppendContent(model, content);
```

- 为什么是问题：轮询发现 etag 变化会把 `contentGeneration` 加一。若这次加一发生在 `readFile` 尚未结束时，`consume` 发现代数对不上就直接返回，不推进 `endOffset`。调用方不看消费是否生效，仍然把刚读到的文本追加进模型。下一次仍从旧偏移读取，同一段内容再追加一遍。
- 方向：`consume` 拒绝这次读取时不要把该段文本写入模型，让下一次从仍有效的偏移读取。

## r11-4 中

- 症状：`debug.saveBeforeStart` 不是 `none` 时，保存被取消或失败后调试仍然启动，跑的是磁盘上的旧内容。
- 位置：`src/vs/workbench/contrib/debug/common/debugUtils.ts` 第 377–389 行；`src/vs/workbench/contrib/debug/browser/debugService.ts` 第 367–369 行
- 引用：

```377:389:src/vs/workbench/contrib/debug/common/debugUtils.ts
export async function saveAllBeforeDebugStart(configurationService: IConfigurationService, editorService: IEditorService): Promise<void> {
	const saveBeforeStartConfig: string = configurationService.getValue('debug.saveBeforeStart', { overrideIdentifier: editorService.activeTextEditorLanguageId });
	if (saveBeforeStartConfig !== 'none') {
		await editorService.saveAll();
		if (saveBeforeStartConfig === 'allEditorsInActiveGroup') {
			const activeEditor = editorService.activeEditorPane;
			if (activeEditor && activeEditor.input.resource?.scheme === Schemas.untitled) {
				await editorService.save({ editor: activeEditor.input, groupId: activeEditor.group.id });
			}
		}
	}
	await configurationService.reloadConfiguration();
}
```

```367:369:src/vs/workbench/contrib/debug/browser/debugService.ts
			if (saveBeforeStart) {
				await saveAllBeforeDebugStart(this.configurationService, this.editorService);
			}
```

`saveAllBeforeDebugStart` 不读取 `saveAll()` 的结果。`startDebugging` 在这次 await 之后继续解析配置并启动会话。

- 为什么是问题：保存对话框取消或写入失败时，函数仍正常返回，调用方把调试启动做完。用户取消保存后，调试器执行的仍是未保存前的文件。
- 方向：`saveAll` / 未命名文件 `save` 未成功时返回失败，并且不要启动调试。

## r11-5 中

- 症状：数据断点转成 DAP 失败后，断点视图只显示未验证，看不到转换错误。
- 位置：`src/vs/workbench/contrib/debug/browser/debugSession.ts` 第 624–643 行；`src/vs/workbench/contrib/debug/common/debugModel.ts` 第 886–894 行、第 1888–1894 行
- 引用：

```624:643:src/vs/workbench/contrib/debug/browser/debugSession.ts
			const converted = await Promise.all(dataBreakpoints.map(async bp => {
				try {
					const dap = await bp.toDAP(this);
					return { dap, bp };
				} catch (e) {
					return { bp, message: e.message };
				}
			}));
			// ...
					if (!dap.dap) {
						data.set(dap.bp.getId(), dap.message);
					} else if (i < response.body.breakpoints.length) {
						data.set(dap.bp.getId(), response.body.breakpoints[i++]);
					}
```

```886:894:src/vs/workbench/contrib/debug/common/debugModel.ts
function toBreakpointSessionData(data: DebugProtocol.Breakpoint, capabilities: DebugProtocol.Capabilities): IBreakpointSessionData {
	return mixin({
		supportsConditionalBreakpoints: !!capabilities.supportsConditionalBreakpoints,
		// ...
	}, data);
}
```

```1888:1894:src/vs/workbench/contrib/debug/common/debugModel.ts
		this.dataBreakpoints.forEach(dbp => {
			if (!data) {
				dbp.setSessionData(sessionId, undefined);
			} else {
				const dbpData = data.get(dbp.getId());
				if (dbpData) {
					dbp.setSessionData(sessionId, toBreakpointSessionData(dbpData, capabilites));
```

- 为什么是问题：`toDAP` 抛错时放进 Map 的是错误字符串。`setBreakpointSessionData` 仍把它交给 `toBreakpointSessionData`，按断点对象去 mixin。字符串上没有 `verified` 和 `message`，`BaseBreakpoint.message` 读不到这段错误，视图只能显示未验证。
- 方向：转换失败时写入 `{ verified: false, message }` 这种断点对象，不要把字符串直接放进 session data。
