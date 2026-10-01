---
title: "方案 r10：workbench-shell"
type: plan
status: accepted
phase: N/A
updated: 2026-10-01
summary: "2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。空数组不再吃到 stable 未设置实验的全放行；另存为先确认再替换并在失败时还原；文件不存在的还原保持脏和备份；磁盘写入失败不再改编辑器缓冲。"
---

# 方案 r10：workbench-shell

核对发现稿时，r10-2、r10-3、r10-4 的引用行仍是所述行为。r10-1 的 `() => true` 仍在，但「未设置即全放行」对非空名单是现有测试和注释里的默认，降级后只改空数组。只读审查后，r10-2 改为直接 `write` 并在失败时 `overwrite` 移回，避免对缺失路径 `del`，也避免留下会再次保存的脏模型。

## r10-1（weaken）

反证：`resolveEnabledApiProposalsFallbackExperiment` 第 412–415 行写的是回落到 `undefined` 会保持今天的行为，下次启动再从缓存读。`setEnabledApiProposalsFallbackExperiment` 的 JSDoc 第 432 行写明未设置时允许全部提案。`src/vs/workbench/services/extensions/test/common/extensions.test.ts` 的 `missing experiment allows all proposals on stable by default`（第 66–80 行）把 `undefined` + `stable` + 非空 `enabledApiProposals` 断言为 true，把名单为 `undefined` 断言为 false。`raceTimeout` 到点 resolve 成 `undefined`，读取抛错走同文件第 417–418 行的 catch，两条都进入这个「未设置」默认。发现稿写的「注释会保持原有限制」和「`value` 为 `undefined` 时不要安装解析器」与上述注释和测试相反。仍成立的是：`extensionsProposedApi.ts` 第 110–113 行把非内置扩展的名单赋成 `[]` 并注明不能使用提案；`isProposedApiEnabled` 第 327 行只把 `null` / `undefined` 当拒绝，空数组会继续问解析器；未设置时的解析器是第 455–456 行的 `() => true`，于是空数组上每个提案都返回 true。同文件 JSDoc 第 427–428 行要求至少声明过一个提案，空数组长度是 0。

- 问题类：stable 上实验未设置时，提案名单已被收成空数组的扩展仍被放行全部 proposed API。
- 不变量：品质是 `stable` 且实验值为 `undefined` 时，非空 `enabledApiProposals` 仍对未列入的提案返回 true；名单为 `undefined` 仍返回 false。实验值为 `none` 时，走到回退的提案全部返回 false。实验值是明确的 `publisher.extension:proposal` 时，该组合返回 true，即使当前名单是空数组。空数组且实验值为 `undefined` 时，`isProposedApiEnabled` 返回 false。
- 要动的符号或文件：`setEnabledApiProposalsFallbackExperiment`（`src/vs/workbench/services/extensions/common/extensions.ts` 第 455–457 行）。`value === undefined` 的解析器改为：`enabledApiProposals.length > 0` 时返回 true，空数组返回 false。逗号名单和 `none` 仍走 `allowed.has`。同步改第 432 行 JSDoc：未设置时，只对非空名单放行全部提案；空数组不放行。第 412–415 行改成「`undefined` 表示未设置，默认行为见 `setEnabledApiProposalsFallbackExperiment` 的 JSDoc」。不要保留 keeps today's behavior 的字面：今天的行为包含空数组也被 `() => true` 放行，与新不变量相反。第 427–428 行只描述名单为 `undefined` 的拒绝，不拿它去收紧逗号名单。
- 明确不改什么：不在 `value === undefined` 时跳过安装解析器。不改 `resolveEnabledApiProposalsFallbackExperiment` 的 5 秒上限、超时得到 `undefined`、以及 catch 返回 `undefined`。不改非 `stable` 直接 `Disposable.None`。不改 `ExtensionsProposedApi.doUpdateEnabledApiProposals` 把名单赋成 `[]`。不改 `enabledApiProposals` 为 `undefined` 时第 327 行的直接拒绝。空数组配上明确的 `publisher.extension:proposal` 时，该提案仍由 `allowed.has` 放行。
- 怎样本地验证：`scripts/test.sh --run src/vs/workbench/services/extensions/test/common/extensions.test.ts`。现有 `missing experiment allows all proposals on stable by default`、`none experiment blocks all proposals that reach the fallback`、`experiment enables a declared-but-missing proposal on stable, honoring the declared value otherwise`、`experiment does not grant access to extensions that declare no proposals` 保持通过。新增断言：`enabledApiProposals: []` 且 `setEnabledApiProposalsFallbackExperiment(undefined, 'stable')` 时任意提案为 false；同一空数组、实验值为 `test.missing:someProposal` 时 `someProposal` 为 true、其它提案为 false。

## r10-2（hold）

- 问题类：关联路径上的未命名文档覆盖已有二进制或超大文件时，先删除再写，覆盖确认不会出现，写入失败后原字节已经不在目标路径上。
- 不变量：仅当源是带关联路径的 `UntitledTextEditorModel`，且目标等于 `toLocalResource(sourceModel.resource, remoteAuthority, defaultUriScheme)` 时，才在移动前调用 `confirmOverwrite`。用户取消则不移动、不删除、不写入，返回 false。其它目标不弹这次确认。确认通过，或本来就不必确认时，先把目标 `move` 到同目录临时名。`move` 抛错则原样抛出，不写目标。然后用本类已有的 `write` 把源模型文本写到目标，并带上源编码。`write` 成功后才删除临时文件，然后 `return true`，不得落到该 `if` 外面 `throw error`（约第 543 行）。否则磁盘已是源文本，保存仍以原来的 `FILE_IS_BINARY` / `FILE_TOO_LARGE` 失败，未命名源也不会被 revert。`write` 抛错且移回成功后，抛出写入错误；移回抛错则保留临时文件并抛出移回错误，不得先删临时文件。移回调用 `move(临时, 目标, true)`。`IFileService.move` 第三参默认 false，目标已存在时抛 `FILE_MOVE_CONFLICT`（`fileService.ts` 约第 940 行）。磁盘写入会先创建目标路径再写完字节，失败断言必须落在目标路径已经存在之后。这条路径不递归 `doSaveAsTextFile`，不为目标解析文本模型，因此不会走到 `updateModel` 后 `save()` 返回 false、把模型留在脏和错误态，也不会调用 `saveErrorHandler.onSaveError`。
- 要动的符号或文件：`AbstractTextFileService.doSaveAsTextFile`（`src/vs/workbench/services/textfile/browser/textFileService.ts` 第 532–540 行）。第 552–553 行的关联路径判断抽成私有方法，在 `FILE_IS_BINARY` / `FILE_TOO_LARGE` 分支里、移动目标之前调用。移动和移回用现有 `IFileService.move`。临时名用 `src/vs/base/common/uuid.ts` 的 `generateUuid`（`textFileService.ts` 目前未导入）和已导入的 `joinPath` / `dirname`，不新增导出。源文本和编码沿用同方法第 502–507 行、第 562–569 行已有的取法，写入走第 266 行的 `write`。
- 明确不改什么：不改 `save` 对 `hasAssociatedFilePath` 跳过保存对话框（第 359–362 行）和 `suggestSavePath` 把关联未命名资源收成本地路径（第 667–668 行）。不改目标能按文本解析时，现有 `confirmOverwrite` 的文案、按钮，以及随后 `updateModel` 加 `targetModel.save`。不给已经由保存对话框选定的其它目标再弹一次覆盖确认。不改 `confirmOverwrite` 返回 false 时 `doSaveAs` 得到 `undefined`、且不 `revert` 源文档。不把 `fileService.del` 用在不存在的路径上（`fileService.ts` 第 1072–1073 行会对缺失文件抛 `FILE_NOT_FOUND`）。不新做文件操作的 undo 栈。
- 怎样本地验证：仓内没有这条覆盖路径的测试。在 `src/vs/workbench/services/textfile/test/browser/` 新增断言：未命名模型带关联路径，目标就是 `toLocalResource` 的那条路径，且 `resolve` 抛出 `TextFileOperationResult.FILE_IS_BINARY` 或 `FileOperationResult.FILE_TOO_LARGE`。取消确认后目标字节不变，不出现临时文件。确认后目标变为源文本，临时文件不留，`saveAs` 解析为目标 URI 而不是拒绝。新测试用 `FileService` + `TestInMemoryFileSystemProvider`（或同等会真正 `rename` / `delete` 的提供者），不要用 `TestFileService`：它的 `move` / `del` 是空操作，`exists` 对未记入 `notExistsSet` 的 URI 返回 true，字节还原在当前先 `del` 的实现上也不会失败。取消用例要能看见当前实现已经把目标删掉。`write` 抛错后目标字节与移动前一致，不存在以该目标为 resource 的脏文本模型，`saveErrorHandler.onSaveError` 未被调用。目标不是这条关联路径时不调用 `confirmOverwrite`。用 `scripts/test.sh --run` 跑该新测试文件。

## r10-3（hold）

- 问题类：已删除文件上的还原把脏标记清掉并丢掉热退出备份，缓冲里的未保存文本还在，关闭时不再询问保存。
- 不变量：非软还原读到 `FILE_NOT_FOUND` 时，调用已有的 `undoSetDirty()`，把 `dirty`、冲突、错误和已保存版本号恢复成读盘前的值，然后抛出原来的错误。不触发 `_onDidRevert`，也不触发这次「变为不脏」的 `_onDidChangeDirty`。模型文本保持还原前的内容。文件不存在标记保持读盘失败时已经设上的 orphaned。其它读盘错误仍恢复脏标记并抛出。软还原仍不读盘，并继续把脏标记清掉。关闭时「不保存」若这次 `revert` 抛错，仍按 `editorGroupView` 第 1874–1882 行再做一次 `soft: true`，从而能关掉编辑器。
- 要动的符号或文件：`StoredFileWorkingCopy.revert`（`src/vs/workbench/services/workingCopy/common/storedFileWorkingCopy.ts` 第 1309–1318 行）和 `TextFileEditorModel.revert`（`src/vs/workbench/services/textfile/common/textFileEditorModel.ts` 第 269–278 行）。两处都删掉对 `FILE_NOT_FOUND` 的吞掉分支，与同函数里其它错误一样 `undo` 后抛出。普通文本编辑器和文本型自定义编辑器走 `textFileService.revert` → `TextFileEditorModel.revert`（`customTextEditorModel.ts` 第 107–108 行）。笔记本文件走 `StoredFileWorkingCopy.revert`（`notebookEditorModel.ts` 第 123–125 行）。两处一起改。
- 明确不改什么：不改 `forceResolveFromFile` 传入 `forceReadFromFile: true`（`storedFileWorkingCopy.ts` 第 816–817 行）。不改非强制 `resolve` 在已解析且 `FILE_NOT_FOUND` 时直接 return（第 649–650 行，文本模型在 `textFileEditorModel.ts` 第 507–508 行）。不改 `WorkingCopyBackupTracker.onDidChangeDirty`：不脏就 `discardBackup`，脏就 `scheduleBackup`（第 142–146 行）。不改软还原。不改关闭确认里「保存失败再问一次」和「不保存时先 revert、失败再软还原」。
- 怎样本地验证：`scripts/test.sh --run src/vs/workbench/services/workingCopy/test/browser/storedFileWorkingCopy.test.ts`。同一测试 `revert` 里，软还原、非强制还原、强制还原和 `FILE_PERMISSION_DENIED` 的断言保持通过。改写「file not found error is ignored」：`revert({ force: true })` 拒绝；`onDidRevert` 计数保持 2；`isDirty()` 为 true；模型内容仍是 `hello revert`。`scripts/test.sh --run src/vs/workbench/services/textfile/test/browser/textFileEditorModel.test.ts`。为 `TextFileEditorModel.revert` 新增断言：已解析且脏，`setReadStreamErrorOnce` 注入 `FILE_NOT_FOUND` 后 `revert({ force: true })` 拒绝，`isDirty()` 为 true，编辑器文本不变，`onDidRevert` 不触发；`revert({ soft: true })` 仍把 `isDirty()` 变成 false。

## r10-4（hold）

- 问题类：代理对已有文件提供者的写入失败后仍改已打开的文本模型，并让 `write` 成功返回。
- 不变量：`createFile` / `writeFile` 抛错且 `fileService.hasProvider(uri)` 为 true 时，把原错误抛出，不调用 `_writeVirtual`，已打开模型的文本不变。没有文件提供者时，仍用 `_writeVirtual`：可写模型 `setValue` 并让 `write` 成功返回；只读、解码失败或解析失败则返回 false 并抛出原来的磁盘错误。`createOnly` 撞上已存在文件时同样抛出，不改缓冲。
- 要动的符号或文件：`AgentHostResourceService.write`（`src/vs/workbench/services/agentHost/common/agentHostResourceService.ts` 第 161–172 行）。catch 里先看 `this._fileService.hasProvider(uri)`，有提供者则 `throw err`。无提供者才 `await this._writeVirtual(uri, buf)`。
- 明确不改什么：不改 `_writeVirtual` 对 `isReadonly()` 返回 false、以及 `setValue` 的文本写入。不改 `read` 的 `_readVirtual` 和 `stat` 的 `_statVirtual`。不改 `_gate` 的权限拒绝。不改 `src/vs/platform/agentHost/node/agentService.ts` 里已经把 `createOnly` 冲突抛成 `AlreadyExists` 的宿主写入。不改 Base64 与 UTF-8 的组包。
- 怎样本地验证：`src/vs/workbench/services/agentHost/test/common/agentHostResourceService.test.ts` 现有用例不覆盖 `write`。在该套件新增断言：`hasProvider` 为 true 且 `writeFile` 或 `createFile` 拒绝时，`write` 拒绝，文本模型 `setValue` 未被调用，已有缓冲文本不变；`createOnly: true` 且 `createFile` 因文件已存在拒绝时同样不调用 `setValue`；`hasProvider` 为 false 且模型可写时 `setValue` 收到代理文本并且 `write` 成功返回；模型只读时 `write` 仍拒绝。用 `scripts/test.sh --run src/vs/workbench/services/agentHost/test/common/agentHostResourceService.test.ts` 跑。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：r10-2 写成功并删掉临时文件之后 `return true`，不得落到约第 543 行的 `throw error`。Minor：字节用例不用 `TestFileService`；第 412–415 行不再保留 keeps today's behavior。均已写入正文。

2026-09-30 第二轮。无 Critical。Important：移回改为 `move(临时, 目标, true)`。目标已存在且第三参为 false 时 `fileService.move` 抛 `FILE_MOVE_CONFLICT`。失败断言落在目标路径已经存在之后。均已写入正文。

2026-09-30 用户签收。`accepted`。未实施。
