---
title: "审查 r10：contrib"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "MCP 征询把未填值写成 false/NaN 或在未选中时抛错；语音分组漏掉普通聊天；任务重连因运算符优先级被静默忽略；笔记本搜索留下过期单元格匹配。"
---
# 审查 r10：contrib

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r10-1 中
- 症状：MCP 表单征询里，可选布尔选「None」会提交 `false`，可选数字或整数选「None」会提交 `NaN`。
- 位置：`src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts` 第 273–307 行
- 引用：`result.value = result.value === 'true' ? true : false`；`result.value = Number(result.value)`；随后只有 `result.value === undefined` 才从结果里删掉该字段。
- 为什么是问题：未选时 Quick Pick 给出的是 `undefined`（`noneItem.id`）。布尔转换把一切非 `'true'` 都写成 `false`，数字转换先做 `Number(undefined)` 得到 `NaN`，后面的空值判断就失效。服务端收到明确的假值或 `NaN`，而不是「这个可选字段没填」。
- 方向：类型转换只处理已选出的字符串，保留 `undefined` 并不写入 `content`。

## r10-2 中
- 症状：征询 Quick Pick 在没有选中项时按接受，会直接抛错，这一步提交不出去。
- 位置：`src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts` 第 453–461 行
- 引用：`const id = quickPick.selectedItems[0].id`。多选分支第 390–392 行是 `const selected = quickPick.selectedItems[0]; if (selected.id === undefined)`。
- 为什么是问题：必填且输入为空时列表可以没有项；多选也可以零项接受。`selectedItems[0]` 此时是 `undefined`，读 `.id` 抛出 `TypeError`。单选枚举在第 355 行先判断了 `selected`，这两处没有。事件处理函数抛错后，对应的 Promise 不会按「取消」或「留下重填」结束。
- 方向：接受时先判断有没有选中项，没有就保持当前步，不要读 `.id`。

## r10-3 中
- 症状：Agents 窗口的语音会话列表按仓库分组后，只存在于聊天模型里的会话不再出现，无法选作转写目标。
- 位置：`src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWidgetBinding.ts` 第 215–243 行
- 引用：分组循环是 `for (let i = 0; i < sorted.length; i++)`，行数据取 `sessionRows[i]`。普通聊天是在第 187–210 行追加到 `sessionRows` 末尾的。
- 为什么是问题：`sessionRows` 前面一段才与 `sorted` 对齐，追加的聊天行不会进入 `repoMap` 或 `otherRows`。只要分组非空，`setSessionGroups` 就会带上分组。`sessionListComponent.ts` 第 259–271 行在有分组时只渲染 `group.sessions`，扁平的 `sessions` 不再使用，这些聊天会话从列表消失。
- 方向：分组时把追加的聊天行放进「Other」，或让列表在分组之外仍渲染未入组的会话。

## r10-4 中
- 症状：重连触发的任务若得到 Active 结果，会直接被忽略，不再提示已有任务在跑，也不走实例策略。
- 位置：`src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts` 第 2110–2116 行
- 引用：`if (active && active.same && runSource === TaskRunSource.FolderOpen || runSource === TaskRunSource.Reconnect)`
- 为什么是问题：`&&` 优先于 `||`，条件等价于「同一任务且来自打开文件夹」或「任意重连」。`runSource === Reconnect` 时不再要求 `active` 存在或 `active.same`。重连撞上另一个正在跑的任务时，函数返回 `executeResult.promise` 并打调试日志，后面的实例策略和 RunningTask 错误都不会发生。
- 方向：用括号把两种来源都放进 `active && active.same` 的判断里。

## r10-5 中
- 症状：已打开笔记本的搜索在查询变化后，不再命中的单元格仍留在结果里。
- 位置：`src/vs/workbench/contrib/search/browser/notebookSearch/notebookSearchModel.ts` 第 314–341 行
- 引用：仅当 `getId() !== this._lastEditorWidgetIdForUpdate` 时 `this._cellMatches.clear()`；随后 `matches.forEach` 只 `set` 本轮命中的 cell。
- 为什么是问题：`updateMatchesForEditorWidget` 把 `widget.find` 的完整结果交给这里。同一编辑器再次查找时不会清空 `_cellMatches`，本轮没有出现的 cell 也不会被删除。`matches()` 仍把这些旧 cell 的匹配算进去，搜索树继续显示上一轮命中。
- 方向：用本轮 `matches` 覆盖 `_cellMatches`，或删掉本轮未出现的 cell id。
