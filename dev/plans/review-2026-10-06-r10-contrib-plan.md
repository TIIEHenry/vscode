---
title: "方案 r10：contrib"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 3，drop 0，weaken 2。MCP 征询未填值与空接受、语音分组漏掉聊天、任务重连条件括号、笔记本再次查找留下旧单元格。"
---

hold 3，drop 0，weaken 2

# 方案 r10：contrib

r10-1、r10-2、r10-3 按读到的行号 hold。r10-4、r10-5 降为低。没有 drop。

## r10-1（中）

- 问题类：Quick Pick 表单征询里，可选布尔选 None 会把 `false` 写进 `content`，可选数字或整数选 None 会把 `NaN` 写进 `content`。
- 不变量：`noneItem.id` 仍是 `undefined`（`mcpElicitationService.ts` 第 28 行）。布尔、数字、整数只在 `result.type === 'value'` 且 `result.value !== undefined` 时做转换。转换之后 `undefined` 仍走第 303–304 行的 `delete results[propertyName]`，`content` 里没有这个键。已选字符串 `'true'` / `'false'` 仍变成布尔；已通过校验的数字字符串仍变成 `number`。
- 要动的符号或文件：`src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts` 的 `_doElicitForm`。第 275 行布尔转换包上 `result.value !== undefined`。第 288–290 行 `Number(result.value)` 同样只在值不是 `undefined` 时执行。
- 明确不改什么：不改 `_handleEnumField` / `_handleInputField` 对 None 返回 `undefined` 的方式。不改第 303–307 行「`undefined` 就删除、否则写入」的分支。不改 `_convertCarouselAnswersToElicitResult`（第 711–721 行已经跳过 `null` / `undefined`，并且 `NaN` 不写入）。不改第 274 行布尔默认值对 `false` 的判断，不改第 425 行 `if (schema.default)` 对数字 `0` 的判断。
- 怎样本地验证：`src/vs/workbench/contrib/mcp/test/browser/mcpElicitationService.test.ts` 的 suite `McpElicitationService` 只有 URL 征询用例，没有表单。在该文件里用可控的 `createQuickPick`，走「没有聊天请求 → 通知 → Respond → `_doElicitForm`」。断言：可选布尔接受 None 后 `content` 没有该键，接受 `'true'` / `'false'` 仍是布尔；可选 number 与 integer 接受 None 后 `content` 没有该键，接受合法数字字符串仍是有限数字。命令：`scripts/test.sh --run src/vs/workbench/contrib/mcp/test/browser/mcpElicitationService.test.ts`。

## r10-2（中）

- 问题类：征询 Quick Pick 在没有选中项时接受，输入框和第 391 行的多选都会读空项的 `.id` 并抛出 `TypeError`，这一步的 Promise 不结束。
- 不变量：没有 `selectedItems[0]` 时不读 `.id`，不 `resolve`，Quick Pick 保持当前步。单选枚举第 354–357 行已有的 `if (selected)` 保持为参照。选中 `noneItem`（对象在、`id` 为 `undefined`）时，输入框仍 `resolve({ type: 'value', value: undefined })`，多选仍 `resolve({ type: 'value', value: undefined })`。多选有真实 id 时仍 `map` 出已定义的 id。输入框的 `$default` 与校验失败时不提交当前文本，这两支保持原样。`onDidAccept` 在零选中时仍会触发：单选没有 `activeItems[0]` 也会 `handleAccept`（`src/vs/platform/quickinput/browser/quickInput.ts` 第 905–910 行）；多选零勾选会先把 `_selectedItems` 设成 `[]` 再接受（同文件第 897–904 行）。
- 要动的符号或文件：`_handleInputField` 的 `onDidAccept`（第 453–461 行），先取 `quickPick.selectedItems[0]`，没有则 return。`_handleMultiEnumField` 的 `onDidAccept`（第 390–396 行），`selected` 缺失则 return，再判断 `selected.id === undefined`。
- 明确不改什么：不改 `_handleEnumField` 第 353–358 行。不改 Quick Pick 控件本身的接受时机。不把「零选中」自动当成 None。不改 back / cancel / hide 的 `resolve`。
- 怎样本地验证：同上，现有用例不覆盖表单接受。在 `mcpElicitationService.test.ts` 新增断言：必填字符串、空值、无默认项时接受，Promise 在这一拍不结束，且不抛错；随后 hide 仍得到 `action: 'cancel'`。多选零勾选接受同样不结束、不抛错；勾选 None 得到的字段在 `content` 中缺席（与 r10-1 的删除一致）；勾选一个枚举值则 `content` 含该字符串。命令：`scripts/test.sh --run src/vs/workbench/contrib/mcp/test/browser/mcpElicitationService.test.ts`。

## r10-3（中）

- 问题类：Sessions 窗口把语音会话按仓库分组后，只存在于聊天模型里的行不进入任何组，列表不再画它们。
- 不变量：`sessionRows` 的前 `sorted.length` 项仍按 `getRepositoryName(sorted[i])` 进入仓库组或 Other。下标 `>= sorted.length` 的聊天行，仅当 agent 前缀已经产生至少一个组时，全部追加进 Other。每个 `sessionRows` 元素都出现在某个 `group.sessions` 里。agent 前缀为空时分组结果仍是 `undefined`，`setSessionGroups(undefined)`，扁平 `setSessions(sessionRows)` 继续含聊天行。非 Sessions 窗口仍 `setSessionGroups(undefined)`。与 agent 会话资源重复的聊天模型继续跳过（第 191 行）。
- 要动的符号或文件：`src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWidgetBinding.ts` 的 `_updateSessionData`，分组循环在第 220–233 行。把「仓库名数组 + 完整 `sessionRows` → `SessionGroupData[] | undefined`」收成同文件纯函数，循环之后把多出来的行推入 `otherRows`。`sessionListComponent.ts` 第 259–271 行在 `hasGroups` 时只画 `group.sessions`，分组数据补全后这里不用改。
- 明确不改什么：不改 `setSessions` 的扁平列表内容。不改状态计数 `_updateStatusCounts`。不改 `AgentsVoiceSessionsPicker`（它按日期列 agent 会话，不读这组 `sessionRows`）。不改 `createSessionRow`。
- 怎样本地验证：`agentsVoice` 下没有现成测试。为上述纯函数新增断言：一条有仓库名的 agent 行再加一条聊天行时，两组的 `sessions` 合起来覆盖两行，聊天行在标签为 Other 的组里；agent 前缀为空、只有聊天行时返回 `undefined`；agent 行没有仓库名时仍进 Other，聊天行跟在同一组。命令：`scripts/test.sh --run` 加上这个新测试文件的路径。

## r10-4（降为低）

- 问题类：`_handleExecuteResult` 在 `TaskExecuteKind.Active` 下，重连来源不要求 `active.same` 就提前返回。
- 反证：第 2112 行因 `&&` 优先于 `||`，确是「`active && active.same && FolderOpen`，或任意 `Reconnect`」。但 `terminalTaskSystem.ts` 的 `run` 只有第 272–275 行返回 `TaskExecuteKind.Active`，且 `active.same` 恒为 `true`。`_getInstances`（第 443–446 行）只保留 `getKey()` 相同的任务。另一个正在跑的任务不会让这次 `reconnect` 得到 `same: false` 的 Active。按注释加上括号之后，今天的重连 Active 仍会走同一条提前返回。`FolderOpen` 这一支在两种括号下都要求 `active.same`。发现稿里「撞上另一个任务就跳过 RunningTask」在当前生产者上到不了。
- 不变量：`kind === Active` 且 `active && active.same` 且来源是 `FolderOpen` 或 `Reconnect` 时，打现有调试日志并 `return executeResult.promise`。`active && active.same` 但来源不是这两种时，仍调用 `_handleInstancePolicy`。`kind === Active` 且缺少 `active` 或 `active.same === false` 时，仍抛 `TaskErrors.RunningTask`，重连也不例外。
- 要动的符号或文件：`src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts` 的 `_handleExecuteResult` 第 2112 行，改成 `active && active.same && (runSource === TaskRunSource.FolderOpen || runSource === TaskRunSource.Reconnect)`。判断提成同文件可测函数，方法里只调用它。
- 明确不改什么：不改 `terminalTaskSystem.run` / `reconnect` 的 Active 载荷（第 257–275 行）。不改第 2117–2121 行实例策略与 `RunningTask` 的原文。不改调试日志字符串。不改 `_executeTask` 第 2095 行对 Reconnect 调用 `reconnect` 的分派。
- 怎样本地验证：`src/vs/workbench/contrib/tasks/test` 里没有 `_handleExecuteResult` 的用例。为上面的函数新增断言：`Reconnect` 且 `active.same === true` 为忽略；`Reconnect` 且 `active` 缺失、或 `same === false`，为不忽略；`FolderOpen` 且 `same === true` 为忽略；`FolderOpen` 且 `same === false` 为不忽略；`User` 且 `same === true` 为不忽略。命令：`scripts/test.sh --run` 加上该新测试文件的路径。

## r10-5（降为低）

- 问题类：同一个笔记本编辑器再次把 `widget.find` 的结果写入 `_cellMatches` 时，本轮没出现的单元格不会被删掉，`matches()` 仍把这些旧匹配算进搜索树。
- 反证：第 320–323 行确实只在 `getId() !== this._lastEditorWidgetIdForUpdate` 时 `clear`，第 324–339 行的 `forEach` 只 `set`。第 423–425 行 `matches()` 会摊平全部 `_cellMatches`。但换搜索词会走 `PlainTextSearchHeadingImpl` 的 `query` setter（`textSearchHeading.ts` 第 317–332 行）里的 `clearQuery`（第 167–174 行），`add` 在第 102 行 `disposePastResults` 清掉上一轮 folder match。新的 `NotebookCompatibleFileMatch` 从空的 `_cellMatches` 开始，`_lastEditorWidgetIdForUpdate` 为 `undefined`，第一次 `updateNotebookMatches` 会因 id 不同而 `clear`。所以「查询字符串变了，上一轮单元格还留在当前结果里」对不上。会留下旧单元格的，是同一文件匹配、同一 widget id 的再一次写入：`bindNotebookEditorWidget` 在 `ChangeCellContent` / `ModelChange` 时调度（第 261–265 行），以及之后再次调用 `updateMatchesForEditorWidget`（第 401 行把完整 `widget.find` 结果交进来）。第一次写入会 clear；第二次起，缺席的 cell id 还在 map 里。
- 不变量：`updateNotebookMatches` 结束时，`_cellMatches` 的键集合等于本轮 `matches` 写进去的 cell id。本轮没有的 id 要删掉，包括本轮 `matches` 为空。换 widget id 时现有的 `clear` 保留。`forEach` 里用 `oldCellMatches` 把 `` `${rawCellPrefix}${index}` `` 迁到真实 cell 的逻辑仍在删除之前完成。本轮命中的 cell 仍是先 `clearAllMatches` 再写入本轮 content / webview 匹配。
- 要动的符号或文件：`src/vs/workbench/contrib/search/browser/notebookSearch/notebookSearchModel.ts` 的 `updateNotebookMatches`（第 314–341 行）。在 `forEach` 之后删掉本轮未 `set` 的 id，或用本轮结果换成新的 map，同时让 raw 前缀迁移仍读得到替换前的那份。
- 明确不改什么：不改 `updateMatchesForEditorWidget` 的 `widget.find` 参数、generation 作废返回（第 397–401 行），以及第 383 行对 `_textMatches` 的清空。不改第 343 行 `setAllFindMatchesDecorations(matches)` 的入参。不改 `textSearchHeading.ts` 的查询替换。不改 `removeMatch` 第 432–433 行按单条匹配删除的路径。
- 怎样本地验证：`src/vs/workbench/contrib/search/test/browser/searchNotebookHelpers.test.ts` 会构造 `NotebookCompatibleFileMatch`，但不断言连续两次 `updateNotebookMatches`。把「保留本轮 id、丢掉其余 id，并完成 raw 前缀迁移」提成同文件可测函数后，在该测试文件新增断言：同一 widget id 下第二次给出的 id 集合更小时，第一次独有的 id 不再出现；第二次仍在的 cell 只保留本轮匹配；第二次传入空数组时结果为空；raw 前缀项在本轮迁到真实 cell id 后，旧前缀键不留在 map 里。命令：`scripts/test.sh --run src/vs/workbench/contrib/search/test/browser/searchNotebookHelpers.test.ts`。
