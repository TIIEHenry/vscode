---
title: "方案 r01：base"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "3 hold 已实施，2 weaken 维持现状；树刷新与分页按调用方取消，可取消迭代以取消结束，查找标志归当前轮，fdatasync 失败仍按降级成功。"
---

## 核查

- r01-1 hold：`doRefreshSubTree` 仍忽略取消令牌，子节点获取被取消后仍执行 `node.stale = false`，`refreshAndRenderNode` 会在新刷新前 `render` 旧子节点。
- r01-2 weaken：提前返回时 `asyncWorkInProgress` 确实保持 true，但 `render()` 同时因 `activeFindMetadata` 已是 `undefined` 而返回，只清标志不会把结果画出来。
- r01-3 hold：迭代开始前 `cancel()` 仍只登记 `shortcutEvent` 的下一轮 timer；空迭代会清掉 timer 后正常结束，立刻有一项时 `return` 不 `reject`，`_finishOk` 先落地。
- r01-4 hold：已有较低页的加载时，较高页的 `pendingPageIndex >= pageIndex` 不成立，仍会再进 `loadPagesUntil`，两条循环共用 `currentIterator`。
- r01-5 weaken：`fdatasync` 失败后 `callback(closeError)` 仍会在关闭成功时结束成功，但这段和 `writeFileSync` 写明这是会话内关掉 flush 的退路。

## r01-1 hold

- 问题类：取消或换输入之后，进行中的刷新仍把节点标成已刷新，并按旧子节点再画一次。
- 不变量：一次刷新发布的 `stale`、子节点和 `render` 只属于它开始时的输入身份，并且只在这次令牌仍有效时发布。身份已经换成新输入，或令牌已取消，旧的子节点列表就不能写成当前结果。新的 `_updateChildren` 在旧刷新结算之后发布当前输入的子节点。
- 要动的符号或文件：
  - `AsyncDataTree.doRefreshSubTree`：把 `createCancelablePromise` 传入的 token 交给回调。开始时记下 `this.root.element` 和 `node.element`。`await this.doRefreshNode` 之后，令牌已取消或这两个身份有一个变了，就返回，不要执行 `node.stale = false`，也不要 `Promises.settled` 那些子刷新。
  - `AsyncDataTree.doRefreshNode`：在 `await childrenPromise` 之后、`setChildren` 之前做同一判断。`CancellationError` 分支继续返回 `[]`，调用方不能据此把节点当成已刷新。
  - `AsyncDataTree.refreshAndRenderNode`：刷新结算后，令牌已取消或输入身份已变，就返回，不要 `render`。
  - `AsyncDataTree._updateChildren` 和 `AsyncDataTree.expand`：等待的屏障改成「这一轮 `refreshAndRenderNode` 已经结束」，结束包括画完和明确放弃。放弃时不调用 `render`，因此不再把 `_onDidRender` 当作唯一唤醒。现在 `root.refreshPromise` 在 `render` 之前就 resolve，`_updateChildren` 先醒来并订阅 `_onDidRender`，旧的 `refreshAndRenderNode` 随后才 `render`。跳过这次 `render` 时，已经订阅的等待者要被放开，然后开始当前输入的刷新。
  - `refreshNode` 用来避开相交子树的，仍是 `subTreeRefreshPromises` 里的数据刷新 promise。包含 `render` 决定的外层 promise 不要放进这个 map，否则 `refreshNode` 会等到自己。
- 不改：
  - `createCancelablePromise` 的实现。树的回调自己认 token。
  - 折叠节点把 `stale` 设为 true 并 `setChildren(node, [])` 的路径（`refreshNode` 里 `treeNode.collapsed` 分支）。
  - 树已 dispose 时 `refreshAndRenderNode` 的两个提前返回。
  - `getChildren` 同步返回可迭代对象时，`setChildren` 在同一次调用里完成。
- 本地验证：`src/vs/base/test/browser/ui/tree/asyncDataTree.test.ts` 没有「`getChildren` 未完成时 `setInput`」的测试。`issue #199264 - dispose during render` 是等第一次 `setInput` 结束后再调第二次。应新增断言：根的 `getChildren` 仍挂起时 `setInput` 换成新输入；被取消的那次结算后，列表行不是上一输入的子节点，节点也不是 `stale === false` 的旧子列表；`setInput` 的 promise 在新输入的子节点画上之后完成。

## r01-2 weaken

- 问题类：`find` 返回 `undefined`、抛错，或 await 之后因取消提前返回时，`asyncWorkInProgress` 保持 true。
- 不变量：`asyncWorkInProgress` 只在这一轮 `find` 尚未结束、且 `activeTokenSource` 仍是这一轮时为 true。这一轮结束后标志为 false。当前轮次被新的 `applyPattern` 替换后，旧轮次不能把标志清掉，也不能写回自己的 metadata。
- 要动的符号或文件：
  - `AsyncFindController.applyPatternAsync`：进入 `find` 之前留下当时的 `activeFindMetadata`。`await this.findProvider.find` 之后，无论返回 `undefined`、抛错，还是令牌已取消，都在这一轮收尾时处理标志。只有 `activeTokenSource` 仍是这一轮时，才把 `asyncWorkInProgress` 设为 false，并恢复进入本次 `find` 之前的 metadata。
  - 仍是当前轮次且 `find` 抛错时，恢复 metadata 并清标志，再把错误传出。`taskQueue.trigger` 现在没有接住这个 rejection。
- 不改：
  - 成功路径上先写入新的 `activeFindMetadata`，再 `filter.reset()` 和 `super.applyPattern(pattern)`。
  - await 尚未结束且仍是当前令牌时，标志保持 true。
  - 空 pattern 里 `deactivateFindSession` 之后把标志设为 false 的顺序。
  - `render()` 的条件 `asyncWorkInProgress || !this.activeFindMetadata`。反证：`asyncWorkInProgress` 只在这里被读；349 行在 await 之前已经把 metadata 清掉；356–357 行只在成功时同时清标志并写入 metadata。提前返回后即使标志为 false，`render()` 仍会因为没有 metadata 而返回。`applyPattern` 取消令牌后总会 `taskQueue.trigger` 下一轮。空 pattern 在 `deactivateFindSession` 之后会把标志设回 false。
- 本地验证：`src/vs/base/test` 没有 `AsyncFindController` 或 `IAsyncFindProvider` 的测试。应新增断言：`find` 返回 `undefined` 且没有下一次 `applyPattern` 时，标志为 false，metadata 仍是进入这次 `find` 之前的值。`find` 抛错时同样，并且错误向外传出。旧轮次的收尾发生在新 `applyPattern` 已经换过 `activeTokenSource` 之后时，标志和 metadata 保持新轮次的值。

## r01-3 hold

- 问题类：迭代开始前取消 `CancelableAsyncIterableProducer`，消费方得到正常结束。
- 不变量：`cancel()` 之后，生产者以 `CancellationError` 结束。正常的 done 不能先写成最终值。已经有最终值时，后到的 `reject` 继续被忽略。
- 要动的符号或文件：
  - `createCancelableAsyncIterableProducer` 的执行器：订阅 `onCancellationRequested` 之后，先看 `source.token.isCancellationRequested`。已经取消就 `emitter.reject(new CancellationError())` 并返回。循环里现有的 `isCancellationRequested` 分支同样 `reject` 再返回，不要只 `return`。这两条路径都 `dispose` 订阅和 `source`，避免 `shortcutEvent` 的 timer 随后再 `reject`。
  - `AsyncIterableProducer` 构造函数里 `await p` 之后的 `_finishOk()`：执行器已经 `reject` 时，`hasFinalValue` 为真，保持跳过 `_finishOk()`。
- 不改：
  - `shortcutEvent` 和 `MutableToken.onCancellationRequested`。取消之后才登记的监听仍在下一轮 timer 触发。
  - `_finishError` 在已有最终值时直接返回。
  - 执行器在订阅之后才取消、并且 `onCancellationRequested` 同步 `reject` 的路径。
- 本地验证：`src/vs/base/test/common/async.test.ts` 的 `AsyncIterableProducer` 套件没有可取消生产者的测试。应新增断言：`createCancelableAsyncIterableProducer` 返回后立刻 `cancel()`，内部迭代为空时，`for await` 抛 `CancellationError`，而不是正常结束。内部迭代立刻产出一项时同样抛 `CancellationError`，该项不作为正常迭代的值交给消费方。

## r01-4 hold

- 问题类：同时要两页时，较后的页另起一次 `loadPagesUntil`，页缓存和 `currentIterator` 错位。
- 不变量：`PageIteratorPager` 的 `currentIterator` 和 `cachedPages` 只由一条顺序加载推进。`cachedPages[n]` 是第 n 页。较高页先等已经在跑的加载结束，再从同一个游标继续取。一个调用方取消，不能让另一条循环同时 `getNextPage`。
- 要动的符号或文件：
  - `PageIteratorPager.getPage`：去掉「只有 `pendingPageIndex >= pageIndex` 才接上」之后另起 `loadPagesUntil` 的分支。进行中的加载只有一条；请求的页还没进 `cachedPages` 时，先等这条加载结束，再由同一条链补到目标页。
  - `PageIteratorPager.loadPagesUntil`：循环里继续在 `getNextPage` 之前看取消标记。`getNextPage` 成功返回后，先把返回值赋给 `currentIterator` 并 `push` 进 `cachedPages`，然后再停止后续页。`finally` 里按调用方页号 `delete` 的写法要换成这条共享链的所有权：接入者结束时不能把仍在为别人加载的 promise 删掉。
  - 取消令牌归属：共享链不能直接使用第一个调用方的 token，否则第二个调用方取消会中断第一个。共享链使用一个中性 token（只在 `PageIteratorPager` 自身 dispose 时取消）；每个调用方的 token 只控制它自己的等待：调用方取消时从 waiter 集合里 detach 并抛 `CancellationError`，不取消共享链，也不删除仍被其他 waiter 使用的 promise。共享链没有 waiter 后再停止取下一页。
- 不改：
  - 页已经在 `cachedPages` 里时直接返回。
  - `isComplete` 之后越界仍抛出现有的 out of bounds 错误。
  - `getNextPage` 已经成功返回的那一页要留在缓存里。丢掉它会让游标前进、缓存缺页，页号继续错位。取消只停止再取下一页。
  - `IterativePagedModel.loadNextPage` 自己的 `loadingPromise` 单飞。
- 本地验证：`src/vs/base/test/common/paging.test.ts` 没有 `PageIteratorPager` 的测试。应新增断言：`getPage(1)` 的 `getNextPage` 尚未返回时再调用 `getPage(3)`，`getNextPage` 的重叠次数为 0，两次都返回后 `cachedPages[1]` 与 `cachedPages[3]` 分别是第 1 页和第 3 页。先请求较高页、再请求较低页时，较低页仍从同一次顺序加载的缓存里返回。另加断言：两个调用方共用同一条加载时，第一个调用方取消只让它自己 reject，第二个调用方仍拿到目标页，`getNextPage` 不重叠；两个都取消后共享链停止，不再取下一页。

## r01-5 weaken

- 问题类：`fdatasync` 失败时，这次 `writeFile` 仍会成功结束。
- 不变量：`write()` 已经完成的字节保持已写入。这次 `fdatasync` 失败后，进程把后续 flush 关掉，fd 仍要关闭。调用结果与现在一样，由 `fs.close` 的错误决定；关闭成功就是成功。
- 要动的符号或文件：
  - 无。
- 不改：
  - `doWriteFileAndFlush` 里 `syncError` 分支：`console.warn`、`configureFlushOnWrite(false)`，然后 `fs.close(fd, closeError => callback(closeError))`。反证：430–431 行写明 exotic 环境里 node 无法 sync 时，这次会话关掉 flushing 并警告。`writeFileSync` 466–474 行对 `fdatasyncSync` 做同一件事，catch 之后不抛，`finally` 里 `closeSync`，函数正常返回。把 `syncError` 传给这次回调会让已经写完的调用失败，和这条退路相反。
  - `writeFile` 在 callback 收到 null 时 `resolve()`。
  - `configureFlushOnWrite(false)` 之后走 `fs.writeFile` 的路径。
- 本地验证：不新增「`fdatasync` 失败必须 reject」的断言。`src/vs/base/test/node/pfs/pfs.test.ts` 的 `writeFile (string) - flush on write` 继续覆盖 flush 开启时写入的内容可以读回。

## 落地

- 2026-10-25 实施 r01-1：`doRefreshSubTree` 的 cancelable promise 接住令牌，`doRefreshNode` 透传；取消或根 / 节点元素已换时不再 `node.stale = false`。`refreshAndRenderNode` 记录整轮 `refreshAndRenderPromise`，`render` 前再核对元素身份，`reveal` / `expand` 等调用方等整轮而不是等一个可能不发生的 render 事件。
- 2026-10-25 实施 r01-2：`AsyncFindController` 在 `find` 抛错时只在仍是当前令牌时清 `asyncWorkInProgress` 并恢复上一份 metadata；`find` 返回 `undefined` 或令牌已换时同样不留下 true。
- 2026-10-25 实施 r01-3：`createCancelableAsyncIterableProducer` 在开始迭代前或 await 期间发现取消，改为 `reject(new CancellationError())`，不再以正常结束返回。
- 2026-10-25 实施 r01-4：`PageIteratorPager` 改为共享顺序加载。调用方只登记 waiter；单个调用方取消只 reject 自己，不取消共享链；共享链只在自身 dispose 时取消，没有 waiter 后停止；已取回的页留在缓存里。
- r01-5 维持现状：`fdatasync` 失败仍关掉 flushing、关闭 fd 并按 `fs.close` 结果结束，不新增 reject 断言。
- 验证：`asyncDataTree.test.ts`、`async.test.ts`、`paging.test.ts` 合计 173 passing（2 pending）；`pfs.test.ts` 32 passing。
- 既有失败：无。
