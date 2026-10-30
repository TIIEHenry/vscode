---
title: "十六路审查 r15：copilot 扩展方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "hold 3，weaken 1，drop 1。"
---
# 十六路审查 r15：copilot 扩展方案

状态：草案。
覆盖需求：无（正文未引用需求编号）。

对照 `extensions/copilot` 活码后的改法。只描述要改的行为，不改代码。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r15-1 | hold | 高 | 删除批量索引仍在队列外，读失败会写成 `{}` |
| r15-2 | hold | 高 | `state.json` 刷盘仍会清掉期间的 dirty，并先删后改名 |
| r15-3 | weaken | 低 | 原为中。空 `catch` 还在，但只在遗留 v1 且关闭自动提交的路径 |
| r15-4 | hold | 中 | `stat` 已存在仍会在打开失败后继续插入或重写 notebook |
| r15-5 | drop | 中 | 不是问题。`remoteContentExclusion.spec.ts` 的 `matches fetched globs against every file rather than only their own repository` 把跨仓库 glob 过阻断钉成可接受结果（sibling 必须为 true）。组织级规则另有 `applies organization rules to files inside and outside a repository` |

### r15-1

问题类：删除一条 CLI 会话时，批量索引的整文件覆盖不进 `_bulkSequencer`，读失败会把文件写成空对象。

不变量：

- 删一个会话不得让批量文件里其它会话消失。
- `getGlobalStorageData` 抛错时不得调用 `writeToGlobalStorage` 写 `{}` 或任何由空对象变来的内容；原文件保持不动。
- `deleteSessionMetadata` 对批量文件的读改写与 `updateGlobalStorageImpl`、`reloadBulkFromDisk` 共用 `BULK_SEQUENCER_KEY`，一次只跑一个。
- 删除墓碑在让出队列之前就记上，包括 `_cache.delete` 的同一段同步代码。`SequencerByKey.queue` 是在当前轮之后才跑回调。已经排在前面的 `updateGlobalStorageImpl` 或 `reloadBulkFromDisk` 若只看 `_cache`，会在墓碑写下之前把磁盘条目补回。补回条件 `!local` 必须同时看墓碑。`modified` 比较只在 id 已经在内存时才跑，挡不住这条补回。
- 读失败而原文件仍留着该会话时，随后的 `updateGlobalStorage` 和 `refresh` 都不得把该 id 从磁盘重新采纳回 `_cache`。新断言不能只覆盖 `updateGlobalStorage` 返回之后。
- 启动后 `getSessionIdsForFolder` / `getWorktreeSessions` 仍只反映这份批量索引里还在的会话。未删除会话的文件夹与 worktree 对应关系要还在。

要动的符号或文件：

- `extensions/copilot/src/extension/chatSessions/copilotcli/vscode-node/chatSessionMetadataStoreImpl.ts`
- `ChatSessionMetadataStore.deleteSessionMetadata`
- `updateGlobalStorageImpl`（补回磁盘条目时要认删除墓碑，或等价地不要复活已删 id）
- 现有的 `_bulkSequencer` / `BULK_SEQUENCER_KEY`
- `getGlobalStorageData`、`writeToGlobalStorage` 的调用方式，不是这两个函数的裁剪逻辑

明确不改什么：

- 单会话 `vscode.metadata.json` 的 `replaceMetadataFile`。
- `refresh` / `reloadBulkFromDisk` 的「磁盘 `modified` 更新则覆盖内存」规则，除了已删 id 不得被补回。
- `MAX_BULK_STORAGE_ENTRIES` 的裁剪。
- `getSessionIdsForFolder`、`getWorktreeSessions`、`_updateFolderIndex` 的查找结构。
- `writeToGlobalStorage` 仍直接 `writeFile`。这一条用「读失败不写」挡住空覆盖，不改它的写文件方式。
- 不实现 `WorktreeSessionEntry`。接口注释里的 `vscode.session.worktree.jsonl` 没有被这个类读写。

怎样本地验证：

在 `extensions/copilot` 下跑 `npm run test:unit -- src/extension/chatSessions/copilotcli/vscode-node/test/chatSessionMetadataStoreImpl.spec.ts`。

现有用例保持通过：`should handle deleting non-existent session gracefully`、`should trigger bulk storage update after delete`、`refresh() never drops in-memory entries that are not on disk`、`keeps the entry with the higher modified timestamp`。

应新增的断言：

- 批量文件里已有其它会话时，`getGlobalStorageData` 抛错，`deleteSessionMetadata` 返回后该文件字节不变，不能是 `{}`。
- 一个会话已在内存、尚未刷盘，同时删除另一个已在盘上的会话；两边都结束后，新会话仍在文件里，被删会话不在。
- 用这份文件重新构造 store（走 `initializeStorage`）后，`getSessionIdsForFolder` 与 `getWorktreeSessions` 仍包含未删除会话，不包含已删除会话。
- 删除时读盘失败、文件里仍有该会话，随后 `updateGlobalStorage` 和 `refresh` 都成功时，被删 id 不得重新出现。墓碑必须在进入队列之前就能被已经排队的合并看见。

### r15-2

问题类：工作区录制的 `state.json` 在刷盘过程中把新的 `setValue` 标成已落盘，并且先删原文件再改名。

不变量：

- `flushAsync` 在第一次让出之前拍下的内容，只能代表那一次写入。等待写盘期间发生的 `setValue` 必须留下 dirty。
- 这次写入若失败，dirty 保持 true。
- 替换目标文件前若又有更新的 `setValue`，这次不得把旧内容换成目标文件。
- 正式文件已经存在时，禁止先 `unlink` 再 `rename`。新内容就位之前，正式路径仍是上一份完整文件。
- `loadOrCreate` 仍只读正式路径，不读 `.new`。正式文件已经存在时，崩溃后仍能读到旧文件或改名后的新文件。正式文件还不存在时，先 `writeFile` 到 `.new` 再 `rename` 的窗口里崩溃会只留下 `.new`。首次创建改为直接写正式路径，避免这条窗口。
- 退出时 `WorkspaceRecorderImpl._forceFlush` 调用的 `flushSync` 必须能写出尚未落盘的最新 `_value`，包括异步刷盘进行中又 `setValue` 的那次。
- `flushAsync` 与 `flushSync` 今天共用同一个 `filePath + '.new'`，且 `_forceFlush` 不等待进行中的 `flushAsync`。代数检查挡不住后写的临时文件盖掉先写的。两次刷盘使用不同的临时文件，或在改名之前互斥。过期的 `flushAsync` 不得在 `flushSync` 之后把旧内容盖回目标。

要动的符号或文件：

- `extensions/copilot/src/extension/workspaceRecorder/vscode-node/safeFileWriteUtils.ts` 的 `FlushableJSONFile.flushAsync` 与 `FlushableJSONFile.flushSync`
- `setValue` 需要一个代数（或等价的「这次写入是否仍是最新值」）
- `extensions/copilot/src/extension/workspaceRecorder/vscode-node/workspaceRecorder.ts` 的 `_scheduleFlush`、`_forceFlush` 不改队列结构；它们继续调用上述两个 flush

明确不改什么：

- `FlushableSafeJSONLFile` 的按批追加、`_lock`、失败保留批次。
- `TaskQueue.clearPending`「不取消正在跑的任务」的语义，以及 10 秒延迟。
- `loadOrCreate` 不改成去读 `.new`。
- `workspaceRecorder._getId` 里登记 document 的条件。

怎样本地验证：

在 `extensions/copilot` 下跑 `npm run test:unit -- src/extension/workspaceRecorder/vscode-node/test/safeFileWriteUtils.spec.ts`。

现有用例保持通过：`keeps the batch when appendFile rejects and writes it once on the next flush`、`leaves entries appended during an in-flight write queued after that batch`、`keeps the batch when appendFileSync throws and writes it on the next flushSync`。该文件今天没有 `FlushableJSONFile` 用例。

应新增的断言：

- `flushAsync` 停在写临时文件时 `setValue` 换上新文档表；这次 flush 结束后 dirty 仍为 true，再 flush 一次后磁盘是新表。
- 同上窗口里立刻 `flushSync`（对应 `_forceFlush`），磁盘是新表；随后过期的 `flushAsync` 结束时不得把旧表盖回去。
- 正式文件已存在时，替换过程中不删除目标路径；原文件在新文件就位前仍可按原路径读到上一份内容。`flushSync` 同样不得先删目标。`flushAsync` 与 `flushSync` 的临时文件路径不同，或两次改名互斥。

### r15-3

问题类：遗留工作树在单个文件的 short stats 抛错时，把该文件从变更列表里丢掉。

反证与降级：原严重度中，降为低。

- `getWorktreeChanges` 只在 `version === 1 && autoCommit === false` 时调用 `_getWorktreeChangesFromIndex`。旁边注释写的是 Legacy。
- `_createWorktree` 新建的工作树是 `version: 2`。`CLIAutoCommitEnabled` 默认 `true`。
- `version === 2 && autoCommit === true` 走 `_getWorktreeChangesFromCommits`，或在 Agent Sessions 工作区走 `_getWorktreeChanges`。这两条都没有这个空 `catch`。
- `diffIndexWithHEADShortStats` 在 git API 没有该方法时返回 `undefined`，不抛错。调用方用 `insertions ?? 0` 与 `deletions ?? 0`，文件仍留在列表里。少文件只发生在该方法 reject 时。
- 空 `catch` 仍在 `_getWorktreeChangesFromIndex` 的循环里，没有日志。核心还在，影响面是仍停在 v1 且关闭自动提交的旧会话。

不变量：

- 该循环里单个文件的 `diffIndexWithHEADShortStats` 抛错时，这个文件仍出现在返回数组里，路径按现在的 `indexChanges` / `workingTree` 规则填写。
- 同一次调用里其它文件的统计不受影响。
- 错误要进现有 `logService`，不能再空吞。
- 统计拿不到时增删行数用 0。类型上没有单独的错误字段，0 只表示这次没拿到统计，并由日志区分。

要动的符号或文件：

- `extensions/copilot/src/extension/chatSessions/vscode-node/chatSessionWorktreeServiceImpl.ts` 的 `ChatSessionWorktreeService._getWorktreeChangesFromIndex`

明确不改什么：

- 不改 `ChatSessionWorktreeFile`，不加错误字段。`_toChatSessionChangedFile2` 只把增删行数交给 `vscode.ChatSessionChangedFile`，没有错误槽。
- 不改 `_getWorktreeChangesFromCommits`、`_getWorktreeChanges`，也不把 v2 自动提交路径改成同一套 `try/catch`。
- 不改 `getWorktreeChanges` 外层「整次 diff 失败则返回空列表并打 warn」的分支。那是另一条路径。
- 不把 `untrackedChanges` 并进这个循环。

怎样本地验证：

没有覆盖 `_getWorktreeChangesFromIndex` 的现有测试。`worktreeSharing.spec.ts` 不测这条。

应新增的断言：构造 `version: 1` 且 `autoCommit: false` 的工作树属性，索引里两个文件，其中一次 `diffIndexWithHEADShortStats` reject。`getWorktreeChanges` 的结果仍包含两个文件的路径；失败的那个增删为 0；另一次成功的统计保持原值。`version: 2` 且 `autoCommit: true` 的调用不进入 `_getWorktreeChangesFromIndex`。

### r15-4

问题类：建文件工具在 `stat` 已确认路径存在时，仍会因为打开失败而跳过「文件已存在」并继续写入。

不变量：

- `fileExists` 为 true 时，`invoke` 抛出现有的「文件已存在」错误（notebook 与普通文件各用现在的那句），并且不再发出编辑。
- 这个判断只看 `fileExists`，不看 `doc` 是否打开成功，也不看 `getText()` 是否非空。打开抛错时 `doc` 现在会留在 `undefined`，`fileExists && !!doc?.getText()` 为假，于是落到后面的插入或 notebook 重写。空的 `getText()` 今天同样会被跳过。
- 磁盘上不存在、但内存里仍有非空文档时，仍用整篇 `TextEdit.replace` 覆盖，不改成拒绝，也不改成在文件头插入。

要动的符号或文件：

- `extensions/copilot/src/extension/tools/node/createFileTool.tsx` 的 `CreateFileTool.invoke`
- 继续用现有的 `fileExists`（`fileSystemService.stat`）

明确不改什么：

- `!fileExists && doc && doc.getText().length > 0` 时的 `TextEdit.replace`（注释里的过期内存缓冲）。
- `extractNotebookCreateFileContent`、`prepareInvocation`、`handleToolStream`。
- 打开失败以外的创建路径：磁盘不存在且没有内存正文时，仍是 `TextEdit.insert` 在 `(0, 0)`；notebook 仍走 `processFullRewriteNewNotebook`。
- 不把「二进制文件一定会让 `openTextDocument` 抛错」写成条件。拒绝发生在 `stat` 成功之后。

怎样本地验证：

`extensions/copilot/src/extension/tools/node/test/createFileTool.spec.ts` 只覆盖 `extractNotebookCreateFileContent`（`strips fenced code and leading filepath comment inside the fence`、`removes filepath comment when there is no fence`、`returns raw input when fence is not closed`）。这些保持通过。没有 `invoke` 用例。

在 `extensions/copilot` 下跑 `npm run test:unit -- src/extension/tools/node/test/createFileTool.spec.ts`。

应新增的断言：

- `stat` 成功，`openTextDocumentAndSnapshot` 抛错：`invoke` 抛出已存在错误，不调用 `stream.textEdit`。
- `stat` 成功，`hasSupportedNotebooks` 为真且 `openNotebookDocumentAndSnapshot` 抛错：`invoke` 抛出 notebook 那句已存在错误，不调用 `processFullRewriteNewNotebook`。
- `stat` 失败，打开结果是非空文档：仍发出覆盖全篇的 `TextEdit.replace`，不抛已存在。

## 审查

2026-10-30 只读审查的结论是须改稿，Critical 无。Important 已改：r15-1 的删除墓碑必须在让出队列之前可见，`refresh` 的 `!local` 补回也要认墓碑；r15-2 把「崩溃后不能只剩 `.new`」收成正式文件已存在时的约束，首次创建直接写正式路径，并且 `flushAsync` 与 `flushSync` 不得共用同一个临时文件。
