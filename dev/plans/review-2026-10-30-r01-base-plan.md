---
title: "十六路审查 r01：base 方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "hold 2，weaken 3。"
---

# 十六路审查 r01：base 方案
状态：草案。
覆盖需求：无（正文未引用需求编号）。

只改发现稿里仍然成立的行为。不改发现稿，不改生产代码。

| 编号 | 判定 | 严重度 |
|:-----|:-----|:-------|
| r01-1 | weaken | 中 |
| r01-2 | weaken | 低 |
| r01-3 | hold | 中 |
| r01-4 | hold | 中 |
| r01-5 | weaken | 低 |

### r01-1

- 问题类：`IndexedDB.getKeyValues` 在游标或事务出错时，用当时已经放进 Map 的条目把 Promise 成功 resolve。
- 不变量：这次读失败或事务被中止时，Promise 必须拒绝。调用方不能把半截 Map 当成完整快照。`isValid` 判为非法的值仍然跳过，这不是失败。
- 要动的符号或文件：`src/vs/base/browser/indexedDB.ts` 的 `IndexedDB.getKeyValues`。`onError` 现在调用 `resolve(items)`，Promise 构造器也只有 `resolve`。改成拒绝，并带上这次的错误。同文件的 `runInTransaction` 已经在 `transaction.onerror` 和 `transaction.onabort` 上拒绝；`getKeyValues` 没有 `onabort`。错误和中止都要拒绝，避免 `close()` 里的 `transaction.abort()` 要么仍 resolve 半截 Map，要么没有处理函数而一直挂着。
- 明确不改什么：不改 `runInTransaction` 和 `compareAndSwap` 的拒绝路径。不改 `Storage.doInit`、`flushPending`，也不让 `IndexedDBStorageDatabase.close` 按内存 cache 整表回写。
- 反证与降级后的严重度：原严重度是高，降为中。半截成功是活码：`getKeyValues` 的错误处理调用 `resolve(items)`。发现稿说「若按这份 Map 回写，未读到的键会被丢掉」。读到的存储路径不是这样。`Storage.doInit` 把 `getItems()` 放进内存 cache；`flushPending` 只提交 `pendingInserts` 和 `pendingDeletes`。`Storage.doClose` 把 cache 当作 recovery 回调传给 `database.close`，但 `IndexedDBStorageDatabase.close` 不接收这个回调，只等待进行中的更新再调用 `IndexedDB.close()`。未读到的键不会因此从 IndexedDB 删掉。实际后果是这一次会话把半截结果当成全量。
- 怎样本地验证：已有 `src/vs/base/test/browser/indexedDB.test.ts` 的 `getKeyValues` 和 `close`。`close` 目前只断言 `runInTransaction` 在 `close()` 后拒绝。应新增断言：游标或事务失败，以及 `getKeyValues` 尚未完成时调用 `close()`，返回的 Promise 拒绝，并且不会以部分 Map 成功结束。用 `scripts/test.sh --grep getKeyValues` 跑这条，连同现有 `close`。

### r01-2

- 问题类：已有任务在执行时再 `queue`，被合并的后一个任务一旦拒绝，调用方拿到的 Promise 不结束，中间那次拒绝也没有人接。
- 不变量：`Throttler.queue` 返回的 Promise 必须在它所等待的那次任务拒绝时拒绝。多个等待者仍共享同一次合并结果，仍然只跑最后排入的 factory。
- 要动的符号或文件：`src/vs/base/common/async.ts` 的 `Throttler.queue`。`queuedPromise` 用 `new Promise(resolve => { this.activePromise!.then(onComplete, onComplete).then(resolve); })` 包住后续任务。`onComplete` 返回的是下一次 `queue()` 的 Promise；它拒绝时，这里没有 `reject`，外层 Promise 不会结束。给这条链接上 `reject`。
- 明确不改什么：不改「最后一次 factory 才执行」的合并。不改 `dispose()` 之后已排队调用以成功结束、且第二个 factory 不再执行。`onComplete` 在 token 已取消时直接 `return`，因此这次完成的值仍是 `undefined`。
- 反证与降级后的严重度：原严重度是中，降为低。任务拒绝导致排队 Promise 挂起，这一点仍在。发现稿后半句「销毁时则变成成功的 `undefined`」是当前契约，不是缺陷。`src/vs/base/test/common/async.test.ts` 的 `disposal after queueing` 在两次 `queue` 之后 `dispose()`，再用 `Promise.all` 等待，并断言 factory 只调用一次。`Promise.all` 成功要求这两个 Promise 都 fulfill。`disposal before queueing` 才要求拒绝，错误文案是 `Throttler is disposed`。活跃任务自己的 Promise 已经有 `reject`，挂起只发生在合并后的等待者身上。
- 怎样本地验证：保留 `non async`、`async`、`last factory should be the one getting called`、`disposal after queueing`、`disposal before queueing`。应新增断言：第一个任务还没结束时，第二次 `queue` 的 factory 返回拒绝的 Promise，第二次 `queue()` 的 Promise 以同一次错误拒绝，测试自己接住这次拒绝。用 `scripts/test.sh --grep Throttler`。

### r01-3

- 问题类：`IterativePagedModel` 把同一页的共享加载绑在第一个调用方的 `CancellationToken` 上；该 token 取消后，后加入且 token 仍有效的调用方一起失败，这一页也不会进入 `items`。
- 不变量：进行中的 `getNextPage` 不随单个调用方取消而失败。token 仍有效的调用方必须拿到这一页，页数据要追加进 `items`。调用在 `loadNextPage` 之前就已经取消的，仍拒绝。
- 要动的符号或文件：`src/vs/base/common/paging.ts` 的 `IterativePagedModel.loadNextPage` 和 `resolve`。现在是 `this.pager.getNextPage(cancellationToken)`，后续调用只 `await this.loadingPromise`。共享请求改用模型自己持有的 token，单个 `resolve` 的 token 不再传给这次 `getNextPage`。同文件 `PageIteratorPager` 已经这样：`loadCancellation` 的注释写明只在 pager 消失时取消，不由单个调用方取消。
- 明确不改什么：不改「并发打到同一个哨兵只加载一次」。不改 `PagedList` / `src/vs/base/browser/ui/list/listPaging.ts` 的渲染协议。不改 `resolve` 开头对「调用前已取消」的拒绝。不改 `PageIteratorPager`。
- 怎样本地验证：已有 `src/vs/base/test/common/iterativePaging.test.ts` 的 `concurrent access to sentinel only loads once` 和 `cancelled token during initial resolve`。后者只覆盖调用前就已取消。应新增断言：两个 `resolve` 等待同一哨兵；共享的 `getNextPage` 使用模型自己的 token，不随先发起的调用方取消而拒绝。先发起的 token 取消后，后一个 token 仍有效的 `resolve` 成功，`items` 含这一页。不要写成「`getNextPage` 在 token 取消时拒绝」和「后一个 `resolve` 成功」出现在同一次共享加载里。用 `scripts/test.sh --grep IterativePagedModel`。

### r01-4

- 问题类：`write()` 因 `highWaterMark` 把数据放进缓冲并返回未完成的 Promise 之后，`destroy()` 清空缓冲和 `pendingWritePromises`，既不 resolve 也不 reject。
- 不变量：`destroy()` 之后，此前因背压挂起的 `write` Promise 必须拒绝。被清掉的缓冲不再交给 `flowData` 消费。`destroy()` 之后新的 `write()` 仍直接返回。
- 要动的符号或文件：`src/vs/base/common/stream.ts` 的 `WriteableStreamImpl.destroy` 和 `pendingWritePromises`。这些 Promise 目前只在 `flowData` 里被 resolve。`destroy` 要把尚未完成的写 Promise 全部 reject，再清空列表和 `buffer.data`。
- 明确不改什么：不改流动模式下 `write` 直接 `emitData` 的路径。不改 `flowData` 在正常排空时 resolve 等待者。不把 `destroy()` 后的新 `write()` 改成拒绝。
- 怎样本地验证：已有 `src/vs/base/test/common/stream.test.ts` 的 `WriteableStream - highWaterMark`。应新增断言：`highWaterMark` 已经让 `write` 返回 Promise、该 Promise 尚未完成时调用 `destroy()`，这个 Promise 拒绝；之后即使有人 `resume`，被销毁的缓冲也不会再作为 `data` 送出。用 `scripts/test.sh --grep highWaterMark`。

### r01-5

- 问题类：`AsyncFindController` 销毁时不停 `taskQueue`；`endSession` 放在 async 的 `toDisposable` 里，同步 `dispose` 不会等它，销毁后的防抖回调还能再跑一次收尾。
- 不变量：`dispose()` 返回之后不得再进入 `applyPatternAsync`，不得再对树 `refilter`，也不得再调用第二次 `endSession`。
- 要动的符号或文件：`src/vs/base/browser/ui/tree/asyncDataTree.ts` 的 `AsyncFindController`。增加 `dispose` 覆盖：先 `super.dispose()`，再 `activeTokenSource.cancel()`，再 `taskQueue.dispose()`。顺序不能反。`FindWidget.dispose` 会同步触发 `onDidDisable`，`AbstractFindController.close` 接着 `onDidChangeValue('')`，那次 `applyPattern` 会取消旧 token、新建 token，并再次 `taskQueue.trigger`。队列必须在这次重新触发之后再 dispose，定时器才会被取消。这次 `trigger` 返回的 promise 要接住随后 `dispose` 产生的 `CancellationError`。`endSession` 不要再写成 `toDisposable(async () => { await ... })`。`FunctionDisposable.dispose` 只调用 `_fn()`。若仍要在销毁时调用 `endSession`，在同步路径里调用一次，并把 `activeSession` 置为 false，避免随后的空 pattern 回调再调用。
- 明确不改什么：不把 `IDisposable.dispose` 改成 async，也不让 `AsyncDataTree.dispose` 等待 `endSession`。不改 `ThrottledDelayer`。不改 `FindController.applyPattern` 在查找框仍打开时的 `refilter`。用户关掉查找框、控制器还活着时，空 pattern 仍应结束会话。
- 反证与降级后的严重度：原严重度是中，降为低。发现稿说销毁后定时器到期会用仍有效的 token 调用 `find`。`activeSession` 初始为 false，只在防抖回调进入非空 pattern 后才由 `activateFindSession` 置 true。防抖未到期时会话尚未激活，现有 `dispose` 不会调用 `find`、`refilter` 或 `endSession`。`deactivateFindSession` 和 `super.applyPattern('')` 都在 `if (this.activeSession)` 内。仍然成立的是：`activeSession` 已为 true 之后，`taskQueue` 没有在 `dispose` 里停掉；`super.dispose()` 会经 `FindWidget.dispose` → `close` → `onDidChangeValue('')` 再次 `taskQueue.trigger`，返回值被丢掉。随后 `ThrottledDelayer.dispose` 对这次 completion 做 `doReject(new CancellationError())`。这次拒绝要接住。空 pattern 回调不得在 `this.tree.dispose()` 之后再 `refilter`。`endSession` 至多一次，且只在会话已经激活时才可能发生。
- 怎样本地验证：没有覆盖 `AsyncFindController` 销毁顺序的现有测试。应新增断言：查找框打开、pattern 非空、防抖已经跑过因而 `activeSession` 为 true 时 `dispose()`。返回之后 `findProvider.find` 不被调用，`tree.refilter` 不再被这次队列调用，`endSession` 至多一次，并且 `ThrottledDelayer` 的 `CancellationError` 被接住。不要用「防抖尚未到期」当场景，那条路径今天就不会 `refilter`。测试落在 `src/vs/base` 下现有浏览器或单元测试旁边，用 `scripts/test.sh --grep` 配上新测试名。

## 审查

2026-10-30 只读审查的结论是须改稿，Critical 无。Important 已改：r01-3 不再要求同一次共享加载既因调用方取消而拒绝、又在稍后成功；r01-5 的验证改为 `activeSession` 已经为真，并接住 `super.dispose()` 再次入队后 `ThrottledDelayer.dispose` 的 `CancellationError`。
