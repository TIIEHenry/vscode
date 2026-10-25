---
title: "方案 r09：chat"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "3 hold 已实施，2 weaken 维持现状；重命名后编辑仍可撤回原路径，取消与失败不再记成功，进度写入本次 chatRequestId，外部编辑组不再吞普通编辑。"
---

## 核查

- r09-1 weaken：`mergeFileEdit` 仍把非创建、非删除收成 `Edit`，`_writeCheckpointContent` 的 `Edit` 分支只写 `edit.resource`。合并键是 `resource` 字符串相等；先改旧路径再重命名到另一条路径不会进这次合并，单条 `FileEditKind.Rename` 仍会 `move`。
- r09-2 weaken：`invoke` 抛错，或取消时状态还是 `Executing` / `Streaming`，`finally` 里 `didExecuteTool(result, true)` 仍走 `_setCompleted`，不读 `toolResultError`。已在 `WaitingForConfirmation` 或 `WaitingForPostApproval` 的取消会先 `confirmWith(Denied)` 收成 `Cancelled`，`didExecuteTool` 见此状态直接返回；`toolIsConfirmed` 对 `Denied` 为假，进度部分不会把过去时文案画成完成。
- r09-3 hold：`EditTool.invoke` 只在 `result.errorMessage` 时抛错，其后无条件返回 “The file was edited successfully”。`mapCode` 在 token 已取消时返回 `undefined`。调用前的空 `textEdit` 会经 `acceptStreamingEditsStart` 把该文件标成正在修改，组 `done` 后 `stream.complete()` 清掉标志，等待随之 resolve。
- r09-4 hold：`EditTool.invoke` 与 `RunSubagentTool.invoke` 仍用 `getRequests().at(-1)` 接收 `textEdit`。`acceptResponseProgress` 在目标响应已完成时抛错。`invokeTool` 已能按 `chatRequestId` 放行“重开的请求不是最后一条”。
- r09-5 hold：`_mergeOrPushTextEditGroup` / `_mergeOrPushNotebookEditGroup` 仍只按 URI 且未 `done` 合并，`isExternalEdit` 留在第一批。observer 见 `isExternalEdit` 就跳过整组。`chatModel.test.ts` 仍把“标志保持第一批”锁成期望。

## r09-1 weaken

- 问题类：同一 `resource` 上，重命名和后续编辑被收成 `Edit` 后，撤销和重做只覆盖新路径，不再把文件移回 `originalResource`。
- 不变量：检查点条目的路径身份由 `resource` 与 `originalResource` 一起持有。两者不是同一 URI 时，撤销必须先把文件从 `resource` 移回 `originalResource` 再写 before，重做必须先从 `originalResource` 移到 `resource` 再写 after。内容快照不能冒充路径移动。
- 要动的符号或文件：`mergeFileEdit`（`agentHostSnapshotController.ts`）。在现有 else 分支里，若 `next.originalResource ?? prev.originalResource` 存在且与 `next.resource` 不等，`kind` 保持 `FileEditKind.Rename`，让已有的 `Rename` 分支做 `move` 再写内容。
- 不改：`addToolCallEdits` 按 `resource` 字符串找旧条目的规则；`resource` 不同的编辑与重命名继续各留一条；单条 `Rename` 的 `move` 与写内容；`Create` / `Delete` 的净 `kind`。不要让普通 `Edit` 分支见了 `originalResource` 就 `move`。
- 本地验证：`agentHostSnapshotController.test.ts` 的 `multiple tool calls editing the same file collapse to one net edit` 仍只断言同路径两次编辑。新增：同一 request 先记一条 `before` URI 与 `after` URI 不同的编辑，再记一条资源等于该 `after` URI 的内容编辑；`restoreSnapshot` 后文件在 `before` 路径且内容是第一次的 before；再 redo 后文件在 `after` 路径且内容是第二次的 after。

## r09-2 weaken

- 问题类：工具在执行中被取消或 `invoke` 抛错时，卡片变成没有错误的 `Completed`，并继续用准备阶段的 `pastTenseMessage`。
- 不变量：调用状态由 `ChatToolInvocation` 持有。未跑完或已失败不能呈现为已成功执行。已经是 `Cancelled` 的结果不能再被收成成功的 `Completed`。
- 要动的符号或文件：`LanguageModelToolsService.invokeTool` 的 `finally`；`ChatToolInvocation.didExecuteTool` / `_setCompleted`。`catch` 里已经分得出 `isCancellationError`：取消且当前不是 `Cancelled` 时收成 `Cancelled`；其它抛错不要进入没有错误的 `Completed`，完成态要留下 `toolResultError`（或等价的 `isError`），并且不要把 `preparedInvocation.pastTenseMessage` 当作完成文案。`ChatToolProgressPart` 只在完成态仍会画出这段过去时文案时，改为错误可见、成功句不出现。
- 不改：`confirmWith(Denied)` 把 `WaitingForConfirmation` / `WaitingForPostApproval` 收成 `Cancelled` 的路径；`didExecuteTool` 对已是 `Completed` 或 `Cancelled` 的早退；用户 `Skipped` 的既有文案；`alwaysDisplayInputOutput` 已经放进 `toolResultDetails` 的错误输出。
- 本地验证：`languageModelToolsService.test.ts` 的 `cancel tool call` 只断言抛 `CancellationError`。新增：`invoke` 抛非取消错误后，状态不是无错误的 `Completed`，准备阶段的 `pastTenseMessage` 不作为完成文案。另断言：token 在 `WaitingForConfirmation` 期间取消后，状态仍是 `Cancelled`。

## r09-3 hold

- 问题类：代码映射被取消或没有 `errorMessage` 时，编辑工具仍向模型返回编辑成功。
- 不变量：这次调用有没有改成文件，由 `mapCode` 的返回值和 `CancellationToken` 持有。取消、返回 `undefined`、或本次没有文本/笔记本编辑回调，都不能报告成功。空的起始 `textEdit` 只表示流已打开，修改标志落下不等于写入发生。
- 要动的符号或文件：`EditTool.invoke`（`editFileTool.ts`）。在 `textEdit` / `notebookEdit` 回调里记下是否真有编辑。`mapCode` 之后，token 已取消、`result` 为 `undefined`、或没有编辑回调时，返回失败（或抛错），不要返回 “The file was edited successfully”，也不要为了等标志而 resolve 成成功。有真实编辑时，仍可等 `isCurrentlyBeingModifiedBy` 从真变假再返回成功。
- 不改：`result.errorMessage` 已有的 `throw`；`CodeMapperService.mapCode` “取消则返回 `undefined`” 的合同；成功路径上对编辑会话的等待。
- 本地验证：现无 `editFileTool` 测试。新增：`mapCode` 在 token 已取消时返回 `undefined`，或返回无 `errorMessage` 且不调用编辑回调时，工具结果不是 “The file was edited successfully”。有编辑回调且映射没有 `errorMessage` 时仍可成功。

## r09-4 hold

- 问题类：`vscode_editFile` 和子代理把文本编辑进度写进会话最后一条请求，而不是这次调用的 `chatRequestId`。
- 不变量：编辑进度属于 `invocation.chatRequestId` 那条 `ChatRequestModel`。对不上、响应已完成或已取消时，停止写入，不能改写最后一条的身份。
- 要动的符号或文件：`EditTool.invoke` 里取 `request` 以及随后所有 `model.acceptResponseProgress(request, …)`；`RunSubagentTool.invoke` 里取 `request`，以及 `progressCallback` 中对 `textEdit` / `notebookEdit` / `codeblockUri` 的 `acceptResponseProgress`。用 `model.getRequests().find(r => r.id === invocation.chatRequestId)`。找不到、`response.isComplete` 或 `response.isCanceled` 时停止写入并让这次工具失败。
- 不改：`mapCode` 已经收到的 `chatRequestId`；`LanguageModelToolsService.invokeTool` 按 `chatRequestId` 做的取消/完成检查；`askQuestionsTool` / `reviewPlanTool` 找不到 id 时回退到最后一条的行为。
- 本地验证：`languageModelToolsService.test.ts` 的 `invokeTool uses chatRequestId for cancel/complete check when reopened request is not last` 已构造“前面一条未完成、最后一条已完成”。新增：此形状下 `EditTool` 与 `RunSubagentTool` 的 `textEdit` 进 `chatRequestId` 那条；`chatRequestId` 对不上或该响应已完成时，不向最后一条调用 `acceptResponseProgress`。子代理另有自己的请求身份：`runSubagentTool.ts:336` 创建 `agentRequest` 时用的是 `invocation.callId`，不是父请求的 `invocation.chatRequestId`；因此要单独断言父请求进度仍落在父 `chatRequestId` 上，且“重开的请求不是最后一条”时不会把子代理进度写到最后一条。

## r09-5 hold

- 问题类：同一文件上，未完成的外部编辑组会吞掉后面的普通文本编辑，observer 整组跳过，缓冲区收不到。
- 不变量：`isExternalEdit` 是这一批编辑自己的事实，由写入进度的那一方持有。外部批次和普通批次分开累积。observer 只跳过外部批次；普通批次必须进入 streaming 缓冲。
- 要动的符号或文件：`Response._mergeOrPushTextEditGroup` 与 `_mergeOrPushNotebookEditGroup`（`chatModel.ts`）。只有候选组未 `done`、URI 相同、且 `!!candidate.isExternalEdit === !!isExternalEdit` 时才 `push` 进同一组。标志不同则新开一组，新组带上这一批自己的 `isExternalEdit`。
- 不改：同一种来源且未 `done` 的合并；`chatEditingServiceImpl` 里 `part.isExternalEdit` 则 `continue` 的跳过；`startExternalEdits` 开场 `done: false` 且 `isExternalEdit: true` 的那条进度。
- 本地验证：改 `chatModel.test.ts` 的 `textEdit merges edits for same URI when not done` 与 `notebookEdit merges edits for same notebook URI when not done`。两条都是先外部、后普通：应得到两组，普通组的 `isExternalEdit` 不为真，外部组不包含后一批 `edits`。同标志的两批仍合并为一组。

## 落地

- 2026-10-25 实施 r09-1：快照控制器保留 `originalResource`；重命名后又编辑同一文件仍按 `Rename` 处理，撤回时先恢复原路径再写回旧内容。
- 2026-10-25 实施 r09-2：工具执行抛错或取消时，`ChatToolInvocation` 进入带 `toolResultError` 的完成态或取消态，不再沿用准备阶段的成功文案。
- 2026-10-25 实施 r09-3：`editFileTool` 在映射取消、没有编辑或令牌取消时抛错 / 抛 `CancellationError`，不向模型回报成功。
- 2026-10-25 实施 r09-4：`editFileTool` 与 `runSubagentTool` 按 `invocation.chatRequestId` 找请求；请求已完成或已取消时拒绝写入进度。
- 2026-10-25 实施 r09-5：`ChatModel` 的文本与笔记本编辑组合并时同时比较 `isExternalEdit`，外部组与普通组分开。
- 验证：chat 四个测试文件合计 276 passing；`agentHostSnapshotController.test.ts` 的重命名后编辑用例通过。
- 既有失败：无。
