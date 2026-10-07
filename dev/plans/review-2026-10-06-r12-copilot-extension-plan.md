---
title: "方案 r12：copilot-extension"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 3，drop 0，weaken 2。"
---

hold 3，drop 0，weaken 2。

## r12-1

- 问题类：`github.copilot.terminal.generateCommitMessage` 把提交说明送进终端时，转义顺序会拆开双引号，换行和反引号仍可被 shell 执行。
- 不变量：送给 `sendText` 的字符串只有一行，形如 `git commit -m "<payload>"`。payload 的产生顺序固定为：先删掉 `\r` 和 `\n`（换成一个空格），再把 `\` 加倍，然后转义 `"`、`$`、`` ` ``。`say "hi"` 的整行字符必须是 `git commit -m "say \"hi\""`（每个内层引号前只有一个反斜杠）。`` say `id` `` 的反引号前有反斜杠。`$(...)` 的 `$` 前有反斜杠。结果中不得含 `\r` 或 `\n`。`sendText` 的第二参数保持 `false`。`terminalInstance.sendText` 会把 `\r?\n` 换成 `\r`（`src/vs/workbench/contrib/terminal/browser/terminalInstance.ts` 第 1427 行），所以换行必须在调用前去掉。
- 要动的符号或文件：`extensions/copilot/src/extension/conversation/vscode-node/conversationFeature.ts` 第 305–308 行，命令 `github.copilot.terminal.generateCommitMessage` 里的 `sanitizedMessage` 与拼出来的 `message`。把这段收成同文件纯函数，输入原始提交说明，输出上述整行。删掉现在的 CodeQL 注释（它把「先引号、再加倍反斜杠」说成已经转义）。
- 明确不改什么：`github.copilot.git.generateCommitMessage`（第 311–320 行）仍只写 `repository.inputBox.value`。不改 `activeTerminal` 为空时直接不发送。不改终端 `sendText` 的实现。
- 怎样本地验证：没有现成测试。在 `extensions/copilot` 下新增 `*.spec.ts`（`vite.config.ts` 的 `test.include` 只收 `**/*.spec.ts` 和 `**/*.spec.tsx`），直接断言该纯函数：`say "hi"` 得到上面的整行；含 `` ` ``、`$(id)`、`\` 与 `"` 的说明里，反斜杠先于引号被转义；含 `\n` 的说明结果里没有 `\r`/`\n`。命令：`npm run test:unit -- <该 spec 相对 extensions/copilot 的路径>`（在 `extensions/copilot`）。

## r12-2

- 问题类：补丁把文件移动到另一个已存在的路径时，解析不拒绝该目标，文本替换会发到目标 URI。
- 降级：发现稿为高，降为中。
- 反证：第 125 行的 `workspaceEdit.renameFile(path, movePath, { overwrite: true })` 不会执行。`WorkspaceEdit.entries`（`src/vs/workbench/api/common/extHostTypes/workspaceEdit.ts` 第 199–211 行）只收集 `FileEditType.Text`。`invoke` 第 357 行用 `entries()`，第 417 行只把 `deletedFiles` 交给 `responseStream.workspaceEdit`。笔记本分支第 157–158 行注释掉同样的 `renameFile`，并写明对普通文本文件也不生效。实际发出的是第 125–136 行把 `path` 改成 `movePath` 之后的 `replace`，范围终点是源文档的 `lineCount`，源文件不会被删。现有测试 `applies a move when the source and destination are allowed` 只断言目标 URI 上出现 text edit；夹具里没有 `fixtures/allowed.ts`。工作区内普通编辑本来就没有确认卡：`createEditConfirmation` 在没有需要确认的 URI 时返回 `{ presentation: 'hidden' }`（`editFileToolUtils.tsx` 第 945–946 行）。
- 不变量：`movePath` 已存在（`canExistingFileBeEdited` 为真）且与源 URI 按 `extUriBiasedIgnorePathCase.isEqual` 不相等时，在任何 `responseStream.textEdit` / `notebookEdit` 之前返回 `ExtendedLanguageModelToolResult` 且 `hasError === true`，不发出编辑。目标不存在时，仍把 text edit 发到目标 URI，源文件仍不删除。同一 URI 的原地更新仍走现有替换。
- 要动的符号或文件：`ApplyPatchTool.invoke` 里 `ActionType.UPDATE` 分支（`applyPatchTool.tsx` 第 321 行附近），在 `generateUpdateTextDocumentEdit` 与 `generateUpdateNotebookDocumentEdit` 之前做上述存在性检查。存在性用已有的 `canExistingFileBeEdited`。
- 明确不改什么：不改 `WorkspaceEdit.entries`。不靠修改 `overwrite`。不删第 125 行的 `renameFile`。不改 `parser.ts` 对源文件缺失的检查（第 228–229 行）。不改 `createEditConfirmation` 的工作区自动批准。不把「移动」补成删除源文件。
- 怎样本地验证：`extensions/copilot/src/extension/tools/test/node/applyPatch/applyPatch.spec.tsx` 已有 `applies a move when the source and destination are allowed`、`rejects a content-excluded move destination before emitting edits`、`rejects a move destination outside allowedEditUris before emitting edits`、`makes changes atomically`、`replaces the full document when update shortens content and trailing empty lines decrease` 必须仍通过。在同一 suite 新增断言：源用现有夹具，目标是 `TestWorkspaceService` 里另一个已打开文档；`invoke` 的 `hasError` 为 true，`editedUris` 为空。命令：`npm run test:unit -- src/extension/tools/test/node/applyPatch/applyPatch.spec.tsx`（在 `extensions/copilot`）。

## r12-3

- 问题类：`update.downloadUpdate`、`update.installUpdate`、`update.restartToUpdate` 无参数时不返回工具确认文案；更新状态已经满足时，这三条会下载、安装或退出并重启。
- 降级：发现稿为高，降为中。
- 反证：`git.stash` 与 `git.stashStaged` 都进 `_stash`。`extensions/git/src/commands.ts` 第 4519–4526 行必定 `showInputBox`，取消则 return false，不会 `createStash`。第 4560–4566 行 `git.stashPop` 先 `pickStash`，未选择则 return，不会 `popStash`。直接 `popStash` 的是 `git.stashPopLatest`（第 4572–4581 行），它不在免确认名单里。`VSCodeCmdTool.invoke` 第 121–133 行会按 precondition 过滤，对不上就不执行。这三条更新命令的 precondition 在 `src/vs/workbench/contrib/update/browser/update.contribution.ts` 第 138、154、170 行。状态对上时，`abstractUpdateService.ts` 第 485–499 行 `downloadUpdate(true)`、第 520–527 行 `applyUpdate`、第 534–557 行 `quitAndInstall` 里 `quit(true)`，工具确认卡不会出现。
- 不变量：`prepareInvocation` 对仍留在 `noConfirmationCommandsWithoutArgs` / `noConfirmationCommandsWithArgs` 里的命令，两个 `if`（第 167–173 行）的结构不变：无参数只返回 `invocationMessage`。`update.downloadUpdate`、`update.installUpdate`、`update.restartToUpdate` 无参数时必须落到现有的 `confirmationMessages`（含 `title`）。`invoke` 仍是 `executeCommand`。
- 要动的符号或文件：`extensions/copilot/src/extension/tools/node/vscodeCmdTool.tsx` 的 `noConfirmationCommandsWithoutArgs`，去掉上述三条 `update.*`（现位于第 58–60 行）。
- 明确不改什么：`git.stash`、`git.stashStaged`、`git.stashPop`、`git.stashView`、`git.showOutput`、`update.checkForUpdate` 留在免确认集合。不改 `extensions/git` 的命令实现，不改 `src/vs/platform/update` 的下载、安装和退出。不改 `invoke`。不改两个 `if` 的结构。
- 怎样本地验证：`extensions/copilot/src/extension/tools/node/test/vscodeCmdTool.spec.ts` 的 suite `VSCodeCmdTool prepareInvocation confirmation`。已有 `requires confirmation for git.stageAll, git.stashPopLatest, and git.rebaseAbort without args`、`requires confirmation for git.stage with and without args`、`does not require confirmation for git.stash, git.stashPop, and git.showOutput without args` 必须仍通过。在同一 suite 新增断言：这三条 `update.*` 在 `args` 为空时 `confirmationMessages.title` 有值。命令：`npm run test:unit -- src/extension/tools/node/test/vscodeCmdTool.spec.ts`（在 `extensions/copilot`）。

## r12-4

- 问题类：`MemoryTool._localStrReplace` 用 `String.prototype.replace` 写入 `new_str` 时，`$&`、`$'`、`` $` ``、`$$` 会被替换成匹配文本或前后文。
- 不变量：唯一匹配时，文件新内容等于匹配前的前缀 + `new_str` 的原始字符 + 匹配后的后缀。`hello world` 中把 `world` 换成 `cost $& end` 得到 `hello cost $& end`；换成 `tail $'` 得到 `hello tail $'`；换成 `` pre $` `` 得到 `` hello pre $` ``；换成 `$$` 得到 `hello $$`。零次匹配与多次匹配仍返回现有错误文案，不写文件。
- 要动的符号或文件：`extensions/copilot/src/extension/tools/node/memoryTool.tsx` 第 628 行。在已确认只有一处匹配后，用 `indexOf` 得到下标，用 `slice` 拼接写入。不要把 `new_str` 交给 `replace` 的字符串替换符。
- 明确不改什么：不改第 606–626 行的次数检查与错误文案。不改 `_localInsert`（第 664–667 行的 `splice`）。不改第 112、115 行对路径的 `replace`。
- 怎样本地验证：`extensions/copilot/src/extension/tools/node/test/memoryTool.spec.tsx` 已有 `str_replace replaces unique text`、`str_replace fails when text not found`、`str_replace fails on multiple occurrences` 必须仍通过。在同一文件用现有 `invokeMemoryTool` 与 `mockFs.mockFile` 新增断言：`new_str` 分别为 `cost $& end`、`tail $'`、`` pre $` ``、`$$`，再经 `IFileSystemService.readFile` 读回，内容与上面的不变量一致。命令：`npm run test:unit -- src/extension/tools/node/test/memoryTool.spec.tsx`（在 `extensions/copilot`）。

## r12-5

- 问题类：新建 notebook 时，闭合代码围栏抽出的正文在下一行被原始输入覆盖，围栏进入 `processFullRewriteNewNotebook`。
- 不变量：notebook 分支在 `CodeBlockProcessor` 的回调写入 `content` 并 `flush` 之后，对这个 `content` 做 `removeLeadingFilepathComment`，再把结果传给 `processFullRewriteNewNotebook`。有闭合围栏时，输出不含围栏；围栏内首行若是 `getFilepathComment(languageId, filePath)`，该行也不留下。没有围栏时，`content` 仍是原始输入，filepath 注释仍按现有函数去掉。未闭合围栏时回调不触发（`codeBlockProcessor.ts` 第 315–317 行才 `_emitCodeblock`，`flush` 第 344–351 行不补发），结果仍是原始输入。
- 要动的符号或文件：`extensions/copilot/src/extension/tools/node/createFileTool.tsx` 第 107–111 行。把围栏提取与 `removeLeadingFilepathComment` 收成该文件的导出纯函数，对变量 `content` 做注释剥离，notebook 分支把函数结果传给 `processFullRewriteNewNotebook`。
- 明确不改什么：不改非 notebook 分支第 116 行（它没有围栏提取，继续用 `options.input.content`）。不改 `CodeBlockProcessor`。不改 `removeLeadingFilepathComment`。
- 怎样本地验证：没有 create-file 的现成测试。把第 107–111 行收成 `createFileTool.tsx` 的导出纯函数（notebook 分支改为调用它），在 `extensions/copilot` 下新增 `*.spec.ts` 断言该函数：闭合围栏加 `getFilepathComment` 首行时，输出是围栏内其余正文；无围栏且以 filepath 注释开头时，输出去掉该注释；未闭合围栏时输出等于原始输入。命令：`npm run test:unit -- <该 spec 相对 extensions/copilot 的路径>`（在 `extensions/copilot`）。
