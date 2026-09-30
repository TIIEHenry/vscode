---
title: "审查 r14：copilot-extension"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "命令免确认会改 git 状态；补丁会改错位置或留下旧行；历史轮次和子代理文件引用会被丢掉。"
---

# 发现

## r14-1 高
- 症状：代理调用 `run_vscode_command` 且不带参数时，`git.stash`、`git.stashPop`、`git.stashPopLatest`、`git.stashStaged`、`git.stageAll`、`git.rebaseAbort` 会直接执行；`git.stage` 即使带了路径参数也不会弹出确认。工作区未提交的修改可以被藏起来、弹回覆盖，或被整目录暂存。
- 位置：`extensions/copilot/src/extension/tools/node/vscodeCmdTool.tsx` 第 43–49 行、第 108 行、第 171–176 行
- 引用：
```
43|	'git.rebaseAbort',
44|	'git.showOutput',
45|	'git.stageAll',
46|	'git.stash',
47|	'git.stashPop',
48|	'git.stashPopLatest',
49|	'git.stashStaged',
```
```
108|	'git.stage'
```
```
171|		if ((noConfirmationCommandsWithoutArgs.has(commandId) || noConfirmationCommandsWithArgs.has(commandId)) && (!options.input.args || options.input.args.length === 0)) {
172|			return { invocationMessage };
173|		}
174|
175|		if (noConfirmationCommandsWithArgs.has(commandId) && options.input.args && options.input.args.length > 0) {
176|			return { invocationMessage };
```
- 为什么是问题：注释写的是只放行无副作用命令，但这几条会改暂存区、stash 和工作区。`prepareInvocation` 在命中名单时不返回 `confirmationMessages`，确认卡不会出现，`invoke` 接着 `executeCommand`。`git.stashPop` / `git.stashPopLatest` 会把 stash 应用到当前工作区，和未提交修改冲突时覆盖用户改动；`git.stage` 带参数时同样免确认，模型可以指定任意路径。
- 方向：把会改 git 状态或安装更新的命令移出免确认名单，执行前走确认。

## r14-2 中
- 症状：`apply_patch` 更新一个变短的文件时，若新文本末尾的空行比原文少，且删掉的行数多于这个空行差，原文中间的若干行会留在文件里。模型以为补丁已整文件生效，磁盘上仍混着旧代码。
- 位置：`extensions/copilot/src/extension/tools/node/applyPatchTool.tsx` 第 128–146 行
- 引用：
```
128|		workspaceEdit.replace(path, new Range(
129|			new Position(0, 0),
130|			new Position(lines.length, 0)
131|		), newContent);
132|
133|		// Handle trailing newlines to match the original document
134|		const originalTrailing = this.getTrailingDocumentEmptyLineCount(textDocument);
135|		const newTrailing = this.getTrailingArrayEmptyLineCount(lines);
136|
137|		for (let i = newTrailing; i < originalTrailing; i++) {
138|			workspaceEdit.insert(path, new Position(lines.length + i, 0), '\n');
139|		}
140|
141|		// If new content is shorter than original, delete extra lines
142|		if (lines.length < textDocument.lineCount) {
143|			const newLineCount = lines.length + Math.max(originalTrailing - newTrailing, 0);
144|			const from = lines.length === 0 ? new Position(0, 0) : new Position(newLineCount, 0);
145|			workspaceEdit.delete(path, new Range(from, new Position(textDocument.lineCount, 0)));
146|		}
```
- 为什么是问题：`newContent` 是整文件新文本，但 replace 只覆盖原文前 `lines.length` 行。删除起点又被往后挪了 `originalTrailing - newTrailing` 行，用来保留文末空行。被保留的是原文下标 `lines.length` 起的那几行，文末空行实际在文件尾部。例如原文 10 行、末尾 2 行空，新文本 5 行且只有 1 个文末空行：replace 覆盖下标 0–4，删除从下标 6 到文末，下标 5 的旧行留在文件里。文件末尾有空行、同时补丁又缩短了正文时就会发生。
- 方向：用新文本整段替换全文，文末换行单独按原文补，不要在中间留一段未覆盖的原文。

## r14-3 中
- 症状：历史里某一轮助手既写了文字又发起工具调用，但 `toolCallResults` 里没有这些调用的 id 时，下一轮请求的 prompt 会整轮丢掉这段助手文字和工具调用。模型会当成这轮没发生过，重复已经做过的操作。
- 位置：`extensions/copilot/src/extension/prompts/node/panel/toolCalling.tsx` 第 112–118 行
- 引用：
```
112|		if (this.props.isHistorical) {
113|			fixedNameToolCalls = fixedNameToolCalls.filter(tc => tc.id && (this.props.toolCallResults?.[tc.id] || shouldSynthesizeMissingToolResults));
114|		}
115|
116|		if (round.toolCalls.length && !fixedNameToolCalls.length) {
117|			return [];
118|		}
```
- 为什么是问题：历史轮次的 `isHistorical` 为真（当前轮超额续跑除外）。过滤后若一个工具结果都对不上，函数直接返回空数组，`round.response` 不会进 `AssistantMessage`。工具被取消、结果没写入 metadata、或不是带 `statefulMarker` 的 Responses API（只有那种才会合成占位结果）时就会走到这里。用户发出下一条消息后，这轮助手输出从上下文消失。
- 方向：结果缺失时去掉对应工具调用，仍渲染该轮助手文本；需要配对的 API 再补占位结果。

## r14-4 中
- 症状：search / explore 子代理在最终回答里给出 `路径:起行-止行` 时，若该文件需要外部确认，这一行会从交回主代理的结果里消失。主代理看不到这个文件，用户也不会被问是否允许读取。
- 位置：`extensions/copilot/src/extension/tools/node/searchSubagentTool.ts` 第 256–282 行
- 引用：
```
256|			try {
257|				// Enforce read-only file access via shared toolUtils guards before hydrating.
258|				const { needsConfirmation, realPath } = await this.instantiationService.invokeFunction(
259|					accessor => isFileExternalAndNeedsConfirmation(accessor, uri, this._inputContext, { readOnly: true, workingDirectory })
260|				);
261|
262|				if (!needsConfirmation) {
263|					await this.instantiationService.invokeFunction(
264|						accessor => assertFileNotContentExcluded(accessor, uri, realPath)
265|					);
266|					const document = await this.workspaceService.openTextDocument(uri);
267|					const snapshot = TextDocumentSnapshot.create(document);
268|					const clampedStartLine = Math.max(1, Math.min(startLine, snapshot.lineCount));
269|					const clampedEndLine = Math.max(1, Math.min(endLine, snapshot.lineCount));
270|					const range = new Range(
271|						clampedStartLine - 1, 0,
272|						clampedEndLine - 1, Number.MAX_SAFE_INTEGER
273|					);
274|
275|					const code = snapshot.getText(range);
276|					processedLines.push(`File: \`${uri.fsPath}\`, lines ${clampedStartLine}-${clampedEndLine}:\n\`\`\`\n${code}\n\`\`\``);
277|				}
278|			} catch {
279|				// If hydration fails (for example, because the captured path does not exist),
280|				// keep the original line so the main agent still gets the model's answer.
281|				processedLines.push(line);
282|			}
```
- 为什么是问题：`needsConfirmation` 为真时既不写入片段，也不保留原始行；只有抛错才把原行放回去。工作区外、且不在已打开标签或附加只读路径里的文件会走这条分支。子代理已经定位到的路径在主对话里被抹掉，后续回答会漏掉这些命中。
- 方向：需要确认时保留路径并说明未读取，不要从结果里删掉这一行。

## r14-5 中
- 症状：`apply_patch` 的上下文对不上当前搜索起点时，会从文件开头再搜，并采用第一处编辑距离达标的段落。文件前部有一段相似代码时，hunk 会改到那一段，后面真正要改的代码保持原样。
- 位置：`extensions/copilot/src/extension/tools/node/applyPatch/parser.ts` 第 373–383 行、第 597–611 行
- 引用：
```
373|				if (!match) {
374|					// The model sometimes returns patches out of order,
375|					// so start searching from the beginning of the file.
376|					match = find_context(
377|						path,
378|						fileLines,
379|						nextSection.nextChunkContext,
380|						0,
381|						nextSection.eof,
382|					);
383|				}
```
```
597|	// Pass 5 - within edit distance while ignoring surrounding whitespace -----
598|	const maxDistance = Math.floor(context.length * EDIT_DISTANCE_ALLOWANCE_PER_LINE);
599|	fuzz |= Fuzz.EditDistanceMatch;
600|	if (maxDistance > 0) {
601|		const ctxPass6 = ctxPass5.split('\n');
602|		for (let i = start; i < lines.length; i++) {
603|			let totalDistance = 0;
604|			for (let j = 0; j < ctxPass6.length && totalDistance < maxDistance; j++) {
605|				totalDistance += computeLevenshteinDistance(workingLines[i + j], ctxPass6[j]);
606|			}
607|			if (totalDistance <= maxDistance) {
608|				return { line: i, fuzz };
609|			}
610|		}
611|	}
```
- 为什么是问题：精确匹配失败后，`find_context_core` 用 `EDIT_DISTANCE_ALLOWANCE_PER_LINE`（0.34）算出总距离上限，从 `start` 起返回第一处未超过上限的行，不比较哪一处更近。调用方在向后找不到时把 `start` 置 0。两段相似实现里，补丁上下文相对后一段有少量字符差异、相对前一段的距离仍在上限内时，修改会落到前一段。3 行上下文的上限是 1，10 行是 3，重复样板代码里就会发生。
- 方向：重头搜索时只接受精确或空白差异匹配；模糊匹配要选距离最小且唯一的位置，多处接近则拒绝并报上下文不唯一。
