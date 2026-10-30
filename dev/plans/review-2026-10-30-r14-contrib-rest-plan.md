---
title: "十六路审查 r14：contrib 其余方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "保留 5 条：hold 4，weaken 1。"
---

# 十六路审查 r14：contrib 其余方案
状态：草案。
覆盖需求：无（正文未引用需求编号）。

核对范围是发现稿里的 5 条。引用都在 `src/vs/workbench/contrib` 的 comments、files、extensions、git、search，没有落在禁读目录，也没有越出 contrib。

| 编号 | 判定 | 严重度 |
|---|---|---|
| r14-1 | hold | 高 |
| r14-2 | hold | 高 |
| r14-3 | hold | 中 |
| r14-4 | hold | 中 |
| r14-5 | weaken | 提示 |

### r14-1

问题类：本窗口启动不把已保存的未发送评论草稿读进 `_continueOnComments`，随后每次工作台 `flush` 用一份只含当前控件的新表覆盖存储。

不变量：

- 构造 `CommentService` 时，若工作区存储里已有 `comments.continueOnComments`，立刻读进 `_continueOnComments`。工作台打开前已经 `await storageService.initialize()`，所以构造时读得到。原因不是 `InstantiationType.Delayed`。`getObject` 走 `marshalling.parse`，URI 会还原，沿用这条，不要另写序列化。`_addContinueOnComments` 在同一 `uniqueOwner` + uri + range 已存在时直接跳过，不换正文。构造时空表载入可以用它。保存路径若要把控件里改过的正文写回去，不能只用它做「叠上」。
- `onWillSaveState` 的底稿是 `_continueOnComments` 的副本，再叠上各 provider 的结果。清空和覆盖都改这份即将写回的地图，然后 `_saveContinueOnComments` 把它写出，并让内存表等于这份结果。`removeContinueOnComment` 只改服务自己的表，不改调用方手里的拷贝。先改原表再把旧拷贝赋回去，清空项会复活。`storageService.flush` 在空闲和关闭时都会触发，空闲保存也要遵守这条。
- 仍挂着的 zone：未发送正文（与 `provideContinueOnComments` 现有判断相同，正文存在且不等于最后一条评论）按 `uniqueOwner` + uri + range 写进这份结果地图。该 zone 明确没有这份正文时，从这份结果地图里删掉对应项。
- 控件还没建出来、编辑器模型上没有对应 zone 时，不得因为 provider 返回空数组就删掉该 uri 上已有草稿。
- `_inProcessContinueOnComments` 里已有 uri 和 range 的草稿，保存时进地图。`_pendingNewCommentCache` 的值是 `PendingComment`，只有 `body` 和 `cursor`，按 `threadId` 存放，没有 uri 和 range。保存时只有仍能从挂着的 zone 取到 uri 和 range，才能把这份正文写进地图。`onDidChangeModel` 在 `setModel` 已经换成新模型之后才到，这时 `getModel()` 不是这份草稿的文件。不要要求 `removeCommentWidgetsAndStoreCache` 用这份缓存拼出 `PendingCommentThread` 再 `removeContinueOnComment`。
- 编辑器销毁先 `_detachModel()`，不发 `onDidChangeModel`，然后才卸 contribution。控制器 `dispose` 跑起来时模型已经空，`getModel()!.uri` 会抛。未发送正文要在模型还在时写入服务地图。直接 `dispose` 控制器的测试看不到这条顺序。
- 用户清空后的项必须从写出的那份地图消失，不能在下次保存时从旧地图里复活。外部窗口改存储（`external === true`）的监听保持：只处理外部变更，本窗口自己的 `store`（`external` 默认为 false）不得再走一遍载入。

要动的符号或文件：

- `CommentService` 构造函数：在注册 `onWillSaveState` 之前读入存储。
- `CommentService` 里 `onWillSaveState` 回调：不要 `new Map()` 当唯一来源。保存前先拷贝 `_continueOnComments`，再合并 provider。
- `IContinueOnCommentProvider.provideContinueOnComments` 的实现（`CommentController` 构造里注册的那个）：除 `_commentWidgets` 外，纳入 `_pendingNewCommentCache` 和 `_inProcessContinueOnComments`。对已存在且正文已清空的 zone，让服务删掉对应草稿。
- 编辑器卸模型之前的那次保存，而不是在模型已经空了之后的 `CommentController.dispose` 里读 `getModel()`。

明确不改什么：

- 不改 `Event.debounce` 500ms，也不改 `!v.external` 就返回。
- 不改 `getDocumentComments` 把 `_continueOnComments` 滤进 `pendingCommentThreads` 的方式，也不改 `resumePendingComment`。
- 不改评论是否可见、zen mode、reaction。

怎样本地验证：

- 保持 `src/vs/workbench/contrib/comments/test/browser/commentsControllerResumePending.test.ts` 现有恢复行为。
- 新增浏览器测试（可放在 `src/vs/workbench/contrib/comments/test/browser/commentServiceContinueOn.test.ts`）：构造前 `getObject` 已有另一文件的草稿时，服务内存里能按 uri 取回；随后 `onWillSaveState` 只挂着当前编辑器的另一条草稿时，存储里两条都在。当前 zone 正文被清空后再保存，该 range 从存储消失，未打开文件的草稿仍在。编辑器按真实顺序先卸模型再卸控制器时，卸模型前 zone 上的未发送正文仍在存储里。不要只直接 `dispose` 控制器。
- `scripts/test.sh --grep "continueOn|ResumePending|commentServiceContinueOn"`

### r14-2

问题类：确认替换已有目录后，子文件 `writeFile` 直接覆盖同名内容；取消或子项失败时只删除本次新建的名字，不把已覆盖的旧字节写回。

不变量：

- 顶层目标是目录时，仍然只弹确认、不走 `applyBulkEdit` 删除。`directory confirm does not apply the delete bulk edit` 保持：`deletedExistingFile` 对目录仍为 false。
- 覆盖一个已存在子项之前，用 `resolve` 给出的 `child.resource` 做 `readFile`，留下字节。`uploadChildKey` 只返回名字或小写名字，不是 URI。取消、令牌已取消，或任一子项上传拒绝时，把这些字节写回被覆盖的那个 URI。
- 原来没有的名字仍放进 `created`，失败时 `deleteCreatedUploadTree`。已存在的名字不得放进 `created`。大小写不敏感时不得 `del` 已存在的那一项。
- `Promises.settled` 会等这一批全部落定，再抛出第一个错误，抛出点在 `succeeded = true` 之前。目录本来就不会在子项拒绝后标成功。不要把这个抛出吃掉，否则后面的文件夹子项循环还会继续。写回旧字节挂在现有 `!succeeded` 的 `finally` 上。
- 顶层是文件时的撤销快照、`restoreOverwrittenFile`、`rollbackUpload` 在 `deletedExistingFile` 为 true 时的行为保持。

要动的符号或文件：

- `BrowserFileUpload.doUploadEntry` 的目录分支：在调用子项 `doUploadEntry` 之前，按 `child.resource` 记录已存在子项的字节；`finally` 在 `!succeeded` 时先写回这些字节，再删除 `created`。
- 同方法里 `fileChildEntries` 的 `Promises.settled` 保持现有抛出。拒绝已经让 `succeeded` 停留在 false。
- 嵌套目录继续共用这次上传的「新建名单」和「已覆盖字节」名单，只有 `ownsCleanup` 的最外层目录做恢复。

明确不改什么：

- 不把已有目录先递归删除再上传。
- 不改顶层文件确认后的 `createSnapshot` / `applyBulkEdit` / `deleteUndo.undo()`。
- 不改 `uploadChildKey` 的大小写规则，也不改新目录整树删除（`canceled new directory upload removes the directory and its child file`）。

怎样本地验证：

- 保持 `src/vs/workbench/contrib/files/test/browser/fileImportExportCancel.test.ts` 的 `directory confirm does not apply the delete bulk edit`、`canceled upload into an existing directory removes only names created by this upload`、`canceled new directory upload removes the directory and its child file`、`canceled case-sensitive upload deletes only the new different-cased child`。
- 同文件新增断言：已有目录里的 `old.txt` 原字节为 `[1,2,3]`，拖入同名目录并确认，子文件 `writeFile` 写成新字节后取消，`old.txt` 仍在且字节回到 `[1,2,3]`，本次新建的名字被删掉。再加一条：其中一个子文件 `writeFile` 拒绝且令牌未取消时，已写过的同名旧文件字节同样写回，上传结果为空。
- `canceled case-insensitive upload does not delete the existing child it overwrote` 仍断言不 `del` 已存在子项。写回断言落在 `writeFile` 真正写过的那个 URI 上，覆盖前字节和覆盖后字节必须不同。`Old.txt` 与 `old.txt` 若是两个 map key，写 `old.txt` 不会改到 `Old.txt`。只断言没被写过的那个 URI，不写回也会通过。
- `scripts/test.sh --grep "Browser upload cancel|directory confirm|case-insensitive upload|case-sensitive upload"`

### r14-3

问题类：`eventuallyCheckForUpdates` 把下一次预约写在 `await this.checkForUpdates()` 之后，`getExtensions` 拒绝时循环结束，外层 `.then(undefined, err => null)` 把拒绝吃掉。

不变量：

- `checkForUpdates` 成功、提前 return（gallery 未启用、没有本地扩展、没有可查的 infos）或拒绝，这次回调结束后都再调用 `eventuallyCheckForUpdates()`。
- 拒绝仍要能被现有 `.then(undefined, err => null)` 接住，避免未处理拒绝；预约发生在回调的 `finally`，不依赖这次 Promise 成功。
- 自动检查关闭或连接计量时，现有 `if (this.isAutoCheckUpdatesEnabled())` 仍跳过 `checkForUpdates`，但照样预约下一轮。
- 配置开关、启用状态、产品更新、允许列表、计量连接这些路径继续只调用一次 `checkForUpdates(...)`，不改成它们负责重启循环。
- `updatesCheckDelayer.cancel()` 仍在 `eventuallyCheckForUpdates` 开头。任务已经在跑时 `completionPromise` 已被清掉，`finally` 里再进入这个方法不会取消正在跑的这一轮。

要动的符号或文件：

- `ExtensionsWorkbenchService.eventuallyCheckForUpdates`：`try { if (enabled) await this.checkForUpdates(); } finally { this.eventuallyCheckForUpdates(); }`。源码里保留独立的一行 `await this.checkForUpdates();`，不要在这一行上加 `.catch`。

明确不改什么：

- 不改 `getUpdatesCheckInterval`、`UpdatesCheckInterval`，也不改 `checkForUpdates` 内部的 gallery 查询和 `syncInstalledExtensionsWithGallery`。
- 不改 `delayedAutoUpdateCheckTimer`。那条只在已经查出过期扩展且延迟未到时调用 `eventuallyCheckForUpdates(true)`，检查拒绝时到不了 `autoUpdateExtensions`。
- 不改 `initializeAutoUpdate` 里那一次 `eventuallyCheckForUpdates(true)` 的启动位置。

怎样本地验证：

- 保持 `src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD819.test.ts` 的 `checkForUpdates already-double leftover stays already-double`：文件中仍有 `await this.checkForUpdates();`，且该行后面不是双 catch。
- 在 `src/vs/workbench/contrib/extensions/test/electron-browser/extensionsWorkbenchService.test.ts` 新增断言：`galleryService.getExtensions` 第一次拒绝、第二次成功时，间隔触发后仍会第二次查询。`updatesCheckDelayer` 是私有字段，现有间隔是 12 小时。测试要写明是缩短间隔，还是直接调用 `eventuallyCheckForUpdates` 的回调。
- `scripts/test.sh --grep "eventuallyCheckForUpdates|checkForUpdates already-double|Checking for updates"`

### r14-4

问题类：`setDelegate` 的销毁回调只把 `_delegate` 置空，`AutoOpenBarrier` 保持打开；重叠的第二次 `setDelegate` 抛错且旧回调会无条件清掉 `_delegate`，新委托装不回去。

不变量：

- 第一次 `setDelegate` 仍 `open()` 当前屏障。`openRepository` 在屏障打开且 `_delegate` 存在时调用委托。
- 销毁回调只在 `this._delegate === delegate` 时把 `_delegate` 置空，并换成新的 `AutoOpenBarrier(10_000)`。此后 `openRepository` 重新 `wait()`，直到新的 `setDelegate` 或 10 秒自动打开；不得沿用已经 `open()` 的屏障立刻走到 `!this._delegate` 并返回 `undefined`。
- 旧委托还在时再次 `setDelegate` 仍先 `logService.error` 再抛 `BugIndicatingError`。活码注释写明一个窗口里委托只能设一次。不把还在用的委托换成另一个扩展宿主的委托。旧回调因身份不符，不得把后来在委托已清空之后装上的新委托清掉。
- 10 秒自动打开之后委托仍为空时，仍返回 `undefined` 并打现有警告。

要动的符号或文件：

- `GitService.setDelegate` 与它返回的 `toDisposable`。
- `GitService._delegateBarrier` 在上述销毁路径上改为新实例。`openRepository` 继续 `await this._delegateBarrier.wait()`。

明确不改什么：

- 不改 `MainThreadGitExtensionService._initializeDelegate` 里 `$isGitExtensionAvailable` 为 false 就不注册的判断。
- 不改 `GitRepository` 和扩展宿主的停止顺序。
- 不改 10 秒这个自动打开时间。

怎样本地验证：

- 新建 `src/vs/workbench/contrib/git/test/browser/gitService.test.ts`：`setDelegate` 后 dispose，紧接着的 `openRepository` 在新委托 `setDelegate` 之前不返回；新委托装上后返回该委托的仓库。旧委托还在时再次 `setDelegate` 仍抛 `BugIndicatingError`。dispose 之后再 `setDelegate` 成功；旧 disposable 再跑时新委托仍在。从未 `setDelegate` 时，屏障自动打开后返回 `undefined`。
- `scripts/test.sh --grep "GitService delegate|setDelegate"`

### r14-5

问题类：每次 `SearchModelImpl.search` 都 `this._register` 一个只用于首屏遥测的 `Emitter`，监听卸了，Emitter 本身留到模型销毁。

反证：`_startStreamDelay` 的 `setTimeout` 是 0ms 或 150ms，触发后 Promise 结束。字段每次搜索被重新赋值，模型不保留上一轮定时器。`onSearchProgress` 里用 `searchInstanceID` 丢掉过期回调。发现稿写的「定时器一直留到模型销毁」与这段不符。Emitter 外壳会随 `searchView.doSearch` → `viewModel.search` 的次数留在 `SearchViewModelWorkbenchService` 持有的同一个 `SearchModelImpl` 上，这一截还在。严重度由低降为提示。

不变量：

- 一次搜索的 `progressEmitter` 不进入模型的 `DisposableStore`。首屏 `Event.once` 的订阅仍在现有 `Promise.race(...).finally` 里 dispose。不要在这个 race 的 `finally` 里 `progressEmitter.dispose()`。有首屏进度时，这个 `finally` 在搜索后半段之前就跑，后面的 `progressEmitter.fire()` 会变成空操作，同一次搜索的后续进度信号会丢掉。
- Emitter 放到这一轮 `asyncResults` 结束（成功、失败或被新搜索取消）之后再 dispose。`Emitter.fire` 在 dispose 之后是空操作。
- `searchOnType` 的 150ms 与非边输边搜的 0ms 延迟保持。不取消、不改写 `_startStreamDelay`。

要动的符号或文件：

- `SearchModelImpl.search`：`progressEmitter` 改为局部变量，不 `this._register`。`event?.dispose()` 仍留在 race 的 `finally`。`progressEmitter.dispose()` 放到这一轮 `asyncResults` 的 `finally`。

明确不改什么：

- 不改 `_startStreamDelay`、`cancelSearch`、`cancelAISearch`。
- 不改 `SearchViewModelWorkbenchService` 复用同一个 `SearchModelImpl`，也不改 `searchView.ts` 的 `doSearch`。
- 不改 `searchResultsFirstRender` / `searchResultsFinished` 的打点时机。

怎样本地验证：

- 保持 `src/vs/workbench/contrib/search/test/browser/searchModel.test.ts` 的 `Search Model: Previous search is cancelled when new search is called` 和 `Search Model: Search reports timed telemetry on search when progress is called`。
- 同文件新增断言：对同一个 `SearchModelImpl` 连续 `search()` 两次，第一次的 progress `Emitter` 在第一次搜索结束之后才 dispose，不在首屏进度到达时 dispose。模型本身尚未 `dispose`。不断言延迟定时器被 `clearTimeout`。
- `scripts/test.sh --grep "Search Model:"`

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 已改：r14-1 的清空和覆盖都落在即将写回的那份地图上；待发缓存没有 uri 和 range，模型切换之后拼不出草稿；编辑器先卸模型再卸控制器。r14-2 保持 `Promises.settled` 的抛出，写回挂在现有 `!succeeded` 的 `finally` 上，字节按 `child.resource` 记录。Important 已改：r14-4 保持委托只能设一次；r14-5 在搜索结束之后再 dispose Emitter，不放进首屏 race 的 `finally`。
