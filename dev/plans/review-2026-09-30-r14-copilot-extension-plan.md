---
title: "方案 r14：copilot-extension"
type: plan
status: accepted
phase: N/A
updated: 2026-10-01
summary: "2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。免确认只收紧会静默改 git 的四条命令；补丁整文件替换；历史缺结果仍留助手文本；外置路径留未读说明；模糊匹配只接受唯一最近位置。"
---

# 方案

四条 hold，一条 weaken（r14-1）。没有 drop。不占决策记录编号。

## r14-1

- 问题类：`run_vscode_command` 对 `git.stageAll`、`git.stashPopLatest`、`git.rebaseAbort`、`git.stage` 不返回确认文案，这四条会在没有命令自身对话框的情况下改暂存区、stash 或 rebase。
- 降级：发现稿把 `git.stash`、`git.stashStaged`、`git.stashPop` 也写成不带参数就直接改仓库，并把 `git.stage` 的参数写成可指定任意路径，把 stash pop 写成冲突时覆盖未提交修改。反证：`extensions/git/src/commands.ts` 第 4519–4526 行 `_stash` 必走 `showInputBox`，取消则返回 false，不会 `createStash`（`git.stash` 与 `git.stashStaged` 都走这里；未保存文件时第 4488–4509 行还有模态框）。同文件第 4561–4566 行 `git.stashPop` 先 `pickStash`，未选择则 return。`extensions/git/src/git.ts` 第 2688–2694 行在 “would be overwritten” 时抛 `LocalChangesOverwritten`，不会静默覆盖。同文件 `commands.ts` 第 1520–1529 行：`git.stage` 的参数不是带 `Uri` 实例的 `resourceUri` 时退回 `getSCMResource()`，模型传入的路径字符串不会被暂存。仍会静默改状态的是：`stageAll` 第 1575–1584 行直接 `repository.add`；`stashPopLatest` 第 4572–4581 行直接 `popStash`；`rebaseAbort` 第 4931–4934 行在有 rebase 时直接 `rebaseAbort`；`git.stage` 仍跳过工具确认并暂存当前 SCM 资源。
- 不变量：`VSCodeCmdTool.prepareInvocation` 在命令属于仍保留的免确认集合、且参数条件与现在两个 `if` 一致时，只返回 `invocationMessage`。`git.stageAll`、`git.stashPopLatest`、`git.rebaseAbort`（无参数）以及 `git.stage`（无参数或带参数）必须落到现有的 `confirmationMessages` 分支（含 `title`）。`invoke` 仍是 `executeCommand`，确认由平台在有 `confirmationMessages.title` 时等待。
- 要动的符号或文件：`extensions/copilot/src/extension/tools/node/vscodeCmdTool.tsx` 的 `noConfirmationCommandsWithoutArgs`（去掉 `git.stageAll`、`git.stashPopLatest`、`git.rebaseAbort`）和 `noConfirmationCommandsWithArgs`（去掉 `git.stage`）。两个 `if`（第 171–176 行）的结构不动。
- 明确不改什么：`git.stash`、`git.stashStaged`、`git.stashPop`、`git.stashView`、`git.showOutput` 留在免确认集合。不改 `extensions/git` 的命令实现，也不为 stash pop 再加覆盖保护。不改 `update.*` 以及名单里其余命令。不改 `invoke` 的执行与错误文案。
- 本地验证：`extensions/copilot` 下新增 vitest（先 `import` `vscodeCmdTool` 以完成 `ToolRegistry` 注册，用 `ToolName.RunVscodeCmd` 取出构造函数，`new` 时三个服务参数可为空对象，因为 `prepareInvocation` 不用它们）。断言 `git.stageAll`、`git.stashPopLatest`、`git.rebaseAbort` 在 `args` 为空时，以及 `git.stage` 在 `args` 为空和 `args` 为非空时，`confirmationMessages.title` 有值。断言 `git.stash`、`git.stashPop`、`git.showOutput` 在 `args` 为空时没有 `confirmationMessages`。命令：`npm run test:unit -- src/extension/tools/node/test/<新文件>.spec.ts`（在 `extensions/copilot`）。`vite.config.ts` 的 `test.include` 只有 `**/*.spec.ts` 和 `**/*.spec.tsx`。不是 `*.spec.ts` / `*.spec.tsx` 的文件不会被收集。

## r14-2

- 问题类：更新变短且文末空行变少时，`generateUpdateTextDocumentEdit` 的替换范围只覆盖新文本行数，删除起点又向后让出文末空行差，原文中间一行会留下来。
- 不变量：文本文件的 update 只产生覆盖全文的替换。最终字符串是 `newContent`；当 `originalTrailing > newTrailing` 时，只在该字符串末尾再追加这么多个 `\n`。应用后的文档等于这个最终字符串。原文下标大于等于 `newContent.split('\n').length` 的行不得出现在新文本和文末补上的空行之间。`getTrailingDocumentEmptyLineCount` 与 `getTrailingArrayEmptyLineCount` 的计数定义不变，只用来决定末尾追加几个 `\n`。
- 要动的符号或文件：`ApplyPatchTool.generateUpdateTextDocumentEdit`（`extensions/copilot/src/extension/tools/node/applyPatchTool.tsx` 第 128–146 行）。删掉按 `lines.length + i` 插入、以及从 `newLineCount` 删到文末的两段。改为一次 `workspaceEdit.replace`，范围从 `Position(0, 0)` 到 `Position(textDocument.lineCount, 0)`，文本为上面的最终字符串。
- 明确不改什么：不改 `generateUpdateNotebookDocumentEdit`。不改 `applyPatch/parser.ts` 如何生成 `change.newContent`。不改两个空行计数函数的循环。不改 rename、ADD、DELETE。
- 本地验证：`extensions/copilot/src/extension/tools/test/node/applyPatch/applyPatch.spec.tsx` 已有 `makes changes atomically` 必须仍通过。在同一 suite 新增断言：原文 10 行且末尾 2 行空，补丁把文件收成 5 行且只有 1 个文末空行；沿用该测试里 `ChatResponseTextEditPart` 应用到 `WorkingCopyOriginalDocument` 的方式。断言结果等于新文本再补一个 `\n`，且被替换区间之后的那条旧正文不在结果里。命令：`npm run test:unit -- src/extension/tools/test/node/applyPatch/applyPatch.spec.tsx`（在 `extensions/copilot`）。

## r14-3

- 问题类：历史轮的工具调用在 `toolCallResults` 里都对不上、且不会合成占位结果时，`renderOneToolCallRound` 直接返回空数组，该轮助手文本被丢掉。
- 不变量：`isHistorical` 为真且过滤后没有留下任何工具调用时，只要 `round.response` 非空，仍输出一条不带 function call 的 `AssistantMessage`，正文为 `round.response`，不为这些被滤掉的调用追加 tool result。`round.response` 为空且过滤后没有工具调用时可以继续返回空数组。`shouldSynthesizeMissingToolResults` 为真时过滤条件不变：有 id 的调用留在列表里，缺结果仍用 `MISSING_STATEFUL_TOOL_RESULT`。部分调用有结果时，仍只保留有结果的调用，并保留 `round.response`。
- 要动的符号或文件：`ChatToolCalls.renderOneToolCallRound`（`extensions/copilot/src/extension/prompts/node/panel/toolCalling.tsx` 第 112–118 行）。去掉「`round.toolCalls.length && !fixedNameToolCalls.length` 则 `return []`」这条对非空 `round.response` 的短路；空的 `fixedNameToolCalls` 走现有的 `AssistantMessage`，工具结果循环自然不执行。
- 明确不改什么：不改 `conversationHistory.tsx`、`agentConversationHistory.tsx`、`summarizedConversationHistory.tsx` 里 `isHistorical={!(toolCallResultInNextTurn && i === …)}`。不改非历史轮的过滤（非历史本来就不过滤）。不改 `shouldSynthesizeMissingToolResults` 的三个条件（历史、`apiType === 'responses'`、`round.statefulMarker`）。
- 本地验证：`extensions/copilot/src/extension/prompts/node/panel/test/toolCalling.spec.ts` 已有 `synthesizes missing historical tool results for stateful Responses rounds` 必须仍通过（Responses + `statefulMarker` 保留缺结果的调用并合成占位）。在同一文件新增断言：`isHistorical: true`，endpoint 不是 responses（或 responses 但没有 `statefulMarker`），该轮 `response` 为非空文本且 `toolCalls` 的 id 都不在 `toolCallResults` 里。渲染结果里有一条助手消息，其文本为该 `response`，且没有这些 id 的 tool call。命令：`npm run test:unit -- src/extension/prompts/node/panel/test/toolCalling.spec.ts`（在 `extensions/copilot`）。

## r14-4

- 问题类：`parseFinalAnswerAndHydrate` 在 `needsConfirmation` 为真时不写入该行，子代理已经给出的 `路径:起行-止行` 从交回主代理的文本里消失。
- 不变量：整行匹配 `^(.+):(\d+)-(\d+)$` 且 `needsConfirmation` 为真时，结果里仍有该路径和解析出的起止行，并写明未读取；不调用 `openTextDocument`，不放入文件正文。`needsConfirmation` 为假时仍走现有的排除检查与代码水合。抛错时仍把原始行放回（现有 `catch`）。不匹配该正则的行原样保留。
- 要动的符号或文件：`SearchSubagentTool.parseFinalAnswerAndHydrate`（`extensions/copilot/src/extension/tools/node/searchSubagentTool.ts` 第 262–277 行）。在 `if (!needsConfirmation)` 的另一侧 `processedLines.push` 一行英文说明，格式与现有水合行一样使用 `uri.fsPath` 和解析出的起止行，例如 `File: \`<fsPath>\`, lines <start>-<end>: not read (confirmation required)`。`ExploreSubagentTool` 继承该方法，不另写一份。
- 明确不改什么：不在子代理里弹出确认卡，也不读取需确认的文件。不改 `isFileExternalAndNeedsConfirmation`。不改 `preserves non-matching lines verbatim when the model uses a different format` 与 `hydrates the line with code when an inside-workspace path opens` 的期望。文件不存在因而抛错时，仍由 `catch` 保留原行。
- 本地验证：`extensions/copilot/src/extension/tools/node/test/searchSubagentTool.spec.ts` 的 `drops the line when the path is outside the workspace` 改为断言结果含 `/external/secret.ts`（或对应 `fsPath`）和 `5-10`，含未读说明，且不含文件正文；测试名改成保留该行。`keeps the original line when an inside-workspace path fails to open` 与 `hydrates the line with code when an inside-workspace path opens` 保持通过。命令：`npm run test:unit -- src/extension/tools/node/test/searchSubagentTool.spec.ts`（在 `extensions/copilot`）。

## r14-5

- 问题类：上下文从当前起点对不上时会从文件头再搜，编辑距离取第一处未超上限的位置，前部相似代码会被改掉。
- 不变量：`find_context_core` 的精确匹配与空白类匹配（现有 Pass 1 到忽略周围空白的那一趟）仍从 `start` 起返回第一处命中。编辑距离一趟必须把每一行的距离加总（窗口超出文件末尾的起点不是候选，不要对缺失行调用 `computeLevenshteinDistance`）。距离不超过 `Math.floor(context.length * EDIT_DISTANCE_ALLOWANCE_PER_LINE)` 的位置里，距离最小的那一处若唯一，用该处；最小距离并列才抛 `InvalidContextError`，`kindForTelemetry` 为 `invalidContext-ambiguous`，不应用该 hunk。零处则像现在一样返回未命中。不要改成「上限内多于一处就拒绝」：那与「只改距离更小的后段」不能同时成立。`parse_update_file` 在起点 `index` 未命中后从 0 再搜时，这次不允许编辑距离，只接受精确或空白类匹配；仍未命中则走现有的 `InvalidContextError`（`invalidContext` / `invalidContext-eof`）。`EDIT_DISTANCE_ALLOWANCE_PER_LINE` 仍是 `0.34`。
- 要动的符号或文件：`find_context_core` 第 597–611 行的编辑距离循环，改成收集上限内的窗口再取唯一最小距离，不要在 `totalDistance <= maxDistance` 时立刻返回第一处。`find_context` 增加是否允许编辑距离的参数，默认允许。`parse_update_file` 第 376–382 行从 0 再搜的那次传入不允许。eof 分支仍走 `find_context_core`，因此同样遵守「最小距离唯一才采纳、并列则抛歧义」。搜索起点必须同时覆盖测试里的前后两段，否则「第一处达标就返回」可能已经只改后段，锁不住规则。
- 明确不改什么：不改 Pass 1–5 的比较和 `Fuzz` 标志。不改 `@@` 定义行如何移动 `index`。不改 `peek_next_section` 的 hunk 切分。不改 `EDIT_DISTANCE_ALLOWANCE_PER_LINE`。并列最小时抛错，不改去选第一处达标窗口，也不改去选靠前的那一处。
- 本地验证：`extensions/copilot/src/extension/tools/test/node/applyPatch/parser.spec.ts` 已有 `replace_explicit_tabs` 与现有 snapshot 必须仍通过。新增三条 `text_to_patch` 断言：（1）前后两段都不是精确或仅空白差异，后段编辑距离更小且两段都不超过上限，结果只改后段；（2）两段距离相等且都在上限内，抛 `InvalidContextError` 且 `kindForTelemetry === 'invalidContext-ambiguous'`；（3）`@@` 把头把起点移到后段之后，后段精确、空白、编辑距离都对不上，前段只有编辑距离能对上，抛现有的 invalid context，不得把前段改掉。命令：`npm run test:unit -- src/extension/tools/test/node/applyPatch/parser.spec.ts`（在 `extensions/copilot`）。

## 审查

2026-09-30 只读审查后改稿。Critical：r14-5 收成「上限内距离最小且唯一才采纳，并列才抛 `invalidContext-ambiguous`」。不采纳「上限内多于一处就拒绝」：那与摘要和「只改更近的后段」不能同时成立。Important：r14-1 的新测试文件用 `*.spec.ts`。均已写入正文。

2026-09-30 第二轮。无 Critical / Important。Minor：收集范围改成「不是 `*.spec.ts` / `*.spec.tsx` 的文件不会被收集」。已写入正文。

2026-09-30 用户签收。`accepted`。未实施。
