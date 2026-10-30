---
title: "审查 r01：base"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；取消进行中的异步树刷新后，仍会把节点标成已刷新并画出旧子节点。"
---
# 审查 r01：base

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r01-1 中

- 症状：取消或换输入之后，进行中的刷新仍把节点标成已刷新，并按旧子节点再画一次。
- 位置：`src/vs/base/browser/ui/tree/asyncDataTree.ts` 第 1122–1174 行
- 引用：

```1122:1128:src/vs/base/browser/ui/tree/asyncDataTree.ts
	private async doRefreshSubTree(node: IAsyncDataTreeNode<TInput, T>, recursive: boolean, viewStateContext?: IAsyncDataTreeViewStateContext<TInput, T>): Promise<void> {
		const cancelablePromise = createCancelablePromise(async () => {
			const childrenToRefresh = await this.doRefreshNode(node, recursive, viewStateContext);
			node.stale = false;

			await Promises.settled(childrenToRefresh.map(child => this.doRefreshSubTree(child, recursive, viewStateContext)));
		});
```

- 为什么是问题：这个 `async` 回调不读 `createCancelablePromise` 传入的 token。`cancel()` 只拒绝外层 promise，回调在 `await` 之后继续跑。`doRefreshNode` 在第 1172–1174 行遇到 `CancellationError` 时直接 `return []`，并不调用 `setChildren`，但上面仍无条件执行 `node.stale = false`。`setInput`（第 780–784 行）先 `cancelAllRefreshPromises()` 再改 `root.element`，却不取消 `subTreeRefreshPromises`；旧的 `refreshAndRenderNode`（第 1089–1093 行）会在新刷新开始前 `render`。节点身份已经换成新输入，子节点仍是上一轮的，且 `stale === false`，树把旧子节点画成当前结果。`cancelAllRefreshPromises(true)` 取消子树 promise 时同样挡不住这次 `setChildren`。
- 方向：刷新回调在每次 `await` 之后认 token 和当前输入身份，取消或身份已变就不要清 `stale`、不要 `setChildren`、不要 `render`。

## r01-2 中

- 症状：异步查找提前返回后，界面一直认为查找还在进行，不再画出查找结果。
- 位置：`src/vs/base/browser/ui/tree/asyncDataTree.ts` 第 348–381 行
- 引用：

```348:356:src/vs/base/browser/ui/tree/asyncDataTree.ts
		this.asyncWorkInProgress = true;
		this.activeFindMetadata = undefined;

		const findMetadata = await this.findProvider.find(pattern, { matchType: this.matchType, findMode: this.mode }, token);
		if (token.isCancellationRequested || findMetadata === undefined) {
			return;
		}

		this.asyncWorkInProgress = false;
```

- 为什么是问题：`asyncWorkInProgress` 只在成功路径上被设回 `false`。`find` 返回 `undefined`、抛错，或在 `await` 之后因取消走进这个 `return` 时，标志保持 `true`。`render()`（第 379–381 行）看到该标志就直接返回，既不更新 “无匹配”，也不提示结果。取消通常会再排一次 `applyPattern`，后续成功的那次能把标志清掉；最后一次查找若停在这条提前返回上，标志不会再被清掉。
- 方向：离开 `applyPatternAsync` 时在 `finally` 里按这一轮是否仍是当前查找来清 `asyncWorkInProgress`。

## r01-3 中

- 症状：在迭代开始前取消 `CancelableAsyncIterableProducer`，消费方会得到正常结束，而不是取消错误。
- 位置：`src/vs/base/common/async.ts` 第 2277–2292 行
- 引用：

```2277:2292:src/vs/base/common/async.ts
	return new CancelableAsyncIterableProducer<T>(source, async (emitter) => {
		const subscription = source.token.onCancellationRequested(() => {
			subscription.dispose();
			source.dispose();
			emitter.reject(new CancellationError());
		});
		try {
			for await (const item of innerIterable) {
				if (source.token.isCancellationRequested) {
					// canceled in the meantime
					return;
				}
				emitter.emitOne(item);
			}
			subscription.dispose();
			source.dispose();
```

- 为什么是问题：`cancel()` 若发生在执行器订阅之前，token 已经是取消态，`onCancellationRequested` 走 `shortcutEvent`，监听要到下一轮 timer 才跑。空迭代不会进入循环，随即 `subscription.dispose()` 清掉这个 timer，`reject` 不会发生，执行器正常返回。构造函数（第 2482–2485 行）在 `await` 之后调用 `_finishOk()`，消费方看到的是成功结束。迭代能立刻产出一项时，循环里的 `return` 同样不 `reject`；`_finishOk()` 先写成完成，之后才触发的 `reject` 因已有 final value 被忽略。
- 方向：发现已取消时用 `CancellationError` 结束 producer，并且不要在 reject 落地前调用 `_finishOk()`。

## r01-4 中

- 症状：同时要两页时，较后的页会另起一次迭代，页缓存和迭代器游标会错位。
- 位置：`src/vs/base/common/paging.ts` 第 241–273 行
- 引用：

```241:273:src/vs/base/common/paging.ts
		let promise: Promise<void> | undefined;
		for (const [pendingPageIndex, pendingPromise] of this.pendingRequests) {
			if (pendingPageIndex >= pageIndex) {
				promise = pendingPromise;
				break;
			}
		}

		if (!promise) {
			promise = this.loadPagesUntil(pageIndex, cancellationToken);
			this.pendingRequests.set(pageIndex, promise);
		}
		try {
			await promise;
			if (pageIndex >= this.cachedPages.length) {
				throw new Error(`Page ${pageIndex} is out of bounds. Total pages: ${this.cachedPages.length}`);
			}
			return this.cachedPages[pageIndex];
		} finally {
			this.pendingRequests.delete(pageIndex);
		}
	}

	private async loadPagesUntil(targetPageIndex: number, cancellationToken: CancellationToken): Promise<void> {
		while (targetPageIndex >= this.cachedPages.length && this.currentIterator.hasNextPage) {
			if (cancellationToken.isCancellationRequested) {
				throw new CancellationError();
			}

			this.currentIterator = await this.currentIterator.getNextPage(cancellationToken);
			this.cachedPages.push([...this.currentIterator.elements]);
		}
```

- 为什么是问题：进行中的加载只有在它的目标页号大于等于本次页号时才会被接上。已有第 5 页的加载时，第 7 页不会等它，而是再调用 `loadPagesUntil`。两条循环共用 `this.currentIterator`，都会 `getNextPage` 再 `push`。同一页会被推进缓存两次，或游标被提前拨过，随后 `getPage(n)` 返回的不是第 n 页。`await` 之后也没有再看取消标记，取消前已经取到的页仍会留在缓存里。
- 方向：同一时刻只允许一条顺序的 `loadPagesUntil` 推进 `currentIterator`，更高页等它结束再接着取。

## r01-5 中

- 症状：`fdatasync` 失败时，写文件调用仍会以成功结束。
- 位置：`src/vs/base/node/pfs.ts` 第 426–437 行
- 引用：

```426:437:src/vs/base/node/pfs.ts
			fs.fdatasync(fd, (syncError: Error | null) => {

				// In some exotic setups it is well possible that node fails to sync
				// In that case we disable flushing and warn to the console
				if (syncError) {
					console.warn('[node.js fs] fdatasync is now disabled for this session because it failed: ', syncError);
					configureFlushOnWrite(false);
				}

				return fs.close(fd, closeError => callback(closeError));
			});
```

- 为什么是问题：`doWriteFileAndFlush` 的约定是写入并刷到盘上。`fdatasync` 失败只打日志并关掉以后的 flush，回调收到的是 `fs.close` 的错误。关闭成功时 `callback(null)`，`Promises.writeFile`（第 385 行）据此 `resolve()`。调用方认为这次数据已经落盘，崩溃后这次写入仍可能只留在系统缓存里。
- 方向：`fdatasync` 失败时把该错误传给回调，不要在同一次调用上报成功。
